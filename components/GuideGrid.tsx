"use client";

import { useEffect, useMemo, useState } from "react";
import { BROADCAST_EPOCH_MS, getLiveState } from "@/lib/liveEngine";
import { isHiddenGuideItem } from "@/lib/guideSchedule";
import type { BroadcastItem } from "@/lib/types";

const PX_PER_MINUTE = 5;
const SLOT_MINUTES = 30;
const AXIS_SLOTS = 6;
const WINDOW_MINUTES = SLOT_MINUTES * AXIS_SLOTS;
const WINDOW_SECONDS = WINDOW_MINUTES * 60;
const MIN_ITEM_WIDTH = 64;
const LIVE_TICK_MS = 5_000;
const MAX_GUIDE_SEGMENTS = 240;

type GuideSegment = {
  item: BroadcastItem;
  startSec: number;
  endSec: number;
  scheduleIndex: number;
};

interface GuideGridProps {
  schedule: BroadcastItem[];
}

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

function getGuideTitle(item: BroadcastItem): string {
  return item.sourceTitle?.trim() || item.title;
}

function getGuideDuration(item: BroadcastItem): number {
  const guideDuration = Math.floor(Number(item.guideDuration));

  if (Number.isFinite(guideDuration) && guideDuration > 0) {
    return guideDuration;
  }

  const duration = Math.floor(Number(item.duration));

  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

function getVisibleSchedule(schedule: BroadcastItem[]): BroadcastItem[] {
  return schedule.filter(
    (item) => item.file && getGuideDuration(item) > 0 && !isHiddenGuideItem(item),
  );
}

function getTotalScheduleDuration(schedule: BroadcastItem[]): number {
  return schedule.reduce((sum, item) => sum + getGuideDuration(item), 0);
}

function getSecondsSinceBroadcastEpoch(dateMs: number): number {
  return Math.floor((dateMs - BROADCAST_EPOCH_MS) / 1000);
}

function getScheduleOffsetAtBroadcastSecond(
  schedule: BroadcastItem[],
  broadcastSeconds: number,
): number {
  const total = getTotalScheduleDuration(schedule);

  if (total <= 0) {
    return 0;
  }

  return ((broadcastSeconds % total) + total) % total;
}

function buildGuideSegments(
  schedule: BroadcastItem[],
  windowStartBroadcastSeconds: number,
): GuideSegment[] {
  const visibleSchedule = getVisibleSchedule(schedule);

  if (visibleSchedule.length === 0) {
    return [];
  }

  const totalDuration = getTotalScheduleDuration(visibleSchedule);

  if (totalDuration <= 0) {
    return [];
  }

  const offset = getScheduleOffsetAtBroadcastSecond(
    visibleSchedule,
    windowStartBroadcastSeconds,
  );

  let scheduleIndex = 0;
  let accumulated = 0;

  for (let index = 0; index < visibleSchedule.length; index += 1) {
    const item = visibleSchedule[index];

    if (!item) {
      continue;
    }

    const duration = getGuideDuration(item);
    const end = accumulated + duration;

    if (offset >= accumulated && offset < end) {
      scheduleIndex = index;
      break;
    }

    accumulated = end;
  }

  let offsetInsideCurrent = Math.max(0, offset - accumulated);
  let cursor = 0;
  const segments: GuideSegment[] = [];

  while (cursor < WINDOW_SECONDS) {
    const item = visibleSchedule[scheduleIndex];

    if (!item) {
      break;
    }

    const itemDuration = getGuideDuration(item);
    const remainingInItem = Math.max(itemDuration - offsetInsideCurrent, 1);
    const segmentDuration = Math.min(remainingInItem, WINDOW_SECONDS - cursor);

    segments.push({
      item,
      startSec: cursor,
      endSec: cursor + segmentDuration,
      scheduleIndex,
    });

    cursor += segmentDuration;
    scheduleIndex = (scheduleIndex + 1) % visibleSchedule.length;
    offsetInsideCurrent = 0;
  }

  return segments;
}

function getDisplayType(item: BroadcastItem): string {
  if (item.type === "movie") return "MOVIE";
  if (item.type === "show") return "SHOW";
  if (item.type === "music") return "MUSIC";
  if (item.type === "music-video") return "MUSIC VIDEO";
  if (item.type === "bumper") return "BUMPER";

  return "COMMERCIAL";
}

function getSegmentWidth(segmentDurationSeconds: number): number {
  return Math.max((segmentDurationSeconds / 60) * PX_PER_MINUTE, MIN_ITEM_WIDTH);
}

function EmptyGuideState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <section
      className="ttv-glass-panel rounded-2xl p-4"
      style={{
        color: "var(--text)",
      }}
    >
      <div className="text-sm font-black">{title}</div>

      <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
        {message}
      </div>
    </section>
  );
}

