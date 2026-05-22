"use client";

import { useEffect, useMemo, useState } from "react";
import { BROADCAST_EPOCH_MS, getLiveState } from "@/lib/liveEngine";
import type { MediaItem } from "@/lib/types";

const PX_PER_MINUTE = 5;
const SLOT_MINUTES = 30;
const AXIS_SLOTS = 6;
const WINDOW_MINUTES = SLOT_MINUTES * AXIS_SLOTS;
const WINDOW_SECONDS = WINDOW_MINUTES * 60;
const MIN_ITEM_WIDTH = 48;

type GuideSegment = {
  item: MediaItem;
  startSec: number;
  endSec: number;
  scheduleIndex: number;
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  if (minutes >= 1) {
    return `${minutes} min`;
  }

  return `${safeSeconds}s`;
}

function floorToHalfHour(date: Date): Date {
  const nextDate = new Date(date);

  nextDate.setSeconds(0, 0);

  const minutes = nextDate.getMinutes();
  nextDate.setMinutes(minutes < 30 ? 0 : 30);

  return nextDate;
}

function getSafeDuration(item: MediaItem): number {
  const duration = Number(item.duration);

  if (!Number.isFinite(duration) || duration <= 0) {
    return 1;
  }

  return Math.max(Math.floor(duration), 1);
}

function getTotalScheduleDuration(schedule: MediaItem[]): number {
  return schedule.reduce((sum, item) => sum + getSafeDuration(item), 0);
}

function getSecondsSinceBroadcastEpoch(dateMs: number): number {
  return Math.floor((dateMs - BROADCAST_EPOCH_MS) / 1000);
}

function getScheduleOffsetAtBroadcastSecond(
  schedule: MediaItem[],
  broadcastSeconds: number,
): number {
  const total = getTotalScheduleDuration(schedule);

  if (total <= 0) {
    return 0;
  }

  return ((broadcastSeconds % total) + total) % total;
}

function buildGuideSegments(
  schedule: MediaItem[],
  windowStartBroadcastSeconds: number,
): GuideSegment[] {
  const playableSchedule = schedule.filter((item) => item.file && item.duration > 0);

  if (playableSchedule.length === 0) {
    return [];
  }

  const totalDuration = getTotalScheduleDuration(playableSchedule);

  if (totalDuration <= 0) {
    return [];
  }

  const offset = getScheduleOffsetAtBroadcastSecond(
    playableSchedule,
    windowStartBroadcastSeconds,
  );

  let scheduleIndex = 0;
  let accumulated = 0;

  for (let index = 0; index < playableSchedule.length; index += 1) {
    const duration = getSafeDuration(playableSchedule[index]);
    const end = accumulated + duration;

    if (offset >= accumulated && offset < end) {
      scheduleIndex = index;
      break;
    }

    accumulated = end;
  }

  let offsetInsideCurrent = offset - accumulated;
  let cursor = 0;
  const segments: GuideSegment[] = [];

  while (cursor < WINDOW_SECONDS) {
    const item = playableSchedule[scheduleIndex];

    if (!item) {
      break;
    }

    const itemDuration = getSafeDuration(item);
    const remainingInItem = Math.max(itemDuration - offsetInsideCurrent, 1);
    const segmentDuration = Math.min(remainingInItem, WINDOW_SECONDS - cursor);

    segments.push({
      item,
      startSec: cursor,
      endSec: cursor + segmentDuration,
      scheduleIndex,
    });

    cursor += segmentDuration;
    scheduleIndex = (scheduleIndex + 1) % playableSchedule.length;
    offsetInsideCurrent = 0;
  }

  return segments;
}

