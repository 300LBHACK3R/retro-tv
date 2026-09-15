import { test, expect } from "@playwright/test";
import { runInNewContext } from "node:vm";
import { createThemeBootstrapScript } from "../components/ThemeBootstrapScript";
import { DEFAULT_THEME_ID, DEFAULT_THEME_REVISION, resolveSavedTheme, THEMES, canUseTheme, getThemeAccessLabel, getThemePriceLabel, getFreeThemes } from "../lib/themes";
import { approveReviewedKidsLineup, kidsLineupReview, viewerCatalog } from "../lib/audience";
import { programming } from "./programming-fixture";
import type { Channel, MediaItem } from "../lib/types";

test("first paint uses the seasonal default once and keeps later personal choices", () => {
  const script = createThemeBootstrapScript();
  for (const saved of [
    undefined,
    { themeId: "obsidian-gold" },
    { themeId: "shaw-2006", themeRevision: DEFAULT_THEME_REVISION },
    { themeId: "halloween-haunted-arcade", themeRevision: DEFAULT_THEME_REVISION },
    { themeId: "unknown", themeRevision: DEFAULT_THEME_REVISION },
  ]) {
    const expected = resolveSavedTheme(saved?.themeId, saved?.themeRevision);
    const root = { dataset: {} as Record<string, string>, style: { colorScheme: "", setProperty() {} } };
    runInNewContext(script, {
      window: { localStorage: { getItem: () => JSON.stringify({ state: saved }) } },
      document: { documentElement: root },
    });
    expect(root.dataset.ttvTheme).toBe(expected);
  }
  expect(DEFAULT_THEME_ID).toBe("halloween-night");
  expect(resolveSavedTheme("obsidian-gold", DEFAULT_THEME_REVISION)).toBe("obsidian-gold");
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

test("every launch theme is free without purchases, including both Halloween looks", () => {
  expect(THEMES.filter((theme) => theme.category === "seasonal").map((theme) => theme.id))
    .toEqual(["halloween-night", "halloween-haunted-arcade"]);
  expect(getFreeThemes()).toHaveLength(THEMES.length);
  for (const theme of THEMES) {
    expect(canUseTheme(theme.id, [], false), theme.name).toBe(true);
    expect(getThemeAccessLabel(theme, [], false), theme.name).toBe("Free");
    expect(getThemePriceLabel(theme), theme.name).toBe("Free");
  }
});
