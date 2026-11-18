import { test, expect } from "@playwright/test";
import { buildRokuCatalog, rokuPlayback, rokuSchedule } from "../lib/rokuCatalog";
import { rokuClock } from "../lib/rokuClock";
import { buildSchedule } from "../lib/scheduler";
import { getLiveState, getScheduleDuration } from "../lib/liveEngine";
import { createBroadcastDayAnchor, getMediaForChannel } from "../lib/viewer";
import { programming } from "./programming-fixture";
import type { ProgrammingSnapshot } from "../lib/programmingSnapshot";

function dailyStation(): ProgrammingSnapshot {
  const data = structuredClone(programming);
  data.media = Array.from({ length: 6 }, (_, index) => ({
    id: `episode-${index}`, title: `Episode ${index}`, type: "show",
    duration: 60 + index * 5, file: `https://media.example/episode-${index}.mp4`,
    breakpoints: [30], breakDurations: [15], kidsApproved: true,
  }));
  data.channels = [{ ...data.channels[0]!, mediaIds: data.media.map(item => item.id),
    scheduleMode: "daily-random", randomSeed: "channel-1", kidsApproved: true,
    adPolicy: { enabled: true, placements: ["mid-roll"] },
  }];
  data.media.push({ id: "station-ad", title: "Station commercial", type: "commercial",
    duration: 15, file: "https://media.example/ad.mp4", kidsApproved: true,
    adChannelIds: [data.channels[0]!.id], adPlacements: ["mid-roll"],
  });
  return data;
}

// These are browser-local midnights expressed as instants. They deliberately
// differ from UTC midnight, including the two daylight-saving transition days.
const cases = [
  ["America/Regina", "2026-11-18T05:27:59Z", "2026-11-17T06:00:00.000Z"],
  ["Canada/Mountain", "2026-01-18T06:30:00Z", "2026-01-17T07:00:00.000Z"],
  ["Canada/Newfoundland", "2026-11-18T03:00:00Z", "2026-11-17T03:30:00.000Z"],
  ["Pacific/Auckland", "2026-11-18T12:30:00Z", "2026-11-18T11:00:00.000Z"],
  ["Canada/Eastern", "2026-03-08T18:00:00Z", "2026-03-08T05:00:00.000Z"],
  ["Canada/Eastern", "2026-11-01T19:00:00Z", "2026-11-01T04:00:00.000Z"],
] as const;

for (const [zone, iso, expectedMidnight] of cases) {
  test(`website and Roku share the broadcast day in ${zone} at ${iso}`, () => {
    const data = dailyStation();
    const channel = data.channels[0]!;
    const clock = rokuClock(zone, new Date(iso))!;
    const day = rokuClock(zone, new Date(expectedMidnight))!;
    const anchor = createBroadcastDayAnchor(clock);
    expect(anchor.toISOString()).toBe(expectedMidnight);
    expect(anchor.getHours()).toBe(0);
    expect(clock.toISOString()).toBe(new Date(iso).toISOString());
    const website = buildSchedule(getMediaForChannel(channel,
      new Map(data.media.map(item => [item.id, item]))), {
      channel, now: day, availableAds: data.media.filter(item => item.type === "commercial"),
    });
    expect(rokuSchedule(channel, data.media, clock)).toEqual(website);
    const live = getLiveState(website, clock.getTime());
    const playback = rokuPlayback(data, "all", `channel:${channel.id}`, clock)!;
    expect(playback.url).toBe(live.item!.file);
    expect(playback.start).toBe(live.sourceElapsed);
    expect(playback.remaining).toBe(live.remaining);
    // Scheduling uses midnight; response timestamps and playback remain live.
    expect(playback.generatedAt).toBe(clock.toISOString());
    expect(buildRokuCatalog(data, "all", clock).channels[0]!.now)
      .toBe(live.item!.sourceTitle || live.item!.title);
  });
}

test("daily shuffle changes at local midnight, not UTC midnight", () => {
  const data = dailyStation();
  const schedule = (iso: string) => rokuSchedule(data.channels[0]!, data.media,
    rokuClock("America/Regina", new Date(iso))!);
  expect(schedule("2026-11-17T23:59:59Z")).toEqual(schedule("2026-11-18T00:00:00Z"));
  expect(schedule("2026-11-18T05:59:59Z")).toEqual(schedule("2026-11-18T00:00:00Z"));
  expect(schedule("2026-11-18T06:00:00Z")).not.toEqual(schedule("2026-11-18T05:59:59Z"));
});

test("Roku joins the same commercial and resumes the same episode after UTC midnight", () => {
  const data = dailyStation();
  const channel = data.channels[0]!;
  const day = rokuClock("America/Regina", new Date("2026-11-17T06:00:00Z"))!;
  const website = buildSchedule(getMediaForChannel(channel,
    new Map(data.media.map(item => [item.id, item]))), { channel, now: day,
    availableAds: data.media.filter(item => item.type === "commercial") });
  const adIndex = website.findIndex(item => item.type === "commercial");
  expect(adIndex).toBeGreaterThan(0);
  const adOffset = website.slice(0, adIndex).reduce((sum, item) => sum + item.duration, 0);
  const start = new Date("2026-11-18T01:00:00Z").getTime();
  const offset = getLiveState(website, start).offsetInLoop;
  const duration = getScheduleDuration(website);
  const adStart = start + ((adOffset - offset + duration) % duration) * 1000;
  for (const seconds of [-1, 0, 1, 14, 15, 16]) {
    const instant = adStart + seconds * 1000;
    const live = getLiveState(website, instant);
    const playback = rokuPlayback(data, "all", `channel:${channel.id}`,
      rokuClock("America/Regina", new Date(instant))!)!;
    expect(playback.url, `boundary ${seconds}`).toBe(live.item!.file);
    expect(playback.start).toBe(live.sourceElapsed);
    expect(playback.end - playback.start).toBe(live.remaining);
  }
});
