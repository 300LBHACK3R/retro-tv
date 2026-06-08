"use client";

import { useEffect, useMemo, useState } from "react";
import { BROADCAST_EPOCH_MS } from "@/lib/liveEngine";
import { isHiddenGuideItem } from "@/lib/guideSchedule";
import { useStore } from "@/lib/store";
import { cleanDisplayText } from "@/lib/textClean";
import type { BroadcastItem, Channel } from "@/lib/types";

const BASE_ROW_HEIGHT = 58;
const COMPACT_ROW_HEIGHT = 48;
const SLOT_MINUTES = 30;
const SLOT_COUNT = 6;
const CHANNEL_COLUMN_WIDTH = 132;
const MIN_SLOT_WIDTH = 164;
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

function getTimelineGridTemplate(): string {
  return `repeat(${SLOT_COUNT}, minmax(${MIN_SLOT_WIDTH}px, 1fr))`;
}

function EmptyGuideState({ message }: { message: string }) {
  return (
    <div
      className="col-span-2 flex items-center justify-center px-4 py-8 text-sm"
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

  const secondsSinceWindowStart = Math.min(
    WINDOW_SECONDS,
    Math.max(0, Math.floor((now.getTime() - windowStart.getTime()) / 1000)),
  );

  const windowStartBroadcastSeconds = getSecondsSinceBroadcastEpoch(
    windowStart.getTime(),
  );

  const timelineGridTemplate = getTimelineGridTemplate();

  const nowLinePercent = Math.min(
    100,
    Math.max(0, (secondsSinceWindowStart / WINDOW_SECONDS) * 100),
  );

  return (
    <section
      className="ttv-glass-panel w-full overflow-hidden rounded-2xl shadow-2xl"
      style={{
        color: "var(--text)",
      }}
      aria-label="Live TV guide"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
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
            TatesTv
          </div>

          <div className="mt-1 text-sm font-black">Live Guide</div>
        </div>

        <div className="text-right">
          <div className="text-sm font-black">{formatTime(now)}</div>

          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {WINDOW_MINUTES} minute window / commercials hidden
          </div>
        </div>
      </div>

      <div className="ttv-guide-scroll w-full">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `${CHANNEL_COLUMN_WIDTH}px minmax(${
              SLOT_COUNT * MIN_SLOT_WIDTH
            }px, 1fr)`,
          }}
        >
          <div
            className="border-r border-b px-3 py-3 text-xs font-black uppercase tracking-[0.12em]"
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
                  className="border-r px-3 py-3 text-xs font-black last:border-r-0"
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
            <EmptyGuideState message="No enabled channels available." />
          ) : (
            enabledRows.map(({ channel, schedule }, rowIndex) => {
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
                  visibleSegments={visibleSegments}
                  nowLinePercent={nowLinePercent}
                  onChannelSelect={() => {
                    setChannel(channel.id);
                  }}
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
  rowHeight,
  visibleSegments,
  nowLinePercent,
  onChannelSelect,
  onProgramSelect,
}: {
  channel: Channel;
  isActive: boolean;
  accent: string;
  rowIndex: number;
  rowHeight: number;
  visibleSegments: TimelineSegment[];
  nowLinePercent: number;
  onChannelSelect: () => void;
  onProgramSelect?: (payload: { channel: Channel; item: BroadcastItem }) => void;
}) {
  const rowBg = isActive
    ? "var(--guide-active-bg)"
    : rowIndex % 2 === 0
      ? "var(--guide-row-bg)"
      : "var(--guide-row-alt-bg)";

  const channelTextColor = isActive ? "#0f172a" : "var(--text)";
  const nowSeconds = (nowLinePercent / 100) * WINDOW_SECONDS;
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
        className="ttv-touch-target flex flex-col justify-center border-r border-b px-3 text-left transition hover:opacity-90"
        style={{
          height: `${rowHeight}px`,
          borderColor: "var(--border)",
          background: isActive ? "var(--guide-active-bg)" : "var(--panel-alt-bg)",
          borderLeft: `3px solid ${isActive ? accent : "transparent"}`,
          color: channelTextColor,
        }}
      >
        <div className="text-[13px] font-black">{getChannelLabel(channel)}</div>

        <div
          className="truncate text-[10px] font-semibold uppercase tracking-[0.16em]"
          style={{ opacity: 0.8 }}
          title={getChannelName(channel)}
        >
          {getChannelCallsign(channel)}
        </div>
      </button>

      <div
        className="relative border-b"
        style={{
          height: `${rowHeight}px`,
          borderColor: "var(--border)",
          background: rowBg,
        }}
      >
        <div
          className="grid h-full w-full"
          style={{
            gridTemplateColumns: getTimelineGridTemplate(),
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
              className="absolute top-0 overflow-hidden border px-2 py-1 text-left text-[11px] leading-tight transition hover:brightness-110"
              style={{
                left: `${leftPercent}%`,
                width: `${Math.max(widthPercent, 1.35)}%`,
                height: `${rowHeight}px`,
                background: isCurrentProgram
                  ? "var(--guide-current-bg)"
                  : "var(--panel-alt-bg)",
                borderColor: isCurrentProgram ? accent : "var(--border)",
                color: isCurrentProgram ? "#0f172a" : "var(--text)",
                boxShadow: isCurrentProgram
                  ? `inset 0 0 0 1px ${accent}, 0 0 18px rgba(255,255,255,0.10)`
                  : "none",
              }}
              title={`${title} / ${formatDuration(duration)}`}
              aria-label={`${getChannelLabel(channel)} ${title}, ${formatDuration(
                duration,
              )}`}
            >
              <div className="truncate font-black tracking-tight">
                {title}
              </div>

              <div className="mt-1 truncate text-[10px]" style={{ opacity: 0.75 }}>
                {segment.item.type.toUpperCase()} / {formatDuration(duration)}
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