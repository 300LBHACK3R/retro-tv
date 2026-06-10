"use client";

import { useEffect, useMemo } from "react";
import type { BroadcastItem, Channel, MediaItem } from "@/lib/types";

type MediaPreloaderProps = {
  activeSchedule: BroadcastItem[];
  activeChannel?: Channel;
};

type UrlLike = {
  url?: string;
  sourceUrl?: string;
  mediaUrl?: string;
  fileUrl?: string;
  src?: string;
  media?: UrlLike;
  mediaItem?: UrlLike;
  item?: UrlLike;
};

type ChannelLike = {
  media?: MediaItem[];
  mediaItems?: MediaItem[];
  library?: MediaItem[];
  items?: MediaItem[];
};

type IdleCallbackHandle = number;

const MAX_DESKTOP_PRELOADS = 4;
const MAX_MOBILE_PRELOADS = 2;
const PRELOAD_DATA_ATTRIBUTE = "ttvPreload";

function isUsableUrl(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getUrlFromUnknown(value: unknown): string | undefined {
  const item = value as UrlLike | undefined;

  if (!item) return undefined;

  return (
    item.url ??
    item.sourceUrl ??
    item.mediaUrl ??
    item.fileUrl ??
    item.src ??
    item.media?.url ??
    item.media?.sourceUrl ??
    item.mediaItem?.url ??
    item.mediaItem?.sourceUrl ??
    item.item?.url ??
    item.item?.sourceUrl
  );
}

function getChannelMediaItems(channel?: Channel): MediaItem[] {
  if (!channel) return [];

  const channelLike = channel as unknown as ChannelLike;

  return (
    channelLike.media ??
    channelLike.mediaItems ??
    channelLike.library ??
    channelLike.items ??
    []
  );
}

function isLikelyMobile(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(max-width: 768px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function getPreloadLimit(): number {
  return isLikelyMobile() ? MAX_MOBILE_PRELOADS : MAX_DESKTOP_PRELOADS;
}

function toAbsoluteUrl(url: string): string | null {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return null;
  }
}

function getOrigin(url: string): string | null {
  try {
    return new URL(url, window.location.href).origin;
  } catch {
    return null;
  }
}

function getExistingManagedLinks(): HTMLLinkElement[] {
  return Array.from(
    document.querySelectorAll<HTMLLinkElement>(
      `link[data-${PRELOAD_DATA_ATTRIBUTE}="true"]`,
    ),
  );
}

function cleanupManagedLinks(validHrefs: Set<string>) {
  for (const link of getExistingManagedLinks()) {
    if (!validHrefs.has(link.href)) {
      link.remove();
    }
  }
}

function appendLink(rel: string, href: string, as?: string) {
  const existing = Array.from(document.querySelectorAll<HTMLLinkElement>("link")).some(
    (link) => link.rel === rel && link.href === href,
  );

  if (existing) return;

  const link = document.createElement("link");

  link.rel = rel;
  link.href = href;
  link.dataset[PRELOAD_DATA_ATTRIBUTE] = "true";

  if (as) {
    link.as = as;
  }

  document.head.appendChild(link);
}

function addPerformanceLinks(urls: string[]) {
  const absoluteUrls = urls
    .map((url) => toAbsoluteUrl(url))
    .filter((url): url is string => Boolean(url));

  const origins = Array.from(
    new Set(
      absoluteUrls
        .map((url) => getOrigin(url))
        .filter((origin): origin is string => Boolean(origin)),
    ),
  );

  const validHrefs = new Set<string>(absoluteUrls);

  for (const origin of origins) {
    validHrefs.add(origin + "/");
  }

  cleanupManagedLinks(validHrefs);

  for (const origin of origins) {
    appendLink("preconnect", origin);
    appendLink("dns-prefetch", origin);
  }

  for (const url of absoluteUrls) {
    appendLink("preload", url, "video");
  }
}

function scheduleIdleWork(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const requestIdleCallback = window.requestIdleCallback;
  const cancelIdleCallback = window.cancelIdleCallback;

  if (requestIdleCallback && cancelIdleCallback) {
    const handle = requestIdleCallback(callback, { timeout: 2000 }) as IdleCallbackHandle;

    return () => {
      cancelIdleCallback(handle);
    };
  }

  const timeout = window.setTimeout(callback, 250);

  return () => {
    window.clearTimeout(timeout);
  };
}

export function MediaPreloader({ activeSchedule, activeChannel }: MediaPreloaderProps) {
  const preloadUrls = useMemo(() => {
    const urls: string[] = [];

    for (const item of activeSchedule) {
      const url = getUrlFromUnknown(item);

      if (isUsableUrl(url)) {
        urls.push(url);
      }

      if (urls.length >= MAX_DESKTOP_PRELOADS) break;
    }

    for (const mediaItem of getChannelMediaItems(activeChannel)) {
      const url = getUrlFromUnknown(mediaItem);

      if (isUsableUrl(url)) {
        urls.push(url);
      }

      if (urls.length >= MAX_DESKTOP_PRELOADS) break;
    }

    return Array.from(new Set(urls));
  }, [activeSchedule, activeChannel]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const limitedUrls = preloadUrls.slice(0, getPreloadLimit());

    if (limitedUrls.length === 0) {
      cleanupManagedLinks(new Set());
      return;
    }

    return scheduleIdleWork(() => {
      addPerformanceLinks(limitedUrls);
    });
  }, [preloadUrls]);

  return null;
}

export default MediaPreloader;
