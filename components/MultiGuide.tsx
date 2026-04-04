"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Channel, MediaItem } from "@/lib/types";

const ROW_HEIGHT = 52;
const SLOT_MINUTES = 30;
const SLOT_COUNT = 6;
const CHANNEL_COLUMN_WIDTH = 110;
const WINDOW_MINUTES = SLOT_MINUTES * SLOT_COUNT;
const WINDOW_SECONDS = WINDOW_MINUTES * 60;

type MultiGuideRow = {
  channel: Channel;
  schedule: MediaItem[];
};

interface MultiGuideProps {
  data: MultiGuideRow[];
  onProgramSelect?: (payload: { channel: Channel; item: MediaItem }) => void;
}

type TimelineSegment = {
  item: MediaItem;
  startSec: number;
  endSec: number;
};

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)} min`;
}

function floorToHalfHour(date: Date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const minutes = d.getMinutes();
  d.setMinutes(minutes < 30 ? 0 : 30);
  return d;
}

function getTotalScheduleDuration(schedule: MediaItem[]) {
  return schedule.reduce((sum, item) => sum + Math.max(item.duration, 1), 0);
}

function getScheduleOffsetAtAbsoluteTime(
  schedule: MediaItem[],
  absoluteSeconds: number
) {
  const total = getTotalScheduleDuration(schedule);
  if (total <= 0) return 0;
  return ((absoluteSeconds % total) + total) % total;
}

function buildVisibleTimeline(
  schedule: MediaItem[],
  windowStartAbsoluteSeconds: number,
  windowDurationSeconds: number
): TimelineSegment[] {
  if (!schedule.length) return [];

  const total = getTotalScheduleDuration(schedule);
  if (total <= 0) return [];

  let scheduleOffset = getScheduleOffsetAtAbsoluteTime(
    schedule,
    windowStartAbsoluteSeconds
  );

  let scheduleIndex = 0;
  let accumulated = 0;

  for (let i = 0; i < schedule.length; i += 1) {
    const dur = Math.max(schedule[i].duration, 1);
    if (scheduleOffset >= accumulated && scheduleOffset < accumulated + dur) {
      scheduleIndex = i;
      break;
    }
    accumulated += dur;
  }

  let offsetInsideCurrent = scheduleOffset - accumulated;
  let cursor = 0;
  const segments: TimelineSegment[] = [];

  while (cursor < windowDurationSeconds) {
    const item = schedule[scheduleIndex];
    const itemDuration = Math.max(item.duration, 1);
    const remainingInItem = itemDuration - offsetInsideCurrent;
    const segmentDuration = Math.min(
      remainingInItem,
      windowDurationSeconds - cursor
    );

    segments.push({
      item,
      startSec: cursor,
      endSec: cursor + segmentDuration,
    });

    cursor += segmentDuration;
    scheduleIndex = (scheduleIndex + 1) % schedule.length;
    offsetInsideCurrent = 0;
  }

  return segments;
}

export default function MultiGuide({
  data,
  onProgramSelect,
}: MultiGuideProps) {
  const currentChannelId = useStore((state) => state.currentChannelId);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());

    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const windowStart = useMemo(() => {
    if (!now) return null;
    return floorToHalfHour(now);
  }, [now]);

  if (!mounted || !now || !windowStart) return null;

  const secondsSinceWindowStart = Math.floor(
    (now.getTime() - windowStart.getTime()) / 1000
  );

  const timelineGridTemplate = `repeat(${SLOT_COUNT}, minmax(140px, 1fr))`;

  return (
    <div
      className="w-full overflow-hidden rounded-2xl border shadow-2xl"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{
          borderColor: "var(--border)",
          background: "var(--guide-header-bg)",
        }}
      >
        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "var(--text-muted)" }}
          >
            Tate&apos;s TV
          </div>
          <div className="mt-1 text-sm font-semibold">Live Guide</div>
        </div>

        <div className="text-sm" style={{ color: "var(--text-muted)" }}>
          {formatTime(now)}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <div
          className="grid w-full"
          style={{
            gridTemplateColumns: `${CHANNEL_COLUMN_WIDTH}px minmax(0, 1fr)`,
          }}
        >
          <div
            className="border-r border-b px-3 py-3 text-xs font-medium"
            style={{
              borderColor: "var(--border)",
              background: "var(--panel-alt-bg)",
              color: "var(--text-muted)",
            }}
          >
            Channels
          </div>

          <div
            className="grid border-b"
            style={{
              gridTemplateColumns: timelineGridTemplate,
              borderColor: "var(--border)",
              background: "var(--panel-alt-bg)",
            }}
          >
            {Array.from({ length: SLOT_COUNT }).map((_, i) => {
              const tickTime = new Date(
                windowStart.getTime() + i * SLOT_MINUTES * 60 * 1000
              );

              return (
                <div
                  key={i}
                  className="border-r px-3 py-3 text-xs last:border-r-0"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  {formatTime(tickTime)}
                </div>
              );
            })}
          </div>

          {data.map(({ channel, schedule }, rowIndex) => {
            const isActive = channel.id === currentChannelId;
            const accent = channel.branding?.accentColor || "#2563eb";

            const visibleSegments = buildVisibleTimeline(
              schedule,
              Math.floor(windowStart.getTime() / 1000),
              WINDOW_SECONDS
            );

            return (
              <FragmentRow
                key={channel.id}
                channel={channel}
                isActive={isActive}
                accent={accent}
                rowIndex={rowIndex}
                visibleSegments={visibleSegments}
                secondsSinceWindowStart={secondsSinceWindowStart}
                onProgramSelect={onProgramSelect}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FragmentRow({
  channel,
  isActive,
  accent,
  rowIndex,
  visibleSegments,
  secondsSinceWindowStart,
  onProgramSelect,
}: {
  channel: Channel;
  isActive: boolean;
  accent: string;
  rowIndex: number;
  visibleSegments: TimelineSegment[];
  secondsSinceWindowStart: number;
  onProgramSelect?: (payload: { channel: Channel; item: MediaItem }) => void;
}) {
  const rowBg = isActive
    ? "var(--guide-active-bg)"
    : rowIndex % 2 === 0
    ? "var(--guide-row-bg)"
    : "var(--guide-row-alt-bg)";

  return (
    <>
      <div
        className="flex flex-col justify-center border-r border-b px-3"
        style={{
          height: `${ROW_HEIGHT}px`,
          borderColor: "var(--border)",
          background: isActive ? "var(--guide-active-bg)" : "var(--panel-alt-bg)",
          borderLeft: `3px solid ${isActive ? accent : "transparent"}`,
          color: isActive ? "#0f172a" : "var(--text)",
        }}
      >
        <div className="text-[13px] font-semibold">CH {channel.id}</div>
        <div
          className="truncate text-[10px] uppercase tracking-[0.16em]"
          style={{ opacity: 0.8 }}
        >
          {channel.branding?.callsign || channel.name}
        </div>
      </div>

      <div
        className="relative border-b"
        style={{
          height: `${ROW_HEIGHT}px`,
          borderColor: "var(--border)",
          background: rowBg,
        }}
      >
        <div
          className="grid h-full w-full"
          style={{ gridTemplateColumns: `repeat(${SLOT_COUNT}, minmax(140px, 1fr))` }}
        >
          {Array.from({ length: SLOT_COUNT }).map((_, i) => (
            <div
              key={i}
              className="border-r last:border-r-0"
              style={{ borderColor: "var(--border)" }}
            />
          ))}
        </div>

        {visibleSegments.length === 0 && (
          <div
            className="absolute inset-0 flex items-center justify-center text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Off Air
          </div>
        )}

        {visibleSegments.map((segment, index) => {
          const leftPercent = (segment.startSec / WINDOW_SECONDS) * 100;
          const widthPercent =
            ((segment.endSec - segment.startSec) / WINDOW_SECONDS) * 100;

          const isCurrentProgram =
            segment.startSec <= secondsSinceWindowStart &&
            segment.endSec > secondsSinceWindowStart;

          return (
            <button
              key={`${segment.item.id}-${index}-${segment.startSec}`}
              type="button"
              onClick={() =>
                onProgramSelect?.({
                  channel,
                  item: segment.item,
                })
              }
              className="absolute top-0 overflow-hidden border px-2 py-1 text-left text-[11px] leading-tight transition"
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                height: `${ROW_HEIGHT}px`,
                background: isCurrentProgram
                  ? "var(--guide-current-bg)"
                  : "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: isCurrentProgram ? "#0f172a" : "var(--text)",
              }}
            >
              <div className="truncate font-medium tracking-tight">
                {segment.item.title}
              </div>
              <div className="mt-1 text-[10px]" style={{ opacity: 0.75 }}>
                {formatDuration(segment.item.duration)}
              </div>
            </button>
          );
        })}

        <div
          className="absolute bottom-0 top-0 z-10 w-[2px] bg-red-500"
          style={{
            left: `${(secondsSinceWindowStart / WINDOW_SECONDS) * 100}%`,
          }}
        />
      </div>
    </>
  );
}