"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import Image from "next/image";
import { useDeviceLibrary } from "@/lib/deviceLibrary";
import SaveButton from "@/components/viewer/SaveButton";
import { BROADCAST_EPOCH_MS } from "@/lib/liveEngine";
import { useStore } from "@/lib/store";
import type { BroadcastItem, Channel } from "@/lib/types";

import {
  GUIDE_HOURS,
  MOBILE_GUIDE_HOURS,
  MOBILE_GUIDE_MEDIA_QUERY,
  MOBILE_GUIDE_BREAKPOINT_PX,
  TOUCH_GUIDE_BREAKPOINT_PX,
  MOBILE_USER_AGENT_PATTERN,
  MOBILE_PROGRAM_LIMIT,
  SLOT_COUNT,
  CHANNEL_COLUMN_WIDTH,
  SLOT_WIDTH,
  TIMELINE_WIDTH,
  ROW_HEIGHT_COMFORTABLE,
  ROW_HEIGHT_COMPACT,
  SLOT_SECONDS,
  GUIDE_WINDOW_SECONDS,
  MOBILE_GUIDE_WINDOW_SECONDS,
  LIVE_TICK_MS,
  GUIDE_PREPARE_BATCH_SIZE,
  SLOT_INDEXES,
  GuideRowInput,
  GuideCell,
  PreparedGuideRow,
  GuideMarker,
  formatTime,
  formatShortDate,
  formatDuration,
  floorToHalfHour,
  startOfLocalDay,
  clampNumber,
  getDisplayTitle,
  getDisplayType,
  getChannelLabel,
  getChannelName,
  getChannelCallsign,
  getSafeAccent,
  sortRows,
  buildForwardGuideCells,
  buildGuideMarkers,
  getCellLeft,
  getCellWidth,
} from "@/lib/guideTimeline";

function getSmallestViewportWidth(): number {
  if (typeof window === "undefined") {
    return Number.POSITIVE_INFINITY;
  }

  const candidateWidths = [
    window.innerWidth,
    document.documentElement.clientWidth,
    window.visualViewport?.width,
  ].filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value) && value > 0,
  );

  return candidateWidths.length > 0
    ? Math.min(...candidateWidths)
    : Number.POSITIVE_INFINITY;
}

function shouldUseMobileGuide(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const viewportWidth = getSmallestViewportWidth();
  const mediaQueryMatches = window.matchMedia(MOBILE_GUIDE_MEDIA_QUERY).matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const touchCapable = navigator.maxTouchPoints > 0;
  const mobileUserAgent = MOBILE_USER_AGENT_PATTERN.test(navigator.userAgent);
  const screenWidth = window.screen?.width ?? Number.POSITIVE_INFINITY;
  const screenHeight = window.screen?.height ?? Number.POSITIVE_INFINITY;
  const screenShortSide = Math.min(screenWidth, screenHeight);

  return (
    viewportWidth <= MOBILE_GUIDE_BREAKPOINT_PX ||
    mediaQueryMatches ||
    mobileUserAgent ||
    ((coarsePointer || touchCapable) &&
      screenShortSide <= TOUCH_GUIDE_BREAKPOINT_PX)
  );
}

