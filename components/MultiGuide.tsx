"use client";

import { useEffect, useMemo, useState } from "react";
import { BROADCAST_EPOCH_MS } from "@/lib/liveEngine";
import { useStore } from "@/lib/store";
import type { Channel, MediaItem } from "@/lib/types";

const ROW_HEIGHT = 56;
const SLOT_MINUTES = 30;
const SLOT_COUNT = 6;
const CHANNEL_COLUMN_WIDTH = 118;
const MIN_SLOT_WIDTH = 150;
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));

  if (safeSeconds < 60) {
    return `${safeSeconds}s`;
  }

  const minutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  return `${minutes} min`;
}

function floorToHalfHour(date: Date): Date {
  const nextDate = new Date(date);

  nextDate.setSeconds(0, 0);

  const minutes = nextDate.getMinutes();
  nextDate.setMinutes(minutes < 30 ? 0 : 30);

  return nextDate;
}

function getChannelLabel(channel: Channel): string {
  return `CH ${channel.number ?? channel.id}`;
}

function getChannelName(channel: Channel): string {
  return channel.branding?.displayName ?? channel.name;
}

function getTotalScheduleDuration(schedule: MediaItem[]): number {
  return schedule.reduce((sum, item) => {
    const duration = Number(item.duration);

    if (!Number.isFinite(duration) || duration <= 0) {
      return sum + 1;
    }

    return sum + Math.max(Math.floor(duration), 1);
  }, 0);
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

function buildVisibleTimeline(
  schedule: MediaItem[],
  windowStartBroadcastSeconds: number,
  windowDurationSeconds: number,
): TimelineSegment[] {
  const playableSchedule = schedule.filter((item) => item.file && item.duration > 0);

  if (playableSchedule.length === 0) {
    return [];
  }

  const total = getTotalScheduleDuration(playableSchedule);

  if (total <= 0) {
    return [];
  }

  const scheduleOffset = getScheduleOffsetAtBroadcastSecond(
    playableSchedule,
    windowStartBroadcastSeconds,
  );

  let scheduleIndex = 0;
  let accumulated = 0;

  for (let index = 0; index < playableSchedule.length; index += 1) {
    const duration = Math.max(Math.floor(playableSchedule[index]?.duration ?? 1), 1);
    const end = accumulated + duration;

    if (scheduleOffset >= accumulated && scheduleOffset < end) {
      scheduleIndex = index;
      break;
    }

    accumulated = end;
  }

  let offsetInsideCurrent = scheduleOffset - accumulated;
  let cursor = 0;
  const segments: TimelineSegment[] = [];

  while (cursor < windowDurationSeconds) {
    const item = playableSchedule[scheduleIndex];

    if (!item) {
      break;
    }

    const itemDuration = Math.max(Math.floor(item.duration), 1);
    const remainingInItem = Math.max(itemDuration - offsetInsideCurrent, 1);
    const segmentDuration = Math.min(
      remainingInItem,
      windowDurationSeconds - cursor,
    );

    segments.push({
      item,
      startSec: cursor,
      endSec: cursor + segmentDuration,
    });

    cursor += segmentDuration;
    scheduleIndex = (scheduleIndex + 1) % playableSchedule.length;
    offsetInsideCurrent = 0;
  }

  return segments;
}

export default function MultiGuide({
  data,
  onProgramSelect,
}: MultiGuideProps) {
  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());

    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const enabledRows = useMemo(
    () =>
      data
        .filter(({ channel }) => channel.isEnabled !== false)
        .sort((a, b) => {
          const aNumber = Number(a.channel.number ?? a.channel.id);
          const bNumber = Number(b.channel.number ?? b.channel.id);

          if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
            return aNumber - bNumber;
          }

          return a.channel.id.localeCompare(b.channel.id);
        }),
    [data],
  );

  const windowStart = useMemo(() => {
    if (!now) {
      return null;
    }

    return floorToHalfHour(now);
  }, [now]);

  if (!mounted || !now || !windowStart) {
    return null;
  }

  const secondsSinceWindowStart = Math.min(
    WINDOW_SECONDS,
    Math.max(0, Math.floor((now.getTime() - windowStart.getTime()) / 1000)),
  );

  const windowStartBroadcastSeconds = getSecondsSinceBroadcastEpoch(
    windowStart.getTime(),
  );

  const timelineGridTemplate = `repeat(${SLOT_COUNT}, minmax(${MIN_SLOT_WIDTH}px, 1fr))`;
  const nowLinePercent = Math.min(
    100,
    Math.max(0, (secondsSinceWindowStart / WINDOW_SECONDS) * 100),
  );

  return (
    <section
      className="w-full overflow-hidden rounded-2xl border shadow-2xl"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      aria-label="Live TV guide"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
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

        <div className="text-right">
          <div className="text-sm font-semibold">{formatTime(now)}</div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {WINDOW_MINUTES} minute window
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `${CHANNEL_COLUMN_WIDTH}px minmax(${
              SLOT_COUNT * MIN_SLOT_WIDTH
            }px, 1fr)`,
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
            {Array.from({ length: SLOT_COUNT }).map((_, index) => {
              const tickTime = new Date(
                windowStart.getTime() + index * SLOT_MINUTES * 60 * 1000,
              );

              return (
                <div
                  key={tickTime.toISOString()}
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

          {enabledRows.length === 0 ? (
            <div
              className="col-span-2 flex items-center justify-center px-4 py-8 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              No enabled channels available.
            </div>
          ) : (
            enabledRows.map(({ channel, schedule }, rowIndex) => {
              const isActive = channel.id === currentChannelId;
              const accent = channel.branding?.accentColor || "#2563eb";

              const visibleSegments = buildVisibleTimeline(
                schedule,
                windowStartBroadcastSeconds,
                WINDOW_SECONDS,
              );

              return (
                <GuideRow
                  key={channel.id}
                  channel={channel}
                  isActive={isActive}
                  accent={accent}
                  rowIndex={rowIndex}
                  visibleSegments={visibleSegments}
                  nowLinePercent={nowLinePercent}
                  onProgramSelect={(payload) => {
                    setChannel(payload.channel.id);
                    onProgramSelect?.(payload);
                  }}
                />
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function GuideRow({
  channel,
  isActive,
  accent,
  rowIndex,
  visibleSegments,
  nowLinePercent,
  onProgramSelect,
}: {
  channel: Channel;
  isActive: boolean;
  accent: string;
  rowIndex: number;
  visibleSegments: TimelineSegment[];
  nowLinePercent: number;
  onProgramSelect?: (payload: { channel: Channel; item: MediaItem }) => void;
}) {
  const rowBg = isActive
    ? "var(--guide-active-bg)"
    : rowIndex % 2 === 0
      ? "var(--guide-row-bg)"
      : "var(--guide-row-alt-bg)";

  const activeTextColor = isActive ? "#0f172a" : "var(--text)";

  return (
    <>
      <div
        className="flex flex-col justify-center border-r border-b px-3"
        style={{
          height: `${ROW_HEIGHT}px`,
          borderColor: "var(--border)",
          background: isActive ? "var(--guide-active-bg)" : "var(--panel-alt-bg)",
          borderLeft: `3px solid ${isActive ? accent : "transparent"}`,
          color: activeTextColor,
        }}
      >
        <div className="text-[13px] font-semibold">{getChannelLabel(channel)}</div>

        <div
          className="truncate text-[10px] uppercase tracking-[0.16em]"
          style={{ opacity: 0.8 }}
          title={getChannelName(channel)}
        >
          {channel.branding?.callsign || getChannelName(channel)}
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
          style={{
            gridTemplateColumns: `repeat(${SLOT_COUNT}, minmax(${MIN_SLOT_WIDTH}px, 1fr))`,
          }}
          aria-hidden="true"
        >
          {Array.from({ length: SLOT_COUNT }).map((_, index) => (
            <div
              key={index}
              className="border-r last:border-r-0"
              style={{ borderColor: "var(--border)" }}
            />
          ))}
        </div>

        {visibleSegments.length === 0 ? (
          <div
            className="absolute inset-0 flex items-center justify-center text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Off Air
          </div>
        ) : null}

        {visibleSegments.map((segment, index) => {
          const leftPercent = (segment.startSec / WINDOW_SECONDS) * 100;
          const widthPercent =
            ((segment.endSec - segment.startSec) / WINDOW_SECONDS) * 100;

          const isCurrentProgram =
            segment.startSec <= (nowLinePercent / 100) * WINDOW_SECONDS &&
            segment.endSec > (nowLinePercent / 100) * WINDOW_SECONDS;

          return (
            <button
              key={`${channel.id}-${segment.item.id}-${index}-${segment.startSec}`}
              type="button"
              onClick={() =>
                onProgramSelect?.({
                  channel,
                  item: segment.item,
                })
              }
              className="absolute top-0 overflow-hidden border px-2 py-1 text-left text-[11px] leading-tight transition hover:brightness-110"
              style={{
                left: `${leftPercent}%`,
                width: `${Math.max(widthPercent, 1.25)}%`,
                height: `${ROW_HEIGHT}px`,
                background: isCurrentProgram
                  ? "var(--guide-current-bg)"
                  : "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: isCurrentProgram ? "#0f172a" : "var(--text)",
              }}
              title={`${segment.item.title} • ${formatDuration(
                segment.item.duration,
              )}`}
            >
              <div className="truncate font-medium tracking-tight">
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
          className="absolute bottom-0 top-0 z-10 w-[2px] bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.85)]"
          style={{
            left: `${nowLinePercent}%`,
          }}
          aria-hidden="true"
        />
      </div>
    </>
  );
}