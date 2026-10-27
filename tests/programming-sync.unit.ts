import { test, expect } from "@playwright/test";
import { programmingSignature } from "../lib/programmingSnapshot";
import { programming } from "./programming-fixture";

test("restoring a profile theme or changing channels cannot trigger a station publish", () => {
  expect(programmingSignature({
    ...programming, currentChannelId: "25", themeId: "midas-gold",
    ownedPremiumThemes: ["midas-gold"], updatedAt: "2026-10-27T00:00:00Z",
  })).toBe(programmingSignature(programming));
});

test("schedule, Kids approval, artwork and announcement edits remain publishable", () => {
  const original = programmingSignature(programming);
  for (const change of [
    { media: programming.media.map(item => ({ ...item, kidsApproved: true })) },
    { channels: programming.channels.map(item => ({ ...item, isEnabled: false })) },
    { libraryArtwork: { "show:studio-sessions": { poster: "/cover.png", kidsApproved: true } } },
    { upcomingTitles: [{ id: "new", title: "New show", description: "", poster: "", type: "show" as const, releaseLabel: "Soon", published: true, kidsApproved: false }] },
  ]) expect(programmingSignature({ ...programming, ...change })).not.toBe(original);
});
