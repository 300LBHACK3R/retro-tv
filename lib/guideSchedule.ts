import type { BroadcastItem } from "./types";

function getGuideGroupKey(item: BroadcastItem): string {
  return item.parentMediaId ?? item.id;
}

function getCleanTitle(item: BroadcastItem): string {
  if (!item.isVirtualSegment || !item.segmentLabel) {
    return item.title;
  }

  return item.title.replace(new RegExp(`\\s+${item.segmentLabel}$`), "");
}

function createVisibleGuideItem(item: BroadcastItem, groupKey: string): BroadcastItem {
  return {
    ...item,
    id: `guide:${groupKey}`,
    title: getCleanTitle(item),
    sourceStart: undefined,
    sourceEnd: undefined,
    segmentLabel: undefined,
    isVirtualSegment: false,
    hiddenFromGuide: false,
  };
}

export function buildGuideSchedule(schedule: BroadcastItem[]): BroadcastItem[] {
  const guideItems: BroadcastItem[] = [];

  let activeItem: BroadcastItem | undefined;
  let activeGroupKey = "";

  const flush = () => {
    if (activeItem) {
      guideItems.push(activeItem);
    }

    activeItem = undefined;
    activeGroupKey = "";
  };

  for (const item of schedule) {
    if (item.hiddenFromGuide) {
      if (activeItem) {
        activeItem = {
          ...activeItem,
          duration: activeItem.duration + item.duration,
        };
      }

      continue;
    }

    const groupKey = getGuideGroupKey(item);

    if (!activeItem) {
      activeItem = createVisibleGuideItem(item, groupKey);
      activeGroupKey = groupKey;
      continue;
    }

    if (groupKey === activeGroupKey) {
      activeItem = {
        ...activeItem,
        duration: activeItem.duration + item.duration,
      };
      continue;
    }

    flush();

    activeItem = createVisibleGuideItem(item, groupKey);
    activeGroupKey = groupKey;
  }

  flush();

  return guideItems;
}
