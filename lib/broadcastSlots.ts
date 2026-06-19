import type { CommercialStrategy, MediaItem, MediaType } from "./types";

export const THIRTY_MINUTE_SLOT_SECONDS = 30 * 60;
export const SIXTY_MINUTE_SLOT_SECONDS = 60 * 60;

export const CARTOON_30_MINUTE_BREAKPOINTS = [7 * 60 + 30, 15 * 60] as const;
export const CARTOON_30_MINUTE_BREAK_DURATIONS = [2 * 60, 2 * 60] as const;

export const SITCOM_30_MINUTE_BREAKPOINTS = [11 * 60] as const;
export const SITCOM_30_MINUTE_BREAK_DURATIONS = [3 * 60] as const;

export const DRAMA_60_MINUTE_BREAKPOINTS = [12 * 60, 24 * 60, 36 * 60] as const;
export const DRAMA_60_MINUTE_BREAK_DURATIONS = [3 * 60, 3 * 60, 3 * 60] as const;

export const STANDARD_COMMERCIAL_STRATEGY: CommercialStrategy = "best-fit";

const PLAYABLE_BROADCAST_TYPES: readonly MediaType[] = [
  "show",
  "movie",
  "music",
  "music-video",
];

const AUTO_STANDARDIZED_BROADCAST_TYPES: readonly MediaType[] = ["show", "movie"];

const COMMERCIAL_MEDIA_TYPES: readonly MediaType[] = ["commercial", "bumper"];

export type BroadcastPresetId = "cartoon-30" | "sitcom-30" | "drama-60";

export type BroadcastPreset = {
  id: BroadcastPresetId;
  label: string;
  shortLabel: string;
  slotLengthSeconds: number;
  breakpoints: number[];
  breakDurations: number[];
  fillSlotWithCommercials: boolean;
  commercialStrategy: CommercialStrategy;
};

type BreakPlan = {
  breakpoints: number[];
  breakDurations: number[];
};

export const CARTOON_30_MINUTE_PRESET: BroadcastPreset = {
  id: "cartoon-30",
  label: "30m Cartoon/Anime Block",
  shortLabel: "30m Cartoon",
  slotLengthSeconds: THIRTY_MINUTE_SLOT_SECONDS,
  breakpoints: [...CARTOON_30_MINUTE_BREAKPOINTS],
  breakDurations: [...CARTOON_30_MINUTE_BREAK_DURATIONS],
  fillSlotWithCommercials: true,
  commercialStrategy: STANDARD_COMMERCIAL_STRATEGY,
};

export const SITCOM_30_MINUTE_PRESET: BroadcastPreset = {
  id: "sitcom-30",
  label: "30m Sitcom Block",
  shortLabel: "30m Sitcom",
  slotLengthSeconds: THIRTY_MINUTE_SLOT_SECONDS,
  breakpoints: [...SITCOM_30_MINUTE_BREAKPOINTS],
  breakDurations: [...SITCOM_30_MINUTE_BREAK_DURATIONS],
  fillSlotWithCommercials: true,
  commercialStrategy: STANDARD_COMMERCIAL_STRATEGY,
};

export const DRAMA_60_MINUTE_PRESET: BroadcastPreset = {
  id: "drama-60",
  label: "60m Drama Block",
  shortLabel: "60m Drama",
  slotLengthSeconds: SIXTY_MINUTE_SLOT_SECONDS,
  breakpoints: [...DRAMA_60_MINUTE_BREAKPOINTS],
  breakDurations: [...DRAMA_60_MINUTE_BREAK_DURATIONS],
  fillSlotWithCommercials: true,
  commercialStrategy: STANDARD_COMMERCIAL_STRATEGY,
};

export const BROADCAST_PRESETS: BroadcastPreset[] = [
  CARTOON_30_MINUTE_PRESET,
  SITCOM_30_MINUTE_PRESET,
  DRAMA_60_MINUTE_PRESET,
];

function normalizePositiveSecond(value: unknown): number {
  const numberValue = Math.floor(Number(value));

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return 0;
  }

  return numberValue;
}

function clonePreset(preset: BroadcastPreset): BroadcastPreset {
  return {
    ...preset,
    breakpoints: [...preset.breakpoints],
    breakDurations: [...preset.breakDurations],
  };
}

function includesMediaType(types: readonly MediaType[], type: MediaType): boolean {
  return types.includes(type);
}

