import type { MediaItem } from "./types";

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

export function buildSchedule(media: MediaItem[]): MediaItem[] {
  if (!media.length) return [];

  const longForm = media.filter(
    (item) => item.type === "show" || item.type === "movie"
  );
  const shortForm = media.filter(
    (item) => item.type === "commercial" || item.type === "bumper"
  );

  if (!longForm.length) return media;

  const schedule: MediaItem[] = [];

  for (const item of shuffle(longForm)) {
    schedule.push(item);

    if (shortForm.length > 0) {
      const ads = shuffle(shortForm).slice(0, Math.min(2, shortForm.length));
      schedule.push(...ads);
    }
  }

  return schedule;
}