"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { cleanDisplayText } from "@/lib/textClean";
import type { MediaItem } from "@/lib/types";

type ParsedEpisode = {
  media: MediaItem;
  seriesTitle: string;
  displayTitle: string;
  season: number;
  episode: number;
  isMovie: boolean;
};

type LibraryShow = {
  title: string;
  seasons: Map<number, ParsedEpisode[]>;
  episodeCount: number;
  movieCount: number;
};

const DEFAULT_SEASON = 1;
const MOVIE_SEASON = 0;

function cleanDisplay(value: string): string {
  return cleanDisplayText(value)
    .replaceAll("â€¢", " / ")
    .replaceAll("Â", "")
    .replaceAll("•", " / ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripExtension(value: string): string {
  return value.replace(/\.(mp4|webm|mov|m4v)$/i, "");
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

function formatEpisodeCode(season: number, episode: number): string {
  if (season === MOVIE_SEASON) {
    return "Movie";
  }

  if (episode <= 0) {
    return `S${String(season).padStart(2, "0")}`;
  }

  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(
    2,
    "0",
  )}`;
}

function parseEpisode(media: MediaItem): ParsedEpisode {
  const rawTitle = cleanDisplay(media.title || inferTitleFromFile(media.file));
  const fallbackTitle = rawTitle || "Untitled";

  if (media.type === "movie") {
    return {
      media,
      seriesTitle: "Movies",
      displayTitle: fallbackTitle,
      season: MOVIE_SEASON,
      episode: 0,
      isMovie: true,
    };
  }

  const patterns = [
    /^(.*?)\s+S(?:eason)?[-_\s.]?(\d{1,2})[-_\s.]?E(?:p|pisode)?[-_\s.]?(\d{1,3})(.*)$/i,
    /^(.*?)\s+S[-_\s.]?(\d{1,2})[-_\s.]?EP[-_\s.]?(\d{1,3})(.*)$/i,
    /^(.*?)\s+(\d{1,2})x(\d{1,3})(.*)$/i,
    /^(.*?)\s+Season\s+(\d{1,2})\s+Episode\s+(\d{1,3})(.*)$/i,
    /^(.*?)\s+\[(\d{1,2})x(\d{1,3})\](.*)$/i,
  ];

  for (const pattern of patterns) {
    const match = fallbackTitle.match(pattern);

    if (match) {
      const seriesTitle = cleanDisplay(match[1] ?? "Untitled");
      const season = Number(match[2] ?? DEFAULT_SEASON);
      const episode = Number(match[3] ?? 0);
      const suffix = cleanDisplay(match[4] ?? "");
      const episodeCode = formatEpisodeCode(season, episode);

      return {
        media,
        seriesTitle: seriesTitle || "Untitled",
        displayTitle: suffix.length > 0 ? `${episodeCode} / ${suffix}` : episodeCode,
        season: Number.isFinite(season) && season > 0 ? season : DEFAULT_SEASON,
        episode: Number.isFinite(episode) && episode > 0 ? episode : 0,
        isMovie: false,
      };
    }
  }

  return {
    media,
    seriesTitle: fallbackTitle,
    displayTitle: fallbackTitle,
    season: DEFAULT_SEASON,
    episode: 0,
    isMovie: false,
  };
}

function buildLibrary(media: MediaItem[]): LibraryShow[] {
  const shows = new Map<string, LibraryShow>();

  media
    .filter((item) => item.type === "show" || item.type === "movie")
    .map(parseEpisode)
    .forEach((episode) => {
      const key = episode.seriesTitle.toLowerCase();

      const existing =
        shows.get(key) ??
        ({
          title: episode.seriesTitle,
          seasons: new Map<number, ParsedEpisode[]>(),
          episodeCount: 0,
          movieCount: 0,
        } satisfies LibraryShow);

      const seasonEpisodes = existing.seasons.get(episode.season) ?? [];
      seasonEpisodes.push(episode);
      existing.seasons.set(episode.season, seasonEpisodes);
      existing.episodeCount += 1;

      if (episode.isMovie) {
        existing.movieCount += 1;
      }

      shows.set(key, existing);
    });

  return Array.from(shows.values())
    .map((show) => {
      show.seasons.forEach((episodes, season) => {
        show.seasons.set(
          season,
          episodes.sort((a, b) => {
            if (a.episode !== b.episode) return a.episode - b.episode;
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
      if (a.title === "Movies") return -1;
      if (b.title === "Movies") return 1;

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

function getSeasonLabel(season: number): string {
  if (season === MOVIE_SEASON) {
    return "Movies";
  }

  return `Season ${season}`;
}

function getPoster(media: MediaItem): string | undefined {
  return media.poster?.trim() || undefined;
}

function getEpisodeSearchText(episode: ParsedEpisode): string {
  return [
    episode.seriesTitle,
    episode.displayTitle,
    episode.media.title,
    episode.media.file,
    episode.media.description,
    episode.media.originalName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-2xl border p-4 text-sm leading-6"
      style={{
        borderColor: "var(--border)",
        background: "var(--panel-bg)",
        color: "var(--text-muted)",
      }}
    >
      {message}
    </div>
  );
}

export default function ShowLibrary() {
  const media = useStore((state) => state.media);

  const playerRef = useRef<HTMLVideoElement | null>(null);

  const [open, setOpen] = useState(false);
  const [selectedShowTitle, setSelectedShowTitle] = useState<string>("");
  const [selectedSeason, setSelectedSeason] = useState<number>(DEFAULT_SEASON);
  const [selectedEpisode, setSelectedEpisode] = useState<ParsedEpisode | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [episodeQuery, setEpisodeQuery] = useState("");

  const library = useMemo(() => buildLibrary(media), [media]);

  const filteredLibrary = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    if (!cleanQuery) return library;

    return library.filter((show) => {
      const titleMatches = show.title.toLowerCase().includes(cleanQuery);
      const episodeMatches = Array.from(show.seasons.values())
        .flat()
        .some((episode) => getEpisodeSearchText(episode).includes(cleanQuery));

      return titleMatches || episodeMatches;
    });
  }, [library, query]);

  const selectedShow = useMemo(() => {
    return (
      library.find((show) => show.title === selectedShowTitle) ??
      filteredLibrary[0] ??
      library[0] ??
      null
    );
  }, [filteredLibrary, library, selectedShowTitle]);

  const seasonNumbers = useMemo(() => {
    if (!selectedShow) return [];

    return Array.from(selectedShow.seasons.keys()).sort((a, b) => a - b);
  }, [selectedShow]);

  const activeSeason = useMemo(() => {
    if (!selectedShow) return DEFAULT_SEASON;

    if (selectedShow.seasons.has(selectedSeason)) {
      return selectedSeason;
    }

    return seasonNumbers[0] ?? DEFAULT_SEASON;
  }, [seasonNumbers, selectedSeason, selectedShow]);

  const episodes = useMemo(() => {
    if (!selectedShow) return [];

    const seasonEpisodes = selectedShow.seasons.get(activeSeason) ?? [];
    const cleanQuery = episodeQuery.trim().toLowerCase();

    if (!cleanQuery) {
      return seasonEpisodes;
    }

    return seasonEpisodes.filter((episode) =>
      getEpisodeSearchText(episode).includes(cleanQuery),
    );
  }, [activeSeason, episodeQuery, selectedShow]);

  const totalItems = useMemo(
    () => library.reduce((sum, show) => sum + show.episodeCount, 0),
    [library],
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!selectedShow && library[0]) {
      setSelectedShowTitle(library[0].title);
    }
  }, [library, selectedShow]);

  useEffect(() => {
    if (!open) {
      const player = playerRef.current;

      if (player) {
        player.pause();
      }
    }
  }, [open]);

  useEffect(() => {
    if (!selectedShow) return;

    if (!selectedShow.seasons.has(selectedSeason)) {
      setSelectedSeason(seasonNumbers[0] ?? DEFAULT_SEASON);
    }
  }, [seasonNumbers, selectedSeason, selectedShow]);

  const handleShowSelect = (title: string) => {
    const show = library.find((item) => item.title === title);

    setSelectedShowTitle(title);

    const firstSeason = show
      ? Array.from(show.seasons.keys()).sort((a, b) => a - b)[0] ?? DEFAULT_SEASON
      : DEFAULT_SEASON;

    setSelectedSeason(firstSeason);
    setSelectedEpisode(null);
    setEpisodeQuery("");
  };

  const playEpisode = (episode: ParsedEpisode) => {
    setSelectedEpisode(episode);

    window.setTimeout(() => {
      playerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 50);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ttv-action-button ttv-touch-target rounded-2xl border px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] shadow-2xl shadow-black/30"
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
            className="ttv-modal-scroll mx-auto flex min-h-[calc(100dvh-2rem)] max-w-7xl flex-col gap-3 rounded-2xl border p-3 shadow-2xl sm:p-4"
            style={{
              background: "var(--panel-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            <div className="sticky top-0 z-20 -mx-3 -mt-3 border-b px-3 py-3 backdrop-blur-xl sm:-mx-4 sm:-mt-4 sm:px-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div
                    className="text-xs font-black uppercase tracking-[0.2em]"
                    style={{ color: "var(--primary)" }}
                  >
                    Library
                  </div>

                  <h2 className="mt-1 text-xl font-black tracking-tight">
                    Watch Shows In Order
                  </h2>

                  <p
                    className="mt-1 text-xs leading-5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Live channels create the cable-TV feel. Library mode lets
                    viewers browse seasons and watch episodes in order.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="ttv-action-button ttv-touch-target rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em]"
                >
                  Close
                </button>
              </div>

              <div
                className="mt-3 rounded-2xl border px-3 py-2 text-xs leading-5"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                {library.length} shows / {totalItems} items loaded
              </div>
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
                  placeholder="Search shows..."
                  className="mb-3 w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                  spellCheck={false}
                  style={{
                    background: "var(--panel-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />

                <div className="max-h-[55dvh] space-y-2 overflow-y-auto pr-1">
                  {filteredLibrary.length > 0 ? (
                    filteredLibrary.map((show) => {
                      const active = selectedShow?.title === show.title;

                      return (
                        <button
                          key={show.title}
                          type="button"
                          onClick={() => handleShowSelect(show.title)}
                          className="ttv-touch-target w-full rounded-2xl border p-3 text-left transition hover:opacity-90"
                          style={{
                            background: active
                              ? "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))"
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
                            {show.episodeCount} item
                            {show.episodeCount === 1 ? "" : "s"}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <EmptyState message="No shows found." />
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
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-black">
                            {selectedShow.title}
                          </h3>

                          <div
                            className="mt-1 text-xs"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {selectedShow.episodeCount} library item
                            {selectedShow.episodeCount === 1 ? "" : "s"}
                          </div>
                        </div>

                        <div className="ttv-no-scrollbar flex max-w-full gap-2 overflow-x-auto">
                          {seasonNumbers.map((season) => {
                            const active = season === activeSeason;

                            return (
                              <button
                                key={season}
                                type="button"
                                onClick={() => {
                                  setSelectedSeason(season);
                                  setSelectedEpisode(null);
                                  setEpisodeQuery("");
                                }}
                                className="ttv-touch-target shrink-0 rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.1em]"
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
                                {getSeasonLabel(season)}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <input
                        value={episodeQuery}
                        onChange={(event) => setEpisodeQuery(event.target.value)}
                        placeholder="Search episodes in this season..."
                        className="mb-3 w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                        spellCheck={false}
                        style={{
                          background: "var(--panel-bg)",
                          borderColor: "var(--border)",
                          color: "var(--text)",
                        }}
                      />

                      {episodes.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {episodes.map((episode) => {
                            const active =
                              selectedEpisode?.media.id === episode.media.id;

                            return (
                              <button
                                key={episode.media.id}
                                type="button"
                                onClick={() => playEpisode(episode)}
                                className="ttv-touch-target rounded-2xl border p-3 text-left transition hover:scale-[1.01] hover:opacity-95"
                                style={{
                                  background: active
                                    ? "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))"
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
                                  {episode.isMovie
                                    ? "Movie"
                                    : `S${episode.season} E${
                                        episode.episode || "-"
                                      }`}{" "}
                                  / {formatDuration(episode.media.duration)}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <EmptyState message="No episodes match this search." />
                      )}
                    </>
                  ) : (
                    <EmptyState message="Upload shows first, then they will appear here." />
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
                      <div className="aspect-video overflow-hidden rounded-2xl border bg-black">
                        <video
                          ref={playerRef}
                          key={selectedEpisode.media.id}
                          src={selectedEpisode.media.file}
                          controls
                          playsInline
                          preload="metadata"
                          poster={getPoster(selectedEpisode.media)}
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

                      <div
                        className="mt-3 rounded-2xl border px-3 py-2 text-xs leading-5"
                        style={{
                          background: "var(--panel-bg)",
                          borderColor: "var(--border)",
                          color: "var(--text-muted)",
                        }}
                      >
                        On-demand playback does not affect the live channel
                        schedule.
                      </div>
                    </>
                  ) : (
                    <EmptyState message="Select an episode to watch it here. This does not affect the live channel schedule." />
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