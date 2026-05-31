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
   * Manual ad/commercial cut points in seconds.
   * Example: 480, 960 = 08:00 and 16:00.
   */
  breakpoints?: number[];

  /**
   * Empty/undefined means every day.
   */
  airDays?: Weekday[];

  /**
   * Optional planned schedule label/order time.
   * Format: HH:mm, example: 16:00.
   * This helps organize weekly schedules.
   */
  airStartTime?: string;
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
}

export type BroadcastItem = MediaItem & {
  sourceStart?: number;
  sourceEnd?: number;
  parentMediaId?: string;
  segmentLabel?: string;
  isVirtualSegment?: boolean;
  hiddenFromGuide?: boolean;
};
