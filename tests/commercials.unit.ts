import { test, expect } from "@playwright/test";
import { applyEndBreaks, planEndBreaks, isCommercial } from "../lib/commercialSetup";
import { buildSchedule } from "../lib/scheduler";
import { viewerCatalog } from "../lib/audience";
import { sanitizeProgrammingSnapshot } from "../lib/programmingSnapshot";
import { programming } from "./programming-fixture";
import type { Channel, MediaItem, CommercialStrategy } from "../lib/types";

const show: MediaItem = { id: "show", title: "Example", type: "show", file: "/show.mp4", duration: 120, kidsApproved: true };
const ad: MediaItem = { id: "ad", title: "Local sponsor", type: "commercial", file: "/ad.mp4", duration: 30, adChannelIds: ["station"], adPlacements: ["filler"], allowCommercialSlicing: false };
const channel: Channel = { id: "station", number: 24, name: "Station", mediaIds: ["show"], kidsApproved: true, adPolicy: { enabled: true, placements: ["filler"], allowChannelTargetedAds: true, allowGlobalAds: false } };
const now = new Date(2026, 9, 19, 12);
const adsIn = (item: MediaItem, commercial: MediaItem = ad, station: Channel = channel) => buildSchedule([item], { channel: station, now, availableAds: [commercial] }).filter(isCommercial);

test("end-only ads enter the pool without needing permission for a mid-show placement", () => {
  expect(adsIn({ ...show, slotLengthSeconds: 150, fillSlotWithCommercials: true })).toMatchObject([{ parentMediaId: "ad", duration: 30, adPlacement: "filler" }]);
  expect(adsIn({ ...show, breakpoints: [60], breakDurations: [30] })).toEqual([]);
  const mid = { ...channel, adPolicy: { ...channel.adPolicy, placements: ["mid-roll" as const] } };
  expect(adsIn({ ...show, breakpoints: [60], breakDurations: [30] }, { ...ad, adPlacements: ["mid-roll"] }, mid)).toHaveLength(1);
});

for (const strategy of ["best-fit", "sequential", "random"] as CommercialStrategy[]) {
  test(`${strategy} never cuts a whole commercial to fit a shorter break`, () => {
    const programme = { ...show, slotLengthSeconds: 135, fillSlotWithCommercials: true, commercialStrategy: strategy };
    expect(adsIn(programme)).toEqual([]);
    expect(adsIn(programme, { ...ad, allowCommercialSlicing: true })).toMatchObject([{ duration: 15, isVirtualSegment: true }]);
    expect(buildSchedule([programme], { channel, now, availableAds: [{ ...ad, duration: 45 }, { ...ad, id: "short", duration: 15 }] }).filter(isCommercial)).toMatchObject([{ parentMediaId: "short", duration: 15 }]);
  });
}

test("placement repair still enforces targets, disabled policies, categories and campaign windows", () => {
  const programme = { ...show, slotLengthSeconds: 150, fillSlotWithCommercials: true };
  for (const patch of [{ adChannelIds: [] }, { adChannelIds: ["other"] }, { adChannelIds: ["all"] }, { adDays: ["tuesday" as const] }, { adStartTime: "20:00", adEndTime: "23:00" }]) {
    expect(adsIn(programme, { ...ad, ...patch })).toEqual([]);
  }
  expect(adsIn(programme, ad, { ...channel, adPolicy: { ...channel.adPolicy, enabled: false } })).toEqual([]);
  expect(adsIn(programme, ad, { ...channel, adPolicy: { ...channel.adPolicy, allowedCategories: ["gaming"] } })).toEqual([]);
  expect(adsIn(programme, { ...ad, adChannelIds: ["all"] }, { ...channel, adPolicy: { ...channel.adPolicy, allowGlobalAds: true } })).toHaveLength(1);
});

test("safe automation is idempotent and skips custom, shared, fixed-time and invalid programmes", () => {
  const media = [show, { ...show, id: "custom", breakpoints: [60], breakDurations: [30] }, { ...show, id: "shared" }, { ...show, id: "fixed", airStartTime: "20:00" }, { ...show, id: "invalid", duration: 0 }, ad];
  const stations = [{ ...channel, mediaIds: media.filter(item => !isCommercial(item)).map(item => item.id) }, { ...channel, id: "second", programmeBlocks: [{ id: "b", title: "Shared", days: ["monday" as const], startTime: "20:00", durationMinutes: 30, mediaIds: ["shared"] }], mediaIds: [] }];
  const plan = planEndBreaks(media, stations, "station", 60);
  expect(plan.updates.map(item => item.id)).toEqual(["show"]);
  expect(plan.skipped).toHaveLength(4);
  const applied = applyEndBreaks(media, stations, "station", 60);
  expect(applied.media[0]).toMatchObject({ duration: 120, slotLengthSeconds: 180, fillSlotWithCommercials: true });
  expect(applied.media.slice(1)).toEqual(media.slice(1));
  expect(applied.channels[1]).toEqual(stations[1]);
  expect(applyEndBreaks(applied.media, applied.channels, "station", 60)).toEqual(applied);
  expect(() => planEndBreaks(media, stations, "station", 0)).toThrow();
});

test("saved commercial setup round trips and never approves an unreviewed ad for Kids", () => {
  const applied = applyEndBreaks([show, ad], [channel], "station", 60);
  const restored = sanitizeProgrammingSnapshot({ ...programming, ...applied });
  expect(restored).toBeTruthy();
  expect(restored!.media.find(item => item.id === "show")).toMatchObject({ slotLengthSeconds: 180, fillSlotWithCommercials: true });
  expect(restored!.channels[0]!.mediaIds).toEqual(["show"]);
  expect(viewerCatalog(restored!.channels, restored!.media, true).channels.map(item => item.id)).not.toContain("station");
  expect(viewerCatalog(restored!.channels, restored!.media.map(item => ({ ...item, kidsApproved: true })), true).channels.map(item => item.id)).toContain("station");
});
