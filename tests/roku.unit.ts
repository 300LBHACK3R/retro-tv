import { test, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { viewerCatalog } from "../lib/audience";
import { buildRokuCatalog, rokuLineup, rokuPlayback, rokuStream } from "../lib/rokuCatalog";
import { buildRokuGuide } from "../lib/rokuGuide";
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

function advertisingModule(metadata = "{}") {
  return serverModule("lib/server/rokuAdvertising.ts", {
    "../rokuCatalog": rokuModel,
  }, { TTV_ROKU_AD_VIDEO_METADATA: metadata });
}

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

test("Roku seek previews are valid HTTPS BIF files bound to the on-demand video", () => {
  const data = snapshot();
  const item = data.media[0]!;
  const mediaId = `media:${item.id}`;
  const hdBifUrl = "https://media.example/seek/episode-v1.bif";
  expect(rokuPlayback(data, "all", mediaId, now)).not.toHaveProperty("hdBifUrl");

  item.rokuSeekIndex = { sourceFile: item.file, hdBifUrl };
  const saved = programmingModel.sanitizeProgrammingSnapshot(data)!;
  expect(saved.media[0]!.rokuSeekIndex).toEqual(item.rokuSeekIndex);
  expect(rokuPlayback(saved, "all", mediaId, now)).toMatchObject({ hdBifUrl });
  expect(rokuPlayback(saved, "all", "channel:24", now)).not.toHaveProperty("hdBifUrl");

  item.file = "https://media.example/replacement.mp4";
  expect(programmingModel.sanitizeProgrammingSnapshot(data)!.media[0]!.rokuSeekIndex).toBeUndefined();
  expect(rokuPlayback(data, "all", mediaId, now)).not.toHaveProperty("hdBifUrl");

  for (const invalidUrl of ["/episode.bif", "http://media.example/v.bif", "https://user:pass@media.example/v.bif", "https://media.example/v.mp4"]) {
    item.rokuSeekIndex = { sourceFile: item.file, hdBifUrl: invalidUrl };
    expect(programmingModel.sanitizeProgrammingSnapshot(data)!.media[0]!.rokuSeekIndex).toBeUndefined();
    expect(rokuPlayback(data, "all", mediaId, now)).not.toHaveProperty("hdBifUrl");
  }
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
  const provider = {
    rokuChannelAllowlist: () => undefined,
    rokuProgramming: async () => { calls++; if (failed) throw new Error("private database detail"); return data; },
  };
  const imports = {
    "@/lib/rokuCatalog": rokuModel,
    "@/lib/rokuClock": { rokuClock },
    "@/lib/server/http": serverModule("lib/server/http.ts"),
    "@/lib/server/rokuAdvertising": advertisingModule(),
    "@/lib/server/rokuStoreProgramming": serverModule("lib/server/rokuStoreProgramming.ts", {
      "../audience": { viewerCatalog },
      "../rokuCatalog": rokuModel,
      "./rokuProgramming": provider,
    }),
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

test("Store edition only exposes approved short-form video across guide, live and Library requests", async () => {
  const data = snapshot();
  const studio = data.channels[0]!;
  studio.commercialBreakMode = "end-only";
  studio.adPolicy = { enabled: true };
  studio.defaultSlotLengthSeconds = 1800;
  studio.mediaIds = [...studio.mediaIds, "qa-ad", "qa-bumper", "qa-unreviewed", "qa-unsupported"];
  studio.programmeBlocks = [
    { id: "with-short", title: "Short slot", startTime: "00:00", days: [], durationMinutes: 30, mediaIds: ["qa-block", "qa-unreviewed"] },
    { id: "without-short", title: "Unreleased slot", startTime: "01:00", days: [], durationMinutes: 30, mediaIds: ["qa-unreviewed"] },
  ];
  Object.assign(data.media[0]!, { duration: 899, slotLengthSeconds: 1800, fillSlotWithCommercials: true, breakpoints: [120], breakDurations: [30] });
  data.media[1]!.duration = 900;
  data.media.push(
    { id: "qa-ad", type: "commercial", title: "Station sponsor", duration: 30, file: "https://media.example/ad.mp4" },
    { id: "qa-bumper", type: "bumper", title: "Station bumper", duration: 5, file: "https://media.example/bumper.mp4" },
    { id: "qa-unreviewed", type: "show", title: "Unreviewed show", duration: 30, file: "https://media.example/unreviewed.mp4" },
    { id: "qa-unsupported", type: "movie", title: "Unsupported movie", duration: 40, file: "https://media.example/unsupported.webm" },
    { id: "qa-block", type: "show", title: "Scheduled Short S01E01", duration: 123, file: "https://media.example/short.mp4", kidsApproved: true },
  );

  let reads = 0;
  const storeModules = (env: Record<string, string>) => {
    const loader = serverModule("lib/server/rokuStoreProgramming.ts", {
      "../audience": { viewerCatalog },
      "../rokuCatalog": rokuModel,
      "./rokuProgramming": {
        rokuChannelAllowlist: () => undefined,
        rokuProgramming: async () => { reads++; return data; },
      },
    }, env);
    const imports = {
      "@/lib/rokuCatalog": rokuModel,
      "@/lib/rokuGuide": { buildRokuGuide },
      "@/lib/rokuClock": { rokuClock: (zone: string | null) => rokuClock(zone, now) },
      "@/lib/server/http": serverModule("lib/server/http.ts"),
      "@/lib/server/rokuAdvertising": advertisingModule(),
      "@/lib/server/rokuStoreProgramming": loader,
    };
    const handlers = {
      catalog: serverModule("app/api/roku/catalog/route.ts", imports).GET!,
      guide: serverModule("app/api/roku/guide/route.ts", imports).GET!,
      play: serverModule("app/api/roku/play/route.ts", imports).GET!,
    };
    return {
      loader,
      get: (route: keyof typeof handlers, query: string) =>
        handlers[route](new Request(`https://www.tatestv.ca/api/roku/${route}?${query}`)),
    };
  };

  const allButUnreviewed = "qa-show-a,qa-show-b,qa-movie,qa-ad,qa-bumper,qa-unsupported,qa-block";
  const { get, loader } = storeModules({
    TTV_ROKU_STORE_CHANNEL_IDS: "24",
    TTV_ROKU_STORE_MEDIA_IDS: allButUnreviewed,
  });
  expect((await get("catalog", "edition=preview")).status).toBe(400);
  expect((await get("guide", "edition=store&edition=preview")).status).toBe(400);
  expect((await get("play", "edition=&id=media:qa-show-a")).status).toBe(400);
  expect(reads).toBe(0);

  const storeSnapshot = (await loader.rokuEditionProgramming!("store", "all")).snapshot as ProgrammingSnapshot;
  expect(storeSnapshot.channels[0]).toMatchObject({
    id: "24",
    mediaIds: ["qa-show-a"],
    programmeBlocks: [{ id: "with-short", mediaIds: ["qa-block"] }],
    commercialBreakMode: "none",
    adPolicy: { enabled: false },
  });
  expect(storeSnapshot.channels[0]!.defaultSlotLengthSeconds).toBeUndefined();
  expect(storeSnapshot.media[0]!.slotLengthSeconds).toBeUndefined();
  expect(storeSnapshot.media[0]!.breakpoints).toBeUndefined();
  expect(data.media[0]!.breakpoints).toEqual([120]);

  const catalogResponse = await get("catalog", "edition=store");
  expect(catalogResponse.headers.get("cache-control")).toContain("no-store");
  const catalog = await catalogResponse.json();
  expect(catalog.edition).toBe("store");
  expect(catalog.channels.map((channel: { id: string }) => channel.id)).toEqual(["channel:24"]);
  expect(catalog.library.flatMap((group: { items: { id: string }[] }) => group.items.map(item => item.id)).sort())
    .toEqual(["media:qa-block", "media:qa-show-a"]);
  const guide = await (await get("guide", "edition=store")).json();
  expect(guide.edition).toBe("store");
  expect(guide.channels.map((row: { id: string }) => row.id)).toEqual(["channel:24"]);
  expect(JSON.stringify(guide)).not.toMatch(/Station sponsor|Station bumper|Unreviewed show/);
  const live = await (await get("play", "edition=store&id=channel:24")).json();
  expect(live.edition).toBe("store");
  expect(live.playback.url).toMatch(/\/(qa-show-a|short)\.mp4$/);
  expect((await get("play", "edition=store&id=media:qa-show-a")).status).toBe(200);
  for (const id of ["media:qa-show-b", "media:qa-movie", "media:qa-ad", "media:qa-bumper", "media:qa-unreviewed", "media:qa-unsupported", "channel:25"])
    expect((await get("play", `edition=store&id=${id}`)).status).toBe(404);
  const standard = await get("play", "id=media:qa-show-b");
  expect(standard.status).toBe(200);
  expect((await standard.json()).edition).toBeUndefined();

  const unconfiguredAllowLists: Record<string, string>[] = [
    { TTV_ROKU_STORE_CHANNEL_IDS: "24", TTV_ROKU_STORE_MEDIA_IDS: "" },
    { TTV_ROKU_STORE_CHANNEL_IDS: "", TTV_ROKU_STORE_MEDIA_IDS: "qa-show-a" },
    {},
  ];
  for (const env of unconfiguredAllowLists) {
    const closed = storeModules(env);
    expect(await (await closed.get("catalog", "edition=store")).json()).toMatchObject({ edition: "store", channels: [], library: [] });
    expect(await (await closed.get("guide", "edition=store")).json()).toMatchObject({ edition: "store", channels: [] });
    expect((await closed.get("play", "edition=store&id=media:qa-show-a")).status).toBe(404);
  }
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

test("Full Store identifies RAF breaks and preserves the underlying station clock", async () => {
  const data = snapshot();
  const channel = data.channels[0]!;
  channel.adPolicy = { enabled: true, placements: ["mid-roll"], targetBreakSeconds: 30, maxAdsPerBreak: 2 };
  const programme = data.media[0]!;
  programme.duration = 960;
  programme.breakpoints = [480];
  programme.breakDurations = [30];
  const adFile = "https://media.example/sponsor.mp4?lang=en&quality=hd";
  data.media.push({ id: "sponsor-ad", title: "Sponsor & Co.", duration: 15, file: adFile,
    type: "commercial", kidsApproved: true, adChannelIds: [channel.id], adPlacements: ["mid-roll"] });
  const clock = new Date(BROADCAST_EPOCH_MS + 480_000);
  const mediaKey = createHash("sha256").update(adFile).digest("hex");
  const adModule = advertisingModule(JSON.stringify({ [mediaKey]: { width: 1920, height: 1080, duration: 15 } }));
  const http = serverModule("lib/server/http.ts");
  let wallTime = clock.getTime();
  class FakeDate extends Date { static override now() { return wallTime; } }
  const dependencies = {
    "@/lib/rokuClock": { rokuClock: (zone: string | null, date = new Date(wallTime)) => rokuClock(zone, date) },
    "@/lib/rokuCatalog": rokuModel,
    "@/lib/server/http": http,
    "@/lib/server/rokuAdvertising": adModule,
    "@/lib/server/rokuStoreProgramming": {
      rokuEdition: (params: URLSearchParams) => params.get("edition") ?? "standard",
      rokuEditionProgramming: async () => ({ snapshot: data }),
    },
  };
  const play = serverModule("app/api/roku/play/route.ts", dependencies);
  const events: unknown[] = [];
  const ad = serverModule("app/api/roku/ad/route.ts", dependencies, {}, {
    Date: FakeDate, console: { info: (_label: string, event: unknown) => events.push(event) },
  });
  const request = new Request(`https://www.tatestv.ca/api/roku/play?audience=kids&tz=America%2FEdmonton&id=channel:${channel.id}&raf=1`);
  const response = await play.GET!(request);
  expect(response.status).toBe(200);
  const initial = await response.json();
  expect(initial).toMatchObject({ advertising: "raf", playback: { scheduledAd: true, start: 0,
    end: 15, remaining: 15, kidsContent: true } });
  expect(initial.playback.url).toBeUndefined();
  const tag = new URL(initial.playback.vastUrl);
  tag.searchParams.set("rida", "test-ad-id");
  const rendered = await ad.GET!(new Request(tag));
  expect(rendered.status).toBe(200);
  expect(rendered.headers.get("content-type")).toContain("application/xml");
  const xml: string = await rendered.text();
  expect(xml).toContain("Sponsor &amp; Co.");
  expect(xml).toContain("lang=en&amp;quality=hd");
  expect(xml).toContain('<Tracking event="complete">');
  expect(xml).not.toContain("test-ad-id");
  const event = new URL(initial.playback.vastUrl);
  event.searchParams.set("event", "complete");
  wallTime += 15_000;
  expect((await ad.GET!(new Request(tag))).status).toBe(400);
  expect((await ad.GET!(new Request(event))).status).toBe(204);
  expect(events).toEqual([{ event: "complete", channel: `channel:${channel.id}`, creative: mediaKey }]);

  wallTime = clock.getTime() + 8_000;
  const midway = await (await play.GET!(request)).json();
  expect(midway.playback).toMatchObject({ scheduledAd: true, start: 8, end: 15, remaining: 7 });
  expect(midway.playback.vastUrl).toBeUndefined();
  expect(midway.playback.url).toBeUndefined();
  const legacy = await (await play.GET!(new Request(request.url.replace("&raf=1", "")))).json();
  expect(legacy.playback.url).toBe(adFile);

  wallTime = clock.getTime();
  data.media.at(-1)!.file = "https://media.example/replacement.mp4";
  expect((await ad.GET!(new Request(tag))).status).toBe(404);
  const unknown = await (await play.GET!(request)).json();
  expect(unknown.playback).toMatchObject({ scheduledAd: true, remaining: 15 });
  expect(unknown.playback.vastUrl).toBeUndefined();
});

test("RAF rejects sliced creatives and closely spaced breaks without changing schedule boundaries", () => {
  const data = snapshot();
  const channel = data.channels[0]!;
  channel.adPolicy = { enabled: true, placements: ["mid-roll"], targetBreakSeconds: 10 };
  data.media[0]!.duration = 600;
  data.media[0]!.breakpoints = [60, 510];
  data.media[0]!.breakDurations = [10, 10];
  data.media.push({ id: "long-ad", title: "Long ad", type: "commercial", duration: 30,
    file: "https://media.example/ad.mp4", kidsApproved: true, allowCommercialSlicing: true,
    adChannelIds: [channel.id], adPlacements: ["mid-roll"] });
  const close = rokuPlayback(data, "all", `channel:${channel.id}`, new Date(BROADCAST_EPOCH_MS + 60_000), undefined, true)!;
  const later = rokuPlayback(data, "all", `channel:${channel.id}`, new Date(BROADCAST_EPOCH_MS + 520_000), undefined, true)!;
  expect(close.adSlot).toMatchObject({ whole: false, eligibleBreak: false });
  expect(later.adSlot).toMatchObject({ whole: false, eligibleBreak: true });
  expect(close.remaining).toBe(10);
  expect(later.remaining).toBe(10);
});
