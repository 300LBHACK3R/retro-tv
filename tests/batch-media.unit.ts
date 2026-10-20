import { test, expect } from "@playwright/test";
import { batchFileType, batchTitle, buildBatchImport, publicVideoUrl, type BatchEntry, type BatchSettings } from "../lib/batchMedia";
import { programming } from "./programming-fixture";
import { sanitizeProgrammingSnapshot } from "../lib/programmingSnapshot";
const settings: BatchSettings = { channelId: programming.channels[0]!.id, type: "show", endBreak: 30, folder: "Shows" };
const entry = (id: string): BatchEntry => ({ id, title: `Series S01E${id}`, url: `https://media.example/${id}.mp4`, duration: 1200 });

test("batch append keeps existing content and channel order, configures only new programmes and requires Kids review", () => {
  const before = structuredClone(programming);
  const result = buildBatchImport(before.media, before.channels, [entry("01"), entry("02")], settings);
  expect(before).toEqual(programming);
  expect(result.media.slice(0,before.media.length)).toEqual(before.media);
  expect(result.channels[1]).toEqual(before.channels[1]);
  expect(result.channels[0]!.mediaIds.slice(0,before.channels[0]!.mediaIds.length)).toEqual(before.channels[0]!.mediaIds);
  const added = result.media.slice(before.media.length);
  expect(added.map(item => item.title)).toEqual(["Series S01E01", "Series S01E02"]);
  expect(added.every(item => item.slotLengthSeconds === 1230 && item.fillSlotWithCommercials && !item.kidsApproved)).toBe(true);
  expect(result.channels[0]!.adPolicy?.placements).toContain("filler");
  const snapshot = sanitizeProgrammingSnapshot({ ...before, media: result.media, channels: result.channels });
  expect(snapshot?.media.find(item => item.id === added[0]!.id)?.slotLengthSeconds).toBe(1230);
});

test("commercial batch creates targeted inventory without inserting ads into programme playlists", () => {
  const result = buildBatchImport(programming.media, programming.channels, [entry("01")], { ...settings, type: "commercial" });
  expect(result.channels).toEqual(programming.channels);
  const ad = result.media.at(-1)!;
  expect(ad.adChannelIds).toEqual([settings.channelId]);
  expect(ad.adPlacements).toEqual(["filler", "between-programs"]);
  expect(ad.kidsApproved).toBe(false);
  expect(ad.slotLengthSeconds).toBeUndefined();
});

test("duplicate URLs within a batch and after a repeated commit never overwrite existing records", () => {
  const first = buildBatchImport(programming.media, programming.channels, [entry("01"), { ...entry("01"), id: "duplicate" }], settings);
  expect(first.added).toEqual(["01"]);
  expect(first.skipped).toEqual(["duplicate"]);
  const second = buildBatchImport(first.media, first.channels, [{ ...entry("01"), title: "Changed title" }], settings);
  expect(second.media).toBe(first.media);
  expect(second.channels).toBe(first.channels);
  expect(second.added).toEqual([]);
});

test("invalid batches fail before returning a partial update", () => {
  for (const patch of [{ url: "javascript:alert(1)" }, { title: "" }, { duration: 0 }, { duration: NaN }, { duration: 86401 }]) {
    expect(() => buildBatchImport(programming.media, programming.channels, [entry("01"), { ...entry("02"), ...patch }], settings)).toThrow();
  }
  expect(() => buildBatchImport(programming.media, programming.channels, [entry("01")], { ...settings, channelId: "missing" })).toThrow();
});

test("batch helpers keep episode numbers, reject non-public protocols and unsupported file uploads", () => {
  expect(batchTitle("Series.S02E10.Episode_Name.mp4")).toBe("Series S02E10 Episode Name");
  expect(publicVideoUrl("https://media.example/a.mp4#preview")).toBe("https://media.example/a.mp4");
  expect(publicVideoUrl("https://user:password@media.example/a.mp4")).toBe("");
  expect(publicVideoUrl("http://media.example/a.mp4")).toBe("");
  expect(batchFileType({name:"video.MP4",size:100})).toBe("video/mp4");
  expect(() => batchFileType({name:"video.mkv",size:100})).toThrow();
  expect(() => batchFileType({name:"video.mp4",size:0})).toThrow();
});