function cleanBreakpoints(
  values: readonly number[],
  durationSeconds: number,
): number[] {
  const durationLimit = normalizePositiveSecond(durationSeconds);

  if (durationLimit <= 0) {
    return [];
  }

  const uniqueBreakpoints = new Set<number>();

  values.forEach((value) => {
    const normalized = normalizePositiveSecond(value);

    if (normalized > 0 && normalized < durationLimit) {
      uniqueBreakpoints.add(normalized);
    }
  });

  return [...uniqueBreakpoints].sort((a, b) => a - b);
}

function cleanBreakDurations(values: readonly number[]): number[] {
  return values.map(normalizePositiveSecond).filter((value) => value > 0);
}

function cleanBreakPlan(
  breakpoints: readonly number[],
  breakDurations: readonly number[],
  durationSeconds: number,
): BreakPlan {
  const cleanedBreakpoints = cleanBreakpoints(breakpoints, durationSeconds);
  const cleanedDurations = cleanBreakDurations(breakDurations);

  return {
    breakpoints: cleanedBreakpoints,
    breakDurations: cleanedBreakpoints.map((_, index) => {
      return cleanedDurations[index] ?? cleanedDurations[cleanedDurations.length - 1] ?? 0;
    }).filter((value) => value > 0),
  };
}

function getCleanPresetBreakPlan(
  preset: BroadcastPreset,
  durationSeconds?: number,
): BreakPlan {
  const safeDuration = normalizePositiveSecond(durationSeconds);
  const durationLimit = safeDuration > 0 ? safeDuration : preset.slotLengthSeconds;

  return cleanBreakPlan(preset.breakpoints, preset.breakDurations, durationLimit);
}

function hasRealBreakpoints(item: MediaItem): boolean {
  if (!Array.isArray(item.breakpoints)) {
    return false;
  }

  const duration = normalizePositiveSecond(item.duration || item.slotLengthSeconds);

  return cleanBreakpoints(item.breakpoints, duration).length > 0;
}

function hasRealBreakDurations(item: MediaItem): boolean {
  if (!Array.isArray(item.breakDurations)) {
    return false;
  }

  return cleanBreakDurations(item.breakDurations).length > 0;
}

function hasCustomSlotLength(item: MediaItem): boolean {
  const slotLength = normalizePositiveSecond(item.slotLengthSeconds);

  if (slotLength <= 0) {
    return false;
  }

  const duration = normalizePositiveSecond(item.duration);

  if (duration >= 18 * 60 && duration <= 26 * 60) {
    return slotLength !== THIRTY_MINUTE_SLOT_SECONDS;
  }

  if (duration >= 38 * 60 && duration <= 52 * 60) {
    return slotLength !== SIXTY_MINUTE_SLOT_SECONDS;
  }

  return true;
}

function hasCustomCommercialStrategy(item: MediaItem): boolean {
  return Boolean(
    item.commercialStrategy &&
      item.commercialStrategy !== STANDARD_COMMERCIAL_STRATEGY,
  );
}

function hasCustomBroadcastSettings(item: MediaItem): boolean {
  return Boolean(
    hasRealBreakpoints(item) ||
      hasRealBreakDurations(item) ||
      item.fillSlotWithCommercials === false ||
      hasCustomCommercialStrategy(item) ||
      hasCustomSlotLength(item),
  );
}

function shouldAutoStandardizeMediaType(type: MediaType): boolean {
  return includesMediaType(AUTO_STANDARDIZED_BROADCAST_TYPES, type);
}

export function isBroadcastMediaType(type: MediaType): boolean {
  return includesMediaType(PLAYABLE_BROADCAST_TYPES, type);
}

export function isCommercialMediaType(type: MediaType): boolean {
  return includesMediaType(COMMERCIAL_MEDIA_TYPES, type);
}

export function getBroadcastPresetById(
  presetId: BroadcastPresetId,
): BroadcastPreset {
  const preset = BROADCAST_PRESETS.find((item) => item.id === presetId);

  if (!preset) {
    return clonePreset(CARTOON_30_MINUTE_PRESET);
  }

  return clonePreset(preset);
}

export function isBroadcastPresetId(value: string): value is BroadcastPresetId {
  return BROADCAST_PRESETS.some((preset) => preset.id === value);
}

export function getBroadcastPresetOptions(): BroadcastPreset[] {
  return BROADCAST_PRESETS.map(clonePreset);
}

