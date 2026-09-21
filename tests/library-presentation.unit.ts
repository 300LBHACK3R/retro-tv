import { test, expect } from "@playwright/test";
import {
  safeArtworkUrl,
  sanitizeLibraryArtwork,
  sanitizeUpcomingTitles,
  visibleUpcomingTitles,
} from "../lib/libraryPresentation";
import { buildLibrary } from "../lib/libraryCatalog";
import {
  approveReviewedKidsLineup,
  kidsLineupReview,
  viewerCatalog,
} from "../lib/audience";
import { sanitizeProgrammingSnapshot } from "../lib/programmingSnapshot";
import { useStore } from "../lib/store";
import { programming } from "./programming-fixture";

const announcement = {
  id: "frights",
  title: "Friday Night Frights",
  description: "A station special",
  poster: "https://images.example/poster.webp",
  type: "movie" as const,
  releaseLabel: "Coming this October",
  kidsApproved: false,
  published: true,
};
test("artwork accepts only safe image addresses and bounds stored presentation data", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:image/svg+xml,test",
    "//example.com/image.png",
    "http://example.com/image.png",
    "/\\example.com/x",
    "https://user:pass@example.com/x",
    "\u0000/x",
  ])
    expect(safeArtworkUrl(value)).toBe("");
  expect(safeArtworkUrl("/posters/show.webp")).toBe("/posters/show.webp");
  expect(
    sanitizeLibraryArtwork({
      good: { poster: "/poster.webp", kidsApproved: "true" },
      bad: { poster: "//example.com/x" },
    }),
  ).toEqual({ good: { poster: "/poster.webp", kidsApproved: false } });
  expect(
    sanitizeUpcomingTitles([
      { ...announcement, poster: "", kidsApproved: "true" },
    ])[0],
  ).toMatchObject({ published: false, kidsApproved: false });
  expect(
    sanitizeUpcomingTitles(
      Array.from({ length: 120 }, (_, index) => ({
        ...announcement,
        id: String(index),
      })),
    ),
  ).toHaveLength(100);
});
test("shared artwork covers future episodes but Kids require the poster review", () => {
  const media = structuredClone(programming.media);
  media[0]!.poster = "/reviewed-episode.webp";
  const key = buildLibrary(media).find((group) => group.type === "show")!.key;
  const artwork = { [key]: { poster: "/shared.webp", kidsApproved: false } };
  expect(
    buildLibrary(media, artwork).find((group) => group.key === key)?.poster,
  ).toBe("/shared.webp");
  expect(
    buildLibrary(media, artwork, true).find((group) => group.key === key)
      ?.poster,
  ).toBe("/reviewed-episode.webp");
  artwork[key]!.kidsApproved = true;
  media.push({ ...media[0]!, id: "new", title: "Studio Sessions S02E01" });
  const group = buildLibrary(media, artwork, true).find(
    (group) => group.key === key,
  )!;
  expect(group.poster).toBe("/shared.webp");
  expect(group.seasons).toEqual([1, 2]);
  expect(group.items).toHaveLength(3);
});
test("Kids library is empty until reviewed; channel review carries programmes automatically and new uploads stay hidden", () => {
  const source = structuredClone(programming);
  expect(
    buildLibrary(viewerCatalog(source.channels, source.media, true).media),
  ).toHaveLength(0);
  const channel = source.channels[0]!;
  const review = kidsLineupReview(channel, source.media);
  const approved = approveReviewedKidsLineup(
    source.channels,
    source.media,
    channel.id,
    review.signature,
  );
  expect(
    buildLibrary(
      viewerCatalog(approved.channels, approved.media, true).media,
    ).map((group) => group.title),
  ).toEqual(["Studio Sessions"]);
  const newMedia = [
    ...approved.media,
    { ...source.media[0]!, id: "new", title: "Studio Sessions S01E03" },
  ];
  const kidsMedia = viewerCatalog(approved.channels, newMedia, true).media;
  expect(kidsMedia.map((item) => item.id)).not.toContain("new");
  expect(kidsMedia.map((item) => item.id)).not.toContain("qa-movie");
  approved.media = approved.media.map((item) => ({
    ...item,
    kidsApproved: false,
  }));
  expect(
    buildLibrary(viewerCatalog(approved.channels, approved.media, true).media),
  ).toHaveLength(0);
  expect(
    buildLibrary(viewerCatalog(source.channels, source.media, false).media),
  ).toHaveLength(2);
});
test("upcoming announcements respect publication, channel and Kids review independently", () => {
  const channels = structuredClone(programming.channels);
  channels[0]!.kidsApproved = true;
  const kids = {
    ...announcement,
    id: "rewind",
    title: "Saturday Morning Rewind",
    kidsApproved: true,
    channelId: channels[0]!.id,
  };
  const titles = [
    announcement,
    kids,
    { ...announcement, id: "draft", published: false },
  ];
  expect(visibleUpcomingTitles(titles, channels, false)).toHaveLength(2);
  expect(visibleUpcomingTitles(titles, channels, true)).toEqual([kids]);
  channels[0]!.adultOnly = true;
  expect(visibleUpcomingTitles(titles, channels, true)).toEqual([]);
  channels[0]!.isEnabled = false;
  expect(visibleUpcomingTitles(titles, channels, false)).toEqual([
    announcement,
  ]);
});
test("cloud refresh, export and restore preserve artwork and upcoming drafts without changing viewer choices", () => {
  const previous = useStore.getState().exportProgrammingSnapshot();
  const snapshot = sanitizeProgrammingSnapshot({
    ...programming,
    libraryArtwork: {
      "show:studio-sessions": { poster: "/poster.webp", kidsApproved: true },
    },
    upcomingTitles: [{ ...announcement, published: false }],
  })!;
  try {
    useStore.getState().replaceProgramming(snapshot, { preserveViewer: true });
    const result = useStore.getState().exportProgrammingSnapshot();
    expect(result.libraryArtwork).toEqual(snapshot.libraryArtwork);
    expect(result.upcomingTitles).toEqual(snapshot.upcomingTitles);
    expect(
      sanitizeProgrammingSnapshot(result)?.upcomingTitles?.[0]?.published,
    ).toBe(false);
    useStore.getState().replaceProgramming(programming);
    expect(useStore.getState().libraryArtwork).toEqual({});
    expect(useStore.getState().upcomingTitles).toEqual([]);
  } finally {
    useStore.getState().replaceProgramming(previous);
  }
});
