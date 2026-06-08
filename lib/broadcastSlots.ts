import type {
  CommercialStrategy,
  MediaItem,
  MediaType,
} from "./types";

export const THIRTY_MINUTE_SLOT_SECONDS = 30 * 60;
export const SIXTY_MINUTE_SLOT_SECONDS = 60 * 60;

export const CARTOON_30_MINUTE_BREAKPOINTS = [7 * 60 + 30, 15 * 60];
export const CARTOON_30_MINUTE_BREAK_DURATIONS = [2 * 60, 2 * 60];

export const SITCOM_30_MINUTE_BREAKPOINTS = [11 * 60];
export const SITCOM_30_MINUTE_BREAK_DURATIONS = [3 * 60];

export const DRAMA_60_MINUTE_BREAKPOINTS = [12 * 60, 24 * 60, 36 * 60];
export const DRAMA_60_MINUTE_BREAK_DURATIONS = [3 * 60, 3 * 60, 3 * 60];

export const STANDARD_COMMERCIAL_STRATEGY: CommercialStrategy = "best-fit";

export type BroadcastPresetId =
  | "cartoon-30"
  | "sitcom-30"
  | "drama-60";

export type BroadcastPreset = {
  id: BroadcastPresetId;
  label: string;
  slotLengthSeconds: number;
  breakpoints: number[];
  breakDurations: number[];
  fillSlotWithCommercials: boolean;
  commercialStrategy: CommercialStrategy;
};

export const CARTOON_30_MINUTE_PRESET: BroadcastPreset = {
  id: "cartoon-30",
  label: "30m Cartoon/Anime Block",
  slotLengthSeconds: THIRTY_MINUTE_SLOT_SECONDS,
  breakpoints: CARTOON_30_MINUTE_BREAKPOINTS,
  breakDurations: CARTOON_30_MINUTE_BREAK_DURATIONS,
  fillSlotWithCommercials: true,
  commercialStrategy: STANDARD_COMMERCIAL_STRATEGY,
};

export const SITCOM_30_MINUTE_PRESET: BroadcastPreset = {
  id: "sitcom-30",
  label: "30m Sitcom Block",
  slotLengthSeconds: THIRTY_MINUTE_SLOT_SECONDS,
  breakpoints: SITCOM_30_MINUTE_BREAKPOINTS,
  breakDurations: SITCOM_30_MINUTE_BREAK_DURATIONS,
  fillSlotWithCommercials: true,
  commercialStrategy: STANDARD_COMMERCIAL_STRATEGY,
};

export const DRAMA_60_MINUTE_PRESET: BroadcastPreset = {
  id: "drama-60",
  label: "60m Drama Block",
  slotLengthSeconds: SIXTY_MINUTE_SLOT_SECONDS,
  breakpoints: DRAMA_60_MINUTE_BREAKPOINTS,
  breakDurations: DRAMA_60_MINUTE_BREAK_DURATIONS,
  fillSlotWithCommercials: true,
  commercialStrategy: STANDARD_COMMERCIAL_STRATEGY,
};

export function isBroadcastMediaType(type: MediaType): boolean {
  return type === "show" || type === "movie";
}

export function isThirtyMinuteShowCandidate(item: MediaItem): boolean {
  if (item.type !== "show") {
    return false;
  }

  const duration = Math.floor(Number(item.duration));

  if (!Number.isFinite(duration) || duration <= 0) {
    return false;
  }

  /*
   * Designed for normal 30-minute TV episodes:
   * cartoons, anime, sitcoms, most syndicated half-hour programming.
   */
  return duration >= 18 * 60 && duration <= 26 * 60;
}

export function shouldUseThirtyMinuteBroadcastStandard(
  item: MediaItem,
): boolean {
  if (!isThirtyMinuteShowCandidate(item)) {
    return false;
  }

  const slotLength = Math.floor(Number(item.slotLengthSeconds));

  /*
   * If slotLengthSeconds is missing, we still want normal half-hour shows
   * to behave like real broadcast TV by default.
   */
  return (
    !Number.isFinite(slotLength) ||
    slotLength <= 0 ||
    slotLength === THIRTY_MINUTE_SLOT_SECONDS
  );
}

export function getThirtyMinuteBroadcastPatch(): Partial<MediaItem> {
  return {
    slotLengthSeconds: CARTOON_30_MINUTE_PRESET.slotLengthSeconds,
    breakpoints: [...CARTOON_30_MINUTE_PRESET.breakpoints],
    breakDurations: [...CARTOON_30_MINUTE_PRESET.breakDurations],
    fillSlotWithCommercials: true,
    commercialStrategy: CARTOON_30_MINUTE_PRESET.commercialStrategy,
  };
}

export function standardizeThirtyMinuteBroadcastItem(
  item: MediaItem,
): MediaItem {
  if (!shouldUseThirtyMinuteBroadcastStandard(item)) {
    return item;
  }

  return {
    ...item,
    ...getThirtyMinuteBroadcastPatch(),
  };
}
