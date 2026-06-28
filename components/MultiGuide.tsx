"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import { isHiddenGuideItem } from "@/lib/guideSchedule";
import { BROADCAST_EPOCH_MS } from "@/lib/liveEngine";
import { buildSchedule } from "@/lib/scheduler";
import { useStore } from "@/lib/store";
import { cleanDisplayText } from "@/lib/textClean";
import type { BroadcastItem, Channel, MediaItem } from "@/lib/types";

const GUIDE_HOURS = 72;
const SLOT_MINUTES = 30;
const SLOT_COUNT = GUIDE_HOURS * 2;

const CHANNEL_COLUMN_WIDTH = 164;
const SLOT_WIDTH = 176;
const TIMELINE_WIDTH = SLOT_COUNT * SLOT_WIDTH;

const ROW_HEIGHT_COMFORTABLE = 72;
const ROW_HEIGHT_COMPACT = 58;

const SLOT_SECONDS = SLOT_MINUTES * 60;
const GUIDE_WINDOW_SECONDS = GUIDE_HOURS * 60 * 60;
const LIVE_TICK_MS = 15_000;

const MIN_CELL_WIDTH = 52;
const MIN_BUILD_STEPS = 500;

const SLOT_INDEXES = Array.from({ length: SLOT_COUNT }, (_, index) => index);

type GuideRowInput = {
  channel: Channel;
  schedule: BroadcastItem[];
  media?: MediaItem[];
  availableAds?: MediaItem[];
};

type GuideCell = {
  item: BroadcastItem;
  stableKey: string;
  startSec: number;
  endSec: number;
};

type PreparedGuideRow = GuideRowInput & {
  cells: GuideCell[];
};

type GuideMarker = {
  label: string;
  subLabel: string;
  offsetSec: number;
};

type SchedulePosition = {
  index: number;
  offsetInsideItem: number;
  previousVisibleItem?: BroadcastItem;
};