export function createBroadcastPatchFromPreset(
  presetId: BroadcastPresetId,
  durationSeconds?: number,
): Partial<MediaItem> {
  const preset = getBroadcastPresetById(presetId);
  const breakPlan = getCleanPresetBreakPlan(preset, durationSeconds);

  return {
    slotLengthSeconds: preset.slotLengthSeconds,
    breakpoints: breakPlan.breakpoints,
    breakDurations: breakPlan.breakDurations,
    fillSlotWithCommercials: preset.fillSlotWithCommercials,
    commercialStrategy: preset.commercialStrategy,
  };
}

export function isThirtyMinuteShowCandidate(item: MediaItem): boolean {
  if (item.type !== "show") {
    return false;
  }

  const duration = normalizePositiveSecond(item.duration);

  return duration >= 18 * 60 && duration <= 26 * 60;
}

export function isSixtyMinuteBroadcastCandidate(item: MediaItem): boolean {
  if (!shouldAutoStandardizeMediaType(item.type)) {
    return false;
  }

  const duration = normalizePositiveSecond(item.duration);

  return duration >= 38 * 60 && duration <= 52 * 60;
}

export function shouldUseThirtyMinuteBroadcastStandard(
  item: MediaItem,
): boolean {
  if (!isThirtyMinuteShowCandidate(item)) {
    return false;
  }

  const slotLength = normalizePositiveSecond(item.slotLengthSeconds);

  return slotLength <= 0 || slotLength === THIRTY_MINUTE_SLOT_SECONDS;
}

export function shouldUseSixtyMinuteBroadcastStandard(
  item: MediaItem,
): boolean {
  if (!isSixtyMinuteBroadcastCandidate(item)) {
    return false;
  }

  const slotLength = normalizePositiveSecond(item.slotLengthSeconds);

  return slotLength <= 0 || slotLength === SIXTY_MINUTE_SLOT_SECONDS;
}

export function getThirtyMinuteBroadcastPatch(
  durationSeconds?: number,
): Partial<MediaItem> {
  return createBroadcastPatchFromPreset("cartoon-30", durationSeconds);
}

export function getSitcomThirtyMinuteBroadcastPatch(
  durationSeconds?: number,
): Partial<MediaItem> {
  return createBroadcastPatchFromPreset("sitcom-30", durationSeconds);
}

export function getSixtyMinuteBroadcastPatch(
  durationSeconds?: number,
): Partial<MediaItem> {
  return createBroadcastPatchFromPreset("drama-60", durationSeconds);
}

export function standardizeThirtyMinuteBroadcastItem(
  item: MediaItem,
): MediaItem {
  if (!shouldUseThirtyMinuteBroadcastStandard(item)) {
    return item;
  }

  return {
    ...item,
    ...getThirtyMinuteBroadcastPatch(item.duration),
  };
}

export function standardizeSixtyMinuteBroadcastItem(item: MediaItem): MediaItem {
  if (!shouldUseSixtyMinuteBroadcastStandard(item)) {
    return item;
  }

  return {
    ...item,
    ...getSixtyMinuteBroadcastPatch(item.duration),
  };
}

export function standardizeBroadcastItem(item: MediaItem): MediaItem {
  if (!isBroadcastMediaType(item.type)) {
    return item;
  }

  if (!shouldAutoStandardizeMediaType(item.type)) {
    return item;
  }

  if (hasCustomBroadcastSettings(item)) {
    return item;
  }

  if (shouldUseThirtyMinuteBroadcastStandard(item)) {
    return standardizeThirtyMinuteBroadcastItem(item);
  }

  if (shouldUseSixtyMinuteBroadcastStandard(item)) {
    return standardizeSixtyMinuteBroadcastItem(item);
  }

  return item;
}

export function standardizeBroadcastItems(items: MediaItem[]): MediaItem[] {
  return items.map(standardizeBroadcastItem);
}

export function getRecommendedBroadcastPresetId(
  item: Pick<MediaItem, "type" | "duration">,
): BroadcastPresetId | null {
  const duration = normalizePositiveSecond(item.duration);

  if (item.type === "show" && duration >= 18 * 60 && duration <= 26 * 60) {
    return "cartoon-30";
  }

  if (
    shouldAutoStandardizeMediaType(item.type) &&
    duration >= 38 * 60 &&
    duration <= 52 * 60
  ) {
    return "drama-60";
  }

  return null;
}