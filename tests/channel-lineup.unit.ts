import { test, expect } from "@playwright/test";
import { addHalloweenChannels, moveChannelToPosition, sortChannelLineup } from "../lib/channelLineup";
import { approveReviewedKidsLineup, kidsLineupReview, viewerCatalog } from "../lib/audience";
import { couldAdvertiseOnChannel, buildSchedule } from "../lib/scheduler";
import { sanitizeProgrammingSnapshot } from "../lib/programmingSnapshot";
import { defaultChannels, useStore } from "../lib/store";
import { useDeviceLibrary } from "../lib/deviceLibrary";
import { findChannelByNumber } from "../lib/viewer";
import { programming } from "./programming-fixture";
import type { Channel, MediaItem } from "../lib/types";

const initial = useStore.getState();
const initialLibrary = useDeviceLibrary.getState();
test.afterEach(() => { useStore.setState(initial, true); useDeviceLibrary.setState(initialLibrary, true); });

function lineup(): Channel[] {
  return structuredClone(defaultChannels).map(channel => ({
    ...channel,
    mediaIds: channel.id === "3" ? [programming.media[0]!.id] : [],
    programmeBlocks: [],
  }));
}

test("moving 3 down renumbers both stations while preserving programming, favourites and the tuned station", () => {
  const channels = lineup();
  const original = channels.find(channel => channel.id === "3")!;
  original.programmeBlocks = [{ id: "friday", title: "Friday", days: ["friday"], startTime: "20:00", durationMinutes: 120, mediaIds: [...original.mediaIds] }];
  useStore.setState({ channels, media: programming.media, currentChannelId: "3" });
  useDeviceLibrary.setState({ favouriteChannels: ["3"] });
  const schedule = buildSchedule(programming.media, { channel: original, now: new Date(2026, 9, 2, 21) });
  useStore.getState().moveChannel("3", "down");
  const moved = useStore.getState().channels.find(channel => channel.id === "3")!;
  expect(moved).toEqual({ ...original, number: 4 });
  expect(useStore.getState().channels.find(channel => channel.id === "4")?.number).toBe(3);
  expect(useStore.getState().currentChannelId).toBe("3");
  expect(useDeviceLibrary.getState().favouriteChannels).toEqual(["3"]);
  expect(findChannelByNumber(useStore.getState().channels, "003")?.id).toBe("4");
  expect(buildSchedule(programming.media, { channel: moved, now: new Date(2026, 9, 2, 21) })).toEqual(schedule);
});

test("moving to any slot creates a contiguous lineup including disabled channels; invalid moves do nothing", () => {
  const channels = lineup();
  channels[0]!.isEnabled = false;
  const moved = moveChannelToPosition(channels, "23", 1);
  expect(moved.map(channel => channel.number)).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
  expect(moved[0]?.id).toBe("23");
  expect(moved[1]).toMatchObject({ id: "1", number: 2, isEnabled: false });
  expect(channels[0]?.number).toBe(1);
  for (const position of [0, -1, 24, 1.5, NaN]) expect(moveChannelToPosition(channels, "3", position)).toBe(channels);
  expect(moveChannelToPosition(channels, "unknown", 2)).toBe(channels);
  expect(moveChannelToPosition(channels, "1", 1)).toBe(channels);
});

test("cloud round trips and later settings edits preserve reordered identities, branding and adult restrictions", () => {
  useStore.setState({ channels: lineup(), media: programming.media });
  useStore.getState().addHalloweenChannels();
  useStore.getState().moveChannelTo("3", 4);
  useStore.getState().moveChannelTo("seasonal-friday-night-horror", 1);
  const before = sortChannelLineup(useStore.getState().channels);
  const snapshot = sanitizeProgrammingSnapshot(JSON.parse(JSON.stringify(useStore.getState().exportProgrammingSnapshot())))!;
  expect(snapshot).not.toBeNull();
  useStore.getState().replaceProgramming(snapshot);
  const after = sortChannelLineup(useStore.getState().channels);
  expect(after.map(channel => [channel.id, channel.number, channel.branding])).toEqual(before.map(channel => [channel.id, channel.number, channel.branding]));
  useStore.getState().updateChannelSettings("3", { scheduleMode: "daily-random" });
  expect(useStore.getState().channels.find(channel => channel.id === "3")).toMatchObject({ number: 5, branding: before.find(channel => channel.id === "3")!.branding });
  useStore.getState().updateChannelSettings("seasonal-friday-night-horror", { kidsApproved: true });
  expect(useStore.getState().channels.find(channel => channel.id === "seasonal-friday-night-horror")).toMatchObject({ number: 1, adultOnly: true, kidsApproved: false });
});

