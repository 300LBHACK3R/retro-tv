export type MediaType = "show" | "commercial" | "movie" | "bumper";
export type AppMode = "viewer" | "admin";

export type ThemeId =
  | "shaw-2006"
  | "telus-2008-inspired"
  | "obsidian-gold"
  | "midas-gold"
  | "halo-2008-inspired";

export type ScheduleMode = "ordered" | "daily-random";

export type CommercialBreakMode =
  | "none"
  | "end-only"
  | "midpoint-and-end"
  | "classic-tv";

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
  duration: number;
  file: string;
  mimeType?: string;
  originalName?: string;
  poster?: string;
  description?: string;
  provider?: "cloudflare-r2" | "external-url" | "local-dev" | "unknown";
  createdAt?: string;
  updatedAt?: string;
}

export interface Channel {
  id: string;
  number?: number;
  name: string;
  mediaIds: string[];
  branding?: ChannelBranding;
  isEnabled?: boolean;

  /**
   * ordered = exact playlist order from Channel Programming.
   * daily-random = deterministic random lineup that changes daily but stays synced across devices.
   */
  scheduleMode?: ScheduleMode;

  /**
   * Controls commercial insertion style.
   */
  commercialBreakMode?: CommercialBreakMode;

  /**
   * Optional custom seed for a channel. Useful if you want a channel to reshuffle differently.
   */
  randomSeed?: string;
}

export type BroadcastItem = MediaItem & {
  /**
   * Where to start inside the source file.
   * Used for "part 1 / part 2" commercial breaks without cutting the MP4.
   */
  sourceStart?: number;

  /**
   * Where this segment ends inside the source file.
   */
  sourceEnd?: number;

  /**
   * Original full media id when this is a virtual segment.
   */
  parentMediaId?: string;

  /**
   * Human-readable segment label.
   */
  segmentLabel?: string;

  /**
   * True when this item is a virtual broadcast segment.
   */
  isVirtualSegment?: boolean;
};