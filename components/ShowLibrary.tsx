"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { cleanDisplayText } from "@/lib/textClean";
import type { MediaItem, MediaType } from "@/lib/types";

type LibraryFilter = "all" | "show" | "movie" | "music" | "music-video";

type LibraryMediaType = Exclude<MediaType, "commercial" | "bumper">;

type ParsedLibraryItem = {
  media: MediaItem;
  groupKey: string;
  seriesTitle: string;
  displayTitle: string;
  season: number;
  episode: number;
  type: LibraryMediaType;
};

type LibraryShow = {
  key: string;
  title: string;
  type: LibraryMediaType;
  seasons: Map<number, ParsedLibraryItem[]>;
  itemCount: number;
  totalDuration: number;
};

const LIBRARY_FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "show", label: "Shows" },
  { id: "movie", label: "Movies" },
  { id: "music-video", label: "Music Videos" },
  { id: "music", label: "Music" },
];

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
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function hasPlayableSource(item: MediaItem): boolean {
  return item.file.trim().length > 0 && getSafeDuration(item.duration) > 0;
}

function isLibraryMediaType(type: MediaType): type is LibraryMediaType {
  return (
    type === "show" ||
    type === "movie" ||
    type === "music" ||
    type === "music-video"
  );
}

function isLibraryMedia(item: MediaItem): boolean {
  return isLibraryMediaType(item.type) && hasPlayableSource(item);
}

function getTypeLabel(type: MediaType): string {
  if (type === "movie") return "Movie";
  if (type === "music") return "Music";
  if (type === "music-video") return "Music Video";
  if (type === "commercial") return "Commercial";
  if (type === "bumper") return "Bumper";

  return "Show";
}

function getFallbackGroupTitle(media: MediaItem, fallbackTitle: string): string {
  if (media.type === "movie") {
    return "Movies";
  }

  if (media.type === "music" || media.type === "music-video") {
    return "Music Library";
  }

  return fallbackTitle || "Untitled";
}

function createGroupKey(type: LibraryMediaType, title: string): string {
  return `${type}:${title.toLowerCase().replace(/\s+/g, "-")}`;
}

function createParsedItem({
  media,
  seriesTitle,
  displayTitle,
  season,
  episode,
}: {
  media: MediaItem;
  seriesTitle: string;
  displayTitle: string;
  season: number;
  episode: number;
}): ParsedLibraryItem {
  const safeSeriesTitle = cleanDisplay(seriesTitle) || "Untitled";
  const safeType = media.type as LibraryMediaType;

  return {
    media,
    groupKey: createGroupKey(safeType, safeSeriesTitle),
    seriesTitle: safeSeriesTitle,
    displayTitle: cleanDisplay(displayTitle) || safeSeriesTitle,
    season: Number.isFinite(season) && season > 0 ? season : 1,
    episode: Number.isFinite(episode) && episode > 0 ? episode : 0,
    type: safeType,
  };
}

function parseEpisode(media: MediaItem): ParsedLibraryItem {
  const rawTitle = cleanDisplay(media.title || inferTitleFromFile(media.file));
  const fallbackTitle = rawTitle || "Untitled";

  const patterns = [
    /^(.*?)\s+S(?:eason)?[-_\s.]?(\d{1,2})[-_\s.]?E(?:p|pisode)?[-_\s.]?(\d{1,3})(.*)$/i,
    /^(.*?)\s+S[-_\s.]?(\d{1,2})[-_\s.]?EP[-_\s.]?(\d{1,3})(.*)$/i,
    /^(.*?)\s+(\d{1,2})x(\d{1,3})(.*)$/i,
    /^(.*?)\s+Season\s+(\d{1,2})\s+Episode\s+(\d{1,3})(.*)$/i,
    /^(.*?)\s+Ep(?:isode)?[-_\s.]?(\d{1,3})(.*)$/i,
  ];

  for (const pattern of patterns) {
    const match = fallbackTitle.match(pattern);

    if (!match) {
      continue;
    }

    if (match.length === 4) {
      const seriesTitle =
        cleanDisplay(match[1] ?? "") || getFallbackGroupTitle(media, fallbackTitle);
      const episode = Number(match[2] ?? 0);
      const suffix = cleanDisplay(match[3] ?? "");
      const displayTitle =
        suffix.length > 0
          ? `S01E${String(episode).padStart(2, "0")} ${suffix}`
          : `S01E${String(episode).padStart(2, "0")}`;

      return createParsedItem({
        media,
        seriesTitle,
        displayTitle,
        season: 1,
        episode,
      });
    }

    const seriesTitle =
      cleanDisplay(match[1] ?? "") || getFallbackGroupTitle(media, fallbackTitle);
    const season = Number(match[2] ?? 1);
    const episode = Number(match[3] ?? 0);
    const suffix = cleanDisplay(match[4] ?? "");
    const displayTitle =
      suffix.length > 0
        ? `S${String(season).padStart(2, "0")}E${String(episode).padStart(
            2,
            "0",
          )} ${suffix}`
        : `S${String(season).padStart(2, "0")}E${String(episode).padStart(
            2,
            "0",
          )}`;

    return createParsedItem({
      media,
      seriesTitle,
      displayTitle,
      season,
      episode,
    });
  }

  return createParsedItem({
    media,
    seriesTitle: getFallbackGroupTitle(media, fallbackTitle),
    displayTitle: fallbackTitle,
    season: 1,
    episode: media.type === "show" ? 0 : Number.MAX_SAFE_INTEGER,
  });
}

