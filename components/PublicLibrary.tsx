"use client";

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
import TextEncodingCleaner from "@/components/TextEncodingCleaner";
import ThemeButton from "@/components/ThemeButton";
import { useStore } from "@/lib/store";
import { getThemeLayoutClass } from "@/lib/themeLayouts";
import { createThemeCssVars, getThemeById } from "@/lib/themes";
import { cleanDisplayText } from "@/lib/textClean";
import type { MediaItem, MediaType } from "@/lib/types";

type LibraryFilter = "all" | "show" | "movie" | "music-video" | "music";
type LibraryMediaType = Exclude<MediaType, "commercial" | "bumper">;

type ParsedLibraryItem = {
  media: MediaItem;
  groupKey: string;
  groupTitle: string;
  displayTitle: string;
  season: number;
  episode: number;
  type: LibraryMediaType;
};

type LibraryGroup = {
  key: string;
  title: string;
  type: LibraryMediaType;
  items: ParsedLibraryItem[];
  seasons: number[];
  totalDuration: number;
  poster?: string;
  searchText: string;
};

type ProgressEntry = {
  position: number;
  duration: number;
  updatedAt: number;
};

type ProgressMap = Record<string, ProgressEntry>;

const PROGRESS_STORAGE_KEY = "ttv-library-progress-v1";

const FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "show", label: "Shows" },
  { id: "movie", label: "Movies" },
  { id: "music-video", label: "Music Videos" },
  { id: "music", label: "Music" },
];

const TYPE_ORDER: Record<LibraryMediaType, number> = {
  show: 0,
  movie: 1,
  "music-video": 2,
  music: 3,
};

