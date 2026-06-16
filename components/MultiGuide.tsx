cd C:\Users\techn\retro-tv

$Utf8NoBom = New-Object System.Text.UTF8Encoding $false

Copy-Item .\components\MultiGuide.tsx .\components\MultiGuide.backup.tsx -Force

$MultiGuide = @'
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BROADCAST_EPOCH_MS } from "@/lib/liveEngine";
import { buildGuideSchedule, isHiddenGuideItem } from "@/lib/guideSchedule";
import { buildSchedule } from "@/lib/scheduler";
import { useStore } from "@/lib/store";
import { cleanDisplayText } from "@/lib/textClean";
import type { BroadcastItem, Channel, MediaItem } from "@/lib/types";

const BASE_ROW_HEIGHT = 58;
const COMPACT_ROW_HEIGHT = 48;

const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = 48;
const GUIDE_DAY_COUNT = 7;
const TOTAL_SLOT_COUNT = SLOTS_PER_DAY * GUIDE_DAY_COUNT;

const CHANNEL_COLUMN_WIDTH = 150;
const MIN_SLOT_WIDTH = 164;
const DAY_PIXEL_WIDTH = SLOTS_PER_DAY * MIN_SLOT_WIDTH;
const TIMELINE_MIN_WIDTH = TOTAL_SLOT_COUNT * MIN_SLOT_WIDTH;

const DAY_SECONDS = 24 * 60 * 60;
const GUIDE_WINDOW_SECONDS = DAY_SECONDS * GUIDE_DAY_COUNT;
const LIVE_TICK_MS = 15_000;

type MultiGuideRow = {
  channel: Channel;
  schedule: BroadcastItem[];
  media?: MediaItem[];
};

type TimelineSegment = {
  item: BroadcastItem;
  startSec: number;
  endSec: number;
};

type PreparedGuideRow = MultiGuideRow & {
  visibleSegments: TimelineSegment[];
};

type GuideDay = {
  date: Date;
  label: string;
  subLabel: string;
  isToday: boolean;
};

interface MultiGuideProps {
  data: MultiGuideRow[];
  onProgramSelect?: (payload: {
    channel: Channel;
    item: BroadcastItem;
  }) => void;
}

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

