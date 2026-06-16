"use client";

import { useEffect, useMemo, useState } from "react";
import { BROADCAST_EPOCH_MS } from "@/lib/liveEngine";
import { isHiddenGuideItem } from "@/lib/guideSchedule";
import { useStore } from "@/lib/store";
import { cleanDisplayText } from "@/lib/textClean";
import type { BroadcastItem, Channel } from "@/lib/types";

const BASE_ROW_HEIGHT = 74;
const COMPACT_ROW_HEIGHT = 62;
const SLOT_MINUTES = 30;
const GUIDE_HOURS = 24;
const SLOT_COUNT = GUIDE_HOURS * 2;
const CHANNEL_COLUMN_WIDTH = 132;
const MIN_SLOT_WIDTH = 154;
const WINDOW_MINUTES = SLOT_MINUTES * SLOT_COUNT;
const WINDOW_SECONDS = WINDOW_MINUTES * 60;
const LIVE_TICK_MS = 15_000;

type MultiGuideRow = {
  channel: Channel;
  schedule: BroadcastItem[];
};

interface MultiGuideProps {
  data: MultiGuideRow[];
  onProgramSelect?: (payload: { channel: Channel; item: BroadcastItem }) => void;
}

type TimelineSegment = {
  item: BroadcastItem;
  startSec: number;
  endSec: number;
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
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
  return cleanDisplayText(channel.branding?.displayName ?? channel.name);
}

function getChannelCallsign(channel: Channel): string {
  return cleanDisplayText(channel.branding?.callsign || getChannelName(channel));
}

function getGuideTitle(item: BroadcastItem): string {
  return cleanDisplayText(item.sourceTitle?.trim() || item.title);
}

