export type MediaType = "show" | "commercial" | "movie" | "bumper";
export type AppMode = "viewer" | "admin";

export type PlayerViewMode = "normal" | "mini" | "theater";

export type ThemeId =
  | "shaw-2006"
  | "telus-2008-inspired"
  | "obsidian-gold"
  | "midas-gold"
  | "halo-2008-inspired"
  | "neon-arcade-2005"
  | "saturday-morning-max"
  | "electric-blue-live";

export type ScheduleMode = "ordered" | "daily-random";

export type CommercialBreakMode =
  | "none"
  | "end-only"
  | "midpoint-and-end"
  | "classic-tv";

export type CommercialStrategy =
  | "sequential"
  | "best-fit"
  | "random";

export type Weekday =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

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

  /**
   * Manual show cut points in seconds.
   *
   * Example:
   * 450 = 07:30
   * 900 = 15:00
   */
  breakpoints?: number[];

  /**
   * Target commercial duration after each breakpoint.
   *
   * Example:
   * [120, 120] = two 2-minute ad blocks.
   */
  breakDurations?: number[];

  /**
   * Optional broadcast slot length in seconds.
   *
   * Example:
   * 1800 = 30-minute TV block.
   * 3600 = 60-minute TV block.
   */
  slotLengthSeconds?: number;

  /**
   * If true, the scheduler fills remaining slot time with commercials/fillers.
   *
   * Example:
   * 21:56 show inside a 30:00 block with two 2:00 ad breaks
   * gets the remaining 4:04 filled automatically.
   */
  fillSlotWithCommercials?: boolean;

  /**
   * Commercial selection behaviour for this item.
   *
   * sequential = rotate through commercial pool in order.
   * best-fit = prefer commercials close to the needed duration.
   * random = future random pool support.
   */
  commercialStrategy?: CommercialStrategy;

  /**
   * Empty/undefined means every day.
   */
  airDays?: Weekday[];

  /**
   * Optional planned schedule label/order time.
   *
   * Format: HH:mm
   * Example: 16:00
   */
  airStartTime?: string;

  /**
   * Commercial/bumpers only.
   *
   * If true, this item can be sliced virtually when a break needs
   * only part of a longer commercial reel.
   */
  allowCommercialSlicing?: boolean;

  /**
   * Commercial/bumpers only.
   *
   * Optional grouping for future channel-safe ad pools.
   *
   * Examples:
   * general, kids, anime, gaming, christian, movies
   */
  commercialCategory?: string;
}

export interface Channel {
  id: string;
  number?: number;
  name: string;
  mediaIds: string[];

  branding?: ChannelBranding;
  isEnabled?: boolean;
  scheduleMode?: ScheduleMode;
  commercialBreakMode?: CommercialBreakMode;
  randomSeed?: string;

  /**
   * Optional default slot length for shows on this channel.
   * Media item slotLengthSeconds overrides this.
   */
  defaultSlotLengthSeconds?: number;

  /**
   * Optional default commercial strategy for this channel.
   */
  commercialStrategy?: CommercialStrategy;
}

export type BroadcastItem = MediaItem & {
  sourceStart?: number;
  sourceEnd?: number;
  parentMediaId?: string;
  segmentLabel?: string;
  isVirtualSegment?: boolean;

  /**
   * Real playback schedule still uses this item,
   * but public guide / Now Next should hide it.
   */
  hiddenFromGuide?: boolean;

  /**
   * Original source title for virtual slices.
   */
  sourceTitle?: string;

  /**
   * Optional display duration for clean guide blocks.
   * Useful when the viewer guide shows one 30-minute block while
   * playback secretly contains show parts + commercials.
   */
  guideDuration?: number;
};

export interface ViewerSettings {
  playerViewMode: PlayerViewMode;
  isSettingsOpen: boolean;
  isAdminAccessOpen: boolean;
  guideDensity: "compact" | "comfortable";
  preferReducedMotion: boolean;
}


