import { test, expect } from "@playwright/test";
import { createRewindMovie, rewindRoomCatalog } from "../lib/rewindRoom";
import { programmingSignature, sanitizeProgrammingSnapshot } from "../lib/programmingSnapshot";
import { useStore } from "../lib/store";
import { programming } from "./programming-fixture";

const movie = { ...programming.media.find(item => item.type === "movie")!, rewindRoom: true };

test("the Rewind Room starts empty and only explicitly stocked movies appear", () => {
  expect(rewindRoomCatalog(programming.channels, programming.media, {}, false)).toEqual([]);
  const media = [movie, { ...programming.media[0]!, rewindRoom: true }, { ...movie, id: "other", rewindRoom: false }];
  expect(rewindRoomCatalog(programming.channels, media, {}, false).map(group => group.items[0]!.media.id)).toEqual([movie.id]);
  expect(rewindRoomCatalog([], [movie], {}, false)).toHaveLength(1);
});

test("stocking a movie never grants Kids access or exposes unreviewed posters", () => {
  expect(rewindRoomCatalog([], [movie], {}, true)).toEqual([]);
  const approved = { ...movie, kidsApproved: true, poster: "/reviewed.webp" };
  const key = rewindRoomCatalog([], [approved], {}, false)[0]!.key;
  const art = { [key]: { poster: "/not-reviewed.webp", kidsApproved: false } };
  expect(rewindRoomCatalog([], [approved], art, true)[0]?.poster).toBe("/reviewed.webp");
  const channels = programming.channels.map(channel => ({ ...channel, adultOnly: channel.mediaIds.includes(movie.id) }));
  expect(rewindRoomCatalog(channels, [approved], art, true)).toEqual([]);
});

test("movie shelf membership survives cloud round trips and cannot be forged by truthy values", () => {
  const snapshot = sanitizeProgrammingSnapshot({ ...programming, media: [movie, { ...movie, id: "string-true", rewindRoom: "true" }, { ...movie, id: "wrong-type", type: "show" }] })!;
  expect(snapshot.media.map(item => item.rewindRoom)).toEqual([true, false, false]);
  const previous = useStore.getState().exportProgrammingSnapshot();
  try {
    useStore.getState().replaceProgramming(snapshot);
    const before = useStore.getState().exportProgrammingSnapshot();
    expect(sanitizeProgrammingSnapshot(before)?.media[0]?.rewindRoom).toBe(true);
    useStore.getState().updateMedia(movie.id, { rewindRoom: false });
    const after = useStore.getState().exportProgrammingSnapshot();
    expect(after.channels).toEqual(before.channels);
    expect(programmingSignature(after)).not.toBe(programmingSignature(before));
    useStore.getState().updateMedia(movie.id, { rewindRoom: true, type: "commercial" });
    expect(useStore.getState().media[0]?.rewindRoom).toBe(false);
  } finally { useStore.getState().replaceProgramming(previous); }
});

test("new tapes have no broadcast assignment or Kids approval and require valid movie input", () => {
  const input = { title: " Friday   Night ", file: "https://media.example/movie.mp4", duration: 5400, poster: "/cover.webp", description: "A movie night." };
  const item = createRewindMovie(input);
  expect(item).toMatchObject({ title: "Friday Night", type: "movie", rewindRoom: true, kidsApproved: false, file: input.file, duration: 5400, poster: "/cover.webp" });
  expect(item.breakpoints).toEqual([]);
  expect(item.fillSlotWithCommercials).toBe(false);
  for (const file of ["javascript:alert(1)", "http://example.com/a.mp4", "https://user:password@example.com/a.mp4", "not a url"])
    expect(() => createRewindMovie({ ...input, file })).toThrow();
  for (const duration of [NaN, Infinity, -1, 0]) expect(() => createRewindMovie({ ...input, duration })).toThrow();
  expect(() => createRewindMovie({ ...input, title: " " })).toThrow();
  expect(() => createRewindMovie({ ...input, poster: "javascript:alert(1)" })).toThrow();
});