interface MultiGuideProps {
  data: GuideRowInput[];
  onProgramSelect?: (payload: {
    channel: Channel;
    item: BroadcastItem;
  }) => void;
}

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: (deadline: {
      didTimeout: boolean;
      timeRemaining: () => number;
    }) => void,
    options?: { timeout: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleGuideWork(callback: () => void): () => void {
  const idleWindow = window as IdleWindow;

  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(() => callback(), {
      timeout: 120,
    });

    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(callback, 0);
  return () => window.clearTimeout(handle);
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
  const favourites = useDeviceLibrary((state) => state.favouriteChannels);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [channelQuery, setChannelQuery] = useState("");
  const channelSearchRef = useRef<HTMLInputElement | null>(null);
  const [visibleWindow, setVisibleWindow] = useState({ left: 0, width: 1600 });
  const reduceMotion = useStore(
    (state) => state.viewerSettings.preferReducedMotion,
  );
  const setDensity = useStore((state) => state.setGuideDensity);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);

  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);
  const guideDensity = useStore((state) => state.viewerSettings.guideDensity);

  const [mounted, setMounted] = useState(false);
  const [nowMs, setNowMs] = useState(() => BROADCAST_EPOCH_MS);
  const [activeMarkerIndex, setActiveMarkerIndex] = useState(0);
  const [isMobileGuide, setIsMobileGuide] = useState(() =>
    shouldUseMobileGuide(),
  );
  const [mobileSelectedChannelId, setMobileSelectedChannelId] =
    useState(currentChannelId);
  const [mobileOffsetSec, setMobileOffsetSec] = useState(0);

  useEffect(() => {
    if (!mounted || isMobileGuide) return;
    const element = scrollRef.current;
    if (!element) return;
    const measure = () =>
      setVisibleWindow({
        left: element.scrollLeft,
        width: element.clientWidth,
      });
    measure();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    observer?.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [mounted, isMobileGuide]);
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

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_GUIDE_MEDIA_QUERY);
    const visualViewport = window.visualViewport;
    let animationFrame: number | null = null;

    const updateMobileMode = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        setIsMobileGuide(shouldUseMobileGuide());
      });
    };

    updateMobileMode();
    mediaQuery.addEventListener?.("change", updateMobileMode);
    window.addEventListener("resize", updateMobileMode, { passive: true });
    window.addEventListener("orientationchange", updateMobileMode);
    visualViewport?.addEventListener("resize", updateMobileMode, {
      passive: true,
    });

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }

      mediaQuery.removeEventListener?.("change", updateMobileMode);
      window.removeEventListener("resize", updateMobileMode);
      window.removeEventListener("orientationchange", updateMobileMode);
      visualViewport?.removeEventListener("resize", updateMobileMode);
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

  const guideWindowSeconds = isMobileGuide
    ? MOBILE_GUIDE_WINDOW_SECONDS
    : GUIDE_WINDOW_SECONDS;

  useEffect(() => {
    setActiveMarkerIndex(0);
  }, [windowStartMs]);

  const sortedRows = useMemo(
    () =>
      sortRows(data).filter(
        (row) =>
          (!favouritesOnly || favourites.includes(row.channel.id)) &&
          `${getChannelLabel(row.channel)} ${getChannelName(row.channel)} ${getChannelCallsign(row.channel)}`
            .toLowerCase()
            .includes(channelQuery.trim().toLowerCase()),
      ),
    [data, favourites, favouritesOnly, channelQuery],
  );

  useEffect(() => {
    if (sortedRows.some((row) => row.channel.id === currentChannelId)) {
      setMobileSelectedChannelId(currentChannelId);
      return;
    }

    const firstChannelId = sortedRows[0]?.channel.id;

    if (firstChannelId) {
      setMobileSelectedChannelId(firstChannelId);
    }
  }, [currentChannelId, sortedRows]);

  const [preparedRows, setPreparedRows] = useState<PreparedGuideRow[]>([]);
  const [preparedCount, setPreparedCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let cancelScheduledWork = () => {};

    const placeholders: PreparedGuideRow[] = sortedRows.map((row) => ({
      ...row,
      cells: [],
      isPrepared: false,
    }));

    setPreparedRows(placeholders);
    setPreparedCount(0);

    if (sortedRows.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    const activeRowIndex = sortedRows.findIndex(
      (row) => row.channel.id === currentChannelId,
    );
    const queue = sortedRows.map((_, index) => index);

    if (activeRowIndex > 0) {
      queue.splice(activeRowIndex, 1);
      queue.unshift(activeRowIndex);
    }

    let queueIndex = 0;

    const processBatch = () => {
      if (cancelled) return;

      const updates = new Map<string, PreparedGuideRow>();
      const batchEnd = Math.min(
        queue.length,
        queueIndex + GUIDE_PREPARE_BATCH_SIZE,
      );

      while (queueIndex < batchEnd) {
        const rowIndex = queue[queueIndex];
        const row = rowIndex === undefined ? undefined : sortedRows[rowIndex];
        queueIndex += 1;

        if (!row) continue;

        updates.set(row.channel.id, {
          ...row,
          cells: buildForwardGuideCells(
            row,
            windowStart,
            guideWindowSeconds,
            currentDayReference,
          ),
          isPrepared: true,
        });
      }

      if (updates.size > 0) {
        setPreparedRows((current) =>
          current.map((row) => updates.get(row.channel.id) ?? row),
        );
        setPreparedCount(queueIndex);
      }

      if (queueIndex < queue.length && !cancelled) {
        cancelScheduledWork = scheduleGuideWork(processBatch);
      }
    };

    cancelScheduledWork = scheduleGuideWork(processBatch);

    return () => {
      cancelled = true;
      cancelScheduledWork();
    };
  }, [
    currentChannelId,
    currentDayReference,
    guideWindowSeconds,
    sortedRows,
    windowStart,
  ]);

  const guideMarkers = useMemo(
    () => buildGuideMarkers(windowStart, guideWindowSeconds),
    [guideWindowSeconds, windowStart],
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
        behavior:
          reduceMotion ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
      });
    },
    [reduceMotion],
  );

  const handleGuideScroll = useCallback(
    (event: UIEvent<HTMLDivElement>): void => {
      const scrollElement = event.currentTarget;

      if (scrollRafRef.current !== null) {
        return;
      }

      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        setVisibleWindow({
          left: scrollElement.scrollLeft,
          width: scrollElement.clientWidth,
        });

        const centerLeft =
          scrollElement.scrollLeft + scrollElement.clientWidth * 0.35;
        const centerSeconds =
          (centerLeft / TIMELINE_WIDTH) * GUIDE_WINDOW_SECONDS;

        let nextIndex = 0;

        for (let index = 0; index < guideMarkers.length; index += 1) {
          const marker = guideMarkers[index];

          if (marker && centerSeconds >= marker.offsetSec) {
            nextIndex = index;
          }
        }

        setActiveMarkerIndex((current) =>
          current === nextIndex ? current : nextIndex,
        );
      });
    },
    [guideMarkers],
  );

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  const clearGuideFilters = () => {
    setChannelQuery("");
    setFavouritesOnly(false);
    window.requestAnimationFrame(() =>
      channelSearchRef.current?.focus({ preventScroll: true }),
    );
  };

  const guideTools = (
    <div className="ttv-guide-tools">
      <label>
        <span className="sr-only">Find a channel in the guide</span>
        <input
          ref={channelSearchRef}
          type="search"
          placeholder="Channel name or number…"
          value={channelQuery}
          maxLength={80}
          onChange={(event) => setChannelQuery(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="ttv-section-action"
        aria-pressed={favouritesOnly}
        onClick={() => setFavouritesOnly(!favouritesOnly)}
      >
        Favourites
      </button>
      <button
        type="button"
        className="ttv-section-action"
        aria-pressed={guideDensity === "compact"}
        onClick={() =>
          setDensity(guideDensity === "compact" ? "comfortable" : "compact")
        }
      >
        Compact rows
      </button>
      {(channelQuery || favouritesOnly) && (
        <button
          type="button"
          className="ttv-section-action"
          onClick={clearGuideFilters}
        >
          Show all channels
        </button>
      )}
      <span>
        {sortedRows.length} {sortedRows.length === 1 ? "channel" : "channels"} ·
        Local time
      </span>
    </div>
  );

  if (!mounted) {
    return null;
  }

  if (!sortedRows.length)
    return (
      <div className="ttv-guide-workspace">
        {guideTools}
        <p className="ttv-guide-empty" role="status">
          {favouritesOnly && !favourites.length
            ? "No favourites yet. Use the star beside a channel to save it here."
            : "No channels match your search. Try another name or channel number."}
        </p>
      </div>
    );

  const rowHeight =
    guideDensity === "compact" ? ROW_HEIGHT_COMPACT : ROW_HEIGHT_COMFORTABLE;

  const secondsSinceWindowStart = clampNumber(
    Math.floor((nowMs - windowStartMs) / 1000),
    0,
    guideWindowSeconds,
  );

  const nowLineLeft = getCellLeft(secondsSinceWindowStart);

  if (isMobileGuide) {
    const selectedRow =
      preparedRows.find((row) => row.channel.id === mobileSelectedChannelId) ??
      preparedRows[0];

    return (
      <div className="ttv-guide-workspace" data-density={guideDensity}>
        {guideTools}
        <MobileGuideView
          rows={preparedRows}
          selectedRow={selectedRow}
          currentChannelId={currentChannelId}
          preparedCount={preparedCount}
          totalCount={sortedRows.length}
          now={now}
          nowOffsetSec={secondsSinceWindowStart}
          selectedOffsetSec={mobileOffsetSec}
          windowStartMs={windowStartMs}
          onOffsetChange={setMobileOffsetSec}
          onChannelBrowse={setMobileSelectedChannelId}
          onTune={({ channel, item }) => {
            setChannel(channel.id);
            onProgramSelect?.({ channel, item });
          }}
        />
      </div>
    );
  }

  return (
    <section
      className="ttv-desktop-guide ttv-glass-panel flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border shadow-2xl"
      style={{
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      aria-label="Live TV guide"
    >
      {guideTools}
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
            Browse the next three days. Select a listing to watch its channel
            live.
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

          {preparedCount < sortedRows.length ? (
            <div
              className="rounded-full border px-3 py-2 text-xs font-black"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--primary) 42%, var(--border))",
                background:
                  "color-mix(in srgb, var(--primary) 10%, var(--panel-alt-bg))",
                color: "var(--primary)",
              }}
              aria-live="polite"
            >
              Preparing {preparedCount}/{sortedRows.length}
            </div>
          ) : null}
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
                activeMarkerIndex === index
                  ? "var(--primary)"
                  : "var(--border)",
              background:
                activeMarkerIndex === index
                  ? "var(--guide-current-bg)"
                  : "var(--panel-alt-bg)",
              color:
                activeMarkerIndex === index
                  ? "var(--on-primary)"
                  : "var(--text)",
            }}
          >
            <div className="text-xs font-black">{marker.label}</div>
            <div className="text-[10px] font-bold opacity-75">
              {marker.subLabel}
            </div>
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
            preparedRows.map(({ channel, cells, isPrepared }, rowIndex) => {
              const isActive = channel.id === currentChannelId;
              const accent = getSafeAccent(channel);

              return (
                <GuideRow
                  key={channel.id}
                  channel={channel}
                  cells={cells}
                  isPrepared={isPrepared}
                  isActive={isActive}
                  accent={accent}
                  rowIndex={rowIndex}
                  rowHeight={rowHeight}
                  visibleWindow={visibleWindow}
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

function getMobileProgramTime(
  cell: GuideCell,
  windowStartMs: number,
  nowOffsetSec: number,
): string {
  if (cell.startSec <= nowOffsetSec && cell.endSec > nowOffsetSec) {
    return "LIVE NOW";
  }

  return formatTime(new Date(windowStartMs + cell.startSec * 1000));
}

function getChannelLogoUrl(channel: Channel): string | undefined {
  const value = channel.branding?.logoUrl?.trim();
  return value || undefined;
}

function MobileGuideView({
  rows,
  selectedRow,
  currentChannelId,
  preparedCount,
  totalCount,
  now,
  nowOffsetSec,
  selectedOffsetSec,
  windowStartMs,
  onOffsetChange,
  onChannelBrowse,
  onTune,
}: {
  rows: PreparedGuideRow[];
  selectedRow: PreparedGuideRow | undefined;
  currentChannelId: string;
  preparedCount: number;
  totalCount: number;
  now: Date;
  nowOffsetSec: number;
  selectedOffsetSec: number;
  windowStartMs: number;
  onOffsetChange: (offsetSec: number) => void;
  onChannelBrowse: (channelId: string) => void;
  onTune: (payload: { channel: Channel; item: BroadcastItem }) => void;
}) {
  if (!selectedRow) {
    return (
      <section className="ttv-mobile-guide" aria-label="Mobile live TV guide">
        <EmptyGuideState />
      </section>
    );
  }

  const selectedIndex = Math.max(
    0,
    rows.findIndex((row) => row.channel.id === selectedRow.channel.id),
  );
  const previousRow = rows[(selectedIndex - 1 + rows.length) % rows.length];
  const nextRow = rows[(selectedIndex + 1) % rows.length];
  const liveCell = selectedRow.cells.find(
    (cell) => cell.startSec <= nowOffsetSec && cell.endSec > nowOffsetSec,
  );
  const firstAvailableCell =
    liveCell ?? selectedRow.cells.find((cell) => cell.endSec > nowOffsetSec);
  const visibleCells = selectedRow.cells
    .filter((cell) => cell.endSec > selectedOffsetSec)
    .slice(0, MOBILE_PROGRAM_LIMIT);
  const logoUrl = getChannelLogoUrl(selectedRow.channel);
  const jumpOptions = [
    { label: "Now", offsetSec: 0 },
    { label: "+3 hr", offsetSec: 3 * 60 * 60 },
    { label: "+6 hr", offsetSec: 6 * 60 * 60 },
    { label: "+12 hr", offsetSec: 12 * 60 * 60 },
  ];

  return (
    <section className="ttv-mobile-guide" aria-label="Mobile live TV guide">
      <div className="ttv-mobile-guide-meta" aria-live="polite">
        <span>{formatTime(now)}</span>
        <span>
          {preparedCount < totalCount
            ? `Preparing channels ${preparedCount}/${totalCount}`
            : `${totalCount} channels ready`}
        </span>
      </div>

      <div className="ttv-mobile-guide-scroll">
        <div className="ttv-mobile-channel-picker" aria-label="Choose channel">
          <button
            type="button"
            onClick={() =>
              previousRow && onChannelBrowse(previousRow.channel.id)
            }
            aria-label="Previous channel"
            disabled={!previousRow}
          >
            CH −
          </button>

          <label>
            <span>Browse channel</span>
            <select
              value={selectedRow.channel.id}
              onChange={(event) => onChannelBrowse(event.target.value)}
            >
              {rows.map((row) => (
                <option key={row.channel.id} value={row.channel.id}>
                  {getChannelLabel(row.channel)} · {getChannelName(row.channel)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => nextRow && onChannelBrowse(nextRow.channel.id)}
            aria-label="Next channel"
            disabled={!nextRow}
          >
            CH +
          </button>
        </div>

        <article
          className="ttv-mobile-live-card"
          data-current-channel={selectedRow.channel.id === currentChannelId}
        >
          <div className="ttv-mobile-live-brand">
            {logoUrl ? (
              <Image
                unoptimized
                width={64}
                height={64}
                src={logoUrl}
                alt=""
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="ttv-mobile-live-logo-fallback" aria-hidden="true">
                {selectedRow.channel.branding?.logoText ||
                  getChannelLabel(selectedRow.channel)}
              </div>
            )}

            <div>
              <div className="ttv-mobile-live-channel-number">
                {getChannelLabel(selectedRow.channel)}
              </div>
              <h3>{getChannelName(selectedRow.channel)}</h3>
              <p>
                {selectedRow.channel.branding?.description ||
                  "Live Tate's TV programming."}
              </p>
            </div>
          </div>

          <SaveButton
            kind="channel"
            id={selectedRow.channel.id}
            title={getChannelName(selectedRow.channel)}
          />
          <div className="ttv-mobile-live-program">
            <span>{liveCell ? "Live now" : "Next available"}</span>
            <strong>
              {firstAvailableCell
                ? getDisplayTitle(firstAvailableCell.item)
                : "Off Air"}
            </strong>
            {firstAvailableCell ? (
              <small>
                {getDisplayType(firstAvailableCell.item)} ·{" "}
                {formatDuration(
                  firstAvailableCell.endSec - firstAvailableCell.startSec,
                )}
              </small>
            ) : null}
          </div>

          <button
            type="button"
            className="ttv-mobile-watch-live"
            disabled={!firstAvailableCell}
            onClick={() => {
              if (firstAvailableCell) {
                onTune({
                  channel: selectedRow.channel,
                  item: firstAvailableCell.item,
                });
              }
            }}
          >
            {selectedRow.channel.id === currentChannelId
              ? "Return to Live TV"
              : "Watch This Channel"}
          </button>
        </article>

        <nav className="ttv-mobile-time-jumps" aria-label="Schedule time">
          {jumpOptions.map((option) => (
            <button
              key={option.label}
              type="button"
              data-active={selectedOffsetSec === option.offsetSec}
              onClick={() => onOffsetChange(option.offsetSec)}
            >
              {option.label}
            </button>
          ))}
        </nav>

        <div className="ttv-mobile-program-heading">
          <div>
            <span>Schedule</span>
            <strong>
              {selectedOffsetSec === 0
                ? "Starting now"
                : `From ${formatTime(
                    new Date(windowStartMs + selectedOffsetSec * 1000),
                  )}`}
            </strong>
          </div>
          <small>{MOBILE_GUIDE_HOURS}-hour mobile guide</small>
        </div>

        <div className="ttv-mobile-program-list">
          {!selectedRow.isPrepared ? (
            Array.from({ length: 5 }, (_, index) => (
              <div className="ttv-mobile-program-skeleton" key={index}>
                <span />
                <div>
                  <span />
                  <span />
                </div>
              </div>
            ))
          ) : visibleCells.length === 0 ? (
            <div className="ttv-mobile-guide-empty">
              No scheduled programs are available in this window.
            </div>
          ) : (
            visibleCells.map((cell, index) => {
              const isLive =
                cell.startSec <= nowOffsetSec && cell.endSec > nowOffsetSec;
              const title = getDisplayTitle(cell.item);
              const duration = cell.endSec - cell.startSec;

              return (
                <button
                  key={`${selectedRow.channel.id}-${cell.stableKey}-${cell.startSec}-${index}`}
                  type="button"
                  className="ttv-mobile-program-card"
                  data-live={isLive}
                  onClick={() =>
                    onTune({
                      channel: selectedRow.channel,
                      item: cell.item,
                    })
                  }
                  aria-label={`${getMobileProgramTime(
                    cell,
                    windowStartMs,
                    nowOffsetSec,
                  )}, ${title}, tune ${getChannelName(selectedRow.channel)}`}
                >
                  <div className="ttv-mobile-program-time">
                    <strong>
                      {getMobileProgramTime(cell, windowStartMs, nowOffsetSec)}
                    </strong>
                    <span>{formatDuration(duration)}</span>
                  </div>

                  <div className="ttv-mobile-program-copy">
                    <strong>{title}</strong>
                    <span>
                      {getDisplayType(cell.item)} ·{" "}
                      {getChannelLabel(selectedRow.channel)}
                    </span>
                  </div>

                  <span className="ttv-mobile-program-action">
                    {isLive ? "Watch" : "Tune"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <p className="ttv-mobile-guide-note">
          Tate&apos;s TV is a live channel service. Selecting a future listing
          tunes that channel&apos;s current broadcast.
        </p>
      </div>
    </section>
  );
}

function GuideRow({
  channel,
  cells,
  isPrepared,
  isActive,
  accent,
  rowIndex,
  rowHeight,
  nowLineLeft,
  liveOffsetSec,
  onChannelSelect,
  onProgramSelect,
  visibleWindow,
}: {
  channel: Channel;
  visibleWindow: { left: number; width: number };
  cells: GuideCell[];
  isPrepared: boolean;
  isActive: boolean;
  accent: string;
  rowIndex: number;
  rowHeight: number;
  nowLineLeft: number;
  liveOffsetSec: number;
  onChannelSelect: () => void;
  onProgramSelect?: (payload: {
    channel: Channel;
    item: BroadcastItem;
  }) => void;
}) {
  const rowBg = isActive
    ? "var(--guide-active-bg)"
    : rowIndex % 2 === 0
      ? "var(--guide-row-bg)"
      : "var(--guide-row-alt-bg)";

  const firstCell = cells[0];
  const channelColor = isActive ? "var(--on-primary)" : "var(--text)";
  // Keep nearby cells ready without tripling the DOM on television screens.
  const overscan = Math.min(360, visibleWindow.width / 2);

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
          background: isActive
            ? "var(--guide-active-bg)"
            : "var(--panel-alt-bg)",
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
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px)",
            backgroundSize: `${SLOT_WIDTH}px 100%`,
            opacity: 0.7,
          }}
          aria-hidden="true"
        />

        {!isPrepared ? (
          <div className="absolute inset-0 flex items-center gap-3 px-4">
            <div
              className="h-7 w-44 animate-pulse rounded-lg"
              style={{ background: "rgba(255,255,255,0.08)" }}
            />
            <span
              className="text-[10px] font-black uppercase tracking-[0.12em]"
              style={{ color: "var(--text-muted)" }}
            >
              Preparing schedule
            </span>
          </div>
        ) : cells.length === 0 ? (
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
          const width = Math.max(1, rawWidth - 1);
          if (
            left + width < visibleWindow.left - overscan ||
            left > visibleWindow.left + visibleWindow.width + overscan
          )
            return null;
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
              className="ttv-guide-cell absolute top-0 overflow-hidden border px-3 py-2 text-left text-[12px] leading-tight transition hover:z-20 hover:brightness-110"
              style={{
                left: `${left}px`,
                width: `${width}px`,
                height: `${rowHeight}px`,
                background: isCurrent
                  ? "var(--guide-current-bg)"
                  : "var(--panel-alt-bg)",
                borderColor: isCurrent ? accent : "var(--border)",
                color: isCurrent ? "var(--on-primary)" : "var(--text)",
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

              <div
                className="mt-1 truncate text-[10px]"
                style={{ opacity: 0.76 }}
              >
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
