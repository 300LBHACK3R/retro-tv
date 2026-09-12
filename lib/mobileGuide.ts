import {
  formatShortDate,
  isSameLocalDay,
  type GuideCell,
} from "./guideTimeline";

export const MOBILE_SCHEDULE_PAGE_SIZE = 12;

export function mobileNowNext(cells: GuideCell[], nowOffsetSec: number) {
  return {
    live: cells.find(
      (cell) => cell.startSec <= nowOffsetSec && cell.endSec > nowOffsetSec,
    ),
    next: cells.find((cell) => cell.startSec > nowOffsetSec),
  };
}

export function mobileSchedulePage(
  cells: GuideCell[],
  nowOffsetSec: number,
  hoursAhead: number,
  limit: number,
) {
  // "Now" means the current broadcast, not the start of the half-hour grid.
  const fromSec = nowOffsetSec + Math.max(0, hoursAhead) * 3600;
  const upcoming = cells.filter((cell) => cell.endSec > fromSec);
  return {
    cells: upcoming.slice(0, limit),
    remaining: Math.max(0, upcoming.length - limit),
  };
}

export function mobileScheduleDay(date: Date, now: Date): string {
  if (isSameLocalDay(date, now)) return "Today";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameLocalDay(date, tomorrow)) return "Tomorrow";
  return formatShortDate(date);
}
