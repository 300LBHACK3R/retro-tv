import { test, expect } from "@playwright/test";
import {
  applyProgrammeBlocks,
  blocksOverlap,
  sanitizeProgrammeBlocks,
  WEEKDAYS,
} from "../lib/programmeBlocks";
import { getLiveState, getScheduleDuration } from "../lib/liveEngine";
import { buildSchedule } from "../lib/scheduler";
import { buildForwardGuideCells } from "../lib/guideTimeline";
import { buildLibrary, sanitizeProgress } from "../lib/libraryCatalog";
import { sanitizeSavedIds, useDeviceLibrary } from "../lib/deviceLibrary";
import { programming } from "./programming-fixture";
import { useStore } from "../lib/store";
import type { BroadcastItem, ProgrammeBlock } from "../lib/types";

const base: BroadcastItem[] = [
  {
    id: "regular",
    title: "Regular programme",
    type: "show",
    file: "/regular.mp4",
    duration: 1700,
  },
];
const special: BroadcastItem[] = [
  {
    id: "special",
    title: "Weekend programme",
    type: "show",
    file: "/special.mp4",
    duration: 1800,
    sourceStart: 60,
  },
];
const block: ProgrammeBlock = {
  id: "weekend",
  title: "Saturday Cartoons",
  days: ["saturday"],
  startTime: "08:00",
  durationMinutes: 120,
  mediaIds: ["special"],
};

test("programme blocks preserve the original clock on unconfigured days and empty selections", () => {
  const channel = { ...programming.channels[0]!, programmeBlocks: [block] };
  expect(
    applyProgrammeBlocks(
      base,
      channel,
      new Date(2026, 8, 11, 9),
      () => special,
    ),
  ).toBe(base);
  expect(
    applyProgrammeBlocks(base, channel, new Date(2026, 8, 12, 9), () => []),
  ).toBe(base);
});

