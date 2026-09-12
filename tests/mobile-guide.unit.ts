import { test, expect } from "@playwright/test";
import {
  mobileNowNext,
  mobileScheduleDay,
  mobileSchedulePage,
} from "../lib/mobileGuide";
import type { GuideCell } from "../lib/guideTimeline";

const cells: GuideCell[] = Array.from({ length: 144 }, (_, index) => ({
  item: {
    id: `show-${index}`,
    title: `Show ${index}`,
    type: "show",
    file: "/test.mp4",
    duration: 600,
  },
  stableKey: `show-${index}`,
  startSec: index * 600,
  endSec: (index + 1) * 600,
}));

test("mobile Now excludes ended listings and switches at the actual broadcast boundary", () => {
  expect(mobileNowNext(cells, 1020)).toEqual({
    live: cells[1],
    next: cells[2],
  });
  expect(mobileSchedulePage(cells, 1020, 0, 12).cells[0]).toBe(cells[1]);
  expect(mobileNowNext(cells, 1200)).toEqual({
    live: cells[2],
    next: cells[3],
  });
  expect(mobileSchedulePage(cells, 1200, 0, 12).cells[0]).toBe(cells[2]);
});

test("mobile time jumps are relative to now and pagination exposes the remaining schedule", () => {
  expect(mobileSchedulePage(cells, 1020, 3, 12).cells[0]).toBe(cells[19]);
  const first = mobileSchedulePage(cells, 1020, 0, 12);
  const second = mobileSchedulePage(cells, 1020, 0, 24);
  expect(second.cells.slice(0, 12)).toEqual(first.cells);
  expect(second.cells[12]).toBe(cells[13]);
  expect(second.remaining).toBe(first.remaining - 12);
  const end = mobileSchedulePage(cells, 1020, 0, 144);
  expect(end.remaining).toBe(0);
  expect(end.cells.at(-1)).toBe(cells.at(-1));
  expect(new Set(end.cells.map((cell) => cell.stableKey)).size).toBe(143);
});

test("off-air channels never treat a future programme as playable now", () => {
  const gap = [cells[0]!, cells[3]!];
  expect(mobileNowNext(gap, 900)).toEqual({ live: undefined, next: cells[3] });
  expect(mobileNowNext([], 900)).toEqual({ live: undefined, next: undefined });
  expect(mobileNowNext(cells, 86400)).toEqual({
    live: undefined,
    next: undefined,
  });
  expect(mobileSchedulePage(cells, 86400, 0, 12)).toEqual({
    cells: [],
    remaining: 0,
  });
});

test("mobile day labels cross local midnight and both daylight-saving transitions", () => {
  const original = process.env.TZ;
  process.env.TZ = "America/Edmonton";
  try {
    for (const [month, day] of [
      [2, 8],
      [10, 1],
      [8, 12],
    ]) {
      const now = new Date(2026, month!, day!, 0, 15);
      expect(mobileScheduleDay(new Date(2026, month!, day!, 23, 45), now)).toBe(
        "Today",
      );
      expect(
        mobileScheduleDay(new Date(2026, month!, day! + 1, 0, 15), now),
      ).toBe("Tomorrow");
    }
    const midnight = new Date(2026, 8, 12, 0, 0);
    expect(mobileScheduleDay(new Date(2026, 8, 11, 23, 59), midnight)).not.toBe(
      "Today",
    );
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