export default function GuideGrid({ schedule }: GuideGridProps) {
  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState(() => BROADCAST_EPOCH_MS);

  useEffect(() => {
    setMounted(true);
    setNowMs(Date.now());

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, LIVE_TICK_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const windowStart = useMemo(() => floorToHalfHour(now), [now]);
  const live = useMemo(() => getLiveState(schedule, nowMs), [schedule, nowMs]);
  const visibleSchedule = useMemo(() => getVisibleSchedule(schedule), [schedule]);

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

  if (!schedule.length || !live.item || visibleSchedule.length === 0) {
    return (
      <EmptyGuideState
        title="No schedule loaded."
        message="Assign shows, movies, or music videos to this channel to generate public listings."
      />
    );
  }

  return (
    <section
      className="ttv-glass-panel overflow-hidden rounded-2xl shadow-2xl shadow-black/20"
      style={{
        color: "var(--text)",
      }}
      aria-label="Single channel guide grid"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-sm"
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.04), transparent 44%), var(--guide-header-bg)",
        }}
      >
        <div>
          <div
            className="text-[11px] font-black uppercase tracking-[0.2em]"
            style={{ color: "var(--text-muted)" }}
          >
            Tate’s TV
          </div>

          <div className="mt-1 font-black">Listings</div>
        </div>

        <div className="text-right">
          <div className="font-black">{formatTime(now)}</div>

          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {WINDOW_MINUTES} minute view â€¢ commercials hidden
          </div>
        </div>
      </div>

      <div className="ttv-guide-scroll p-3 sm:p-4">
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
                  className="border-r px-2 font-black last:border-r-0"
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
            className="relative h-[78px] overflow-hidden rounded-2xl border"
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
              const width = getSegmentWidth(segmentDuration);
              const left = (segment.startSec / 60) * PX_PER_MINUTE;

              const isCurrent =
                segment.startSec <= secondsSinceWindowStart &&
                segment.endSec > secondsSinceWindowStart;

              const title = getGuideTitle(segment.item);
              const duration = getGuideDuration(segment.item);
              const displayType = getDisplayType(segment.item);

              return (
                <button
                  key={`${segment.item.id}-${segment.startSec}-${index}`}
                  type="button"
                  className="absolute top-0 h-full overflow-hidden border px-2 py-2 text-left text-xs transition hover:brightness-110"
                  style={{
                    left: `${left}px`,
                    width: `${width}px`,
                    borderColor: isCurrent ? "var(--primary)" : "var(--border)",
                    background: isCurrent
                      ? "var(--guide-current-bg)"
                      : "var(--panel-alt-bg)",
                    color: isCurrent ? "#0f172a" : "var(--text)",
                    boxShadow: isCurrent
                      ? "inset 0 0 0 1px var(--primary), 0 0 20px rgba(255,255,255,0.10)"
                      : "none",
                  }}
                  title={`${title} â€¢ ${formatDuration(duration)}`}
                  aria-label={`${title}, ${displayType}, ${formatDuration(
                    duration,
                  )}`}
                >
                  <div className="truncate font-black tracking-tight">
                    {title}
                  </div>

                  <div className="mt-1 truncate text-[10px]" style={{ opacity: 0.75 }}>
                    {displayType} â€¢ {formatDuration(duration)}
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

            <div
              className="absolute top-1 z-20 -translate-x-1/2 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-white shadow-[0_0_10px_rgba(239,68,68,0.65)]"
              style={{
                left: `${nowLineLeft}px`,
              }}
              aria-hidden="true"
            >
              Now
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}