interface MultiGuideProps {
  data: GuideRowInput[];
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

function formatShortDate(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  return `${Math.max(1, minutes)} min`;
}

function floorToHalfHour(date: Date): Date {
  const nextDate = new Date(date);

  nextDate.setSeconds(0, 0);
  nextDate.setMinutes(nextDate.getMinutes() < 30 ? 0 : 30);

  return nextDate;
}

function startOfLocalDay(date: Date): Date {
  const nextDate = new Date(date);

  nextDate.setHours(0, 0, 0, 0);

  return nextDate;
}

function startOfNextLocalDay(date: Date): Date {
  const nextDate = startOfLocalDay(date);

  nextDate.setDate(nextDate.getDate() + 1);

  return nextDate;
}

function getNoonForDate(date: Date): Date {
  const nextDate = new Date(date);

  nextDate.setHours(12, 0, 0, 0);

  return nextDate;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getSecondsSinceBroadcastEpoch(dateMs: number): number {
  return Math.floor((dateMs - BROADCAST_EPOCH_MS) / 1000);
}

function getItemDuration(item: BroadcastItem): number {
  const guideDuration = Math.floor(Number(item.guideDuration));

  if (Number.isFinite(guideDuration) && guideDuration > 0) {
    return guideDuration;
  }

  const duration = Math.floor(Number(item.duration));

  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}

function getScheduleDuration(schedule: BroadcastItem[]): number {
  return schedule.reduce((sum, item) => sum + getItemDuration(item), 0);
}

function isGuideVisibleItem(item: BroadcastItem): boolean {
  return Boolean(item.file) && getItemDuration(item) > 0 && !isHiddenGuideItem(item);
}

function isProgramMediaItem(item: MediaItem): boolean {
  return (
    item.type === "show" ||
    item.type === "movie" ||
    item.type === "music" ||
    item.type === "music-video"
  );
}

function isAdInventoryItem(item: MediaItem): boolean {
  return item.type === "commercial" || item.type === "bumper";
}

function getProgramMediaItems(media: MediaItem[] | undefined): MediaItem[] {
  return (media ?? []).filter(isProgramMediaItem);
}

function getAvailableAdItems(media: MediaItem[] | undefined): MediaItem[] {
  return (media ?? []).filter(isAdInventoryItem);
}

function getDisplayTitle(item: BroadcastItem): string {
  return cleanDisplayText(item.sourceTitle?.trim() || item.title || "Untitled");
}

function getDisplayType(item: BroadcastItem): string {
  if (item.type === "music-video") return "MUSIC VIDEO";
  return item.type.toUpperCase();
}

function getStableItemKey(item: BroadcastItem): string {
  if (item.isVirtualSegment && item.parentMediaId) {
    return cleanDisplayText(item.parentMediaId);
  }

  return cleanDisplayText(item.parentMediaId || item.id || item.title);
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

function sortRows(data: GuideRowInput[]): GuideRowInput[] {
  return [...data]
    .filter(({ channel }) => channel.isEnabled !== false)
    .sort((a, b) => {
      const aNumber = Number(a.channel.number ?? a.channel.id);
      const bNumber = Number(b.channel.number ?? b.channel.id);

      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
        return aNumber - bNumber;
      }

      return String(a.channel.id).localeCompare(String(b.channel.id), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

function getScheduleOffset(
  schedule: BroadcastItem[],
  broadcastSeconds: number,
): number {
  const totalDuration = getScheduleDuration(schedule);

  if (totalDuration <= 0) {
    return 0;
  }

  return ((broadcastSeconds % totalDuration) + totalDuration) % totalDuration;
}

function findPreviousVisibleItem(
  schedule: BroadcastItem[],
  startIndex: number,
): BroadcastItem | undefined {
  for (let index = startIndex; index >= 0; index -= 1) {
    const item = schedule[index];

    if (item && isGuideVisibleItem(item)) {
      return item;
    }
  }

  for (let index = schedule.length - 1; index > startIndex; index -= 1) {
    const item = schedule[index];

    if (item && isGuideVisibleItem(item)) {
      return item;
    }
  }

  return undefined;
}

function findSchedulePosition(
  schedule: BroadcastItem[],
  broadcastSeconds: number,
): SchedulePosition {
  const offset = getScheduleOffset(schedule, broadcastSeconds);
  let accumulated = 0;

  for (let index = 0; index < schedule.length; index += 1) {
    const item = schedule[index];

    if (!item) {
      continue;
    }

    const duration = getItemDuration(item);
    const end = accumulated + duration;

    if (offset >= accumulated && offset < end) {
      return {
        index,
        offsetInsideItem: offset - accumulated,
        previousVisibleItem: findPreviousVisibleItem(schedule, index),
      };
    }

    accumulated = end;
  }

  return {
    index: 0,
    offsetInsideItem: 0,
    previousVisibleItem: findPreviousVisibleItem(schedule, schedule.length - 1),
  };
}

function canMergeVisibleGuideSegment(
  previous: GuideCell | undefined,
  item: BroadcastItem,
): boolean {
  if (!previous) {
    return false;
  }

  if (item.isVirtualSegment && item.parentMediaId) {
    return previous.stableKey === cleanDisplayText(item.parentMediaId);
  }

  return previous.stableKey === getStableItemKey(item);
}

function pushCell(
  cells: GuideCell[],
  item: BroadcastItem,
  startSec: number,
  endSec: number,
  options: { mergeWithPrevious?: boolean } = {},
): void {
  if (endSec <= startSec) {
    return;
  }

  const stableKey = getStableItemKey(item);
  const previous = cells[cells.length - 1];

  if (
    options.mergeWithPrevious &&
    previous &&
    previous.stableKey === stableKey &&
    previous.endSec >= startSec - 1
  ) {
    previous.endSec = Math.max(previous.endSec, endSec);
    return;
  }

  cells.push({
    item,
    stableKey,
    startSec,
    endSec,
  });
}

function getMaxBuildSteps(
  schedule: BroadcastItem[],
  totalDuration: number,
  windowDurationSeconds: number,
): number {
  const cycleCount = Math.ceil(windowDurationSeconds / Math.max(1, totalDuration));
  return Math.max(MIN_BUILD_STEPS, schedule.length * (cycleCount + 2));
}

function buildDisplayCellsForWindow(
  schedule: BroadcastItem[],
  windowStartBroadcastSeconds: number,
  windowDurationSeconds: number,
): GuideCell[] {
  if (schedule.length === 0 || windowDurationSeconds <= 0) {
    return [];
  }

  const totalDuration = getScheduleDuration(schedule);

  if (totalDuration <= 0) {
    return [];
  }

  const cells: GuideCell[] = [];
  const startPosition = findSchedulePosition(schedule, windowStartBroadcastSeconds);

  let scheduleIndex = startPosition.index;
  let offsetInsideItem = startPosition.offsetInsideItem;
  let cursor = 0;
  let lastVisibleItem = startPosition.previousVisibleItem;
  let guard = 0;

  const maxSteps = getMaxBuildSteps(schedule, totalDuration, windowDurationSeconds);

  while (cursor < windowDurationSeconds && guard < maxSteps) {
    const item = schedule[scheduleIndex];

    if (!item) {
      break;
    }

    const itemDuration = getItemDuration(item);
    const remainingInItem = Math.max(1, itemDuration - offsetInsideItem);
    const segmentDuration = Math.min(remainingInItem, windowDurationSeconds - cursor);

    const segmentStart = cursor;
    const segmentEnd = cursor + segmentDuration;

    if (isGuideVisibleItem(item)) {
      const shouldMergeVisibleSegment = canMergeVisibleGuideSegment(
        cells[cells.length - 1],
        item,
      );

      lastVisibleItem = item;

      pushCell(cells, item, segmentStart, segmentEnd, {
        mergeWithPrevious: shouldMergeVisibleSegment,
      });
    } else if (lastVisibleItem) {
      pushCell(cells, lastVisibleItem, segmentStart, segmentEnd, {
        mergeWithPrevious: true,
      });
    }

    cursor = segmentEnd;
    scheduleIndex = (scheduleIndex + 1) % schedule.length;
    offsetInsideItem = 0;
    guard += 1;
  }

  return cells;
}

function getScheduleForSlice(
  row: GuideRowInput,
  sliceStart: Date,
  currentDayReference: Date,
): BroadcastItem[] {
  if (!row.media || isSameLocalDay(sliceStart, currentDayReference)) {
    return row.schedule;
  }

  const programMedia = getProgramMediaItems(row.media);
  const availableAds = getAvailableAdItems(row.media);

  return buildSchedule(programMedia, {
    channel: row.channel,
    now: getNoonForDate(sliceStart),
    availableAds,
  });
}

function appendCells(
  target: GuideCell[],
  source: GuideCell[],
  offsetSeconds: number,
): void {
  for (const cell of source) {
    pushCell(
      target,
      cell.item,
      cell.startSec + offsetSeconds,
      cell.endSec + offsetSeconds,
      {
        mergeWithPrevious: true,
      },
    );
  }
}

function buildForwardGuideCells(
  row: GuideRowInput,
  windowStart: Date,
  windowDurationSeconds: number,
  currentDayReference: Date,
): GuideCell[] {
  const windowEndMs = windowStart.getTime() + windowDurationSeconds * 1000;
  const result: GuideCell[] = [];

  let sliceStart = new Date(windowStart);

  while (sliceStart.getTime() < windowEndMs) {
    const nextDay = startOfNextLocalDay(sliceStart);
    const sliceEndMs = Math.min(nextDay.getTime(), windowEndMs);

    const sliceDurationSeconds = Math.max(
      0,
      Math.floor((sliceEndMs - sliceStart.getTime()) / 1000),
    );

    const schedule = getScheduleForSlice(row, sliceStart, currentDayReference);
    const sliceBroadcastSeconds = getSecondsSinceBroadcastEpoch(sliceStart.getTime());

    const sliceCells = buildDisplayCellsForWindow(
      schedule,
      sliceBroadcastSeconds,
      sliceDurationSeconds,
    );

    const offsetSeconds = Math.floor(
      (sliceStart.getTime() - windowStart.getTime()) / 1000,
    );

    appendCells(result, sliceCells, offsetSeconds);
    sliceStart = new Date(sliceEndMs);
  }

  return result;
}

function buildGuideMarkers(windowStart: Date): GuideMarker[] {
  const markers: GuideMarker[] = [
    {
      label: "Now",
      subLabel: formatShortDate(windowStart),
      offsetSec: 0,
    },
  ];

  const windowEndMs = windowStart.getTime() + GUIDE_WINDOW_SECONDS * 1000;
  let dayCursor = startOfNextLocalDay(windowStart);
  let dayIndex = 1;

  while (dayCursor.getTime() < windowEndMs) {
    const offsetSec = Math.floor((dayCursor.getTime() - windowStart.getTime()) / 1000);

    markers.push({
      label:
        dayIndex === 1
          ? "Tomorrow"
          : dayCursor.toLocaleDateString([], { weekday: "short" }),
      subLabel: dayCursor.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      }),
      offsetSec,
    });

    dayCursor = startOfNextLocalDay(dayCursor);
    dayIndex += 1;
  }

  return markers;
}

function getCellLeft(startSec: number): number {
  return (startSec / GUIDE_WINDOW_SECONDS) * TIMELINE_WIDTH;
}

function getCellWidth(startSec: number, endSec: number): number {
  return ((endSec - startSec) / GUIDE_WINDOW_SECONDS) * TIMELINE_WIDTH;
}

function EmptyGuideState() {
  return (
    <div
      className="col-span-2 flex min-h-[14rem] items-center justify-center px-4 py-8 text-sm"
      style={{ color: "var(--text-muted)" }}
    >
      No enabled channels available.
    </div>
  );
}

export default function MultiGuide({ data, onProgramSelect }: MultiGuideProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);
  const guideDensity = useStore((state) => state.viewerSettings.guideDensity);

  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState(() => BROADCAST_EPOCH_MS);
  const [activeMarkerIndex, setActiveMarkerIndex] = useState(0);

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

  const windowStartMs = useMemo(() => floorToHalfHour(now).getTime(), [now]);
  const currentDayMs = useMemo(() => startOfLocalDay(now).getTime(), [now]);

  const windowStart = useMemo(() => new Date(windowStartMs), [windowStartMs]);
  const currentDayReference = useMemo(
    () => new Date(currentDayMs),
    [currentDayMs],
  );

  useEffect(() => {
    setActiveMarkerIndex(0);
  }, [windowStartMs]);

  const preparedRows = useMemo<PreparedGuideRow[]>(() => {
    return sortRows(data).map((row) => ({
      ...row,
      cells: buildForwardGuideCells(
        row,
        windowStart,
        GUIDE_WINDOW_SECONDS,
        currentDayReference,
      ),
    }));
  }, [currentDayReference, data, windowStart]);

  const guideMarkers = useMemo(
    () => buildGuideMarkers(windowStart),
    [windowStart],
  );

  const scrollToMarker = useCallback(
    (marker: GuideMarker, markerIndex: number): void => {
      setActiveMarkerIndex(markerIndex);

      const scrollElement = scrollRef.current;

      if (!scrollElement) {
        return;
      }

      const left = (marker.offsetSec / GUIDE_WINDOW_SECONDS) * TIMELINE_WIDTH;

      scrollElement.scrollTo({
        left: Math.max(0, left),
        behavior: "smooth",
      });
    },
    [],
  );

  const handleGuideScroll = useCallback(
    (event: UIEvent<HTMLDivElement>): void => {
      const scrollElement = event.currentTarget;
      const centerLeft = scrollElement.scrollLeft + scrollElement.clientWidth * 0.35;
      const centerSeconds = (centerLeft / TIMELINE_WIDTH) * GUIDE_WINDOW_SECONDS;

      let nextIndex = 0;

      for (let index = 0; index < guideMarkers.length; index += 1) {
        const marker = guideMarkers[index];

        if (marker && centerSeconds >= marker.offsetSec) {
          nextIndex = index;
        }
      }

      setActiveMarkerIndex((current) => (current === nextIndex ? current : nextIndex));
    },
    [guideMarkers],
  );

  if (!mounted) {
    return null;
  }

  const rowHeight =
    guideDensity === "compact" ? ROW_HEIGHT_COMPACT : ROW_HEIGHT_COMFORTABLE;

  const secondsSinceWindowStart = clampNumber(
    Math.floor((nowMs - windowStartMs) / 1000),
    0,
    GUIDE_WINDOW_SECONDS,
  );

  const nowLineLeft = getCellLeft(secondsSinceWindowStart);

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
            "linear-gradient(135deg, rgba(255,255,255,0.06), transparent 44%), var(--guide-header-bg)",
        }}
      >
        <div className="min-w-0">
          <div
            className="text-[11px] font-black uppercase tracking-[0.24em]"
            style={{ color: "var(--text-muted)" }}
          >
            Tate&apos;s TV
          </div>

          <div className="mt-1 text-lg font-black tracking-tight sm:text-xl">
            Live Guide
          </div>

          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Now and upcoming only. Commercial breaks are hidden from public listings.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div
            className="rounded-full border px-3 py-2 text-xs font-black"
            style={{
              borderColor: "var(--border)",
              background: "var(--panel-alt-bg)",
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
            {GUIDE_HOURS} hour forward guide
          </div>
        </div>
      </div>

      <div
        className="ttv-no-scrollbar flex shrink-0 gap-2 overflow-x-auto border-b px-3 py-3"
        style={{
          borderColor: "var(--border)",
          background: "var(--panel-bg)",
        }}
      >
        {guideMarkers.map((marker, index) => (
          <button
            key={`${marker.label}-${marker.offsetSec}`}
            type="button"
            onClick={() => scrollToMarker(marker, index)}
            className="min-w-[7rem] rounded-full border px-3 py-2 text-left transition hover:translate-y-[-1px]"
            style={{
              borderColor:
                activeMarkerIndex === index ? "var(--primary)" : "var(--border)",
              background:
                activeMarkerIndex === index
                  ? "var(--guide-current-bg)"
                  : "var(--panel-alt-bg)",
              color: activeMarkerIndex === index ? "#0f172a" : "var(--text)",
            }}
          >
            <div className="text-xs font-black">{marker.label}</div>
            <div className="text-[10px] font-bold opacity-75">{marker.subLabel}</div>
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        data-ttv-guide-scroll="true"
        className="min-h-0 flex-1 overflow-auto overscroll-contain"
        onScroll={handleGuideScroll}
      >
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `${CHANNEL_COLUMN_WIDTH}px ${TIMELINE_WIDTH}px`,
          }}
        >
          <div
            className="sticky left-0 top-0 z-50 flex items-center border-r border-b px-3 py-3 text-xs font-black uppercase tracking-[0.14em]"
            style={{
              minHeight: "58px",
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
              width: `${TIMELINE_WIDTH}px`,
              gridTemplateColumns: `repeat(${SLOT_COUNT}, ${SLOT_WIDTH}px)`,
              borderColor: "var(--border)",
              background: "var(--panel-alt-bg)",
            }}
          >
            {SLOT_INDEXES.map((index) => {
              const slotTime = new Date(
                windowStartMs + index * SLOT_SECONDS * 1000,
              );

              const isDayStart =
                slotTime.getHours() === 0 && slotTime.getMinutes() === 0;

              return (
                <div
                  key={`${slotTime.toISOString()}-${index}`}
                  className="flex min-h-[58px] flex-col justify-center border-r px-3 py-2 text-xs font-black last:border-r-0"
                  style={{
                    borderColor: "var(--border)",
                    color: isDayStart ? "var(--primary)" : "var(--text-muted)",
                  }}
                >
                  <span>{formatTime(slotTime)}</span>

                  {isDayStart ? (
                    <span className="mt-1 truncate text-[10px] uppercase tracking-[0.12em]">
                      {formatShortDate(slotTime)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {preparedRows.length === 0 ? (
            <EmptyGuideState />
          ) : (
            preparedRows.map(({ channel, cells }, rowIndex) => {
              const isActive = channel.id === currentChannelId;
              const accent = getSafeAccent(channel);

              return (
                <GuideRow
                  key={channel.id}
                  channel={channel}
                  cells={cells}
                  isActive={isActive}
                  accent={accent}
                  rowIndex={rowIndex}
                  rowHeight={rowHeight}
                  nowLineLeft={nowLineLeft}
                  liveOffsetSec={secondsSinceWindowStart}
                  onChannelSelect={() => setChannel(channel.id)}
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
  cells,
  isActive,
  accent,
  rowIndex,
  rowHeight,
  nowLineLeft,
  liveOffsetSec,
  onChannelSelect,
  onProgramSelect,
}: {
  channel: Channel;
  cells: GuideCell[];
  isActive: boolean;
  accent: string;
  rowIndex: number;
  rowHeight: number;
  nowLineLeft: number;
  liveOffsetSec: number;
  onChannelSelect: () => void;
  onProgramSelect?: (payload: { channel: Channel; item: BroadcastItem }) => void;
}) {
  const rowBg = isActive
    ? "var(--guide-active-bg)"
    : rowIndex % 2 === 0
      ? "var(--guide-row-bg)"
      : "var(--guide-row-alt-bg)";

  const firstCell = cells[0];
  const channelColor = isActive ? "#0f172a" : "var(--text)";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          onChannelSelect();

          if (firstCell) {
            onProgramSelect?.({
              channel,
              item: firstCell.item,
            });
          }
        }}
        className="sticky left-0 z-30 flex flex-col justify-center border-r border-b px-3 text-left transition hover:opacity-90"
        style={{
          height: `${rowHeight}px`,
          borderColor: "var(--border)",
          background: isActive ? "var(--guide-active-bg)" : "var(--panel-alt-bg)",
          borderLeft: `4px solid ${isActive ? accent : "transparent"}`,
          color: channelColor,
        }}
      >
        <div className="text-[13px] font-black">{getChannelLabel(channel)}</div>

        <div
          className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.16em]"
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
          width: `${TIMELINE_WIDTH}px`,
          borderColor: "var(--border)",
          background: rowBg,
        }}
      >
        <div
          className="grid h-full"
          style={{
            width: `${TIMELINE_WIDTH}px`,
            gridTemplateColumns: `repeat(${SLOT_COUNT}, ${SLOT_WIDTH}px)`,
          }}
          aria-hidden="true"
        >
          {SLOT_INDEXES.map((index) => (
            <div
              key={index}
              className="border-r last:border-r-0"
              style={{ borderColor: "var(--border)" }}
            />
          ))}
        </div>

        {cells.length === 0 ? (
          <div
            className="absolute inset-0 flex items-center justify-center text-xs font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            Off Air
          </div>
        ) : null}

        {cells.map((cell, index) => {
          const left = getCellLeft(cell.startSec);
          const rawWidth = getCellWidth(cell.startSec, cell.endSec);
          const width = Math.max(rawWidth, MIN_CELL_WIDTH);
          const isCurrent =
            cell.startSec <= liveOffsetSec && cell.endSec > liveOffsetSec;

          const title = getDisplayTitle(cell.item);
          const duration = cell.endSec - cell.startSec;
          const displayType = getDisplayType(cell.item);

          return (
            <button
              key={`${channel.id}-${cell.stableKey}-${index}-${cell.startSec}`}
              type="button"
              onClick={() =>
                onProgramSelect?.({
                  channel,
                  item: cell.item,
                })
              }
              className="absolute top-0 overflow-hidden border px-3 py-2 text-left text-[12px] leading-tight transition hover:z-20 hover:brightness-110"
              style={{
                left: `${left}px`,
                width: `${width}px`,
                height: `${rowHeight}px`,
                background: isCurrent
                  ? "var(--guide-current-bg)"
                  : "var(--panel-alt-bg)",
                borderColor: isCurrent ? accent : "var(--border)",
                color: isCurrent ? "#0f172a" : "var(--text)",
                boxShadow: isCurrent
                  ? `inset 0 0 0 1px ${accent}, 0 0 18px rgba(255,255,255,0.12)`
                  : "none",
              }}
              title={`${title} / ${formatDuration(duration)}`}
              aria-label={`${getChannelLabel(channel)} ${title}, ${formatDuration(
                duration,
              )}`}
            >
              <div className="truncate font-black tracking-tight">{title}</div>

              <div className="mt-1 truncate text-[10px]" style={{ opacity: 0.76 }}>
                {displayType} / {formatDuration(duration)}
              </div>
            </button>
          );
        })}

        <div
          className="absolute bottom-0 top-0 z-20 w-[2px] bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]"
          style={{
            left: `${nowLineLeft}px`,
          }}
          aria-hidden="true"
        />
      </div>
    </>
  );
}