export default function GuideGrid({ schedule }: { schedule: MediaItem[] }) {
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setMounted(true);
    setNowMs(Date.now());

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const windowStart = useMemo(() => floorToHalfHour(now), [now]);

  const live = useMemo(() => getLiveState(schedule, nowMs), [schedule, nowMs]);

  const windowStartBroadcastSeconds = useMemo(
    () => getSecondsSinceBroadcastEpoch(windowStart.getTime()),
    [windowStart],
  );

  const guideSegments = useMemo(
    () => buildGuideSegments(schedule, windowStartBroadcastSeconds),
    [schedule, windowStartBroadcastSeconds],
  );

  const secondsSinceWindowStart = Math.min(
    WINDOW_SECONDS,
    Math.max(0, Math.floor((now.getTime() - windowStart.getTime()) / 1000)),
  );

  const totalTimelineWidth = AXIS_SLOTS * SLOT_MINUTES * PX_PER_MINUTE;
  const nowLineLeft = (secondsSinceWindowStart / 60) * PX_PER_MINUTE;

  if (!mounted) {
    return null;
  }

  if (!schedule.length || !live.item) {
    return (
      <section
        className="rounded-2xl border p-4"
        style={{
          background: "var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div className="text-sm font-semibold">No schedule loaded.</div>
        <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Assign media to this channel to generate a guide.
        </div>
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border shadow-2xl shadow-black/20"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      aria-label="Single channel guide grid"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-sm"
        style={{
          borderColor: "var(--border)",
          background: "var(--guide-header-bg)",
        }}
      >
        <div>
          <div
            className="text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--text-muted)" }}
          >
            Tate&apos;s TV
          </div>

          <div className="mt-1 font-semibold">Listings</div>
        </div>

        <div className="text-right">
          <div className="font-semibold">{formatTime(now)}</div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {WINDOW_MINUTES} minute view
          </div>
        </div>
      </div>

      <div className="overflow-x-auto p-4">
        <div
          className="relative min-w-max"
          style={{ width: `${totalTimelineWidth}px` }}
        >
          <div
            className="mb-2 flex text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {Array.from({ length: AXIS_SLOTS }).map((_, index) => {
              const tickTime = new Date(
                windowStart.getTime() + index * SLOT_MINUTES * 60 * 1000,
              );

              return (
                <div
                  key={tickTime.toISOString()}
                  className="border-r px-2 last:border-r-0"
                  style={{
                    width: `${SLOT_MINUTES * PX_PER_MINUTE}px`,
                    borderColor: "var(--border)",
                  }}
                >
                  {formatTime(tickTime)}
                </div>
              );
            })}
          </div>

          <div
            className="relative h-[68px] overflow-hidden rounded-xl border"
            style={{
              borderColor: "var(--border)",
              background: "var(--guide-row-bg)",
            }}
          >
            {Array.from({ length: AXIS_SLOTS }).map((_, index) => (
              <div
                key={index}
                className="absolute top-0 h-full border-r"
                style={{
                  left: `${index * SLOT_MINUTES * PX_PER_MINUTE}px`,
                  borderColor: "var(--border)",
                }}
                aria-hidden="true"
              />
            ))}

            {guideSegments.length === 0 ? (
              <div
                className="absolute inset-0 flex items-center justify-center text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                Off Air
              </div>
            ) : null}

            {guideSegments.map((segment, index) => {
              const segmentDuration = segment.endSec - segment.startSec;
              const width = Math.max(
                (segmentDuration / 60) * PX_PER_MINUTE,
                MIN_ITEM_WIDTH,
              );

              const left = (segment.startSec / 60) * PX_PER_MINUTE;

              const isCurrent =
                segment.startSec <= secondsSinceWindowStart &&
                segment.endSec > secondsSinceWindowStart;

              return (
                <button
                  key={`${segment.item.id}-${segment.startSec}-${index}`}
                  type="button"
                  className="absolute top-0 h-full overflow-hidden border px-2 py-2 text-left text-xs transition hover:brightness-110"
                  style={{
                    left: `${left}px`,
                    width: `${width}px`,
                    borderColor: "var(--border)",
                    background: isCurrent
                      ? "var(--guide-current-bg)"
                      : "var(--panel-alt-bg)",
                    color: isCurrent ? "#0f172a" : "var(--text)",
                  }}
                  title={`${segment.item.title} • ${formatDuration(
                    segment.item.duration,
                  )}`}
                >
                  <div className="truncate font-semibold tracking-tight">
                    {segment.item.title}
                  </div>

                  <div className="mt-1 truncate text-[10px]" style={{ opacity: 0.75 }}>
                    {segment.item.type.toUpperCase()} •{" "}
                    {formatDuration(segment.item.duration)}
                  </div>
                </button>
              );
            })}

            <div
              className="absolute bottom-0 top-0 z-20 w-[2px] bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.85)]"
              style={{
                left: `${nowLineLeft}px`,
              }}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </section>
  );
}