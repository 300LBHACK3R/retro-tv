import { test, expect } from "@playwright/test";
import { buildLibrary } from "../lib/libraryCatalog";
import { groupRuntime, libraryCollections, sortLibrary, titleLetter, watchStatus } from "../lib/libraryBrowse";
import { viewerCatalog } from "../lib/audience";
import type { Channel, MediaItem } from "../lib/types";
const media: MediaItem[] = [
  { id: "one", title: "The Show S01E01", type: "show", duration: 1200, file: "/one.mp4", kidsApproved: true },
  { id: "two", title: "The Show S02E01", type: "show", duration: 2400, file: "/two.mp4", kidsApproved: true },
  { id: "movie", title: "A Movie", type: "movie", duration: 7200, file: "/movie.mp4", createdAt: "2026-10-27", kidsApproved: true },
];
const channels: Channel[] = [
  { id: "kids", name: "Kids", category: "Kids & Family", mediaIds: ["one", "two"], kidsApproved: true },
  { id: "adult", name: "Adults", category: "Movies", mediaIds: ["movie"], adultOnly: true },
];
test("collections group regular and scheduled episodes without duplicates and exclude disabled channels", () => {
  const groups = buildLibrary(media);
  const linked = libraryCollections(groups, [...channels, { id: "off", name: "Off", mediaIds: ["one"], isEnabled: false }, { id: "block", name: "Block", category: "Faith", mediaIds: [], programmeBlocks: [{ id: "b", title: "Block", days: [], startTime: "12:00", durationMinutes: 30, mediaIds: ["two"] }] }]);
  const show = groups.find(g => g.type === "show")!;
  expect(linked.get(show.key)?.channels.map(c => c.id)).toEqual(["kids", "block"]);
  expect(linked.get(show.key)?.categories).toEqual(["Kids & Family", "Faith"]);
  expect(groupRuntime(show)).toBe(1200);
  expect(sortLibrary(groups, "episodes")[0]?.key).toBe(show.key);
  expect(sortLibrary(groups, "longest")[0]?.type).toBe("movie");
  expect(sortLibrary(groups, "recent")[0]?.type).toBe("movie");
  expect(titleLetter("The Show")).toBe("S");
  expect(titleLetter("A Movie")).toBe("M");
  expect(titleLetter("1996")).toBe("#");
});
test("watch status requires every episode completed; an unwatched new season reopens a show", () => {
  const show = buildLibrary(media).find(g => g.type === "show")!;
  expect(watchStatus(show, {})).toBe("not-started");
  const one = { position: 1200, duration: 1200, updatedAt: 1 };
  expect(watchStatus(show, { one })).toBe("in-progress");
  expect(watchStatus(show, { one, two: { position: 2400, duration: 2400, updatedAt: 2 } })).toBe("finished");
});
test("Kids collections use the reviewed catalogue and never expose adult channel titles", () => {
  const catalog = viewerCatalog(channels, media, true);
  const groups = buildLibrary(catalog.media, {}, true);
  expect(groups.map(g => g.title)).toEqual(["The Show"]);
  const collections = libraryCollections(groups, catalog.channels);
  expect([...collections.values()].flatMap(c => c.categories)).toEqual(["Kids & Family"]);
});