function startOfLocalDay(date: Date): Date {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function addDays(date: Date, amount: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function getNoonForGuideDay(date: Date): Date {
  const nextDate = new Date(date);
  nextDate.setHours(12, 0, 0, 0);
  return nextDate;
}

function buildGuideDays(now: Date): GuideDay[] {
  const today = startOfLocalDay(now);

  return Array.from({ length: GUIDE_DAY_COUNT }, (_, offset) => {
    const date = addDays(today, offset);

    const label =
      offset === 0
        ? "Today"
        : offset === 1
          ? "Tomorrow"
          : date.toLocaleDateString([], {
              weekday: "short",
            });

    return {
      date,
      label,
      subLabel: date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
      isToday: offset === 0,
    };
  });
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

function buildVisibleTimelineForWindow(
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

function buildSevenDayTimeline(row: MultiGuideRow, guideStartDate: Date): TimelineSegment[] {
  if (!row.media) {
    const guideStartBroadcastSeconds = getSecondsSinceBroadcastEpoch(
      guideStartDate.getTime(),
    );

    return buildVisibleTimelineForWindow(
      row.schedule,
      guideStartBroadcastSeconds,
      GUIDE_WINDOW_SECONDS,
    );
  }

  const segments: TimelineSegment[] = [];

  for (let dayOffset = 0; dayOffset < GUIDE_DAY_COUNT; dayOffset += 1) {
    const dayStart = addDays(guideStartDate, dayOffset);
    const scheduleDate = getNoonForGuideDay(dayStart);

    const playbackSchedule = buildSchedule(row.media, {
      channel: row.channel,
      now: scheduleDate,
    });

    const publicGuideSchedule = buildGuideSchedule(playbackSchedule);

    const dayStartBroadcastSeconds = getSecondsSinceBroadcastEpoch(
      dayStart.getTime(),
    );

    const daySegments = buildVisibleTimelineForWindow(
      publicGuideSchedule,
      dayStartBroadcastSeconds,
      DAY_SECONDS,
    );

    const dayOffsetSeconds = dayOffset * DAY_SECONDS;

    for (const segment of daySegments) {
      segments.push({
        item: segment.item,
        startSec: segment.startSec + dayOffsetSeconds,
        endSec: segment.endSec + dayOffsetSeconds,
      });
    }
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
  return `repeat(${TOTAL_SLOT_COUNT}, minmax(${MIN_SLOT_WIDTH}px, 1fr))`;
}

function getTickLabel(date: Date, index: number): {
  primary: string;
  secondary: string;
} {
  const isDayStart = index % SLOTS_PER_DAY === 0;
  const isMajorTick = index % 12 === 0;

  return {
    primary: formatTime(date),
    secondary:
      isDayStart || isMajorTick
        ? date.toLocaleDateString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
          })
        : "",
  };
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

export default function MultiGuide({ data, onProgramSelect }: MultiGuideProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const didInitialAutoScrollRef = useRef(false);

  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);
  const guideDensity = useStore((state) => state.viewerSettings.guideDensity);

  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

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

  const guideDays = useMemo(() => {
    if (!now) {
      return [];
    }

    return buildGuideDays(now);
  }, [now]);

  const guideStartDate = guideDays[0]?.date ?? null;

  const preparedRows = useMemo<PreparedGuideRow[]>(() => {
    if (!guideStartDate) {
      return [];
    }

    return sortRows(data).map((row) => ({
      ...row,
      visibleSegments: buildSevenDayTimeline(row, guideStartDate),
    }));
  }, [data, guideStartDate]);

  useEffect(() => {
    const scrollElement = scrollRef.current;

    if (!scrollElement || !now || !guideStartDate || didInitialAutoScrollRef.current) {
      return;
    }

    didInitialAutoScrollRef.current = true;

    window.requestAnimationFrame(() => {
      const secondsIntoToday = Math.max(
        0,
        Math.floor((now.getTime() - guideStartDate.getTime()) / 1000),
      );

      const estimatedLeft =
        (secondsIntoToday / GUIDE_WINDOW_SECONDS) * TIMELINE_MIN_WIDTH;

      scrollElement.scrollLeft = Math.max(
        0,
        estimatedLeft - scrollElement.clientWidth * 0.35,
      );
    });
  }, [guideStartDate, now]);

  function scrollToDay(dayIndex: number): void {
    const scrollElement = scrollRef.current;

    setSelectedDayIndex(dayIndex);

    if (!scrollElement) {
      return;
    }

    window.requestAnimationFrame(() => {
      const left = Math.max(0, dayIndex * DAY_PIXEL_WIDTH);

      scrollElement.scrollTo({
        left,
        behavior: "smooth",
      });
    });
  }

  function handleGuideScroll(): void {
    const scrollElement = scrollRef.current;

    if (!scrollElement) {
      return;
    }

    const centeredPosition = scrollElement.scrollLeft + scrollElement.clientWidth * 0.5;
    const nextDayIndex = Math.min(
      GUIDE_DAY_COUNT - 1,
      Math.max(0, Math.floor(centeredPosition / DAY_PIXEL_WIDTH)),
    );

    setSelectedDayIndex((currentDayIndex) =>
      currentDayIndex === nextDayIndex ? currentDayIndex : nextDayIndex,
    );
  }

  if (!mounted || !now || !guideStartDate) {
    return null;
  }

  const rowHeight = guideDensity === "compact" ? COMPACT_ROW_HEIGHT : BASE_ROW_HEIGHT;

  const secondsSinceGuideStart = Math.min(
    GUIDE_WINDOW_SECONDS,
    Math.max(0, Math.floor((now.getTime() - guideStartDate.getTime()) / 1000)),
  );

  const nowLinePercent = Math.min(
    100,
    Math.max(0, (secondsSinceGuideStart / GUIDE_WINDOW_SECONDS) * 100),
  );

  const timelineGridTemplate = getTimelineGridTemplate();

  return (
    <section
      className="ttv-glass-panel ttv-guide-shell w-full overflow-hidden rounded-2xl shadow-2xl"
      style={{ color: "var(--text)" }}
      aria-label="Live TV guide"
    >
      <div
        className="ttv-guide-topbar flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
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
            Tate&apos;s TV
          </div>

          <div className="mt-1 text-sm font-black">Live Guide</div>
        </div>

        <div className="text-right">
          <div className="text-sm font-black">{formatTime(now)}</div>

          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            continuous 7 day timeline / scroll right for tomorrow
          </div>
        </div>
      </div>

      <div className="ttv-guide-days" aria-label="Guide days">
        {guideDays.map((day, index) => (
          <button
            key={day.date.toISOString()}
            type="button"
            className="ttv-guide-day"
            data-active={index === selectedDayIndex ? "true" : "false"}
            onClick={() => scrollToDay(index)}
          >
            <span>{day.label}</span>
            <small>{day.subLabel}</small>
          </button>
        ))}
      </div>

      <div ref={scrollRef} className="ttv-guide-scroll w-full" onScroll={handleGuideScroll}>
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `${CHANNEL_COLUMN_WIDTH}px minmax(${TIMELINE_MIN_WIDTH}px, 1fr)`,
          }}
        >
          <div
            className="ttv-guide-sticky-corner border-r border-b px-3 py-3 text-xs font-black uppercase tracking-[0.12em]"
            style={{
              borderColor: "var(--border)",
              background: "var(--panel-alt-bg)",
              color: "var(--text-muted)",
            }}
          >
            Channels
          </div>

          <div
            className="ttv-guide-sticky-time grid border-b"
            style={{
              gridTemplateColumns: timelineGridTemplate,
              borderColor: "var(--border)",
              background: "var(--panel-alt-bg)",
            }}
          >
            {Array.from({ length: TOTAL_SLOT_COUNT }).map((_, index) => {
              const tickTime = new Date(
                guideStartDate.getTime() + index * SLOT_MINUTES * 60 * 1000,
              );

              const label = getTickLabel(tickTime, index);

              return (
                <div
                  key={tickTime.toISOString()}
                  className="border-r px-3 py-2 text-xs font-black last:border-r-0"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  <div>{label.primary}</div>

                  {label.secondary ? (
                    <div
                      className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.12em]"
                      style={{ color: "var(--primary)" }}
                    >
                      {label.secondary}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {preparedRows.length === 0 ? (
            <EmptyGuideState message="No enabled channels available." />
          ) : (
            preparedRows.map(({ channel, visibleSegments }, rowIndex) => {
              const isActive = channel.id === currentChannelId;
              const accent = getSafeAccent(channel);

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
  const nowSeconds = (nowLinePercent / 100) * GUIDE_WINDOW_SECONDS;
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
        className="ttv-guide-channel-cell ttv-touch-target flex flex-col justify-center border-r border-b px-3 text-left transition hover:opacity-90"
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
          {Array.from({ length: TOTAL_SLOT_COUNT }).map((_, index) => (
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
          const leftPercent = (segment.startSec / GUIDE_WINDOW_SECONDS) * 100;
          const widthPercent =
            ((segment.endSec - segment.startSec) / GUIDE_WINDOW_SECONDS) * 100;

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
                width: `${Math.max(widthPercent, 0.12)}%`,
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
              <div className="truncate font-black tracking-tight">{title}</div>

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
'@

[System.IO.File]::WriteAllText(
  (Resolve-Path ".\components\MultiGuide.tsx").Path,
  $MultiGuide,
  $Utf8NoBom
)

npm run typecheck
npm run build
git status --short