test("targeted ads follow the permanent channel, never the station that inherits its old number", () => {
  const channels = moveChannelToPosition(lineup(), "3", 4);
  const ad: MediaItem = { ...programming.media[0]!, id: "adult-ad", type: "commercial", adChannelIds: ["3"] };
  const target = { ...channels.find(channel => channel.id === "3")!, adPolicy: { enabled: true } };
  const other = { ...channels.find(channel => channel.id === "4")!, adPolicy: { enabled: true } };
  expect(couldAdvertiseOnChannel(ad, target)).toBe(true);
  expect(couldAdvertiseOnChannel(ad, other)).toBe(false);
  expect(couldAdvertiseOnChannel({ ...ad, adChannelIds: ["all"] }, other)).toBe(false);
});

test("seasonal setup is idempotent, appends unique numbers and leaves empty channels off air", () => {
  const channels = [...lineup(), { ...programming.channels[0]!, number: 80 }];
  const added = addHalloweenChannels(channels);
  expect(added.slice(0, channels.length)).toEqual(channels);
  expect(added.slice(-2).map(channel => channel.number)).toEqual([81, 82]);
  expect(addHalloweenChannels(added)).toBe(added);
  for (const channel of added.slice(-2)) expect(channel).toMatchObject({ isEnabled: false, kidsApproved: false, mediaIds: [], programmeBlocks: [], adPolicy: { enabled: false } });
  const partial = added.filter(channel => channel.id !== "seasonal-halloween-kids");
  expect(addHalloweenChannels(partial).filter(channel => channel.id === "seasonal-friday-night-horror")).toHaveLength(1);
});

test("adult channels cannot pass Kids review; children's Halloween programming needs explicit review", () => {
  const [horror, kids] = addHalloweenChannels([]);
  const media = programming.media.map(item => ({ ...item, kidsApproved: true }));
  const adult = { ...horror!, isEnabled: true, mediaIds: [media[0]!.id], kidsApproved: true };
  const adultReview = kidsLineupReview(adult, media);
  expect(adultReview.canApprove).toBe(false);
  expect(() => approveReviewedKidsLineup([adult], media, adult.id, adultReview.signature)).toThrow("Adults-only");
  const pending = { ...kids!, isEnabled: true, mediaIds: [media[1]!.id] };
  expect(viewerCatalog([adult, pending], media, true).channels.every(channel => channel.mediaIds.length === 0)).toBe(true);
  const approved = approveReviewedKidsLineup([adult, pending], media, pending.id, kidsLineupReview(pending, media).signature);
  expect(viewerCatalog(approved.channels, approved.media, true).channels.map(channel => channel.mediaIds)).toEqual([[], [media[1]!.id]]);
  expect(viewerCatalog(approved.channels, approved.media, false).channels).toEqual(approved.channels);
  const sanitized = sanitizeProgrammingSnapshot({ ...programming, channels: [adult, pending] })!;
  expect(sanitized.channels[0]).toMatchObject({ adultOnly: true, kidsApproved: false });
});

test("adding existing shows to a seasonal channel preserves their original assignment and keeps it off air", () => {
  useStore.setState({ channels: lineup(), media: programming.media });
  useStore.getState().addHalloweenChannels();
  useStore.getState().assignMediaToChannel("seasonal-halloween-kids", programming.media[0]!.id);
  expect(useStore.getState().channels.find(channel => channel.id === "3")?.mediaIds).toContain(programming.media[0]!.id);
  expect(useStore.getState().channels.find(channel => channel.id === "seasonal-halloween-kids")).toMatchObject({ mediaIds: [programming.media[0]!.id], isEnabled: false, kidsApproved: false });
});

test("adult-only programmes stay out of the Kids library unless shared with a reviewed Kids lineup", () => {
  const [horror, kids] = addHalloweenChannels([]);
  const media = programming.media.map(item => ({ ...item, kidsApproved: true }));
  const adult = { ...horror!, mediaIds: [media[0]!.id], programmeBlocks: [{ id: "scares", title: "Scares", days: ["friday" as const], startTime: "20:00", durationMinutes: 120, mediaIds: [media[1]!.id] }] };
  const kidsChannel = { ...kids!, mediaIds: [media[2]!.id], isEnabled: true, kidsApproved: true };
  expect(viewerCatalog([adult, kidsChannel], media, true).media.map(item => item.id)).toEqual([media[2]!.id]);
  const shared = { ...kidsChannel, mediaIds: [media[0]!.id, media[2]!.id] };
  expect(viewerCatalog([adult, shared], media, true).media.map(item => item.id)).toEqual([media[0]!.id, media[2]!.id]);
  expect(viewerCatalog([adult, shared], media, false).media).toEqual(media);
});
