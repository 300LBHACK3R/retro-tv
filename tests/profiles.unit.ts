import { test, expect } from "@playwright/test";
import {
  kidsChannelReview,
  viewerCatalog,
  channelCategory,
} from "../lib/audience";
import { buildSchedule } from "../lib/scheduler";
import { sanitizeProgrammingSnapshot } from "../lib/programmingSnapshot";
import { useStore } from "../lib/store";
import { useDeviceLibrary } from "../lib/deviceLibrary";
import {
  sanitizeProfiles,
  profileProgressKey,
  useProfiles,
  setParentPin,
  verifyParentPin,
  initializeProfiles,
  activateProfile,
  lockProfiles,
  refreshProfiles,
} from "../lib/deviceProfiles";
import { programming } from "./programming-fixture";
import type { Channel, MediaItem } from "../lib/types";
const programme: MediaItem = { ...programming.media[0]!, kidsApproved: true };
const channel: Channel = {
  ...programming.channels[0]!,
  mediaIds: [programme.id],
  kidsApproved: true,
};

test("Kids requires approval of the whole lineup; genres confer no approval", () => {
  expect(kidsChannelReview(channel, [programme])).toEqual([]);
  expect(
    kidsChannelReview({ ...channel, kidsApproved: undefined }, [programme]),
  ).not.toEqual([]);
  expect(
    kidsChannelReview(channel, [{ ...programme, kidsApproved: undefined }]),
  ).not.toEqual([]);
  expect(kidsChannelReview(channel, [])).not.toEqual([]);
  expect(
    kidsChannelReview({ ...channel, mediaIds: [] }, [programme]),
  ).not.toEqual([]);
  expect(
    viewerCatalog(
      [{ ...channel, category: "Faith", kidsApproved: false }],
      [programme],
      true,
    ).channels.map((item) => item.id),
  ).toEqual(["1"]);
  expect(channelCategory({ ...channel, category: "Music" })).toBe("Music");
});
test("future programmes and all potentially eligible ads require review", () => {
  const extra = { ...programme, id: "unreviewed", kidsApproved: false };
  const scheduled: Channel = {
    ...channel,
    programmeBlocks: [
      {
        id: "later",
        title: "Later",
        days: ["sunday"],
        startTime: "20:00",
        durationMinutes: 60,
        mediaIds: [extra.id],
      },
    ],
  };
  expect(kidsChannelReview(scheduled, [programme, extra]).join()).toContain(
    "programme(s)",
  );
  const ad: MediaItem = {
    ...extra,
    type: "commercial",
    adChannelIds: ["24"],
    adDays: ["sunday"],
    adStartTime: "23:00",
    adEndTime: "23:30",
  };
  expect(kidsChannelReview(channel, [programme, ad]).join()).toContain("ad(s)");
  expect(
    kidsChannelReview(channel, [programme, { ...ad, adChannelIds: ["25"] }]),
  ).toEqual([]);
  expect(
    kidsChannelReview({ ...channel, adPolicy: { enabled: false } }, [
      programme,
      ad,
    ]),
  ).toEqual([]);
  expect(
    kidsChannelReview({ ...channel, adPolicy: { allowGlobalAds: true } }, [
      programme,
      { ...ad, adChannelIds: ["all"] },
    ]).join(),
  ).toContain("ad(s)");
});
test("Kids preserves the broadcast clock and Channel 1 never falls back to unreviewed media", () => {
  const adult = { ...programme, id: "adult", kidsApproved: false };
  const catalog = viewerCatalog([channel], [programme, adult], true);
  expect(catalog.media).toEqual([programme]);
  expect(catalog.channels.find((item) => item.id === channel.id)).toEqual(
    channel,
  );
  const date = new Date(2026, 8, 13);
  expect(buildSchedule([programme], { channel, now: date })).toEqual(
    buildSchedule(catalog.media, { channel: catalog.channels[1], now: date }),
  );
  const welcome = catalog.channels[0]!;
  expect(welcome.number).toBe(1);
  expect(welcome.mediaIds).toEqual([]);
  expect(
    buildSchedule([], {
      channel: welcome,
      availableAds: [
        { ...programme, type: "commercial", adChannelIds: ["all"] },
      ],
    }),
  ).toEqual([]);
  expect(
    viewerCatalog([channel], [programme, adult], false).media,
  ).toHaveLength(2);
  const atOne = { ...channel, id: "1", number: 1 };
  expect(
    viewerCatalog([atOne], [programme], true).channels[0]?.mediaIds,
  ).toEqual([programme.id]);
  expect(
    viewerCatalog([atOne], [{ ...programme, kidsApproved: false }], true)
      .channels[0]?.mediaIds,
  ).toEqual([]);
});
test("approvals and categories survive serialization but truthy values cannot grant approval", () => {
  const snapshot = sanitizeProgrammingSnapshot({
    ...programming,
    channels: [{ ...channel, category: "Music" }],
    media: [programme],
  });
  expect(snapshot?.channels[0]).toMatchObject({
    kidsApproved: true,
    category: "Music",
  });
  expect(snapshot?.media[0]?.kidsApproved).toBe(true);
  const invalid = sanitizeProgrammingSnapshot({
    ...programming,
    channels: [{ ...channel, kidsApproved: "true", category: "made up" }],
    media: [{ ...programme, kidsApproved: 1 }],
  });
  expect(invalid?.channels[0]?.kidsApproved).toBe(false);
  expect(invalid?.channels[0]?.category).toBeUndefined();
  expect(invalid?.media[0]?.kidsApproved).toBe(false);
});
test("changes to reviewed media clear approval until an explicit new review", () => {
  useStore
    .getState()
    .replaceProgramming({ ...programming, media: [programme] });
  useStore
    .getState()
    .updateChannelSettings("24", { kidsApproved: true, category: "Discovery" });
  expect(
    useStore.getState().channels.find((item) => item.id === "24"),
  ).toMatchObject({ kidsApproved: true, category: "Discovery" });
  useStore
    .getState()
    .updateMedia(programme.id, { file: "/new-file.mp4", kidsApproved: true });
  expect(
    useStore.getState().media.find((item) => item.id === programme.id)
      ?.kidsApproved,
  ).toBe(false);
  useStore.getState().updateMedia(programme.id, { kidsApproved: true });
  expect(
    useStore.getState().media.find((item) => item.id === programme.id)
      ?.kidsApproved,
  ).toBe(true);
});
test("Main migrates existing saves; other profiles have isolated saved items and progress keys", () => {
  const store = useDeviceLibrary;
  const merge = store.persist.getOptions().merge!;
  store.setState(
    merge(
      { favouriteChannels: ["24"], watchlist: ["show:legacy"] },
      { ...store.getState(), profileId: "main" },
    ),
  );
  store.getState().selectProfile("kids");
  expect(store.getState().favouriteChannels).toEqual([]);
  expect(store.getState().watchlist).toEqual([]);
  store.getState().toggleChannel("3");
  store.getState().toggleWatchlist("show:kids");
  store.getState().selectProfile("main");
  expect(store.getState().favouriteChannels).toEqual(["24"]);
  expect(store.getState().watchlist).toEqual(["show:legacy"]);
  store.getState().selectProfile("kids");
  expect(store.getState().watchlist).toEqual(["show:kids"]);
  expect(profileProgressKey("main")).not.toBe(profileProgressKey("kids"));
  store.getState().removeProfile("kids");
  store.getState().selectProfile("main");
  expect(store.getState().profiles.kids).toBeUndefined();
});
test("profile data is bounded and Main cannot become a Kids profile", () => {
  expect(sanitizeProfiles(null).map((profile) => profile.id)).toEqual([
    "main",
    "kids",
  ]);
  const profiles = sanitizeProfiles([
    { id: "main", name: " Parent ", kids: true },
    { id: "bad!", name: "Bad" },
    { id: "p-1", name: "Child", kids: true },
    { id: 12, name: "Bad" },
  ]);
  expect(profiles).toHaveLength(2);
  expect(profiles[0]).toMatchObject({ name: "Parent", kids: false });
  expect(
    sanitizeProfiles(
      Array.from({ length: 20 }, (_, i) => ({ id: `p-${i}`, name: `P${i}` })),
    ),
  ).toHaveLength(5);
});
test("startup selects Channel 1, preserves the legacy theme, and external profile changes lock the viewer", () => {
  const local = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const session = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  function memory() {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    };
  }
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memory(),
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: memory(),
    });
    useStore.getState().replaceProgramming(programming);
    useStore.getState().setTheme("obsidian-gold");
    useProfiles.setState({ ready: false });
    initializeProfiles();
    expect(
      useProfiles.getState().profiles.find((profile) => profile.id === "main")
        ?.theme,
    ).toBe("obsidian-gold");
    activateProfile("main");
    expect(useStore.getState().currentChannelId).toBe("1");
    lockProfiles();
    useStore.getState().setTheme("electric-blue-live");
    activateProfile("main");
    expect(useStore.getState().themeId).toBe("obsidian-gold");
    const revision = useProfiles.getState().revision;
    refreshProfiles();
    expect(useProfiles.getState().activeId).toBeNull();
    expect(useProfiles.getState().revision).toBe(revision + 1);
  } finally {
    if (local) Object.defineProperty(globalThis, "localStorage", local);
    else Reflect.deleteProperty(globalThis, "localStorage");
    if (session) Object.defineProperty(globalThis, "sessionStorage", session);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
test("parent PIN verification rejects guesses and delays repeated attempts", async () => {
  await expect(setParentPin("12a")).rejects.toThrow();
  await setParentPin("4826");
  expect(useProfiles.getState().pin?.hash).toMatch(/^[a-f0-9]{64}$/);
  expect(await verifyParentPin("4826")).toBe(true);
  for (let i = 0; i < 5; i++) expect(await verifyParentPin("9999")).toBe(false);
  await expect(verifyParentPin("4826")).rejects.toThrow("Wait 30 seconds");
  useProfiles.setState({ lockedUntil: 0 });
  expect(await verifyParentPin("4826")).toBe(true);
});
