"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Channel, MediaItem } from "@/lib/types";

const PX_PER_MINUTE = 6;
const ROW_HEIGHT = 52;
const SLOT_MINUTES = 30;
const SLOT_COUNT = 6;
const CHANNEL_COLUMN_WIDTH = 96;
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

  const totalTimelineWidth = WINDOW_MINUTES * PX_PER_MINUTE;

  const windowStart = useMemo(() => {
    if (!now) return null;
    return floorToHalfHour(now);
  }, [now]);

  if (!mounted || !now || !windowStart) return null;

  const secondsSinceWindowStart = Math.floor(
    (now.getTime() - windowStart.getTime()) / 1000
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/90 text-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Tate&apos;s TV
          </div>
          <div className="mt-1 text-sm font-semibold text-white">
            Live Guide
          </div>
        </div>

        <div className="text-sm text-slate-300">{formatTime(now)}</div>
      </div>

      <div className="min-w-max">
        <div className="flex border-b border-slate-800 bg-slate-900/80 text-xs text-slate-300">
          <div
            className="shrink-0 border-r border-slate-800 px-3 py-3 font-medium"
            style={{ width: `${CHANNEL_COLUMN_WIDTH}px` }}
          >
            Channels
          </div>

          <div className="relative flex" style={{ width: `${totalTimelineWidth}px` }}>
            {Array.from({ length: SLOT_COUNT }).map((_, i) => {
              const tickTime = new Date(
                windowStart.getTime() + i * SLOT_MINUTES * 60 * 1000
              );

              return (
                <div
                  key={i}
                  className="border-r border-slate-800 px-3 py-3 last:border-r-0"
                  style={{ width: `${SLOT_MINUTES * PX_PER_MINUTE}px` }}
                >
                  {formatTime(tickTime)}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex">
          <div className="flex flex-col">
            {data.map(({ channel }) => {
              const isActive = channel.id === currentChannelId;
              const accent = channel.branding?.accentColor || "#2563eb";

              return (
                <div
                  key={channel.id}
                  style={{
                    height: `${ROW_HEIGHT}px`,
                    width: `${CHANNEL_COLUMN_WIDTH}px`,
                    borderLeft: isActive ? `3px solid ${accent}` : "3px solid transparent",
                  }}
                  className={`flex shrink-0 flex-col items-start justify-center border-b border-r border-slate-800 px-3 ${
                    isActive
                      ? "bg-slate-200 text-slate-950"
                      : "bg-slate-900 text-white"
                  }`}
                >
                  <div className="text-[13px] font-semibold">CH {channel.id}</div>
                  <div className="truncate text-[10px] uppercase tracking-[0.16em] opacity-80">
                    {channel.branding?.callsign || channel.name}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col">
            {data.map(({ channel, schedule }, rowIndex) => {
              const isActive = channel.id === currentChannelId;

              const visibleSegments = buildVisibleTimeline(
                schedule,
                Math.floor(windowStart.getTime() / 1000),
                WINDOW_SECONDS
              );

              return (
                <div
                  key={channel.id}
                  style={{
                    height: `${ROW_HEIGHT}px`,
                    width: `${totalTimelineWidth}px`,
                  }}
                  className={`relative border-b border-slate-800 ${
                    isActive
                      ? "bg-slate-800"
                      : rowIndex % 2 === 0
                      ? "bg-slate-950"
                      : "bg-slate-900/80"
                  }`}
                >
                  {Array.from({ length: SLOT_COUNT }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute bottom-0 top-0 border-r border-slate-800"
                      style={{
                        left: `${i * SLOT_MINUTES * PX_PER_MINUTE}px`,
                      }}
                    />
                  ))}

                  {visibleSegments.map((segment, index) => {
                    const left = (segment.startSec / 60) * PX_PER_MINUTE;
                    const width =
                      ((segment.endSec - segment.startSec) / 60) * PX_PER_MINUTE;

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
                        style={{
                          width: `${width}px`,
                          left: `${left}px`,
                          top: 0,
                          height: `${ROW_HEIGHT}px`,
                          position: "absolute",
                        }}
                        className={`overflow-hidden border px-2 py-1 text-left text-[11px] leading-tight transition ${
                          isCurrentProgram
                            ? "border-blue-300 bg-blue-200 text-slate-950"
                            : "border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
                        }`}
                      >
                        <div className="truncate font-medium tracking-tight">
                          {segment.item.title}
                        </div>
                        <div className="mt-1 text-[10px] opacity-70">
                          {formatDuration(segment.item.duration)}
                        </div>
                      </button>
                    );
                  })}

                  <div
                    className="absolute bottom-0 top-0 z-10 w-[2px] bg-red-500"
                    style={{
                      left: `${(secondsSinceWindowStart / WINDOW_SECONDS) * totalTimelineWidth}px`,
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}