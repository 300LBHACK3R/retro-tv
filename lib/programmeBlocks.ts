import {
  BROADCAST_EPOCH_MS,
  getLiveStateAtOffset,
  getScheduleDuration,
  safeDuration,
} from "./liveEngine";
import type { BroadcastItem, Channel, ProgrammeBlock, Weekday } from "./types";

export const WEEKDAYS: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function sanitizeProgrammeBlocks(value: unknown): ProgrammeBlock[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  return value.slice(0, 24).flatMap((entry): ProgrammeBlock[] => {
    if (!entry || typeof entry !== "object") return [];
    const block = entry as Partial<ProgrammeBlock>;
    if (
      typeof block.id !== "string" ||
      !block.id ||
      block.id.length > 120 ||
      ids.has(block.id) ||
      typeof block.title !== "string" ||
      !block.title.trim() ||
      typeof block.startTime !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(block.startTime)
    )
      return [];
    const days = Array.isArray(block.days)
      ? [...new Set(block.days.filter((day) => WEEKDAYS.includes(day)))]
      : [];
    const mediaIds = Array.isArray(block.mediaIds)
      ? [
          ...new Set(
            block.mediaIds.filter(
              (id): id is string =>
                typeof id === "string" && !!id && id.length <= 240,
            ),
          ),
        ].slice(0, 100)
      : [];
    const durationMinutes = Number(block.durationMinutes);
    const [hour = 0, minute = 0] = block.startTime.split(":").map(Number);
    if (
      !days.length ||
      !mediaIds.length ||
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 15 ||
      durationMinutes > 720 ||
      hour * 60 + minute + durationMinutes > 1440
    )
      return [];
    ids.add(block.id);
    return [
      {
        id: block.id.slice(0, 120),
        title: block.title.trim().slice(0, 100),
        startTime: block.startTime,
        durationMinutes,
        days,
        mediaIds,
      },
    ];
  });
}

export function blocksOverlap(a: ProgrammeBlock, b: ProgrammeBlock): boolean {
  if (!a.days.some((day) => b.days.includes(day))) return false;
  const minutes = (time: string) =>
    Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  return (
    minutes(a.startTime) < minutes(b.startTime) + b.durationMinutes &&
    minutes(b.startTime) < minutes(a.startTime) + a.durationMinutes
  );
}

function appendWindow(
  target: BroadcastItem[],
  schedule: BroadcastItem[],
  offset: number,
  duration: number,
  label?: string,
) {
  if (!schedule.length || duration <= 0) return;
  const state = getLiveStateAtOffset(schedule, offset);
  let index = state.index;
  let inside = state.elapsed;
  let remaining = duration;
  while (remaining > 0 && target.length < 8000) {
    const item = schedule[index];
    if (!item) break;
    const length = Math.min(remaining, safeDuration(item) - inside);
    if (length <= 0) break;
    const sourceStart = (item.sourceStart ?? 0) + inside;
    target.push({
      ...item,
      id: `${item.id}:block:${target.length}`,
      parentMediaId: item.parentMediaId ?? item.id,
      duration: length,
      sourceStart,
      sourceEnd: sourceStart + length,
      isVirtualSegment: true,
      programmeBlock: label,
      guideDuration: undefined,
    });
    remaining -= length;
    index = (index + 1) % schedule.length;
    inside = 0;
  }
}

/** Only channels with configured blocks get a fixed daily timeline. Unconfigured
 * channels retain their exact previous broadcast clock and ad behaviour. */
export function applyProgrammeBlocks(
  base: BroadcastItem[],
  channel: Channel | undefined,
  now: Date,
  buildBlock: (ids: string[]) => BroadcastItem[],
): BroadcastItem[] {
  const blocks = sanitizeProgrammeBlocks(channel?.programmeBlocks).filter(
    (block) => block.days.includes(WEEKDAYS[now.getDay()] ?? "sunday"),
  );
  if (!blocks.length || !base.length) return base;
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const nextDay = new Date(dayStart);
  nextDay.setDate(nextDay.getDate() + 1);
  const dayLength = (nextDay.getTime() - dayStart.getTime()) / 1000;
  const dayStartSeconds = (dayStart.getTime() - BROADCAST_EPOCH_MS) / 1000;
  const windows = blocks
    .flatMap((block) => {
      const content = buildBlock(block.mediaIds);
      if (!content.length || !getScheduleDuration(content)) return [];
      const start = new Date(now);
      start.setHours(
        Number(block.startTime.slice(0, 2)),
        Number(block.startTime.slice(3)),
        0,
        0,
      );
      const offset = (start.getTime() - dayStart.getTime()) / 1000;
      return [
        {
          start: offset,
          end: Math.min(dayLength, offset + block.durationMinutes * 60),
          content,
          title: block.title,
        },
      ];
    })
    .sort((a, b) => a.start - b.start);
  if (!windows.length) return base;
  const result: BroadcastItem[] = [];
  let cursor = 0;
  for (const block of windows) {
    // Invalid imported overlaps cannot displace an already scheduled block.
    if (block.start < cursor) continue;
    appendWindow(result, base, dayStartSeconds + cursor, block.start - cursor);
    appendWindow(
      result,
      block.content,
      0,
      block.end - block.start,
      block.title,
    );
    cursor = block.end;
  }
  appendWindow(result, base, dayStartSeconds + cursor, dayLength - cursor);
  if (getScheduleDuration(result) !== dayLength || !result[0]) return base;
  // A local broadcast day can be 23 or 25 hours. Keep its absolute anchor so
  // both the guide and player use the same offset through DST transitions.
  result[0].scheduleAnchorMs = dayStart.getTime();
  return result;
}