function cleanDisplay(value: string): string {
  return cleanDisplayText(value)
    .replaceAll("â€¢", " / ")
    .replaceAll("Â", "")
    .replaceAll("•", " / ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripExtension(value: string): string {
  return value.replace(/\.(mp4|webm|mov|m4v|mkv|avi)$/i, "");
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function inferTitleFromFile(file: string): string {
  try {
    const url = new URL(file);
    const last = url.pathname.split("/").filter(Boolean).pop() ?? "";
    return titleCase(stripExtension(decodeURIComponent(last)));
  } catch {
    const last = file.split("/").filter(Boolean).pop() ?? file;
    return titleCase(stripExtension(last));
  }
}

function getSafeDuration(value: number | undefined): number {
  const duration = Math.floor(Number(value));
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function isLibraryType(type: MediaType): type is LibraryMediaType {
  return (
    type === "show" ||
    type === "movie" ||
    type === "music-video" ||
    type === "music"
  );
}

function isPlayableLibraryMedia(item: MediaItem): boolean {
  return (
    isLibraryType(item.type) &&
    item.file.trim().length > 0 &&
    getSafeDuration(item.duration) > 0
  );
}

function getTypeLabel(type: LibraryMediaType): string {
  if (type === "movie") return "Movie";
  if (type === "music-video") return "Music Video";
  if (type === "music") return "Music";
  return "Show";
}

function createGroupKey(type: LibraryMediaType, title: string): string {
  return `${type}:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function parseLibraryItem(media: MediaItem): ParsedLibraryItem {
  const libraryType = media.type as LibraryMediaType;
  const rawTitle =
    cleanDisplay(media.title || inferTitleFromFile(media.file)) || "Untitled";

  if (libraryType !== "show") {
    return {
      media,
      groupKey: `${libraryType}:${media.id}`,
      groupTitle: rawTitle,
      displayTitle: rawTitle,
      season: 1,
      episode: 1,
      type: libraryType,
    };
  }

  const patterns = [
    /^(.*?)\s+S(?:eason)?[-_\s.]?(\d{1,2})[-_\s.]?E(?:p|pisode)?[-_\s.]?(\d{1,3})(.*)$/i,
    /^(.*?)\s+(\d{1,2})x(\d{1,3})(.*)$/i,
    /^(.*?)\s+Season\s+(\d{1,2})\s+Episode\s+(\d{1,3})(.*)$/i,
  ];

  for (const pattern of patterns) {
    const match = rawTitle.match(pattern);

    if (!match) continue;

    const groupTitle = cleanDisplay(match[1] ?? "") || rawTitle;
    const season = Math.max(1, Number(match[2] ?? 1));
    const episode = Math.max(1, Number(match[3] ?? 1));
    const suffix = cleanDisplay(match[4] ?? "").replace(/^[-–—:]+\s*/, "");
    const episodeCode = `S${String(season).padStart(2, "0")}E${String(
      episode,
    ).padStart(2, "0")}`;

    return {
      media,
      groupKey: createGroupKey("show", groupTitle),
      groupTitle,
      displayTitle: suffix ? `${episodeCode} · ${suffix}` : episodeCode,
      season,
      episode,
      type: "show",
    };
  }

  const episodeOnly = rawTitle.match(/^(.*?)\s+Ep(?:isode)?[-_\s.]?(\d{1,3})(.*)$/i);

  if (episodeOnly) {
    const groupTitle = cleanDisplay(episodeOnly[1] ?? "") || rawTitle;
    const episode = Math.max(1, Number(episodeOnly[2] ?? 1));
    const suffix = cleanDisplay(episodeOnly[3] ?? "").replace(/^[-–—:]+\s*/, "");
    const episodeCode = `S01E${String(episode).padStart(2, "0")}`;

    return {
      media,
      groupKey: createGroupKey("show", groupTitle),
      groupTitle,
      displayTitle: suffix ? `${episodeCode} · ${suffix}` : episodeCode,
      season: 1,
      episode,
      type: "show",
    };
  }

  return {
    media,
    groupKey: createGroupKey("show", rawTitle),
    groupTitle: rawTitle,
    displayTitle: rawTitle,
    season: 1,
    episode: 1,
    type: "show",
  };
}

function buildLibrary(media: MediaItem[]): LibraryGroup[] {
  const groups = new Map<string, LibraryGroup>();

  media
    .filter(isPlayableLibraryMedia)
    .map(parseLibraryItem)
    .forEach((item) => {
      const existing = groups.get(item.groupKey);

      if (existing) {
        existing.items.push(item);
        existing.totalDuration += getSafeDuration(item.media.duration);
        existing.poster ||= item.media.poster;
        existing.searchText += ` ${item.displayTitle} ${item.media.description ?? ""}`;
        if (!existing.seasons.includes(item.season)) {
          existing.seasons.push(item.season);
        }
        return;
      }

      groups.set(item.groupKey, {
        key: item.groupKey,
        title: item.groupTitle,
        type: item.type,
        items: [item],
        seasons: [item.season],
        totalDuration: getSafeDuration(item.media.duration),
        poster: item.media.poster,
        searchText: `${item.groupTitle} ${item.displayTitle} ${
          item.media.description ?? ""
        }`.toLowerCase(),
      });
    });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      seasons: [...group.seasons].sort((a, b) => a - b),
      items: [...group.items].sort((a, b) => {
        if (a.season !== b.season) return a.season - b.season;
        if (a.episode !== b.episode) return a.episode - b.episode;
        return a.displayTitle.localeCompare(b.displayTitle, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }),
    }))
    .sort((a, b) => {
      if (TYPE_ORDER[a.type] !== TYPE_ORDER[b.type]) {
        return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
      }

      return a.title.localeCompare(b.title, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remaining = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${String(remaining).padStart(2, "0")}s`;
  }

  return `${remaining}s`;
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remaining = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remaining,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function loadProgress(): ProgressMap {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ProgressMap) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function getProgressPercent(entry: ProgressEntry | undefined): number {
  if (!entry || entry.duration <= 0) return 0;
  return Math.min(100, Math.max(0, (entry.position / entry.duration) * 100));
}

function Poster({ group }: { group: LibraryGroup }) {
  if (group.poster) {
    return (
      <img
        src={group.poster}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="ttv-library-poster-fallback flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.4),transparent_45%),linear-gradient(135deg,#111827,#020617)] p-5 text-center">
      <div>
        <img
          src="/brand/ttv-neon-mini.png"
          alt=""
          loading="lazy"
          className="mx-auto h-16 w-16 rounded-2xl object-cover opacity-90 shadow-[0_0_28px_rgba(55,216,255,0.22)]"
        />
        <div className="mt-3 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200/70">
          {getTypeLabel(group.type)}
        </div>
        <div className="mt-2 line-clamp-3 text-base font-black text-white">
          {group.title}
        </div>
      </div>
    </div>
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

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [selectedGroupKey, setSelectedGroupKey] = useState("");
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [progress, setProgress] = useState<ProgressMap>({});
  const [autoPlayRequested, setAutoPlayRequested] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastProgressWriteRef = useRef(0);

  const library = useMemo(() => buildLibrary(media), [media]);

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return library.filter((group) => {
      const matchesFilter = filter === "all" || group.type === filter;
      const matchesQuery =
        !normalizedQuery ||
        group.title.toLowerCase().includes(normalizedQuery) ||
        group.searchText.includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }, [filter, library, query]);

  const selectedGroup = useMemo(
    () =>
      filteredGroups.find((group) => group.key === selectedGroupKey) ??
      filteredGroups[0] ??
      null,
    [filteredGroups, selectedGroupKey],
  );

  const activeSeason = selectedGroup?.seasons.includes(selectedSeason)
    ? selectedSeason
    : selectedGroup?.seasons[0] ?? 1;

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

  const currentIndex = selectedItem
    ? activeItems.findIndex((item) => item.media.id === selectedItem.media.id)
    : -1;

  const previousItem =
    currentIndex > 0
      ? activeItems[currentIndex - 1] ?? null
      : null;

  const nextItem =
    currentIndex >= 0 && currentIndex < activeItems.length - 1
      ? activeItems[currentIndex + 1] ?? null
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

      if (
        entry.position >= 10 &&
        entry.position < duration - 10
      ) {
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
      .sort(
        (a, b) =>
          Number(a.number ?? a.id) - Number(b.number ?? b.id),
      )
      .map(
        (channel) =>
          `CH ${channel.number ?? channel.id} · ${
            channel.branding?.displayName ?? channel.name
          }`,
      );
  }, [channels, selectedItem]);

  useEffect(() => {
    setProgress(loadProgress());
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

  function persistProgress(next: ProgressMap): void {
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
    const position = Math.max(0, Math.floor(video.currentTime));

    persistProgress({
      ...progress,
      [item.media.id]: {
        position,
        duration: Math.max(1, Math.floor(duration)),
        updatedAt: now,
      },
    });
  }

  function openItem(item: ParsedLibraryItem, shouldPlay = false): void {
    const group = library.find((entry) => entry.key === item.groupKey);

    setFilter("all");
    setQuery("");
    setSelectedGroupKey(item.groupKey);
    setSelectedSeason(item.season);
    setSelectedMediaId(item.media.id);
    setAutoPlayRequested(shouldPlay);

    if (!group) return;

    window.setTimeout(() => {
      document.getElementById("ttv-library-player")?.scrollIntoView({
        behavior: "smooth",
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

    const nextProgress = { ...progress };
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
      <TextEncodingCleaner />
      <GlobalProgrammingSync isAdminAuthorized={false} />

      <div className="ttv-library-ambient pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="ttv-library-ambient__primary absolute -left-32 top-0 h-96 w-96 rounded-full blur-3xl" />
        <div className="ttv-library-ambient__secondary absolute right-0 top-24 h-[28rem] w-[28rem] rounded-full blur-3xl" />
      </div>

      <header className="ttv-library-header sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1700px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
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
            <span className="hidden rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 sm:inline-flex">
              Free at launch
            </span>
            <Link
              href="/"
              className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.15em] text-cyan-100 transition hover:bg-cyan-400/20"
            >
              Back to Live TV
            </Link>
          </div>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-[1700px] px-4 py-6 sm:px-6 sm:py-10">
        <section className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(8,47,73,0.58),rgba(17,24,39,0.9)_45%,rgba(88,28,135,0.42))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] sm:p-9">
          <div className="max-w-4xl">
            <div className="text-xs font-black uppercase tracking-[0.3em] text-cyan-200">
              TTV Library
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">
              Watch Tate&apos;s TV On Demand
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70 sm:text-base">
              Browse saved shows, movies, and music without changing the live
              channel schedule. Pick an episode, resume where you stopped, or
              let the next episode continue automatically.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold text-white/75">
              {stats.groups} titles
            </span>
            <span className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold text-white/75">
              {stats.items} playable items
            </span>
            <span className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold text-white/75">
              {formatDuration(stats.duration)} total
            </span>
          </div>
        </section>

        {continueWatching.length > 0 ? (
          <section className="mt-8">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-fuchsia-200">
                  Continue Watching
                </div>
                <h2 className="mt-1 text-2xl font-black">Pick up where you left off</h2>
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
                      <img
                        src={item.media.poster}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(217,70,239,0.35),transparent_50%),#0f172a] px-4 text-center text-xs font-black text-white/80">
                        {item.groupTitle}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="line-clamp-1 text-sm font-black">
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
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                      {formatClock(entry.position)} watched
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 rounded-[2rem] border border-cyan-300/15 bg-[#07101f]/85 p-4 shadow-2xl shadow-black/30 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <label className="block">
              <span className="sr-only">Search the Tate's TV library</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles, episodes, movies, or music..."
                className="w-full rounded-2xl border border-cyan-300/20 bg-black/35 px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/55"
              />
            </label>

            <div className="flex gap-2 overflow-x-auto pb-1 lg:justify-end lg:pb-0">
              {FILTERS.map((item) => {
                const active = item.id === filter;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={`shrink-0 rounded-full border px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] transition ${
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
          <section className="mt-6 rounded-[2rem] border border-dashed border-cyan-300/25 bg-white/[0.03] p-10 text-center">
            <div className="text-xl font-black">The library is syncing</div>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/55">
              Playable shows, movies, and music will appear here as soon as the
              public programming snapshot finishes loading.
            </p>
          </section>
        ) : filteredGroups.length === 0 ? (
          <section className="mt-6 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
            <div className="text-xl font-black">No matching library titles</div>
            <p className="mt-2 text-sm text-white/50">
              Try a different search or content filter.
            </p>
          </section>
        ) : (
          <div className="mt-6 grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="min-w-0 rounded-[2rem] border border-cyan-300/15 bg-[#07101f]/85 p-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto">
              <div className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
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
                        <div className="line-clamp-2 text-sm font-black">
                          {group.title}
                        </div>
                        <div className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100/55">
                          {getTypeLabel(group.type)} · {group.items.length} item
                          {group.items.length === 1 ? "" : "s"}
                        </div>
                        <div className="mt-1 text-[11px] text-white/40">
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
              className="min-w-0 rounded-[2rem] border border-cyan-300/15 bg-[#07101f]/85 p-4 sm:p-5"
            >
              {selectedGroup && selectedItem ? (
                <>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">
                        {getTypeLabel(selectedGroup.type)}
                      </div>
                      <h2 className="mt-1 text-2xl font-black sm:text-3xl">
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
                            className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-black uppercase tracking-[0.12em] ${
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

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-black">
                        {selectedItem.displayTitle}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/45">
                        <span>{formatDuration(selectedItem.media.duration)}</span>
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
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white/70 transition enabled:hover:border-cyan-300/30 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        disabled={!nextItem}
                        onClick={() => moveToItem(nextItem)}
                        className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-cyan-100 transition enabled:hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-white/10 pt-5">
                    <div className="mb-3 flex items-end justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">
                          {selectedGroup.type === "show" ? "Episodes" : "Library Item"}
                        </div>
                        <h3 className="mt-1 text-xl font-black">
                          {selectedGroup.type === "show"
                            ? `Season ${activeSeason}`
                            : selectedGroup.title}
                        </h3>
                      </div>
                      <div className="text-xs text-white/40">
                        {activeItems.length} item{activeItems.length === 1 ? "" : "s"}
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
                                  <img
                                    src={item.media.poster}
                                    alt=""
                                    loading="lazy"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <img
                                    src="/brand/ttv-neon-mini.png"
                                    alt=""
                                    loading="lazy"
                                    className="h-full w-full object-cover opacity-80"
                                  />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="line-clamp-2 text-sm font-black">
                                  {item.displayTitle}
                                </div>
                                <div className="mt-1 text-[11px] text-white/45">
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
