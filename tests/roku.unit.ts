import { test, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { buildRokuCatalog, rokuLineup, rokuPlayback, rokuStream } from "../lib/rokuCatalog";
import { BROADCAST_EPOCH_MS, getLiveState } from "../lib/liveEngine";
import { buildSchedule } from "../lib/scheduler";
import { programming } from "./programming-fixture";
import type { ProgrammingSnapshot } from "../lib/programmingSnapshot";
import { serverModule } from "./server-harness";
import * as rokuModel from "../lib/rokuCatalog";
import * as programmingModel from "../lib/programmingSnapshot";
import { rokuClock } from "../lib/rokuClock";
import { getScheduleDuration } from "../lib/liveEngine";

function snapshot(): ProgrammingSnapshot {
  return {
    ...structuredClone(programming),
    media: programming.media.map(item => ({ ...item, file: `https://media.example/${item.id}.mp4`, kidsApproved: true })),
    channels: programming.channels.map(channel => ({ ...channel, kidsApproved: true })),
  };
}
const now = new Date(BROADCAST_EPOCH_MS + 25_000);

test("Roku uses the same current programme and source offset as the website", () => {
  const data = snapshot();
  const channel = data.channels[0]!;
  const schedule = buildSchedule(data.media.filter(item => channel.mediaIds.includes(item.id)), { channel, now });
  const expected = getLiveState(schedule, now.getTime());
  const playback = rokuPlayback(data, "all", `channel:${channel.id}`, now)!;
  expect(playback.start).toBe(expected.sourceElapsed);
  expect(playback.end - playback.start).toBe(expected.remaining);
  expect(playback.url).toBe(expected.item!.file);
  expect(playback.mediaType).toBe("live");
});

test("current and next channels change at a programme boundary", () => {
  const before = buildRokuCatalog(snapshot(), "all", new Date(BROADCAST_EPOCH_MS + 59_000));
  const after = buildRokuCatalog(snapshot(), "all", new Date(BROADCAST_EPOCH_MS + 60_000));
  expect(before.channels[0]!.now).not.toBe(after.channels[0]!.now);
  expect(before.channels[0]!.next).toBe(after.channels[0]!.now);
});

test("live mid-roll resumes at its source offset while keeping the complete file duration", () => {
  const data = snapshot();
  const channel = data.channels[0]!;
  channel.adPolicy = { enabled: true, placements: ["mid-roll"], targetBreakSeconds: 15 };
  data.media[0]!.breakpoints = [30];
  data.media[0]!.breakDurations = [15];
  data.media.push({ id: "reviewed-ad", title: "Station message", type: "commercial", duration: 15,
    file: "https://media.example/ad.mp4", adChannelIds: [channel.id], adPlacements: ["mid-roll"], kidsApproved: true });
  const schedule = buildSchedule(data.media.filter(item => channel.mediaIds.includes(item.id)), {
    channel, now, availableAds: data.media.filter(item => item.type === "commercial"),
  });
  const index = schedule.findIndex(item => item.parentMediaId === data.media[0]!.id && (item.sourceStart ?? 0) > 0);
  expect(index).toBeGreaterThan(0);
  const elapsed = schedule.slice(0, index).reduce((seconds, item) => seconds + item.duration, 0) + 2;
  const playback = rokuPlayback(data, "all", `channel:${channel.id}`, new Date(BROADCAST_EPOCH_MS + elapsed * 1000))!;
  expect(playback.start).toBe(schedule[index]!.sourceStart! + 2);
  expect(playback.duration).toBe(data.media[0]!.duration);
  expect(playback.end - playback.start).toBe(schedule[index]!.duration - 2);
});

test("unsupported files hold a whole channel instead of shifting its clock", () => {
  const data = snapshot();
  data.media[0]!.file = "https://media.example/unsupported.webm";
  expect(rokuLineup(data, "all").channels.map(item => item.id)).toEqual(["25"]);
  expect(rokuPlayback(data, "all", "channel:24", now)).toBeNull();
  expect(rokuPlayback(data, "all", "media:qa-show-a", now)).toBeNull();
});

test("Kids playback rejects adult channels, programmes and direct links", () => {
  const data = snapshot();
  data.channels[1]!.adultOnly = true;
  const catalog = buildRokuCatalog(data, "kids", now);
  expect(catalog.channels.map(item => item.id)).toEqual(["channel:24"]);
  expect(catalog.library.flatMap(group => group.items).map(item => item.id)).not.toContain("media:qa-movie");
  expect(rokuPlayback(data, "kids", "channel:25", now)).toBeNull();
  expect(rokuPlayback(data, "kids", "media:qa-movie", now)).toBeNull();
});

test("Kids never loses approval checks for targeted commercials", () => {
  const data = snapshot();
  data.channels[0]!.adPolicy = { enabled: true };
  data.media.push({ id: "ad", title: "Unreviewed ad", type: "commercial", duration: 30,
    file: "https://media.example/ad.mp4", adChannelIds: ["24"], kidsApproved: false });
  expect(rokuLineup(data, "kids").channels.map(item => item.id)).not.toContain("24");
  expect(rokuPlayback(data, "kids", "channel:24", now)).toBeNull();
  expect(rokuPlayback(data, "all", "media:ad", now)).toBeNull();
});

test("channel allowlists restrict playback and library; empty means no release content", () => {
  const data = snapshot();
  expect(buildRokuCatalog(data, "all", now, []).library).toEqual([]);
  expect(buildRokuCatalog(data, "all", now, []).channels).toEqual([]);
  const catalog = buildRokuCatalog(data, "all", now, ["25"]);
  expect(catalog.channels.map(item => item.id)).toEqual(["channel:25"]);
  expect(catalog.library.flatMap(group => group.items).map(item => item.id)).toEqual(["media:qa-movie"]);
  expect(rokuPlayback(data, "all", "media:qa-show-a", now, ["25"])).toBeNull();
});

test("new artwork and episodes appear in the feed without an app rebuild", () => {
  const data = snapshot();
  const first = buildRokuCatalog(data, "all", now);
  const key = first.library[0]!.id.slice("series:".length);
  data.libraryArtwork = { [key]: { poster: "https://media.example/new-poster.png", kidsApproved: false } };
  expect(buildRokuCatalog(data, "all", now).library[0]!.poster).toBe("https://media.example/new-poster.png");
  expect(buildRokuCatalog(data, "kids", now).library[0]!.poster).not.toBe("https://media.example/new-poster.png");
  data.libraryArtwork[key]!.kidsApproved = true;
  expect(buildRokuCatalog(data, "kids", now).library[0]!.poster).toBe("https://media.example/new-poster.png");
});

test("Roku output excludes station editor settings, draft announcements and ownership claims", () => {
  const data = snapshot();
  data.appMode = "admin";
  data.ownedPremiumThemes = ["midas-gold"];
  data.upcomingTitles = [{ id: "secret", title: "Not announced", description: "private-draft", poster: "", type: "show", releaseLabel: "Soon", kidsApproved: false, published: false }];
  const json = JSON.stringify(buildRokuCatalog(data, "all", now));
  expect(json).not.toMatch(/ownedPremiumThemes|appMode|private-draft|sidebarWidth|upcomingTitles/);
});

test("playback accepts only supported HTTPS media and never credentials in URLs", () => {
  const item = snapshot().media[0]!;
  for (const file of ["http://example.com/a.mp4", "https://user:pass@example.com/a.mp4", "file:///a.mp4", "blob:local", "https://example.com/a.webm"])
    expect(rokuStream({ ...item, file })).toBeNull();
  expect(rokuStream({ ...item, file: "https://example.com/a.m3u8?token=abc" })?.streamFormat).toBe("hls");
  expect(rokuStream({ ...item, file: "https://example.com/a.mpd" })?.streamFormat).toBe("dash");
  expect(rokuStream({ ...item, file: "https://example.com/a.mkv" })?.streamFormat).toBe("mkv");
  expect(rokuPlayback(snapshot(), "all", "media:missing", now)).toBeNull();
});

test("disabled channels cannot be tuned by ID", () => {
  const data = snapshot();
  data.channels[0]!.isEnabled = false;
  expect(rokuPlayback(data, "all", "channel:24", now)).toBeNull();
});

test("Roku HTTP handlers validate first, enforce profile access, and mask provider failures", async () => {
  let calls = 0;
  let failed = false;
  const data = snapshot();
  data.channels[1]!.adultOnly = true;
  const imports = {
    "@/lib/rokuCatalog": rokuModel,
    "@/lib/rokuClock": { rokuClock },
    "@/lib/server/http": serverModule("lib/server/http.ts"),
    "@/lib/server/rokuProgramming": {
      rokuChannelAllowlist: () => undefined,
      rokuProgramming: async () => { calls++; if (failed) throw new Error("private database detail"); return data; },
    },
  };
  const catalog = serverModule("app/api/roku/catalog/route.ts", imports);
  const play = serverModule("app/api/roku/play/route.ts", imports);
  const get = (path: string) => new Request(`https://www.tatestv.ca/api/roku/${path}`);
  expect((await catalog.GET!(get("catalog?audience=admin"))).status).toBe(400);
  expect((await catalog.GET!(get("catalog?tz=not-a-zone"))).status).toBe(400);
  expect((await play.GET!(get("play?id=https://evil.example/a.mp4"))).status).toBe(400);
  expect(calls).toBe(0);
  const feed = await catalog.GET!(get("catalog?audience=kids"));
  expect(feed.status).toBe(200);
  expect(feed.headers.get("cache-control")).toContain("no-store");
  expect((await feed.json()).channels.map((entry: { id: string }) => entry.id)).toEqual(["channel:24"]);
  expect((await play.GET!(get("play?audience=kids&id=media:qa-movie"))).status).toBe(404);
  const allowed = await play.GET!(get("play?audience=all&id=media:qa-movie"));
  expect(allowed.status).toBe(200);
  expect((await allowed.json()).playback.id).toBe("media:qa-movie");
  failed = true;
  const outage = await play.GET!(get("play?id=media:qa-movie"));
  expect(outage.status).toBe(503);
  expect(await outage.text()).not.toContain("private database detail");
});

test("Roku programming coalesces reads and retries failed reads without serving stale approval", async () => {
  let calls = 0;
  let fail = true;
  let clock = 1000;
  const data = snapshot();
  const query = {
    select: () => query, eq: () => query, abortSignal: () => query,
    maybeSingle: async () => { calls++; return fail ? { error: { message: "offline" } } : { data: { data } }; },
  };
  class Clock extends Date { static now() { return clock; } }
  const provider = serverModule("lib/server/rokuProgramming.ts", {
    "../programmingSnapshot": programmingModel,
    "./supabaseAdmin": { createSupabaseAdminClient: () => ({ from: () => query }) },
  }, {}, { Date: Clock });
  await assert.rejects(provider.rokuProgramming!(), /Programming unavailable/);
  fail = false;
  const [a, b] = await Promise.all([provider.rokuProgramming!(), provider.rokuProgramming!()]);
  expect(a).toBe(b);
  expect(calls).toBe(2);
  await provider.rokuProgramming!();
  expect(calls).toBe(2);
  clock += 16_000;
  fail = true;
  await assert.rejects(provider.rokuProgramming!(), /Programming unavailable/);
  expect(calls).toBe(3);
});

for (const iso of ["2026-01-15T11:18:02Z", "2026-07-15T10:18:02Z"]) {
  test(`Roku fixed airtime uses the device zone at ${iso}`, () => {
    const data = snapshot();
    data.media[0]!.airStartTime = "04:18";
    const clock = rokuClock("Canada/Mountain", new Date(iso))!;
    expect(clock.getHours()).toBe(4);
    const playback = rokuPlayback(data, "all", "channel:24", clock)!;
    expect(playback.url).toBe(data.media[0]!.file);
    expect(playback.start).toBe(2);
    expect(playback.generatedAt).toBe(iso.replace("Z", ".000Z"));
  });
}

for (const [iso, hours] of [["2026-03-08T18:00:00Z", 23], ["2026-11-01T19:00:00Z", 25]] as const) {
  test(`Roku programme blocks retain the ${hours}-hour daylight-saving day`, () => {
    const data = snapshot();
    const channel = data.channels[0]!;
    channel.programmeBlocks = [{ id: "morning", title: "Sunday morning", days: ["sunday"], startTime: "08:00", durationMinutes: 30, mediaIds: [data.media[0]!.id] }];
    const clock = rokuClock("Canada/Eastern", new Date(iso))!;
    const schedule = buildSchedule(data.media, { channel, now: clock });
    expect(getScheduleDuration(schedule)).toBe(hours * 3600);
    const midnight = rokuClock("Canada/Eastern", new Date(iso))!;
    midnight.setHours(0, 0, 0, 0);
    expect(schedule[0]!.scheduleAnchorMs).toBe(midnight.getTime());
  });
}

test("Roku clock handles Canadian aliases and half-hour zones without changing the process zone", () => {
  const now = new Date("2026-07-15T12:00:00Z");
  expect(rokuClock("Canada/Mountain Standard", now)!.getHours()).toBe(5);
  expect(rokuClock("Canada/Central Standard", now)!.getHours()).toBe(6);
  expect(rokuClock("Canada/Newfoundland", now)!.getMinutes()).toBe(30);
  expect(rokuClock("Other/UTC+14", now)!.getHours()).toBe(2);
  expect(rokuClock("__proto__", now)).toBeNull();
  expect(rokuClock("Other/UTC+99", now)).toBeNull();
  expect(rokuClock(null, now)!.getHours()).toBe(12);
});