for (const timezone of [
  "UTC",
  "America/Edmonton",
  "Asia/Tokyo",
  "Pacific/Auckland",
]) {
  test(`block boundaries, source offsets and baseline continuity in ${timezone}`, () => {
    const original = process.env.TZ;
    process.env.TZ = timezone;
    try {
      const day = new Date(2026, 8, 12, 9);
      const schedule = applyProgrammeBlocks(
        base,
        { ...programming.channels[0]!, programmeBlocks: [block] },
        day,
        () => special,
      );
      expect(getScheduleDuration(schedule)).toBe(86400);
      for (const [hour, minute, second] of [
        [7, 59, 59],
        [10, 0, 0],
        [23, 30, 0],
      ]) {
        const at = new Date(2026, 8, 12, hour, minute, second).getTime();
        const expected = getLiveState(base, at);
        const actual = getLiveState(schedule, at);
        expect(actual.item?.parentMediaId).toBe(expected.item?.id);
        expect(actual.sourceElapsed).toBe(expected.sourceElapsed);
      }
      const start = getLiveState(
        schedule,
        new Date(2026, 8, 12, 8, 0).getTime(),
      );
      expect(start.item?.programmeBlock).toBe("Saturday Cartoons");
      expect(start.sourceElapsed).toBe(60);
      expect(
        getLiveState(schedule, new Date(2026, 8, 12, 8, 15).getTime())
          .sourceElapsed,
      ).toBe(960);
      expect(
        getLiveState(schedule, new Date(2026, 8, 12, 9, 59, 59).getTime()).item
          ?.parentMediaId,
      ).toBe("special");
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
}

test("block input rejects invalid clocks and overlaps but allows touching boundaries", () => {
  expect(
    sanitizeProgrammeBlocks([
      block,
      { ...block, id: "bad", startTime: "24:00" },
      { ...block, id: "late", startTime: "23:45", durationMinutes: 60 },
    ]),
  ).toEqual([block]);
  expect(blocksOverlap(block, { ...block, startTime: "09:00" })).toBe(true);
  expect(blocksOverlap(block, { ...block, startTime: "10:00" })).toBe(false);
  expect(blocksOverlap(block, { ...block, days: ["sunday"] })).toBe(false);
});

test("guide and live player agree across a recurring block and local midnight", () => {
  const now = new Date(2026, 8, 12, 17, 30);
  const media = [
    { ...programming.media[0]!, duration: 1800 },
    { ...programming.media[1]!, duration: 1800 },
  ];
  const channel = {
    ...programming.channels[0]!,
    programmeBlocks: [
      {
        ...block,
        startTime: "18:00",
        days: WEEKDAYS,
        mediaIds: [media[1]!.id],
      },
    ],
  };
  const end = 36 * 3600;
  const cells = buildForwardGuideCells(
    { channel, media, availableAds: [] },
    now,
    end,
    now,
  );
  expect(cells.length).toBeGreaterThan(0);
  expect(cells[0]!.startSec).toBe(0);
  expect(cells.at(-1)!.endSec).toBe(end);
  for (let second = 0; second < end; second += 317) {
    const at = new Date(now.getTime() + second * 1000);
    const live = getLiveState(
      buildSchedule(media, { channel, now: at }),
      at.getTime(),
    );
    const cell = cells.find(
      (cell) => cell.startSec <= second && cell.endSec > second,
    );
    expect(cell, `guide gap at ${at}`).toBeDefined();
    expect(cell!.item.parentMediaId ?? cell!.item.id).toBe(
      live.item?.parentMediaId ?? live.item?.id,
    );
  }
  for (let index = 1; index < cells.length; index++)
    expect(cells[index]!.startSec).toBe(cells[index - 1]!.endSec);
});

test("saved channels and programme groups survive cloud programming replacement", () => {
  useDeviceLibrary.setState({ favouriteChannels: [], watchlist: [] });
  useDeviceLibrary.getState().toggleChannel("24");
  const group = buildLibrary(programming.media).find(
    (group) => group.items.length === 2,
  )!;
  useDeviceLibrary.getState().toggleWatchlist(group.key);
  useStore.getState().replaceProgramming(programming);
  expect(useDeviceLibrary.getState().favouriteChannels).toEqual(["24"]);
  expect(useDeviceLibrary.getState().watchlist).toEqual([group.key]);
  useDeviceLibrary.getState().toggleChannel("24");
  expect(useDeviceLibrary.getState().favouriteChannels).toEqual([]);
  expect(sanitizeSavedIds([null, 1, "", "25", "25"])).toEqual(["25"]);
  expect(
    sanitizeSavedIds(Array.from({ length: 600 }, (_, i) => String(i))),
  ).toHaveLength(500);
});

test("malformed progress cannot corrupt resume; retention keeps recent titles", () => {
  expect(
    sanitizeProgress({
      bad: null,
      invalid: { position: -1, duration: 20, updatedAt: 1 },
      valid: { position: 10, duration: 20, updatedAt: 1 },
    }),
  ).toEqual({ valid: { position: 10, duration: 20, updatedAt: 1 } });
  const progress = sanitizeProgress(
    Object.fromEntries(
      Array.from({ length: 400 }, (_, i) => [
        String(i),
        { position: 1, duration: 20, updatedAt: i + 1 },
      ]),
    ),
  );
  expect(Object.keys(progress)).toHaveLength(300);
  expect(progress["0"]).toBeUndefined();
  expect(progress["399"]).toBeDefined();
});

test("scheduled days respect both daylight-saving transitions", () => {
  const original = process.env.TZ;
  process.env.TZ = "America/Edmonton";
  try {
    for (const [month, day, hours] of [
      [2, 8, 23],
      [10, 1, 25],
    ] as const) {
      const now = new Date(2026, month, day, 0);
      const channel = {
        ...programming.channels[0]!,
        programmeBlocks: [{ ...block, days: WEEKDAYS }],
      };
      const schedule = applyProgrammeBlocks(base, channel, now, () => special);
      expect(getScheduleDuration(schedule)).toBe(hours! * 3600);
      const end = new Date(2026, month, day! + 1, 0).getTime();
      for (let at = now.getTime(); at < end; at += 137000) {
        const local = new Date(at);
        if (local.getHours() >= 8 && local.getHours() < 10) {
          expect(getLiveState(schedule, at).item?.parentMediaId).toBe(
            "special",
          );
        } else {
          expect(getLiveState(schedule, at).sourceElapsed).toBe(
            getLiveState(base, at).sourceElapsed,
          );
        }
      }
    }
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("all nine themes use valid colour tokens and readable text pairs", async () => {
  const { THEMES, THEME_ACCESS_MODE } = await import("../lib/themes");
  const luminance = (hex: string) => {
    const channels = hex
      .slice(1)
      .match(/../g)!
      .map((value) => parseInt(value, 16) / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
      );
    return (
      channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
    );
  };
  const ratio = (a: string, b: string) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) /
    (Math.min(luminance(a), luminance(b)) + 0.05);
  expect(THEMES).toHaveLength(9);
  expect(THEME_ACCESS_MODE).toBe("all-unlocked");
  for (const theme of THEMES) {
    for (const key of [
      "panelBg",
      "panelAltBg",
      "buttonBg",
      "buttonHover",
      "guideHeaderBg",
    ] as const)
      expect(theme.colors[key], `${theme.id}:${key}`).toMatch(
        /^#[a-f0-9]{6}$/i,
      );
    for (const background of [
      "panelBg",
      "panelAltBg",
      "guideRowBg",
      "guideRowAltBg",
    ] as const) {
      expect(
        ratio(theme.colors.text, theme.colors[background]),
        `${theme.id}:body:${background}`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        ratio(theme.colors.textMuted, theme.colors[background]),
        `${theme.id}:muted:${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    for (const background of [
      "primary",
      "guideActiveBg",
      "guideCurrentBg",
    ] as const)
      expect(
        ratio(theme.colors.onPrimary, theme.colors[background]),
        `${theme.id}:selected:${background}`,
      ).toBeGreaterThanOrEqual(4.5);
  }
});
