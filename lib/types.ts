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

export type AdPlacement =
  | "pre-roll"
  | "mid-roll"
  | "post-roll"
  | "between-programs"
  | "top-of-hour"
  | "filler";

export const GLOBAL_AD_CHANNEL_TARGET = "all" as const;

export type AdChannelTarget = typeof GLOBAL_AD_CHANNEL_TARGET | string;

export type AdCategory = string;

export interface ChannelAdPolicy {
  /**
   * Master switch for automatic ad insertion on this channel.
   */
  enabled?: boolean;

  /**
   * Where ads are allowed to run on this channel.
   */
  placements?: AdPlacement[];

  /**
   * How ads should be selected from the eligible ad pool.
   */
  strategy?: CommercialStrategy;

  /**
   * Maximum number of ad items in a single break.
   */
  maxAdsPerBreak?: number;

  /**
   * Target ad break length in seconds.
   */
  targetBreakSeconds?: number;

  /**
   * Minimum time before the same ad can repeat on this channel.
   */
  minSecondsBetweenSameAd?: number;

  /**
   * Optional cap for all ads on this channel per hour.
   */
  maxAdsPerHour?: number;

  /**
   * Empty or undefined means all categories are allowed.
   */
  allowedCategories?: AdCategory[];

  /**
   * Allows ads targeted to every channel using "all".
   */
  allowGlobalAds?: boolean;

  /**
   * Allows ads explicitly targeted to this channel id.
   */
  allowChannelTargetedAds?: boolean;

  /**
   * Allows Tate's TV internal promos.
   */
  allowHouseAds?: boolean;
}

export const TTV_PULSE_REACTIONS = [
  {
    id: "fire",
    emoji: "\u{1F525}",
    label: "Fire",
  },
  {
    id: "funny",
    emoji: "\u{1F602}",
    label: "Funny",
  },
  {
    id: "nostalgia",
    emoji: "\u{1F4FC}",
    label: "Nostalgia",
  },
  {
    id: "classic",
    emoji: "\u2B50",
    label: "Classic",
  },
  {
    id: "faith",
    emoji: "\u{1F64F}",
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
   * Uploaded channel logo / network bug / real station image.
   *
   * This is what we will wire into the UI so channels can show actual images
   * instead of fake initials like "TP".
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

  /**
   * Uploaded poster/card art/thumbnail.
   *
   * This is the media-level image holder for cards, guide rows, and library UI.
   */
  poster?: string;

  description?: string;
  provider?: "cloudflare-r2" | "external-url" | "local-dev" | "unknown";
  createdAt?: string;
  updatedAt?: string;

  /**
   * Stable analytics/reaction key.
   *
   * Useful when a file is restored, re-uploaded, sliced, or duplicated but
   * should still count as the same title for TTV Pulse.
   */
  engagementKey?: string;

  /**
   * Manual program cut points in seconds.
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
   * If true, scheduler may fill remaining slot time with commercials/fillers.
   */
  fillSlotWithCommercials?: boolean;

  /**
   * Commercial selection behavior for this item/channel context.
   */
  commercialStrategy?: CommercialStrategy;

  /**
   * Empty or undefined means every day.
   */
  airDays?: Weekday[];

  /**
   * Optional fixed schedule time.
   *
   * Format: HH:mm
   * Example: 16:00
   */
  airStartTime?: string;

  /**
   * Commercial/bumpers only.
   *
   * If true, this item can be sliced virtually when a break needs only part of
   * a longer commercial reel.
   */
  allowCommercialSlicing?: boolean;

  /**
   * Current/legacy single category field.
   *
   * Keep this because the existing Quick Edit panel already reads/writes it.
   */
  commercialCategory?: string;

  /**
   * Channels this commercial/bumper is allowed to run on.
   *
   * Examples:
   * ["all"]
   * ["1", "3", "20"]
   */
  adChannelIds?: AdChannelTarget[];

  /**
   * Where this ad is allowed to run.
   */
  adPlacements?: AdPlacement[];

  /**
   * Multi-category version of commercialCategory.
   */
  adCategories?: AdCategory[];

  /**
   * Higher priority ads are preferred when multiple ads match.
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
   * Optional ad campaign active days.
   *
   * Empty or undefined means every day.
   */
  adDays?: Weekday[];

  /**
   * Optional daily campaign start window.
   *
   * Format: HH:mm
   */
  adStartTime?: string;

  /**
   * Optional daily campaign end window.
   *
   * Format: HH:mm
   */
  adEndTime?: string;

  /**
   * Internal Tate's TV promo.
   */
  isHouseAd?: boolean;

  /**
   * Optional admin-facing campaign labels.
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
   * Optional default slot length for shows/movies on this channel.
   * Media item slotLengthSeconds overrides this.
   */
  defaultSlotLengthSeconds?: number;

  /**
   * Optional default commercial strategy for this channel.
   */
  commercialStrategy?: CommercialStrategy;

  /**
   * Channel-level ad policy.
   *
   * Normal programs stay in mediaIds.
   * Commercials and bumpers can be targeted through adChannelIds and selected
   * by scheduler/admin ad tools.
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