function buildLibrary(media: MediaItem[]): LibraryShow[] {
  const shows = new Map<string, LibraryShow>();

  media
    .filter(isLibraryMedia)
    .map(parseEpisode)
    .forEach((item) => {
      const existing =
        shows.get(item.groupKey) ??
        ({
          key: item.groupKey,
          title: item.seriesTitle,
          type: item.type,
          seasons: new Map<number, ParsedLibraryItem[]>(),
          itemCount: 0,
          totalDuration: 0,
        } satisfies LibraryShow);

      const seasonItems = existing.seasons.get(item.season) ?? [];
      seasonItems.push(item);

      existing.seasons.set(item.season, seasonItems);
      existing.itemCount += 1;
      existing.totalDuration += getSafeDuration(item.media.duration);

      shows.set(item.groupKey, existing);
    });

  return Array.from(shows.values())
    .map((show) => {
      show.seasons.forEach((items, season) => {
        show.seasons.set(
          season,
          items.sort((a, b) => {
            if (a.type !== b.type) {
              return getTypeLabel(a.type).localeCompare(getTypeLabel(b.type));
            }

            if (a.episode !== b.episode) {
              return a.episode - b.episode;
            }

            return a.displayTitle.localeCompare(b.displayTitle, undefined, {
              numeric: true,
              sensitivity: "base",
            });
          }),
        );
      });

      return show;
    })
    .sort((a, b) => {
      if (a.type !== b.type) {
        return getTypeLabel(a.type).localeCompare(getTypeLabel(b.type));
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

  return `${minutes}m ${String(remaining).padStart(2, "0")}s`;
}

function itemMatchesQuery(show: LibraryShow, query: string): boolean {
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) {
    return true;
  }

  const episodeText = Array.from(show.seasons.values())
    .flat()
    .map((item) => `${item.displayTitle} ${item.media.title}`)
    .join(" ");

  return `${show.title} ${getTypeLabel(show.type)} ${episodeText}`
    .toLowerCase()
    .includes(cleanQuery);
}

function getSeasonLabel(show: LibraryShow, season: number): string {
  if (show.type === "show") {
    return `Season ${season}`;
  }

  return "Library";
}

function getEpisodeMeta(show: LibraryShow, episode: ParsedLibraryItem): string {
  if (show.type === "show") {
    return `S${episode.season} E${episode.episode || "-"}`;
  }

  return getTypeLabel(episode.type);
}

export default function ShowLibrary() {
  const media = useStore((state) => state.media);

  const [open, setOpen] = useState(false);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>("");
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<ParsedLibraryItem | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");

  const library = useMemo(() => buildLibrary(media), [media]);

  const filteredLibrary = useMemo(() => {
    return library
      .filter((show) => filter === "all" || show.type === filter)
      .filter((show) => itemMatchesQuery(show, query));
  }, [filter, library, query]);

  const selectedShow = useMemo(() => {
    return (
      filteredLibrary.find((show) => show.key === selectedGroupKey) ??
      filteredLibrary[0] ??
      null
    );
  }, [filteredLibrary, selectedGroupKey]);

  const seasonNumbers = useMemo(() => {
    if (!selectedShow) return [];

    return Array.from(selectedShow.seasons.keys()).sort((a, b) => a - b);
  }, [selectedShow]);

  const activeSeason = selectedShow?.seasons.has(selectedSeason)
    ? selectedSeason
    : seasonNumbers[0];

  const episodes = useMemo(() => {
    if (!selectedShow || !activeSeason) return [];

    return selectedShow.seasons.get(activeSeason) ?? [];
  }, [activeSeason, selectedShow]);

  const libraryStats = useMemo(() => {
    const items = library.reduce((sum, show) => sum + show.itemCount, 0);
    const duration = library.reduce((sum, show) => sum + show.totalDuration, 0);

    return {
      groups: library.length,
      items,
      duration,
    };
  }, [library]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!selectedShow && filteredLibrary[0]) {
      setSelectedGroupKey(filteredLibrary[0].key);
    }
  }, [filteredLibrary, selectedShow]);

  useEffect(() => {
    if (!selectedShow) {
      setSelectedEpisode(null);
      return;
    }

    const firstSeason = Array.from(selectedShow.seasons.keys()).sort(
      (a, b) => a - b,
    )[0];

    if (firstSeason && !selectedShow.seasons.has(selectedSeason)) {
      setSelectedSeason(firstSeason);
      setSelectedEpisode(null);
    }
  }, [selectedSeason, selectedShow]);

  const handleShowSelect = (key: string) => {
    const show = library.find((item) => item.key === key);

    setSelectedGroupKey(key);

    const firstSeason = show
      ? Array.from(show.seasons.keys()).sort((a, b) => a - b)[0] ?? 1
      : 1;

    setSelectedSeason(firstSeason);
    setSelectedEpisode(null);
  };

  const playEpisode = (episode: ParsedLibraryItem) => {
    setSelectedEpisode(episode);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl border px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] shadow-2xl shadow-black/30 transition hover:scale-[1.02] hover:opacity-95"
        style={{
          background: "var(--button-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        Library
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[96] overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Show library"
        >
          <div
            className="mx-auto flex min-h-[calc(100dvh-2rem)] max-w-7xl flex-col gap-3 rounded-2xl border p-3 shadow-2xl sm:p-4"
            style={{
              background: "var(--panel-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div
                  className="text-xs font-black uppercase tracking-[0.2em]"
                  style={{ color: "var(--primary)" }}
                >
                  Library
                </div>

                <h2 className="mt-1 text-xl font-black tracking-tight">
                  Watch On Demand
                </h2>

                <p
                  className="mt-1 text-xs leading-5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Live channels keep the cable-TV feel. Library mode is for
                  browsing saved shows, movies, and music without changing the
                  live schedule.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className="rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {libraryStats.groups} groups
                  </span>

                  <span
                    className="rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {libraryStats.items} items
                  </span>

                  <span
                    className="rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]"
                    style={{
                      borderColor: "var(--border)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {formatDuration(libraryStats.duration)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em] transition hover:scale-[1.01]"
                style={{
                  background: "var(--button-bg)",
                  color: "var(--text)",
                }}
              >
                Close
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside
                className="rounded-2xl border p-3"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: "var(--border)",
                }}
              >
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search library..."
                  className="mb-3 w-full rounded-xl border px-3 py-3 text-sm outline-none"
                  spellCheck={false}
                  style={{
                    background: "var(--panel-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />

                <div className="ttv-no-scrollbar mb-3 flex gap-2 overflow-x-auto pb-1">
                  {LIBRARY_FILTERS.map((item) => {
                    const active = item.id === filter;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setFilter(item.id);
                          setSelectedGroupKey("");
                          setSelectedEpisode(null);
                        }}
                        className="shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em]"
                        style={{
                          background: active ? "var(--primary)" : "var(--button-bg)",
                          borderColor: active ? "var(--primary)" : "var(--border)",
                          color: "var(--text)",
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div className="max-h-[55dvh] space-y-2 overflow-y-auto pr-1">
                  {filteredLibrary.length > 0 ? (
                    filteredLibrary.map((show) => {
                      const active = selectedShow?.key === show.key;

                      return (
                        <button
                          key={show.key}
                          type="button"
                          onClick={() => handleShowSelect(show.key)}
                          className="w-full rounded-xl border p-3 text-left transition hover:opacity-90"
                          style={{
                            background: active
                              ? "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.7))"
                              : "var(--panel-bg)",
                            borderColor: active ? "var(--primary)" : "var(--border)",
                            color: "var(--text)",
                          }}
                        >
                          <div className="truncate text-sm font-black">
                            {show.title}
                          </div>

                          <div
                            className="mt-1 text-[11px] uppercase tracking-[0.12em]"
                            style={{ color: active ? "inherit" : "var(--text-muted)" }}
                          >
                            {getTypeLabel(show.type)} / {show.itemCount} item
                            {show.itemCount === 1 ? "" : "s"}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div
                      className="rounded-xl border p-3 text-sm"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      No library items found.
                    </div>
                  )}
                </div>
              </aside>

              <section className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div
                  className="rounded-2xl border p-3"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                  }}
                >
                  {selectedShow ? (
                    <>
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-lg font-black">{selectedShow.title}</h3>
                          <div
                            className="mt-1 text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {getTypeLabel(selectedShow.type)} /{" "}
                            {selectedShow.itemCount} library item
                            {selectedShow.itemCount === 1 ? "" : "s"}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {seasonNumbers.map((season) => {
                            const active = season === activeSeason;

                            return (
                              <button
                                key={season}
                                type="button"
                                onClick={() => {
                                  setSelectedSeason(season);
                                  setSelectedEpisode(null);
                                }}
                                className="rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.1em]"
                                style={{
                                  background: active
                                    ? "var(--primary)"
                                    : "var(--button-bg)",
                                  borderColor: active
                                    ? "var(--primary)"
                                    : "var(--border)",
                                  color: "var(--text)",
                                }}
                              >
                                {getSeasonLabel(selectedShow, season)}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {episodes.map((episode) => {
                          const active =
                            selectedEpisode?.media.id === episode.media.id;

                          return (
                            <button
                              key={episode.media.id}
                              type="button"
                              onClick={() => playEpisode(episode)}
                              className="rounded-xl border p-3 text-left transition hover:scale-[1.01] hover:opacity-95"
                              style={{
                                background: active
                                  ? "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.7))"
                                  : "var(--panel-bg)",
                                borderColor: active
                                  ? "var(--primary)"
                                  : "var(--border)",
                                color: "var(--text)",
                              }}
                            >
                              <div className="line-clamp-2 text-sm font-black">
                                {episode.displayTitle}
                              </div>

                              <div
                                className="mt-2 text-[11px] uppercase tracking-[0.12em]"
                                style={{
                                  color: active ? "inherit" : "var(--text-muted)",
                                }}
                              >
                                {getEpisodeMeta(selectedShow, episode)} /{" "}
                                {formatDuration(episode.media.duration)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div
                      className="rounded-xl border p-4 text-sm"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      Upload playable shows, movies, or music first, then they
                      will appear here.
                    </div>
                  )}
                </div>

                <aside
                  className="rounded-2xl border p-3"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div
                    className="mb-2 text-xs font-black uppercase tracking-[0.16em]"
                    style={{ color: "var(--primary)" }}
                  >
                    On Demand Player
                  </div>

                  {selectedEpisode ? (
                    <>
                      <div className="aspect-video overflow-hidden rounded-xl border bg-black">
                        <video
                          key={selectedEpisode.media.id}
                          src={selectedEpisode.media.file}
                          controls
                          playsInline
                          preload="metadata"
                          className="h-full w-full bg-black"
                        />
                      </div>

                      <div className="mt-3 text-sm font-black">
                        {selectedEpisode.seriesTitle}
                      </div>

                      <div
                        className="mt-1 text-xs leading-5"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {selectedEpisode.displayTitle} /{" "}
                        {formatDuration(selectedEpisode.media.duration)}
                      </div>
                    </>
                  ) : (
                    <div
                      className="rounded-xl border p-4 text-sm leading-6"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      Select an item to watch it here. This does not affect the
                      live channel schedule.
                    </div>
                  )}
                </aside>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}