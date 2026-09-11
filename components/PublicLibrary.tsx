"use client";

import { usePlaybackMonitor } from "@/components/viewer/usePlaybackMonitor";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import GlobalProgrammingSync from "@/components/GlobalProgrammingSync";
import ThemeButton from "@/components/ThemeButton";
import { useStore } from "@/lib/store";
import { getThemeLayoutClass } from "@/lib/themeLayouts";
import { createThemeCssVars, getThemeById } from "@/lib/themes";
import {
  FILTERS,
  PROGRESS_STORAGE_KEY,
  sanitizeProgress,
  buildLibrary,
  formatClock,
  formatDuration,
  getSafeDuration,
  getTypeLabel,
  type LibraryFilter,
  type LibraryGroup,
  type ParsedLibraryItem,
  type ProgressEntry,
  type ProgressMap,
} from "@/lib/libraryCatalog";
import { useDeviceLibrary } from "@/lib/deviceLibrary";
import SaveButton from "@/components/viewer/SaveButton";
import ProgrammeArtwork from "@/components/viewer/ProgrammeArtwork";

function loadProgress(): ProgressMap {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ProgressMap) : {};
    return sanitizeProgress(parsed);
  } catch {
    return {};
  }
}

function getProgressPercent(entry: ProgressEntry | undefined): number {
  if (!entry || entry.duration <= 0) return 0;
  return Math.min(100, Math.max(0, (entry.position / entry.duration) * 100));
}

function Poster({ group }: { group: LibraryGroup }) {
  return (
    <ProgrammeArtwork
      src={group.poster}
      title={group.title}
      kind={getTypeLabel(group.type)}
    />
  );
}

