import { test, expect } from "@playwright/test";
import { seriesMetadata, seasonLabel, seasonSummary, seasonArtworkKey } from "../lib/seriesMetadata";
import { buildLibrary, isSavedGroup } from "../lib/libraryCatalog";
import { useDeviceLibrary } from "../lib/deviceLibrary";
import { sanitizeLibraryArtwork } from "../lib/libraryPresentation";
import type { MediaItem } from "../lib/types";
const show = (id: string, title: string, file = `https://example.test/${id}.mp4`): MediaItem => ({ id, title, file, type: "show", duration: 1200 });

test("mixed season codes and trailing episode titles form one series in numeric order", () => {
  const groups = buildLibrary([
    show("b10", "BeyBlade - S01-EP10"), show("b2", "Beyblade S01-EP02"),
    show("z2", "Zoey 101 - New Roomies S01-EP02"), show("z1", "Zoey 101 S01E01 Welcome To PCA"),
    show("m12", "Martin Mystery S01- EP12 Nightmare"), show("m2", "Martin Mystery S01E02"),
    show("f1", "Fosters - SE01-EP01"), show("f2", "Fosters S01E02"),
  ]);
  expect(groups).toHaveLength(4);
  expect(groups.find(group => group.title.toLowerCase() === "beyblade")?.items.map(item => item.episode)).toEqual([2, 10]);
  expect(groups.find(group => group.title === "Zoey 101")?.items.map(item => item.displayTitle)).toEqual(["S01E01 · Welcome To PCA", "S01E02 · New Roomies"]);
  expect(groups.find(group => group.title === "Martin Mystery")?.items.map(item => item.episode)).toEqual([2, 12]);
});

test("filenames recover missing numbers, malformed long codes do not become false episode numbers", () => {
  const media = show("ed", "Ed, Edd N Eddy - A Boy And His Ed", "https://example.test/Ed,%20Edd%20N%20Eddy%20(1999)%20-%20S01e16%20-%20A%20Boy%20And%20His%20Ed%20(1080P%20X265).mp4");
  expect(seriesMetadata(media)).toEqual({ title: "Ed, Edd N Eddy", season: 1, episode: 16, episodeTitle: "A Boy And His Ed" });
  expect(seriesMetadata(show("p", "Pokemon - Primeape Goes Bananas S01-EP2525", "https://example.test/Pokemon%20S01E25%20Primeape%20Goes%20Bananas.mp4"))).toMatchObject({ title: "Pokemon", season: 1, episode: 25 });
  expect(seriesMetadata(show("p1", "Pokemon S01E01 Pokemon, I Choose You"))).toMatchObject({ episodeTitle: "Pokemon, I Choose You" });
  expect(seriesMetadata(show("p35", "Pokemon - The Legend Of Dratini S01-EP35 (Japanese)"))).toMatchObject({ title: "Pokemon", episode: 35, episodeTitle: "The Legend Of Dratini (Japanese)" });
  expect(seriesMetadata(show("mona", "Mona - The Night", "https://example.test/Mona%20-%20The%20Night%20(S1e1)%20-%20Archive.mp4"))).toMatchObject({ title: "Mona", season: 1, episode: 1 });
});

test("actual Season 4 remains Season 4; unlabelled collections never invent Season 1", () => {
  const gas = buildLibrary([show("c2", "Corner Gas S04EP02"), show("c1", "Corner Gas S04-EP01")])[0]!;
  expect(gas.seasons).toEqual([4]); expect(gas.items.map(item => item.episode)).toEqual([1, 2]);
  expect(seasonSummary(gas.seasons)).toBe("Season 4");
  expect(seriesMetadata(show("b", "Berenstain Bears - The Sitter", "https://example.test/Berenstain%20Bears%20-%20E08%20(The%20Sitter).mp4"))).toEqual({ title: "Berenstain Bears", season: -1, episode: 8, episodeTitle: "The Sitter" });
  expect(seasonLabel(-1)).toBe("Other episodes");
  expect(seriesMetadata(show("v", "VeggieTales - A Story"))).toMatchObject({ title: "VeggieTales", season: -1, episode: 0 });
});

test("regrouping retains existing artwork and watchlist aliases without rewriting media", () => {
  const media = [show("b", "Beyblade - S01-EP10"), show("c", "Beyblade S01-EP02")];
  const before = structuredClone(media);
  const oldKey = "show:beyblade-s01-";
  const group = buildLibrary(media, { [oldKey]: { poster: "/poster.webp", kidsApproved: true } })[0]!;
  expect(group.poster).toBe("/poster.webp"); expect(isSavedGroup(group, [oldKey])).toBe(true);
  useDeviceLibrary.setState({ profileId: "main", profiles: {}, watchlist: [oldKey], favouriteChannels: [] });
  useDeviceLibrary.getState().toggleWatchlist(group.key, group.aliasKeys);
  expect(useDeviceLibrary.getState().watchlist).toEqual([]);
  useDeviceLibrary.getState().toggleWatchlist(group.key, group.aliasKeys);
  expect(useDeviceLibrary.getState().watchlist).toEqual([group.key]);
  expect(media).toEqual(before);
});

test("one season poster covers current and future episodes, stays scoped, and respects Kids artwork approval", () => {
  const media = [show("one", "A Show S01E01"), show("two", "A Show S02E01")];
  const key = buildLibrary(media)[0]!.key;
  const seasonKey = seasonArtworkKey(key, 1);
  const artwork = sanitizeLibraryArtwork({ [key]: { poster: "/show.webp", kidsApproved: true }, [seasonKey]: { poster: "/season-one.webp", kidsApproved: false } });
  let group = buildLibrary(media, artwork)[0]!;
  expect(group.poster).toBe("/show.webp"); expect(group.seasonPosters[1]).toBe("/season-one.webp"); expect(group.seasonPosters[2]).toBeUndefined();
  expect(buildLibrary(media, artwork, true)[0]!.seasonPosters[1]).toBeUndefined();
  artwork[seasonKey]!.kidsApproved = true;
  media.push(show("new", "A Show S01E02"));
  group = buildLibrary(media, artwork, true)[0]!;
  expect(group.items.filter(item => item.season === 1).map(item => group.seasonPosters[item.season])).toEqual(["/season-one.webp", "/season-one.webp"]);
  delete artwork[seasonKey];
  expect(buildLibrary(media, artwork)[0]!.seasonPosters[1]).toBeUndefined();
  // A cover for Season 1 alone must never become Season 2's fallback.
  group = buildLibrary(media, { [seasonKey]: { poster: "/season-one.webp", kidsApproved: true } })[0]!;
  expect(group.poster).toBeUndefined(); expect(group.seasonPosters[2]).toBeUndefined();
});
