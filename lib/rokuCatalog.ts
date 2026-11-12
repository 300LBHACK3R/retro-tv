import { viewerCatalog } from "./audience";
import { buildLibrary } from "./libraryCatalog";
import { safeArtworkUrl } from "./libraryPresentation";
import { getLiveState } from "./liveEngine";
import type { ProgrammingSnapshot } from "./programmingSnapshot";
import { buildSchedule, couldAdvertiseOnChannel } from "./scheduler";
import type { Channel, MediaItem } from "./types";

const SITE_ORIGIN = "https://www.tatestv.ca";
const FALLBACK_POSTER = `${SITE_ORIGIN}/tatestv-logo-christmas.png`;
export type RokuAudience = "all" | "kids";
type Stream = { url: string; streamFormat: "mp4" | "mkv" | "hls" | "dash" };

export function rokuStream(item: MediaItem): Stream | null {
  try {
    const url = new URL(item.file, SITE_ORIGIN);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const path = url.pathname.toLowerCase();
    if (/\.m3u8$/.test(path)) return { url: url.href, streamFormat: "hls" };
    if (/\.mpd$/.test(path)) return { url: url.href, streamFormat: "dash" };
    if (/\.(mp4|m4v|mov)$/.test(path)) return { url: url.href, streamFormat: "mp4" };
    if (/\.mkv$/.test(path)) return { url: url.href, streamFormat: "mkv" };
    return null;
  } catch {
    return null;
  }
}

function poster(value?: string) {
  const safe = safeArtworkUrl(value);
  return safe ? new URL(safe, SITE_ORIGIN).href : FALLBACK_POSTER;
}

function programmeIds(channel: Channel) {
  return [...new Set([
    ...channel.mediaIds,
    ...(channel.programmeBlocks ?? []).flatMap(block => block.mediaIds),
  ])];
}

/** Undefined exposes the current lineup; an explicit allowlist restricts release content. */
export function rokuLineup(
  snapshot: ProgrammingSnapshot,
  audience: RokuAudience,
  channelIds?: readonly string[],
) {
  const visible = viewerCatalog(snapshot.channels, snapshot.media, audience === "kids");
  const enabled = visible.channels.filter(channel => channel.isEnabled !== false &&
    (channelIds === undefined || channelIds.includes(channel.id)));
  const ids = new Set(enabled.flatMap(programmeIds));
  const media = visible.media.filter(item => channelIds === undefined || ids.has(item.id) ||
    enabled.some(channel => couldAdvertiseOnChannel(item, channel)));
  const byId = new Map(media.map(item => [item.id, item]));
  const playable = (item: MediaItem | undefined) => !!item && item.duration > 0 && !!rokuStream(item);
  // Hold a whole channel when a segment is unsupported. Removing a segment
  // would shift its clock and silently skip programmes or scheduled ads.
  const channels = enabled.filter(channel => {
    const assigned = programmeIds(channel);
    return assigned.length > 0 && assigned.every(id => playable(byId.get(id))) &&
      media.filter(item => couldAdvertiseOnChannel(item, channel)).every(playable);
  });
  return { channels, media };
}

function scheduleFor(channel: Channel, media: MediaItem[], now: Date) {
  const ids = new Set(programmeIds(channel));
  return buildSchedule(media.filter(item => ids.has(item.id)), {
    channel,
    now,
    availableAds: media.filter(item => item.type === "commercial" || item.type === "bumper"),
  });
}

export function buildRokuCatalog(
  snapshot: ProgrammingSnapshot,
  audience: RokuAudience,
  now = new Date(),
  channelIds?: readonly string[],
) {
  const lineup = rokuLineup(snapshot, audience, channelIds);
  const library = buildLibrary(lineup.media.filter(item => !!rokuStream(item)),
    snapshot.libraryArtwork, audience === "kids").filter(group => group.type !== "music").map(group => ({
    id: `series:${group.key}`,
    title: group.title,
    poster: poster(group.poster),
    type: group.type,
    items: group.items.map(({ media, displayTitle, season }) => ({
      id: `media:${media.id}`,
      title: group.type === "show" ? `${group.title} — ${displayTitle}` : group.title,
      description: media.description ?? "",
      poster: poster(group.seasonPosters[season] || group.poster || media.poster),
      duration: media.duration,
      mediaType: media.type === "movie" ? "movie" : "episode",
    })),
  }));
  const channels = lineup.channels.flatMap(channel => {
    const schedule = scheduleFor(channel, lineup.media, now);
    const live = getLiveState(schedule, now.getTime());
    if (!live.item) return [];
    const next = schedule[(live.index + 1) % schedule.length];
    return [{
      id: `channel:${channel.id}`,
      title: channel.branding?.displayName || channel.name,
      number: channel.number ?? (Number(channel.id) || 0),
      description: channel.branding?.description ?? "",
      poster: poster(channel.branding?.logoUrl),
      now: live.item.sourceTitle || live.item.title,
      next: next?.sourceTitle || next?.title || "",
      remaining: live.remaining,
      mediaType: "live",
    }];
  });
  return {
    ok: true,
    version: 1,
    audience,
    updatedAt: snapshot.updatedAt,
    generatedAt: now.toISOString(),
    refreshSeconds: 60,
    channels: channels.sort((a, b) => a.number - b.number),
    library,
  };
}

export function rokuPlayback(
  snapshot: ProgrammingSnapshot,
  audience: RokuAudience,
  id: string,
  now = new Date(),
  channelIds?: readonly string[],
) {
  const lineup = rokuLineup(snapshot, audience, channelIds);
  if (id.startsWith("channel:")) {
    const channel = lineup.channels.find(entry => `channel:${entry.id}` === id);
    if (!channel) return null;
    const state = getLiveState(scheduleFor(channel, lineup.media, now), now.getTime());
    if (!state.item) return null;
    const stream = rokuStream(state.item);
    if (!stream) return null;
    const source = lineup.media.find(item => item.id === (state.item!.parentMediaId || state.item!.id));
    return {
      id, ...stream,
      title: state.item.sourceTitle || state.item.title,
      mediaType: "live",
      start: state.sourceElapsed,
      // Roku's Video node plays the source file. The app must switch at the
      // scheduled segment boundary, including mid-roll and filler boundaries.
      end: state.sourceElapsed + state.remaining,
      remaining: state.remaining,
      duration: source?.duration ?? Math.max(state.item.duration, state.sourceElapsed + state.remaining),
      generatedAt: now.toISOString(),
    };
  }
  const item = lineup.media.find(entry => `media:${entry.id}` === id &&
    ["show", "movie", "music-video"].includes(entry.type));
  if (!item || item.duration <= 0) return null;
  const stream = rokuStream(item);
  if (!stream) return null;
  return {
    id, ...stream, title: item.title,
    mediaType: item.type === "movie" ? "movie" : "episode",
    start: 0, end: item.duration, remaining: item.duration,
    duration: item.duration, generatedAt: now.toISOString(),
  };
}
