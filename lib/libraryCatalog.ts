import { cleanDisplayText } from "./textClean";
import type { MediaItem, MediaType } from "./types";

export type LibraryFilter = "all" | "show" | "movie" | "music-video" | "music";
export type LibraryMediaType = Exclude<MediaType, "commercial" | "bumper">;

export type ParsedLibraryItem = {
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

export function getSafeDuration(value: number | undefined): number {
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

export function parseLibraryItem(media: MediaItem): ParsedLibraryItem {
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

export function buildLibrary(media: MediaItem[]): LibraryGroup[] {
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
        existing.searchText +=
          ` ${item.displayTitle} ${item.media.description ?? ""}`.toLowerCase();
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