export default function PublicLibrary() {
  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const themeId = useStore((state) => state.themeId);

  const theme = useMemo(() => getThemeById(themeId), [themeId]);
  const themeLayoutClass = useMemo(
    () => getThemeLayoutClass(themeId),
    [themeId],
  );
  const themeVars = useMemo(
    () => createThemeCssVars(theme) as CSSProperties,
    [theme],
  );

  const watchlist = useDeviceLibrary((state) => state.watchlist);
  const [savedOnly, setSavedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [selectedGroupKey, setSelectedGroupKey] = useState("");
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [progress, setProgress] = useState<ProgressMap>({});
  const [autoPlayRequested, setAutoPlayRequested] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastProgressWriteRef = useRef(0);
  const progressRef = useRef<ProgressMap>({});

  const library = useMemo(() => buildLibrary(media), [media]);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return library.filter((group) => {
      const matchesFilter = filter === "all" || group.type === filter;
      const matchesQuery =
        !normalizedQuery ||
        group.title.toLowerCase().includes(normalizedQuery) ||
        group.searchText.includes(normalizedQuery);

      return (
        matchesFilter &&
        matchesQuery &&
        (!savedOnly || watchlist.includes(group.key))
      );
    });
  }, [filter, library, query, savedOnly, watchlist]);

  const selectedGroup = useMemo(
    () =>
      filteredGroups.find((group) => group.key === selectedGroupKey) ??
      filteredGroups[0] ??
      null,
    [filteredGroups, selectedGroupKey],
  );

  const activeSeason = selectedGroup?.seasons.includes(selectedSeason)
    ? selectedSeason
    : (selectedGroup?.seasons[0] ?? 1);

  const activeItems = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.items.filter((item) => item.season === activeSeason);
  }, [activeSeason, selectedGroup]);

  const selectedItem = useMemo(
    () =>
      activeItems.find((item) => item.media.id === selectedMediaId) ??
      activeItems[0] ??
      null,
    [activeItems, selectedMediaId],
  );

  const playbackMonitor = usePlaybackMonitor(videoRef, {
    sourceKey: selectedItem?.media.id ?? "",
    channelId: "library",
    mediaId: selectedItem?.media.id ?? "",
    mode: "library",
    reload: () => {
      const video = videoRef.current;
      if (video) {
        video.load();
        void video
          .play()
          .catch(() => video.dispatchEvent(new Event("ttv-autoplay-blocked")));
      }
    },
  });

  const currentIndex = selectedItem
    ? activeItems.findIndex((item) => item.media.id === selectedItem.media.id)
    : -1;

  const previousItem =
    currentIndex > 0 ? (activeItems[currentIndex - 1] ?? null) : null;

  const nextItem =
    currentIndex >= 0 && currentIndex < activeItems.length - 1
      ? (activeItems[currentIndex + 1] ?? null)
      : null;

  const allItems = useMemo(
    () => library.flatMap((group) => group.items),
    [library],
  );

  const continueWatching = useMemo(() => {
    const entries: Array<{
      item: ParsedLibraryItem;
      entry: ProgressEntry;
    }> = [];

    for (const item of allItems) {
      const entry = progress[item.media.id];

      if (!entry) {
        continue;
      }

      const duration = getSafeDuration(item.media.duration);

      if (entry.position >= 10 && entry.position < duration - 10) {
        entries.push({ item, entry });
      }
    }

    return entries
      .sort((a, b) => b.entry.updatedAt - a.entry.updatedAt)
      .slice(0, 6);
  }, [allItems, progress]);

  const stats = useMemo(
    () => ({
      groups: library.length,
      items: allItems.length,
      duration: allItems.reduce(
        (total, item) => total + getSafeDuration(item.media.duration),
        0,
      ),
    }),
    [allItems, library.length],
  );

  const selectedChannels = useMemo(() => {
    if (!selectedItem) return [];

    return channels
      .filter((channel) => channel.mediaIds.includes(selectedItem.media.id))
      .sort((a, b) => Number(a.number ?? a.id) - Number(b.number ?? b.id))
      .map(
        (channel) =>
          `CH ${channel.number ?? channel.id} · ${
            channel.branding?.displayName ?? channel.name
          }`,
      );
  }, [channels, selectedItem]);

  useEffect(() => {
    progressRef.current = loadProgress();
    setProgress(progressRef.current);
  }, []);

  useEffect(() => {
    if (!selectedGroupKey && filteredGroups[0]) {
      setSelectedGroupKey(filteredGroups[0].key);
      return;
    }

    if (
      selectedGroupKey &&
      !filteredGroups.some((group) => group.key === selectedGroupKey)
    ) {
      setSelectedGroupKey(filteredGroups[0]?.key ?? "");
    }
  }, [filteredGroups, selectedGroupKey]);

  useEffect(() => {
    if (!selectedGroup) return;

    if (!selectedGroup.seasons.includes(selectedSeason)) {
      setSelectedSeason(selectedGroup.seasons[0] ?? 1);
    }
  }, [selectedGroup, selectedSeason]);

  useEffect(() => {
    const firstActiveItem = activeItems[0];

    if (!firstActiveItem) {
      setSelectedMediaId("");
      return;
    }

    if (!activeItems.some((item) => item.media.id === selectedMediaId)) {
      setSelectedMediaId(firstActiveItem.media.id);
    }
  }, [activeItems, selectedMediaId]);

  const requestedItemApplied = useRef(false);
  useEffect(() => {
    if (requestedItemApplied.current || !allItems.length) return;
    const id = new URLSearchParams(window.location.search).get("watch");
    if (!id) {
      requestedItemApplied.current = true;
      return;
    }
    const item = allItems.find((entry) => entry.media.id === id);
    if (!item) return;
    requestedItemApplied.current = true;
    setSelectedGroupKey(item.groupKey);
    setSelectedSeason(item.season);
    setSelectedMediaId(id);
  }, [allItems]);

  function persistProgress(value: ProgressMap): void {
    const next = sanitizeProgress(value);
    progressRef.current = next;
    setProgress(next);

    try {
      window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Local progress is optional. Playback must continue if storage is blocked.
    }
  }

  function saveCurrentProgress(force = false): void {
    const video = videoRef.current;
    const item = selectedItem;

    if (!video || !item) return;

    const now = Date.now();

    if (!force && now - lastProgressWriteRef.current < 4000) {
      return;
    }

    lastProgressWriteRef.current = now;

    const duration = Number.isFinite(video.duration)
      ? video.duration
      : getSafeDuration(item.media.duration);
    const position = Math.min(
      duration,
      Math.max(0, Math.floor(video.currentTime)),
    );

    persistProgress({
      ...progressRef.current,
      ...loadProgress(),
      [item.media.id]: {
        position,
        duration: Math.max(1, Math.floor(duration)),
        updatedAt: now,
      },
    });
  }

  function openItem(item: ParsedLibraryItem, shouldPlay = false): void {
    const group = library.find((entry) => entry.key === item.groupKey);

    setSavedOnly(false);
    setFilter("all");
    setQuery("");
    setSelectedGroupKey(item.groupKey);
    setSelectedSeason(item.season);
    setSelectedMediaId(item.media.id);
    setAutoPlayRequested(shouldPlay);

    if (!group) return;

    window.setTimeout(() => {
      document.getElementById("ttv-library-player")?.scrollIntoView({
        behavior:
          window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          useStore.getState().viewerSettings.preferReducedMotion
            ? "auto"
            : "smooth",
        block: "start",
      });
    }, 50);
  }

  function moveToItem(item: ParsedLibraryItem | null): void {
    if (!item) return;
    setSelectedMediaId(item.media.id);
    setAutoPlayRequested(true);
  }

  function handleEnded(): void {
    if (!selectedItem) return;

    const nextProgress = { ...progressRef.current, ...loadProgress() };
    delete nextProgress[selectedItem.media.id];
    persistProgress(nextProgress);

    if (nextItem) {
      moveToItem(nextItem);
    }
  }

  const pageStyle = {
    ...themeVars,
    "--library-border": "var(--border)",
    "--library-panel": "var(--panel-bg)",
  } as CSSProperties;

  return (
    <main
      className={`ttv-library-shell ${themeLayoutClass} min-h-screen`}
      style={pageStyle}
    >
      <GlobalProgrammingSync isAdminAuthorized={false} visibility="problems" />

      <div
        className="ttv-library-ambient pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="ttv-library-ambient__primary absolute -left-32 top-0 h-96 w-96 rounded-full blur-3xl" />
        <div className="ttv-library-ambient__secondary absolute right-0 top-24 h-[28rem] w-[28rem] rounded-full blur-3xl" />
      </div>

      <header className="ttv-library-header sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Back to Tate's TV live channels">
            <Image
              src="/tatestv-logo.png"
              alt="Tate's TV"
              width={210}
              height={72}
              className="h-auto w-[150px] sm:w-[190px]"
              priority
            />
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <ThemeButton />
            <span className="hidden rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200 sm:inline-flex">
              Watch free
            </span>
            <Link
              href="/"
              className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-100 transition hover:bg-cyan-400/20"
            >
              Back to Live TV
            </Link>
          </div>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-10">
        <section className="ttv-library-intro">
          <div>
            <span className="ttv-section-kicker">On demand</span>
            <h1>Your time. Your TV.</h1>
            <p>Find a favourite. Discover something new. Continue watching.</p>
          </div>
          <span className="ttv-library-title-count">
            {stats.groups} titles · {stats.items} videos
          </span>
        </section>

        {continueWatching.length > 0 ? (
          <section className="mt-8">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-fuchsia-200">
                  Continue Watching
                </div>
                <h2 className="mt-1 text-2xl font-semibold">
                  Pick up where you left off
                </h2>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {continueWatching.map(({ item, entry }) => (
                <button
                  key={item.media.id}
                  type="button"
                  onClick={() => openItem(item, true)}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition hover:-translate-y-0.5 hover:border-fuchsia-300/35 hover:bg-white/[0.07]"
                >
                  <div className="aspect-video bg-black">
                    {item.media.poster ? (
                      <Image
                        unoptimized
                        width={480}
                        height={270}
                        src={item.media.poster}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.35),transparent_50%),#0f172a] px-4 text-center text-xs font-semibold text-white/80">
                        {item.groupTitle}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-1 text-sm font-semibold">
                      {item.groupTitle}
                    </div>
                    <div className="mt-1 line-clamp-1 text-xs text-white/55">
                      {item.displayTitle}
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-fuchsia-400"
                        style={{ width: `${getProgressPercent(entry)}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs font-bold tracking-normal text-white/45">
                      {formatClock(entry.position)} watched
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 rounded-2xl border border-cyan-300/15 bg-[#07101f]/85 p-4 shadow-2xl shadow-black/30 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <label className="block">
              <span className="sr-only">Search the Tate&apos;s TV library</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles, episodes, movies, or music..."
                className="w-full rounded-2xl border border-cyan-300/20 bg-black/35 px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/55"
              />
            </label>

            <div className="flex gap-2 overflow-x-auto pb-1 lg:justify-end lg:pb-0">
              <button
                type="button"
                className="ttv-section-action"
                aria-pressed={savedOnly}
                onClick={() => setSavedOnly(!savedOnly)}
              >
                My watchlist ({watchlist.length})
              </button>
              {FILTERS.map((item) => {
                const active = item.id === filter;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={`shrink-0 rounded-full border px-4 py-3 text-xs font-semibold tracking-normal transition ${
                      active
                        ? "border-cyan-300 bg-cyan-300 text-slate-950"
                        : "border-white/10 bg-white/[0.04] text-white/65 hover:border-cyan-300/30 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {library.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-dashed border-cyan-300/25 bg-white/[0.03] p-10 text-center">
            <div className="text-xl font-semibold">The library is syncing</div>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/55">
              Playable shows, movies, and music will appear here as soon as the
              public programming snapshot finishes loading.
            </p>
          </section>
        ) : filteredGroups.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
            <div className="text-xl font-semibold">
              No matching library titles
            </div>
            <p className="mt-2 text-sm text-white/50">
              Try a different search or content filter.
            </p>
          </section>
        ) : (
          <div className="mt-6 grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="min-w-0 rounded-2xl border border-cyan-300/15 bg-[#07101f]/85 p-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
                Browse Titles
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {filteredGroups.map((group) => {
                  const active = selectedGroup?.key === group.key;

                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => {
                        setSelectedGroupKey(group.key);
                        setSelectedSeason(group.seasons[0] ?? 1);
                        setSelectedMediaId(group.items[0]?.media.id ?? "");
                        setAutoPlayRequested(false);
                      }}
                      className={`grid grid-cols-[100px_minmax(0,1fr)] overflow-hidden rounded-2xl border text-left transition ${
                        active
                          ? "border-cyan-300/70 bg-cyan-300/10 shadow-[0_0_30px_rgba(34,211,238,0.12)]"
                          : "border-white/10 bg-white/[0.035] hover:border-cyan-300/30 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="aspect-[4/3] min-h-full overflow-hidden bg-black">
                        <Poster group={group} />
                      </div>
                      <div className="min-w-0 p-3">
                        <div className="line-clamp-2 text-sm font-semibold">
                          {group.title}
                        </div>
                        <div className="mt-2 text-xs font-semibold tracking-normal text-cyan-100/55">
                          {getTypeLabel(group.type)} · {group.items.length} item
                          {group.items.length === 1 ? "" : "s"}
                        </div>
                        <div className="mt-1 text-xs text-white/40">
                          {formatDuration(group.totalDuration)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section
              id="ttv-library-player"
              className="min-w-0 rounded-2xl border border-cyan-300/15 bg-[#07101f]/85 p-4 sm:p-5"
            >
              {selectedGroup && selectedItem ? (
                <>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
                        {getTypeLabel(selectedGroup.type)}
                      </div>
                      <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">
                        {selectedGroup.title}
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
                        {selectedItem.media.description ||
                          "Select an item below to watch it on demand. Library playback stays separate from the live Tate's TV broadcast."}
                      </p>
                    </div>

                    {selectedGroup.seasons.length > 1 ? (
                      <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                        {selectedGroup.seasons.map((season) => (
                          <button
                            key={season}
                            type="button"
                            onClick={() => {
                              setSelectedSeason(season);
                              const first = selectedGroup.items.find(
                                (item) => item.season === season,
                              );
                              setSelectedMediaId(first?.media.id ?? "");
                              setAutoPlayRequested(false);
                            }}
                            className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-semibold tracking-normal ${
                              season === activeSeason
                                ? "border-cyan-300 bg-cyan-300 text-slate-950"
                                : "border-white/10 bg-white/[0.04] text-white/60"
                            }`}
                          >
                            Season {season}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="ttv-library-save-row">
                    <SaveButton
                      kind="programme"
                      id={selectedGroup.key}
                      title={selectedGroup.title}
                    />
                    <span>Saved on this device</span>
                  </div>
                  <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/40">
                    <video
                      ref={videoRef}
                      key={selectedItem.media.id}
                      src={selectedItem.media.file}
                      poster={selectedItem.media.poster}
                      controls
                      playsInline
                      preload="metadata"
                      autoPlay={autoPlayRequested}
                      className="aspect-video h-auto w-full bg-black"
                      onLoadedMetadata={(event) => {
                        const entry = progress[selectedItem.media.id];
                        const duration = event.currentTarget.duration;

                        if (
                          entry &&
                          entry.position >= 5 &&
                          entry.position < duration - 10
                        ) {
                          event.currentTarget.currentTime = entry.position;
                        }
                      }}
                      onTimeUpdate={() => saveCurrentProgress(false)}
                      onPause={() => saveCurrentProgress(true)}
                      onPlay={() => setAutoPlayRequested(false)}
                      onEnded={handleEnded}
                    />
                  </div>

                  {playbackMonitor.notice && (
                    <div className="ttv-player-notice">
                      <span role="status">{playbackMonitor.notice}</span>
                      <button type="button" onClick={playbackMonitor.retry}>
                        Try again
                      </button>
                      <button
                        type="button"
                        disabled={playbackMonitor.reportDisabled}
                        onClick={() => void playbackMonitor.report()}
                      >
                        Report problem
                      </button>
                      {playbackMonitor.reportStatus && (
                        <span role="status">
                          {playbackMonitor.reportStatus}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold">
                        {selectedItem.displayTitle}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/45">
                        <span>
                          {formatDuration(selectedItem.media.duration)}
                        </span>
                        {selectedChannels.map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!previousItem}
                        onClick={() => moveToItem(previousItem)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold tracking-normal text-white/70 transition enabled:hover:border-cyan-300/30 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={!nextItem}
                        onClick={() => moveToItem(nextItem)}
                        className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-xs font-semibold tracking-normal text-cyan-100 transition enabled:hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-white/10 pt-5">
                    <div className="mb-3 flex items-end justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                          {selectedGroup.type === "show"
                            ? "Episodes"
                            : "Library Item"}
                        </div>
                        <h3 className="mt-1 text-xl font-semibold">
                          {selectedGroup.type === "show"
                            ? `Season ${activeSeason}`
                            : selectedGroup.title}
                        </h3>
                      </div>
                      <div className="text-xs text-white/40">
                        {activeItems.length} item
                        {activeItems.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {activeItems.map((item) => {
                        const active = selectedItem.media.id === item.media.id;
                        const entry = progress[item.media.id];

                        return (
                          <button
                            key={item.media.id}
                            type="button"
                            onClick={() => {
                              setSelectedMediaId(item.media.id);
                              setAutoPlayRequested(false);
                            }}
                            className={`overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 ${
                              active
                                ? "border-cyan-300/70 bg-cyan-300/10"
                                : "border-white/10 bg-white/[0.035] hover:border-cyan-300/30"
                            }`}
                          >
                            <div className="flex gap-3 p-3">
                              <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/60">
                                {item.media.poster ? (
                                  <Image
                                    unoptimized
                                    width={480}
                                    height={270}
                                    src={item.media.poster}
                                    alt=""
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <Image
                                    unoptimized
                                    width={480}
                                    height={270}
                                    src="/brand/ttv-neon-mini.png"
                                    alt=""
                                    loading="lazy"
                                    className="h-full w-full object-cover opacity-80"
                                  />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="line-clamp-2 text-sm font-semibold">
                                  {item.displayTitle}
                                </div>
                                <div className="mt-1 text-xs text-white/45">
                                  {formatDuration(item.media.duration)}
                                </div>

                                {entry ? (
                                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className="h-full rounded-full bg-cyan-300"
                                      style={{
                                        width: `${getProgressPercent(entry)}%`,
                                      }}
                                    />
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : null}
            </section>
          </div>
        )}

        <footer className="mt-10 border-t border-white/10 py-8 text-center text-xs leading-6 text-white/35">
          Library playback is separate from the live channel schedule. Only
          publish media you are authorized to distribute.
        </footer>
      </div>
    </main>
  );
}
