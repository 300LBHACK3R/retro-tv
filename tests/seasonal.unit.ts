import { test, expect } from "@playwright/test";
import { runInNewContext } from "node:vm";
import { createThemeBootstrapScript } from "../components/themes/ThemeBootstrapScript";
import { THEMES, canUseTheme, getThemeAccessLabel, getThemePriceLabel, getFreeThemes } from "../lib/themes";
import { approveReviewedKidsLineup, kidsLineupReview, viewerCatalog } from "../lib/audience";
import { programming } from "./programming-fixture";
import { CHRISTMAS_ENTRANCE_START, getEntranceThemeId, PROFILE_STORAGE_KEY, PROFILE_SESSION_KEY } from "../lib/themePreferences";
import type { Channel, MediaItem } from "../lib/types";

function bootstrap(now: number, profiles?: unknown, session?: unknown, blocked: boolean | "malformed" = false) {
  const root = { dataset: {} as Record<string, string>, style: { colorScheme: "", setProperty() {} } };
  const local = {
    getItem: (key: string) => {
      if (blocked === "malformed") return "{";
      if (blocked) throw new Error("Storage blocked");
      return key === PROFILE_STORAGE_KEY ? JSON.stringify(profiles) : JSON.stringify({ state: { viewerSettings: { preferReducedMotion: true } } });
    },
  };
  runInNewContext(createThemeBootstrapScript(), {
    Date: { now: () => now },
    window: { localStorage: local, sessionStorage: { getItem: (key: string) => key === PROFILE_SESSION_KEY ? JSON.stringify(session) : null } },
    document: { documentElement: root },
  });
  return root;
}

test("the entrance changes at Calgary midnight on November 1, independently of saved choices", () => {
  expect(new Date(CHRISTMAS_ENTRANCE_START).toISOString()).toBe("2026-11-01T06:00:00.000Z");
  for (const [now, expected] of [
    [CHRISTMAS_ENTRANCE_START - 1, "halloween-90s-night"],
    [CHRISTMAS_ENTRANCE_START, "christmas-96-living-room"],
    [CHRISTMAS_ENTRANCE_START + 86400000, "christmas-96-living-room"],
  ] as const) {
    expect(getEntranceThemeId(now)).toBe(expected);
    expect(bootstrap(now).dataset.ttvTheme).toBe(expected);
    expect(bootstrap(now, { profiles: [{ id: "main", theme: "midas-gold" }] }).dataset.ttvTheme).toBe(expected);
    expect(bootstrap(now, undefined, undefined, true).dataset.ttvTheme).toBe(expected);
    expect(bootstrap(now, undefined, undefined, "malformed").dataset.ttvTheme).toBe(expected);
    expect(bootstrap(now, "malformed profiles", "bad session").dataset.ttvTheme).toBe(expected);
  }
});

test("first paint ignores legacy saved themes while preserving reduced motion", () => {
  for (const theme of THEMES) {
    for (const now of [CHRISTMAS_ENTRANCE_START - 1, CHRISTMAS_ENTRANCE_START]) {
      const root = bootstrap(now, { profiles: [{ id: "main", theme: theme.id }] }, { id: "main", pinHash: null });
      expect(root.dataset.ttvTheme).toBe(getEntranceThemeId(now));
      expect(root.dataset.ttvReducedMotion).toBe("true");
    }
  }
});

test("invalid themes and expired profile sessions safely use the seasonal entrance", () => {
  for (const [data, session] of [
    [{ profiles: [{ id: "main", theme: "unknown" }] }, { id: "main", pinHash: null }],
    [{ profiles: [{ id: "main", theme: "midas-gold" }] }, { id: "deleted", pinHash: null }],
    [{ profiles: [{ id: "kids", kids: true, theme: "midas-gold" }] }, { id: "kids", pinHash: null }],
    [{ profiles: [{ id: "main", theme: "midas-gold" }], pin: { hash: "changed" } }, { id: "main", pinHash: "old" }],
  ]) {
    expect(bootstrap(CHRISTMAS_ENTRANCE_START, data, session).dataset.ttvTheme).toBe("christmas-96-living-room");
  }
});

