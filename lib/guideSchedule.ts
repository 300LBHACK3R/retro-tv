import type { BroadcastItem } from "./types";

function isCommercialType(item: BroadcastItem): boolean {
  return item.type === "commercial" || item.type === "bumper";
}

export function isHiddenGuideItem(item: BroadcastItem | undefined): boolean {
  if (!item) {
    return true;
  }

  return Boolean(item.hiddenFromGuide) || isCommercialType(item);
}