function getGuideDuration(item: BroadcastItem): number {
  const guideDuration = Math.floor(Number(item.guideDuration));

  if (Number.isFinite(guideDuration) && guideDuration > 0) {
    return guideDuration;
  }

  const duration = Math.floor(Number(item.duration));

  return Number.isFinite(duration) && duration > 0 ? duration : 1;
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

function getVisibleSchedule(schedule: BroadcastItem[]): BroadcastItem[] {
  return schedule.filter(
    (item) => item.file && getGuideDuration(item) > 0 && !isHiddenGuideItem(item),
  );
}

function buildVisibleTimeline(
  schedule: BroadcastItem[],
  windowStartBroadcastSeconds: number,
  windowDurationSeconds: number,
): TimelineSegment[] {
  const visibleSchedule = getVisibleSchedule(schedule);

  if (visibleSchedule.length === 0) {
    return [];
  }

  const total = getTotalScheduleDuration(visibleSchedule);

  if (total <= 0) {
    return [];
  }

  const scheduleOffset = getScheduleOffsetAtBroadcastSecond(
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

    if (scheduleOffset >= accumulated && scheduleOffset < end) {
      scheduleIndex = index;
      break;
    }

    accumulated = end;
  }

  let offsetInsideCurrent = Math.max(0, scheduleOffset - accumulated);
  let cursor = 0;
  const segments: TimelineSegment[] = [];

  while (cursor < windowDurationSeconds) {
    const item = visibleSchedule[scheduleIndex];

    if (!item) {
      break;
    }

    const itemDuration = getGuideDuration(item);
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
    scheduleIndex = (scheduleIndex + 1) % visibleSchedule.length;
    offsetInsideCurrent = 0;
  }

  return segments;
}

function sortRows(data: MultiGuideRow[]): MultiGuideRow[] {
  return [...data]
    .filter(({ channel }) => channel.isEnabled !== false)
    .sort((a, b) => {
      const aNumber = Number(a.channel.number ?? a.channel.id);
      const bNumber = Number(b.channel.number ?? b.channel.id);

      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
        return aNumber - bNumber;
      }

      return a.channel.id.localeCompare(b.channel.id);
    });
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

function getSafeAccent(channel: Channel): string {
  const accent = channel.branding?.accentColor?.trim();

  if (accent && isValidHexColor(accent)) {
    return accent.toLowerCase();
  }

  return "var(--primary)";
}

function EmptyGuideState({ message }: { message: string }) {
  return (
    <div
      className="flex min-h-[14rem] items-center justify-center px-4 py-8 text-sm"
      style={{ color: "var(--text-muted)" }}
    >
      {message}
    </div>
  );
}

export default function MultiGuide({
  data,
  onProgramSelect,
}: MultiGuideProps) {
  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);
  const guideDensity = useStore((state) => state.viewerSettings.guideDensity);

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());

    const interval = window.setInterval(() => {
      setNow(new Date());
    }, LIVE_TICK_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const enabledRows = useMemo(() => sortRows(data), [data]);

  const windowStart = useMemo(() => {
    if (!now) {
      return null;
    }

    return floorToHalfHour(now);
  }, [now]);

  if (!mounted || !now || !windowStart) {
    return null;
  }

  const rowHeight = guideDensity === "compact" ? COMPACT_ROW_HEIGHT : BASE_ROW_HEIGHT;
  const timelineWidth = SLOT_COUNT * MIN_SLOT_WIDTH;

  const secondsSinceWindowStart = Math.min(
    WINDOW_SECONDS,
    Math.max(0, Math.floor((now.getTime() - windowStart.getTime()) / 1000)),
  );

  const windowStartBroadcastSeconds = getSecondsSinceBroadcastEpoch(
    windowStart.getTime(),
  );

  const nowLineLeft = Math.min(
    timelineWidth,
    Math.max(0, (secondsSinceWindowStart / WINDOW_SECONDS) * timelineWidth),
  );

  const guideEnd = new Date(windowStart.getTime() + WINDOW_SECONDS * 1000);

  return (
    <section
      className="ttv-glass-panel flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border shadow-2xl"
      style={{
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      aria-label="Live TV guide"
    >
      <div
        className="flex shrink-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.06), transparent 42%), var(--guide-header-bg)",
        }}
      >
        <div className="min-w-0">
          <div
            className="text-[11px] font-black uppercase tracking-[0.28em]"
            style={{ color: "var(--text-muted)" }}
          >
            TatesTV
          </div>

          <div className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
            Premium Live Guide
          </div>

          <div
            className="mt-1 text-xs leading-5"
            style={{ color: "var(--text-muted)" }}
          >
            Scroll right for the next {GUIDE_HOURS} hours. Scroll down for all
            channels. Commercials are hidden from guide view.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div
            className="rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.16em]"
            style={{
              borderColor: "var(--border)",
              background: "var(--panel-alt-bg)",
              color: "var(--text)",
            }}
          >
            {formatTime(now)}
          </div>

          <div
            className="rounded-full border px-3 py-2 text-xs"
            style={{
              borderColor: "var(--border)",
              background: "var(--panel-alt-bg)",
              color: "var(--text-muted)",
            }}
          >
            {formatShortDate(windowStart)} → {formatShortDate(guideEnd)}
          </div>
        </div>
      </div>

      {enabledRows.length === 0 ? (
        <EmptyGuideState message="No enabled channels available." />
      ) : (
        <div className="ttv-guide-scroll min-h-0 flex-1 overflow-auto overscroll-contain">
          <div
            className="grid min-w-max"
            style={{
              gridTemplateColumns: `${CHANNEL_COLUMN_WIDTH}px ${timelineWidth}px`,
            }}
          >
            <div
              className="sticky left-0 top-0 z-50 flex items-center border-r border-b px-3 py-3 text-xs font-black uppercase tracking-[0.16em]"
              style={{
                minHeight: "54px",
                borderColor: "var(--border)",
                background: "var(--panel-alt-bg)",
                color: "var(--text-muted)",
              }}
            >
              Channels
            </div>

            <div
              className="sticky top-0 z-40 grid border-b"
              style={{
                width: `${timelineWidth}px`,
                gridTemplateColumns: `repeat(${SLOT_COUNT}, ${MIN_SLOT_WIDTH}px)`,
                borderColor: "var(--border)",
                background: "var(--panel-alt-bg)",
              }}
            >
              {Array.from({ length: SLOT_COUNT }).map((_, index) => {
                const tickTime = new Date(
                  windowStart.getTime() + index * SLOT_MINUTES * 60 * 1000,
                );

                const isMidnight =
                  tickTime.getHours() === 0 && tickTime.getMinutes() === 0;

                return (
                  <div
                    key={tickTime.toISOString()}
                    className="flex min-h-[54px] flex-col justify-center border-r px-3 py-2 text-xs font-black last:border-r-0"
                    style={{
                      borderColor: "var(--border)",
                      color: isMidnight ? "var(--primary)" : "var(--text-muted)",
                    }}
                  >
                    <span>{formatTime(tickTime)}</span>

                    {isMidnight ? (
                      <span className="mt-1 text-[10px] uppercase tracking-[0.16em]">
                        {formatShortDate(tickTime)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {enabledRows.map(({ channel, schedule }, rowIndex) => {
              const isActive = channel.id === currentChannelId;
              const accent = getSafeAccent(channel);

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
                  rowHeight={rowHeight}
                  timelineWidth={timelineWidth}
                  visibleSegments={visibleSegments}
                  nowLineLeft={nowLineLeft}
                  onChannelSelect={() => {
                    setChannel(channel.id);
                  }}
                  onProgramSelect={(payload) => {
                    setChannel(payload.channel.id);
                    onProgramSelect?.(payload);
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function GuideRow({
  channel,
  isActive,
  accent,
  rowIndex,
  rowHeight,
  timelineWidth,
  visibleSegments,
  nowLineLeft,
  onChannelSelect,
  onProgramSelect,
}: {
  channel: Channel;
  isActive: boolean;
  accent: string;
  rowIndex: number;
  rowHeight: number;
  timelineWidth: number;
  visibleSegments: TimelineSegment[];
  nowLineLeft: number;
  onChannelSelect: () => void;
  onProgramSelect?: (payload: { channel: Channel; item: BroadcastItem }) => void;
}) {
  const rowBg = isActive
    ? "var(--guide-active-bg)"
    : rowIndex % 2 === 0
      ? "var(--guide-row-bg)"
      : "var(--guide-row-alt-bg)";

  const channelTextColor = isActive ? "#0f172a" : "var(--text)";
  const nowSeconds = (nowLineLeft / timelineWidth) * WINDOW_SECONDS;
  const firstVisibleItem = visibleSegments[0]?.item;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          onChannelSelect();

          if (firstVisibleItem) {
            onProgramSelect?.({
              channel,
              item: firstVisibleItem,
            });
          }
        }}
        className="ttv-touch-target sticky left-0 z-30 flex flex-col justify-center border-r border-b px-3 text-left transition hover:opacity-95"
        style={{
          height: `${rowHeight}px`,
          borderColor: "var(--border)",
          background: isActive ? "var(--guide-active-bg)" : "var(--panel-alt-bg)",
          borderLeft: `4px solid ${isActive ? accent : "transparent"}`,
          color: channelTextColor,
        }}
      >
        <div className="text-[14px] font-black">{getChannelLabel(channel)}</div>

        <div
          className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ opacity: 0.82 }}
          title={getChannelName(channel)}
        >
          {getChannelCallsign(channel)}
        </div>
      </button>

      <div
        className="relative border-b"
        style={{
          height: `${rowHeight}px`,
          width: `${timelineWidth}px`,
          borderColor: "var(--border)",
          background: rowBg,
        }}
      >
        <div
          className="grid h-full"
          style={{
            width: `${timelineWidth}px`,
            gridTemplateColumns: `repeat(${SLOT_COUNT}, ${MIN_SLOT_WIDTH}px)`,
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
            className="absolute inset-0 flex items-center justify-center text-xs font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            Off Air
          </div>
        ) : null}

        {visibleSegments.map((segment, index) => {
          const left = (segment.startSec / WINDOW_SECONDS) * timelineWidth;
          const width =
            ((segment.endSec - segment.startSec) / WINDOW_SECONDS) * timelineWidth;

          const isCurrentProgram =
            segment.startSec <= nowSeconds && segment.endSec > nowSeconds;

          const title = getGuideTitle(segment.item);
          const duration = getGuideDuration(segment.item);

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
              className="absolute top-0 overflow-hidden border px-3 py-2 text-left text-[12px] leading-tight transition hover:z-20 hover:brightness-110"
              style={{
                left: `${left}px`,
                width: `${Math.max(width, 44)}px`,
                height: `${rowHeight}px`,
                background: isCurrentProgram
                  ? "var(--guide-current-bg)"
                  : "var(--panel-alt-bg)",
                borderColor: isCurrentProgram ? accent : "var(--border)",
                color: isCurrentProgram ? "#0f172a" : "var(--text)",
                boxShadow: isCurrentProgram
                  ? `inset 0 0 0 1px ${accent}, 0 0 20px rgba(255,255,255,0.14)`
                  : "none",
              }}
              title={`${title} / ${formatDuration(duration)}`}
              aria-label={`${getChannelLabel(channel)} ${title}, ${formatDuration(
                duration,
              )}`}
            >
              <div className="truncate font-black tracking-tight">{title}</div>

              <div className="mt-1 truncate text-[10px]" style={{ opacity: 0.78 }}>
                {segment.item.type.toUpperCase()} / {formatDuration(duration)}
              </div>
            </button>
          );
        })}

        <div
          className="absolute bottom-0 top-0 z-20 w-[2px] bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.95)]"
          style={{
            left: `${nowLineLeft}px`,
          }}
          aria-hidden="true"
        />
      </div>
    </>
  );
}