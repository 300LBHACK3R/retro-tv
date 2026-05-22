import type { MediaItem, ProgramBlock } from "./types";

const DEFAULT_COMMERCIAL_INSERTS_AFTER_SHOW = 2;

type ScheduleOptions = {
  seed?: string;
  commercialInsertsAfterShow?: number;
  includeBumpersAfterMovies?: boolean;
};

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: string): () => number {
  let state = hashString(seed) || 1;

  return () => {
    state += 0x6d2b79f5;

    let result = state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);

    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const arr = [...items];
  const random = createSeededRandom(seed);

  for (let index = arr.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [arr[index], arr[swapIndex]] = [arr[swapIndex], arr[index]];
  }

  return arr;
}

function isLongForm(item: MediaItem): boolean {
  return item.type === "show" || item.type === "movie";
}

function isShortForm(item: MediaItem): boolean {
  return item.type === "commercial" || item.type === "bumper";
}

function hasPlayableDuration(item: MediaItem): boolean {
  return Number.isFinite(item.duration) && item.duration > 0;
}

function normalizeScheduleOptions(options?: ScheduleOptions): Required<ScheduleOptions> {
  return {
    seed: options?.seed ?? "retro-tv-default-schedule",
    commercialInsertsAfterShow:
      options?.commercialInsertsAfterShow ?? DEFAULT_COMMERCIAL_INSERTS_AFTER_SHOW,
    includeBumpersAfterMovies: options?.includeBumpersAfterMovies ?? false,
  };
}

export function buildSchedule(
  media: MediaItem[],
  options?: ScheduleOptions,
): MediaItem[] {
  const safeMedia = media.filter(hasPlayableDuration);

  if (safeMedia.length === 0) {
    return [];
  }

  const normalizedOptions = normalizeScheduleOptions(options);

  const longForm = safeMedia.filter(isLongForm);
  const shortForm = safeMedia.filter(isShortForm);

  if (longForm.length === 0) {
    return seededShuffle(safeMedia, `${normalizedOptions.seed}:fallback`);
  }

  const shuffledLongForm = seededShuffle(
    longForm,
    `${normalizedOptions.seed}:long-form`,
  );

  const shuffledShortForm = seededShuffle(
    shortForm,
    `${normalizedOptions.seed}:short-form`,
  );

  const schedule: MediaItem[] = [];
  let shortFormCursor = 0;

  for (const item of shuffledLongForm) {
    schedule.push(item);

    const shouldInsertShortForm =
      shortForm.length > 0 &&
      (item.type === "show" || normalizedOptions.includeBumpersAfterMovies);

    if (!shouldInsertShortForm) {
      continue;
    }

    const insertCount = Math.min(
      normalizedOptions.commercialInsertsAfterShow,
      shortForm.length,
    );

    for (let insertIndex = 0; insertIndex < insertCount; insertIndex += 1) {
      const shortItem = shuffledShortForm[shortFormCursor % shortForm.length];

      if (shortItem) {
        schedule.push(shortItem);
        shortFormCursor += 1;
      }
    }
  }

  return schedule;
}

export function getScheduleDuration(schedule: MediaItem[]): number {
  return schedule.reduce((total, item) => {
    if (!hasPlayableDuration(item)) {
      return total;
    }

    return total + item.duration;
  }, 0);
}

export function buildProgramBlocks(schedule: MediaItem[]): ProgramBlock[] {
  let cursor = 0;

  return schedule.filter(hasPlayableDuration).map((item) => {
    const startsAt = cursor;
    const endsAt = startsAt + item.duration;

    cursor = endsAt;

    return {
      mediaId: item.id,
      startsAt,
      endsAt,
      duration: item.duration,
    };
  });
}