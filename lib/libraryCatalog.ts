import { safeArtworkUrl, type LibraryArtwork } from "./libraryPresentation";
import { seriesMetadata, seriesIdentity, seriesGroupKey, seasonArtworkKey } from "./seriesMetadata";
import { cleanDisplayText } from "./textClean";
import type { MediaItem, MediaType } from "./types";

export type LibraryFilter = "all" | "show" | "movie" | "music-video" | "music";
export type LibraryMediaType = Exclude<MediaType, "commercial" | "bumper">;

type ParsedLibraryItem = {
  media: MediaItem;
  groupKey: string;
  groupTitle: string;
  displayTitle: string;
  season: number;
  episode: number;
  type: LibraryMediaType;
};

export type LibraryGroup = {
  key: string;
  title: string;
  type: LibraryMediaType;
  items: ParsedLibraryItem[];
  seasons: number[];
  totalDuration: number;
  poster?: string;
  searchText: string;
  aliasKeys: string[];
  seasonPosters: Record<number, string>;
};

export type ProgressEntry = {
  position: number;
  duration: number;
  updatedAt: number;
};

export type ProgressMap = Record<string, ProgressEntry>;

/** Ignore malformed storage and keep only the 300 most recently watched items. */
export function sanitizeProgress(value: unknown): ProgressMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([id, raw]) => {
        if (!id || id.length > 240 || !raw || typeof raw !== "object")
          return false;
        const entry = raw as ProgressEntry;
        return (
          Number.isFinite(entry.position) &&
          entry.position >= 0 &&
          Number.isFinite(entry.duration) &&
          entry.duration > 0 &&
          entry.position <= entry.duration &&
          Number.isFinite(entry.updatedAt) &&
          entry.updatedAt > 0
        );
      })
      .sort(
        (a, b) =>
          (b[1] as ProgressEntry).updatedAt - (a[1] as ProgressEntry).updatedAt,
      )
      .slice(0, 300),
  );
}

export const PROGRESS_STORAGE_KEY = "ttv-library-progress-v1";

export const FILTERS: { id: LibraryFilter; label: string }[] = [
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

export function getTypeLabel(type: LibraryMediaType): string {
  if (type === "movie") return "Movie";
  if (type === "music-video") return "Music Video";
  if (type === "music") return "Music";
  return "Show";
}

function createGroupKey(type: LibraryMediaType, title: string): string {
  return `${type}:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

// Retain the old grouping solely to carry existing saved posters/watchlists
// into corrected series cards. New season parsing does not use this result.
function parseLegacyLibraryItem(media: MediaItem): ParsedLibraryItem {
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
    /^(.*?)\s*S(?:eason)?[-_\s.]?(\d{1,2})[-_\s.]?E(?:p|pisode)?[-_\s.]?(\d{1,3})(.*)$/i,
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

  const episodeOnly = rawTitle.match(
    /^(.*?)\s+Ep(?:isode)?[-_\s.]?(\d{1,3})(.*)$/i,
  );

  if (episodeOnly) {
    const groupTitle = cleanDisplay(episodeOnly[1] ?? "") || rawTitle;
    const episode = Math.max(1, Number(episodeOnly[2] ?? 1));
    const suffix = cleanDisplay(episodeOnly[3] ?? "").replace(
      /^[-–—:]+\s*/,
      "",
    );
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

export function buildLibrary(media: MediaItem[], artwork: LibraryArtwork = {}, kids = false): LibraryGroup[] {
  const playable = media.filter(isPlayableLibraryMedia);
  const metadata = new Map(playable.filter(item => item.type === "show").map(item => [item.id, seriesMetadata(item)]));
  // Prefer the most common spelling so punctuation and spacing variants share a card.
  const names = new Map<string, Map<string, number>>();
  for (const item of metadata.values()) {
    const key = seriesIdentity(item.title);
    const counts = names.get(key) ?? new Map<string, number>();
    counts.set(item.title, (counts.get(item.title) ?? 0) + 1);
    names.set(key, counts);
  }
  const preferred = new Map([...names].map(([key, counts]) => [key, [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0]]));
  const groups = new Map<string, LibraryGroup>();
  for (const source of playable) {
    const legacy = parseLegacyLibraryItem(source);
    const meta = metadata.get(source.id);
    const groupTitle = meta ? preferred.get(seriesIdentity(meta.title))! : legacy.groupTitle;
    const groupKey = meta ? seriesGroupKey(groupTitle) : legacy.groupKey;
    const code = meta ? (meta.episode > 0 ? `${meta.season >= 0 ? `S${String(meta.season).padStart(2, "0")}E` : "Episode "}${String(meta.episode).padStart(2, "0")}` : "") : "";
    const item: ParsedLibraryItem = meta ? { media: source, groupKey, groupTitle, type: "show", season: meta.season, episode: meta.episode,
      displayTitle: [code, meta.episodeTitle].filter(Boolean).join(" · ") || source.title } : legacy;
    let group = groups.get(groupKey);
    if (!group) {
      group = { key: groupKey, title: groupTitle, type: item.type, items: [], seasons: [], totalDuration: 0, poster: undefined, searchText: groupTitle.toLowerCase(), aliasKeys: [], seasonPosters: {} };
      groups.set(groupKey, group);
    }
    group.items.push(item);
    group.totalDuration += getSafeDuration(source.duration);
    group.poster ||= source.poster;
    group.searchText += ` ${source.title} ${item.displayTitle} ${source.description ?? ""}`.toLowerCase();
    if (!group.seasons.includes(item.season)) group.seasons.push(item.season);
    if (!group.aliasKeys.includes(legacy.groupKey)) group.aliasKeys.push(legacy.groupKey);
  }
  function posterFor(keys: string[]) {
    return keys.map(key => artwork[key]).filter(value => value && (!kids || value.kidsApproved)).map(value => safeArtworkUrl(value?.poster)).find(Boolean);
  }
  return [...groups.values()].map(group => ({
    ...group,
    // Existing posters and watchlists follow the regrouped episodes.
    poster: posterFor([group.key, ...group.aliasKeys]) || safeArtworkUrl(group.poster) || undefined,
    seasonPosters: Object.fromEntries(group.seasons.map(season => [season, posterFor([group.key, ...group.aliasKeys].map(key => seasonArtworkKey(key, season)))]).filter(([, value]) => value)),
    seasons: [...group.seasons].sort((a, b) => (a < 0 ? Infinity : a) - (b < 0 ? Infinity : b)),
    items: [...group.items].sort((a, b) => {
      if (a.season !== b.season) return (a.season < 0 ? Infinity : a.season) - (b.season < 0 ? Infinity : b.season);
      if (a.episode !== b.episode) return (a.episode || Infinity) - (b.episode || Infinity);
      return a.displayTitle.localeCompare(b.displayTitle, undefined, { numeric: true, sensitivity: "base" });
    }),
  })).sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" }));
}

export function isSavedGroup(group: LibraryGroup, saved: readonly string[]) {
  return saved.includes(group.key) || group.aliasKeys.some(key => saved.includes(key));
}

export function formatDuration(seconds: number): string {
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

export function formatClock(seconds: number): string {
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
