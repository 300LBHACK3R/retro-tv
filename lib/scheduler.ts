import type { MediaItem } from "./types";

const DEFAULT_COMMERCIAL_INSERTS_AFTER_SHOW = 0;

export type ScheduleMode = "playlist" | "shuffle";

export type ScheduleOptions = {
  /**
   * playlist = respect channel.mediaIds order exactly.
   * shuffle = deterministic seeded shuffle.
   */
  mode?: ScheduleMode;

  /**
   * Used only in shuffle mode.
   */
  seed?: string;

  /**
   * Number of short-form items inserted after each show.
   * Keep this 0 if you want exact show-after-show control.
   */
  commercialInsertsAfterShow?: number;

  /**
   * If true, short-form items can be inserted after movies too.
   */
  includeBumpersAfterMovies?: boolean;
};

export type ProgramBlock = {
  mediaId: string;
  startsAt: number;
  endsAt: number;
  duration: number;
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

function normalizeScheduleOptions(
  options?: ScheduleOptions,
): Required<ScheduleOptions> {
  return {
    mode: options?.mode ?? "playlist",
    seed: options?.seed ?? "retro-tv-default-schedule",
    commercialInsertsAfterShow:
      options?.commercialInsertsAfterShow ?? DEFAULT_COMMERCIAL_INSERTS_AFTER_SHOW,
    includeBumpersAfterMovies: options?.includeBumpersAfterMovies ?? false,
  };
}

function rotateShortForm(shortForm: MediaItem[], cursor: number): MediaItem | null {
  if (shortForm.length === 0) {
    return null;
  }

  return shortForm[cursor % shortForm.length] ?? null;
}

/**
 * Builds the channel playback schedule.
 *
 * Important:
 * In playlist mode, this respects the exact channel programming order.
 * This is what makes "Slot 1 before Slot 2 before Slot 3" work properly.
 */
export function buildSchedule(
  media: MediaItem[],
  options?: ScheduleOptions,
): MediaItem[] {
  const safeMedia = media.filter(
    (item) => item.file.trim().length > 0 && hasPlayableDuration(item),
  );

  if (safeMedia.length === 0) {
    return [];
  }

  const normalizedOptions = normalizeScheduleOptions(options);

  if (normalizedOptions.mode === "shuffle") {
    return buildShuffledSchedule(safeMedia, normalizedOptions);
  }

  return buildPlaylistSchedule(safeMedia, normalizedOptions);
}

function buildPlaylistSchedule(
  media: MediaItem[],
  options: Required<ScheduleOptions>,
): MediaItem[] {
  if (options.commercialInsertsAfterShow <= 0) {
    return media;
  }

  const shortForm = media.filter(isShortForm);

  if (shortForm.length === 0) {
    return media;
  }

  const schedule: MediaItem[] = [];
  let shortFormCursor = 0;

  for (const item of media) {
    schedule.push(item);

    const shouldInsertShortForm =
      item.type === "show" || (item.type === "movie" && options.includeBumpersAfterMovies);

    if (!shouldInsertShortForm) {
      continue;
    }

    for (
      let insertIndex = 0;
      insertIndex < options.commercialInsertsAfterShow;
      insertIndex += 1
    ) {
      const shortItem = rotateShortForm(shortForm, shortFormCursor);

      if (shortItem) {
        schedule.push(shortItem);
        shortFormCursor += 1;
      }
    }
  }

  return schedule;
}

function buildShuffledSchedule(
  media: MediaItem[],
  options: Required<ScheduleOptions>,
): MediaItem[] {
  const longForm = media.filter(isLongForm);
  const shortForm = media.filter(isShortForm);

  if (longForm.length === 0) {
    return seededShuffle(media, `${options.seed}:fallback`);
  }

  const shuffledLongForm = seededShuffle(longForm, `${options.seed}:long-form`);
  const shuffledShortForm = seededShuffle(shortForm, `${options.seed}:short-form`);

  const schedule: MediaItem[] = [];
  let shortFormCursor = 0;

  for (const item of shuffledLongForm) {
    schedule.push(item);

    const shouldInsertShortForm =
      shortForm.length > 0 &&
      (item.type === "show" || options.includeBumpersAfterMovies);

    if (!shouldInsertShortForm || options.commercialInsertsAfterShow <= 0) {
      continue;
    }

    const insertCount = Math.min(
      options.commercialInsertsAfterShow,
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