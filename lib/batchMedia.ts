import { createMediaItemFromUrl } from "./mediaUtils";
import type { Channel, MediaItem, MediaType } from "./types";

export const MAX_BATCH_ITEMS = 200;
export const BATCH_TYPES = ["show", "movie", "music-video", "commercial", "bumper"] as const;
export type BatchType = typeof BATCH_TYPES[number];
export type BatchEntry = { id: string; title: string; url: string; duration: number; originalName?: string };
export type BatchSettings = { channelId: string; type: BatchType; endBreak: number; folder: string };

export function publicVideoUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return "";
    url.hash = "";
    return url.href;
  } catch { return ""; }
}

export function batchTitle(filename: string): string {
  return filename.replace(/\.(mp4|webm|mov|m4v)$/i, "").replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
}

export function videoFilename(url: string): string {
  try { return decodeURIComponent(new URL(url).pathname.split("/").at(-1) || "Video"); }
  catch { return "Video"; }
}

export function batchFileType(file: Pick<File, "name" | "size">): string {
  if (!file.size || file.size > Math.floor(4.9 * 1024 ** 3)) throw new Error("Empty file or over 4.9 GB. Use a smaller browser-ready file.");
  const types: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/x-m4v" };
  const type = types[file.name.split(".").at(-1)?.toLowerCase() || ""];
  if (!type) throw new Error("Use MP4, WebM, MOV or M4V. Uploading does not convert codecs.");
  return type;
}

// Validate the whole selection before returning a single atomic store update.
// Existing URLs are never overwritten or silently reassigned.
export function buildBatchImport(media: MediaItem[], channels: Channel[], entries: BatchEntry[], settings: BatchSettings) {
  const channel = channels.find(item => item.id === settings.channelId);
  if (!channel) throw new Error("Choose an existing channel.");
  if (!BATCH_TYPES.includes(settings.type) || !entries.length || entries.length > MAX_BATCH_ITEMS) throw new Error("Choose 1–200 valid items.");
  if (![0, 15, 30, 60, 90, 120, 180, 300].includes(settings.endBreak)) throw new Error("Choose a supported end-break length.");
  for (const item of entries) {
    if (!publicVideoUrl(item.url) || !item.title.trim() || item.title.length > 240 || !Number.isInteger(item.duration) || item.duration < 1 || item.duration > 86400) {
      throw new Error(`Review the title, public HTTPS URL and runtime for ${item.title || "this item"}.`);
    }
  }
  const seen = new Set(media.map(item => publicVideoUrl(item.file) || item.file));
  const additions: MediaItem[] = [];
  const added: string[] = [];
  const skipped: string[] = [];
  const ad = settings.type === "commercial" || settings.type === "bumper";
  const endBreak = settings.type === "show" || settings.type === "movie" ? settings.endBreak : 0;
  for (const entry of entries) {
    const url = publicVideoUrl(entry.url);
    if (seen.has(url)) { skipped.push(entry.id); continue; }
    seen.add(url);
    const item = createMediaItemFromUrl({ url, title: entry.title, type: settings.type as MediaType, duration: entry.duration,
      slotLengthSeconds: endBreak ? entry.duration + endBreak : undefined, fillSlotWithCommercials: endBreak > 0 });
    additions.push({ ...item, originalName: entry.originalName || videoFilename(url), kidsApproved: false,
      ...(ad ? { adChannelIds: [channel.id], adPlacements: ["filler", "between-programs"], adCategories: ["general"], allowCommercialSlicing: false } : {}) });
    added.push(entry.id);
  }
  return {
    added, skipped,
    media: additions.length ? [...media, ...additions] : media,
    channels: !additions.length || ad ? channels : channels.map(item => item.id !== channel.id ? item : {
      ...item, mediaIds: [...item.mediaIds, ...additions.map(addition => addition.id)],
      ...(endBreak ? { adPolicy: { ...item.adPolicy, enabled: true, allowChannelTargetedAds: true,
        placements: [...new Set([...(item.adPolicy?.placements ?? ["between-programs", "filler"]), "filler" as const])] } } : {}),
    }),
  };
}