const kids: Channel = { ...programming.channels[0]!, adPolicy: { enabled: true, allowGlobalAds: true }, kidsApproved: false };
const later: MediaItem = { ...programming.media[0]!, id: "later", file: "/later.webm" };
const ad: MediaItem = {
  ...programming.media[0]!, id: "future-ad", type: "commercial", adChannelIds: ["all"],
  adDays: ["sunday"], adStartTime: "23:00", adEndTime: "23:30",
};
const scheduled: Channel = {
  ...kids, programmeBlocks: [{ id: "after-school", title: "After school", days: ["monday"],
    startTime: "15:00", durationMinutes: 60, mediaIds: [later.id] }],
};
const channels = [scheduled, programming.channels[1]!];
const media = [...programming.media, later, ad];

test("a reviewed Kids lineup includes recurring shows and future ads, while parents keep everything", () => {
  const review = kidsLineupReview(scheduled, media);
  expect(review.programmeCount).toBe(3);
  expect(review.adCount).toBe(1);
  expect(review.items.map((item) => item.id)).toContain("future-ad");
  const approved = approveReviewedKidsLineup(channels, media, scheduled.id, review.signature);
  expect(approved.channels[0]).toMatchObject({ kidsApproved: true, category: "Kids & Family" });
  expect(approved.channels[0]!.mediaIds).toEqual(scheduled.mediaIds);
  expect(approved.channels[0]!.programmeBlocks).toEqual(scheduled.programmeBlocks);
  expect(approved.channels[1]).toBe(channels[1]);
  expect(approved.media.find((item) => item.id === "qa-movie")).toBe(media[2]);
  expect(approved.media.find((item) => item.id === "future-ad")?.kidsApproved).toBe(true);
  const catalog = viewerCatalog(approved.channels, approved.media, true);
  expect(catalog.channels.map((item) => item.id)).toEqual(["1", scheduled.id]);
  expect(catalog.media.some((item) => item.id === "qa-movie")).toBe(false);
  expect(viewerCatalog(approved.channels, approved.media, false)).toEqual(approved);
  expect(scheduled.kidsApproved).toBe(false);
  expect(later.kidsApproved).toBeUndefined();
});

test("Kids approval rejects a missing, empty or disabled lineup and a changed review", () => {
  const signature = kidsLineupReview(scheduled, media).signature;
  for (const changed of [
    media.map((item) => item.id === later.id ? { ...item, file: "/replacement.webm" } : item),
    media.map((item) => item.id === ad.id ? { ...item, title: "New advertising" } : item),
    [...media, { ...ad, id: "additional-ad" }],
  ]) {
    expect(() => approveReviewedKidsLineup(channels, changed, scheduled.id, signature)).toThrow("lineup changed");
  }
  for (const invalid of [
    { ...kids, mediaIds: [] },
    { ...kids, mediaIds: ["missing"] },
    { ...kids, isEnabled: false },
  ]) {
    const review = kidsLineupReview(invalid, media);
    expect(review.canApprove).toBe(false);
    expect(() => approveReviewedKidsLineup([invalid], media, invalid.id, review.signature)).toThrow();
  }
});

test("every launch theme is free without purchases, including Christmas and Halloween", () => {
  expect(THEMES.filter((theme) => theme.category === "seasonal").map((theme) => theme.id))
    .toEqual(["christmas-96-living-room", "halloween-90s-night", "halloween-night", "halloween-haunted-arcade"]);
  expect(getFreeThemes()).toHaveLength(THEMES.length);
  for (const theme of THEMES) {
    expect(canUseTheme(theme.id, [], false), theme.name).toBe(true);
    expect(getThemeAccessLabel(theme, [], false), theme.name).toBe("Free");
    expect(getThemePriceLabel(theme), theme.name).toBe("Free");
  }
});
