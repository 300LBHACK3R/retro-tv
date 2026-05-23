export type MediaType = "show" | "commercial" | "movie" | "bumper";
export type AppMode = "viewer" | "admin";

export type ThemeId =
  | "shaw-2006"
  | "telus-2008-inspired"
  | "obsidian-gold"
  | "midas-gold"
  | "halo-2008-inspired";

export type MediaSourceProvider =
  | "cloudflare-r2"
  | "external-url"
  | "local-dev"
  | "unknown";

export type PlaybackFit = "contain" | "cover";

export interface ChannelBranding {
  displayName: string;
  callsign: string;
  description: string;
  accentColor: string;
  logoText: string;
}

export interface MediaItem {
  id: string;
  title: string;
  type: MediaType;

  /**
   * Duration in seconds.
   * This drives the live TV schedule engine, guide sizing, and playback offset.
   */
  duration: number;

  /**
   * Full playable media URL.
   *
   * Current production rule:
   * - Use Cloudflare R2 public MP4 URLs.
   * - Do not commit MP4 files to GitHub/Vercel.
   */
  file: string;

  /**
   * Optional browser media type.
   * Recommended default for Cloudflare R2 MP4s:
   * video/mp4
   */
  mimeType?: string;

  /**
   * Optional original filename or upload reference.
   * Useful for admin history/debugging.
   */
  originalName?: string;

  /**
   * Optional thumbnail/poster image.
   * Can also be a Cloudflare R2 public URL.
   */
  poster?: string;

  /**
   * Optional short description for admin panels, detail views, or future metadata screens.
   */
  description?: string;

  /**
   * Source hint for admin/debug UI.
   */
  provider?: MediaSourceProvider;

  /**
   * Optional date strings for future backend migration.
   * Keep as ISO strings so this stays JSON/localStorage-safe.
   */
  createdAt?: string;
  updatedAt?: string;
}

export interface Channel {
  id: string;
  name: string;
  mediaIds: string[];
  branding?: ChannelBranding;

  /**
   * Optional channel number for guide sorting/display.
   * Example: 1, 2, 101, etc.
   */
  number?: number;

  /**
   * Whether this channel is visible to viewers.
   * Admin tools can still show hidden channels.
   */
  isEnabled?: boolean;

  /**
   * Optional fallback poster/background for the channel.
   */
  poster?: string;
}

export interface ProgramBlock {
  mediaId: string;
  startsAt: number;
  endsAt: number;
  duration: number;
}

export interface NowPlayingResult {
  channel: Channel;
  media: MediaItem;
  program: ProgramBlock;
  elapsed: number;
  remaining: number;
  startsAt: number;
  endsAt: number;
}

export interface GuideSlot {
  channelId: string;
  mediaId: string;
  startsAt: number;
  endsAt: number;
  duration: number;
  title: string;
  type: MediaType;
}

export interface PersistedProgrammingState {
  media: MediaItem[];
  channels: Channel[];
  currentChannelId: string;
  updatedAt: string;
}