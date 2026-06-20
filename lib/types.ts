export type MediaType =
  | "show"
  | "movie"
  | "music"
  | "music-video"
  | "commercial"
  | "bumper";

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

export type CommercialStrategy = "sequential" | "best-fit" | "random";

export type Weekday =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

/**
 * Ad placement controls where an ad is allowed to run.
 *
 * pre-roll = before a program/music video.
 * mid-roll = inside a program slot/break.
 * post-roll = after a program/music video.
 * between-programs = between lineup items.
 * top-of-hour = exact clock-style insertion point.
 * filler = safe fallback when the scheduler needs to fill remaining time.
 */
export type AdPlacement =
  | "pre-roll"
  | "mid-roll"
  | "post-roll"
  | "between-programs"
  | "top-of-hour"
  | "filler";

/**
 * Reserved global ad target.
 *
 * An ad with "all" in adChannelIds can run across every eligible channel,
 * subject to each channel ad policy.
 */
export const GLOBAL_AD_CHANNEL_TARGET = "all" as const;

export type AdChannelTarget = typeof GLOBAL_AD_CHANNEL_TARGET | string;

export type AdCategory =
  | "general"
  | "kids"
  | "music"
  | "gaming"
  | "christian"
  | "movies"
  | "anime"
  | "local-business"
  | "house-promo"
  | string;

export interface ChannelAdPolicy {
  /**
   * Master switch for channel-level ad insertion.
   *
   * If false, this channel should not insert ads unless the admin manually
   * places commercials directly in the lineup.
   */
  enabled?: boolean;

  /**
   * Which ad placements this channel allows.
   */
  placements?: AdPlacement[];

  /**
   * Commercial picking behaviour for this channel.
   */
  strategy?: CommercialStrategy;

  /**
   * Maximum number of ad items in one break.
   *
   * Example:
   * 1 = one ad per break.
   * 2 = two ads per break.
   */
  maxAdsPerBreak?: number;

  /**
   * Target break length in seconds.
   *
   * Example:
   * 120 = fill around 2 minutes.
   * 240 = fill around 4 minutes.
   */
  targetBreakSeconds?: number;

  /**
   * Prevents one ad from repeating too quickly on the same channel.
   */
  minSecondsBetweenSameAd?: number;

  /**
   * Optional channel-level play cap.
   */
  maxAdsPerHour?: number;

  /**
   * Empty/undefined means all categories are allowed.
   *
   * Example:
   * ["general", "local-business"].
   */
  allowedCategories?: AdCategory[];

  /**
   * Allows ads targeted to "all" channels.
   */
  allowGlobalAds?: boolean;

  /**
   * Allows ads explicitly assigned to this channel id.
   */
  allowChannelTargetedAds?: boolean;

  /**
   * Allows Tate's TV house promos.
   */
  allowHouseAds?: boolean;
}

export const TTV_PULSE_REACTIONS = [
  {
    id: "fire",
    emoji: "🔥",
    label: "Fire",
  },
  {
    id: "funny",
    emoji: "😂",
    label: "Funny",
  },
  {
    id: "nostalgia",
    emoji: "📼",
    label: "Nostalgia",
  },
  {
    id: "classic",
    emoji: "⭐",
    label: "Classic",
  },
  {
    id: "faith",
    emoji: "🙏",
    label: "Faith Pick",
  },
] as const;

export type PulseReactionId = (typeof TTV_PULSE_REACTIONS)[number]["id"];

export interface PulseReactionDefinition {
  id: PulseReactionId;
  emoji: string;
  label: string;
}

export type PulseReactionCounts = Partial<Record<PulseReactionId, number>>;

export type PulseCountsByMedia = Record<string, PulseReactionCounts>;

export type PulseUserReactions = Record<string, PulseReactionId>;

export interface PulseEngagementSummary {
  mediaKey: string;
  total: number;
  reactions: PulseReactionCounts;
  userReaction?: PulseReactionId;
  updatedAt?: string;
}

export interface ChannelBranding {
  displayName: string;
  callsign: string;
  description: string;
  accentColor: string;
  logoText: string;

  /**
   * Optional uploaded/channel logo.
   *
   * Existing channels can keep using logoText.
   * Branded channels can later use a real image without changing the schema again.
   */
  logoUrl?: string;
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
   * Optional analytics/engagement-safe grouping key.
   *
   * Useful when several virtual slices, restored files, or re-uploaded files
   * should count as the same program for TTV Pulse.
   */
  engagementKey?: string;

  /**
   * Manual show/movie cut points in seconds.
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
   * A 21:56 show inside a 30:00 block with two 2:00 ad breaks
   * gets the remaining time filled automatically.
   */
  fillSlotWithCommercials?: boolean;

  /**
   * Commercial selection behaviour for this item.
   *
   * sequential = rotate through commercial pool in order.
   * best-fit = prefer commercials close to the needed duration.
   * random = deterministic random pool support.
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
   * Legacy commercial category.
   *
   * Keep this for backwards compatibility. New ad tools should prefer
   * adCategories, but the scheduler/store can still map this into adCategories.
   *
   * Examples:
   * general, kids, anime, gaming, christian, movies
   */
  commercialCategory?: string;

  /**
   * Ad campaign controls.
   *
   * These fields let one uploaded commercial run on multiple channels without
   * duplicating the media file or placing the ad directly into each lineup.
   */

  /**
   * Channels this ad is allowed to run on.
   *
   * Use ["all"] for global availability.
   * Use ["1", "3", "20"] for selected channels.
   */
  adChannelIds?: AdChannelTarget[];

  /**
   * Where this ad is allowed to run.
   *
   * Empty/undefined means scheduler can use normal safe defaults.
   */
  adPlacements?: AdPlacement[];

  /**
   * Ad categories for matching against channel policies.
   */
  adCategories?: AdCategory[];

  /**
   * Higher priority ads are preferred when multiple ads match.
   *
   * Suggested range:
   * 0 = normal
   * 50 = preferred
   * 100 = house/paid priority
   */
  adPriority?: number;

  /**
   * Optional per-ad hourly cap.
   */
  adMaxPlaysPerHour?: number;

  /**
   * Optional per-ad repeat protection.
   */
  adMinSecondsBetweenPlays?: number;

  /**
   * Optional campaign active days.
   *
   * Empty/undefined means every day.
   */
  adDays?: Weekday[];

  /**
   * Optional daily start time for the campaign window.
   *
   * Format: HH:mm
   * Example: 09:00
   */
  adStartTime?: string;

  /**
   * Optional daily end time for the campaign window.
   *
   * Format: HH:mm
   * Example: 21:00
   */
  adEndTime?: string;

  /**
   * House ads are Tate's TV / internal promos.
   */
  isHouseAd?: boolean;

  /**
   * Optional human-facing campaign details.
   */
  advertiserName?: string;
  campaignName?: string;
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

  /**
   * Senior ad system.
   *
   * Programs stay in mediaIds.
   * Ads stay in the global media library and are selected through this policy.
   */
  adPolicy?: ChannelAdPolicy;
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

  /**
   * Optional ad playback metadata.
   */
  adPlacement?: AdPlacement;
  adBreakIndex?: number;
  adCampaignKey?: string;
};

export interface ViewerSettings {
  playerViewMode: PlayerViewMode;
  isSettingsOpen: boolean;
  isAdminAccessOpen: boolean;
  guideDensity: "compact" | "comfortable";
  preferReducedMotion: boolean;
}