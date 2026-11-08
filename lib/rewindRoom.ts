import { buildLibrary } from "./libraryCatalog";
import { viewerCatalog } from "./audience";
import { safeArtworkUrl, type LibraryArtwork } from "./libraryPresentation";
import { createMediaItemFromUrl } from "./mediaUtils";
import type { Channel, MediaItem } from "./types";

/** Use the same audience and artwork review as the main library, before search. */
export function rewindRoomCatalog(channels: Channel[], media: MediaItem[], artwork: LibraryArtwork, kids: boolean) {
  const approved = viewerCatalog(channels, media, kids).media;
  return buildLibrary(approved.filter(item => item.type === "movie" && item.rewindRoom === true), artwork, kids);
}

export function createRewindMovie(input: { title: string; file: string; duration: number; poster?: string; description?: string }): MediaItem {
  const title = input.title.trim().replace(/\s+/g, " ").slice(0, 140);
  if (!title) throw new Error("Enter a movie title.");
  let url: URL;
  try { url = new URL(input.file.trim()); } catch { throw new Error("Use a full public HTTPS video URL."); }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Use a public HTTPS video URL without credentials.");
  if (!Number.isFinite(input.duration) || input.duration < 1) throw new Error("Detect the runtime or enter a valid duration.");
  if (input.poster?.trim() && !safeArtworkUrl(input.poster)) throw new Error("Use a valid poster URL.");
  return {
    ...createMediaItemFromUrl({ title, url: url.href, duration: input.duration, type: "movie" }),
    rewindRoom: true,
    kidsApproved: false,
    poster: safeArtworkUrl(input.poster) || undefined,
    description: input.description?.trim().slice(0, 2000) || undefined,
  };
}
