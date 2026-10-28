import type { MediaItem } from "./types";

export type SeriesMetadata = { title: string; season: number; episode: number; episodeTitle: string };
const clean = (value: string) => value.replace(/^[\s._–—:-]+|[\s._–—:-]+$/g, "").replace(/\s+/g, " ").trim();
const display = (value: string) => clean(value.replace(/\.(mp4|webm|mov|m4v|mkv|avi)$/i, "").replace(/_compressed\b|\bcompressed$/ig, "").replace(/\s*\((?:\d{3,4}p|1080|720|480)[^)]*\)\s*$/i, "").replace(/\s*\[[^\]]*\]\s*$/, "").replace(/_/g, " "));
export const seriesIdentity = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function seriesGroupKey(title: string) { return `show:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`; }
export function seasonArtworkKey(groupKey: string, season: number) { return `${groupKey}:season:${season}`; }
export function seasonLabel(season: number) { return season < 0 ? "Other episodes" : season === 0 ? "Specials" : `Season ${season}`; }
export function seasonSummary(seasons: number[]) {
  const known = seasons.filter(value => value > 0);
  if (!known.length) return seasons.includes(0) ? "Specials" : "Episode collection";
  if (known.length === 1) return `Season ${known[0]}`;
  return `Seasons ${known.join(", ")}`;
}
function numbered(value: string): SeriesMetadata | null {
  const code = /(?:^|[\s(._–—:-])S(?:eason|e)?[\s._-]*(\d{1,2})[\s._-]*E(?:pisode|p)?[\s._-]*(\d{1,3})(?!\d)/i.exec(value)
    || /(?:^|[\s._–—:-])(\d{1,2})x(\d{1,3})(?!\d)/i.exec(value);
  if (!code) return null;
  const prefix = clean(value.slice(0, code.index));
  const suffix = clean(value.slice(code.index + code[0].length));
  const split = prefix.split(/\s+[–—-]\s*/);
  // Older imports use "Show - Episode title S01E01".
  const trailingCode = !suffix || /^[)\]]/.test(suffix) || /^\([^)]*\)$/.test(suffix);
  const title = trailingCode && split.length > 1 ? split[0]! : prefix;
  return { title, season: Number(code[1]), episode: Number(code[2]), episodeTitle: trailingCode && split.length > 1 ? clean(split.slice(1).join(" - ")) + (/^\(/.test(suffix) ? ` ${suffix}` : "") : suffix };
}

/** Recover order from explicit title codes first, then the original file name.
 * Unknown season/episode values stay unknown rather than inventing Season 1. */
export function seriesMetadata(media: Pick<MediaItem, "title" | "file" | "originalName">): SeriesMetadata {
  let parts: string[];
  try { parts = new URL(media.file, "https://local.invalid").pathname.split("/").filter(Boolean).map(part => decodeURIComponent(part)); }
  catch { parts = media.file.split("/").filter(Boolean); }
  const folder = display(parts.at(-2) || "");
  const filename = display(media.originalName || parts.at(-1) || "");
  const title = display(media.title || filename);
  const fromTitle = numbered(title);
  const fromFile = numbered(filename);
  const parsed = fromTitle || fromFile;
  if (parsed) {
    const prefix = title.split(/\s+[–—-]\s*/)[0] || "";
    let series = parsed.title;
    if (!series) series = fromFile?.title || folder;
    if (!fromTitle && fromFile && prefix && seriesIdentity(series.replace(/\s*\(\d{4}\)$/, "")) === seriesIdentity(prefix)) series = prefix;
    let episodeTitle = parsed.episodeTitle;
    if (!fromTitle && title.startsWith(`${series} -`) && !/\bS(?:eason|e)?[\s._-]*\d+[\s._-]*E/i.test(title)) episodeTitle = clean(title.slice(series.length + 2));
    if (!parsed.title && series && episodeTitle.startsWith(`${series} `)) episodeTitle = clean(episodeTitle.slice(series.length));
    return { ...parsed, title: series || title, episodeTitle: display(episodeTitle) };
  }
  const episodeOnly = /^(.*?)\bE(?:pisode|p)?[\s._-]*(\d{1,3})(?!\d)(.*)$/i.exec(filename)
    || /^(.*?)\s+\((\d{1,3})\)(.*)$/.exec(filename);
  if (episodeOnly) {
    const series = clean(episodeOnly[1] || "") || folder;
    const seasonFolder = parts.slice(0, -1).map(part => /^(?:Season\s*|S)(\d{1,2})$/i.exec(part)).find(Boolean);
    return { title: series || title, season: seasonFolder ? Number(seasonFolder[1]) : -1, episode: Number(episodeOnly[2]), episodeTitle: display(episodeOnly[3] || "").replace(/^\((.*)\)$/, "$1") };
  }
  const split = /^(.*?)\s+[–—-]\s*(.+)$/.exec(title);
  return { title: split?.[1] || title, season: -1, episode: 0, episodeTitle: split?.[2] || title };
}
