import type { Channel } from "./types";

export type TitleArtwork = { poster: string; kidsApproved: boolean };
export type LibraryArtwork = Record<string, TitleArtwork>;
export type UpcomingTitle = {
  id: string;
  title: string;
  description: string;
  poster: string;
  type: "show" | "movie" | "music";
  releaseLabel: string;
  channelId?: string;
  kidsApproved: boolean;
  published: boolean;
};

export function safeArtworkUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const url = value.trim();
  if (!url || url.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(url))
    return "";
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      ? parsed.href
      : "";
  } catch {
    return "";
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeLibraryArtwork(value: unknown): LibraryArtwork {
  if (!record(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 5000)
      .flatMap(([key, entry]) => {
        if (!key || key.length > 240 || !record(entry)) return [];
        const poster = safeArtworkUrl(entry.poster);
        return poster
          ? [[key, { poster, kidsApproved: entry.kidsApproved === true }]]
          : [];
      }),
  );
}

export function sanitizeUpcomingTitles(value: unknown): UpcomingTitle[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 100).flatMap((raw) => {
    if (!record(raw)) return [];
    const text = (key: string, max: number) =>
      typeof raw[key] === "string" ? raw[key].trim().slice(0, max) : "";
    const id = text("id", 100);
    const title = text("title", 160);
    if (!id || !title || seen.has(id)) return [];
    seen.add(id);
    const poster = safeArtworkUrl(raw.poster);
    return [
      {
        id,
        title,
        description: text("description", 600),
        poster,
        type: raw.type === "movie" || raw.type === "music" ? raw.type : "show",
        releaseLabel: text("releaseLabel", 80),
        channelId: text("channelId", 100) || undefined,
        kidsApproved: raw.kidsApproved === true,
        published: raw.published === true && !!poster,
      } satisfies UpcomingTitle,
    ];
  });
}

export function visibleUpcomingTitles(
  titles: UpcomingTitle[],
  channels: Channel[],
  kids: boolean,
): UpcomingTitle[] {
  return titles.filter((title) => {
    if (
      !title.published ||
      !safeArtworkUrl(title.poster) ||
      (kids && !title.kidsApproved)
    )
      return false;
    if (!title.channelId) return true;
    const channel = channels.find((entry) => entry.id === title.channelId);
    return (
      !!channel &&
      channel.isEnabled !== false &&
      (!kids || (channel.kidsApproved === true && channel.adultOnly !== true))
    );
  });
}
