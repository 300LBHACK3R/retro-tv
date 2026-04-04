import type { MediaItem } from "./types";

export function getLiveState(schedule: MediaItem[]) {
  if (!schedule.length) {
    return {
      item: null,
      progress: 0,
      elapsed: 0,
      index: -1,
      totalDuration: 0,
      offsetInLoop: 0,
    };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const totalDuration = schedule.reduce(
    (sum, item) => sum + Math.max(item.duration, 1),
    0
  );

  if (totalDuration <= 0) {
    return {
      item: schedule[0],
      progress: 0,
      elapsed: 0,
      index: 0,
      totalDuration: 0,
      offsetInLoop: 0,
    };
  }

  const offsetInLoop = nowSeconds % totalDuration;

  let accumulated = 0;

  for (let index = 0; index < schedule.length; index += 1) {
    const item = schedule[index];
    const safeDuration = Math.max(item.duration, 1);
    const end = accumulated + safeDuration;

    if (offsetInLoop >= accumulated && offsetInLoop < end) {
      return {
        item,
        progress: (offsetInLoop - accumulated) / safeDuration,
        elapsed: offsetInLoop - accumulated,
        index,
        totalDuration,
        offsetInLoop,
      };
    }

    accumulated = end;
  }

  return {
    item: schedule[0],
    progress: 0,
    elapsed: 0,
    index: 0,
    totalDuration,
    offsetInLoop: 0,
  };
}