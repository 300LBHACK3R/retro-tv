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

const MAX_PRELOADS = 4;
const MAX_MOBILE_PRELOADS = 2;

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
  return isLikelyMobile() ? MAX_MOBILE_PRELOADS : MAX_PRELOADS;
}

function toAbsoluteUrl(url: string): string | null {
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return null;
  }
}

function getExistingPreloadLinks(): HTMLLinkElement[] {
  return Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[data-ttv-preload="true"]'),
  );
}

function cleanupPreloadLinks(validUrls: Set<string>) {
  for (const link of getExistingPreloadLinks()) {
    if (!validUrls.has(link.href)) {
      link.remove();
    }
  }
}

function addMissingPreloadLinks(urls: string[]) {
  const existingUrls = new Set(getExistingPreloadLinks().map((link) => link.href));

  for (const url of urls) {
    const absoluteUrl = toAbsoluteUrl(url);

    if (!absoluteUrl || existingUrls.has(absoluteUrl)) continue;

    const link = document.createElement("link");

    link.rel = "preload";
    link.as = "video";
    link.href = absoluteUrl;
    link.dataset.ttvPreload = "true";

    document.head.appendChild(link);
    existingUrls.add(absoluteUrl);
  }
}

export function MediaPreloader({ activeSchedule, activeChannel }: MediaPreloaderProps) {
  const preloadUrls = useMemo(() => {
    const urls: string[] = [];

    for (const item of activeSchedule) {
      const url = getUrlFromUnknown(item);

      if (isUsableUrl(url)) {
        urls.push(url);
      }

      if (urls.length >= MAX_PRELOADS) break;
    }

    for (const mediaItem of getChannelMediaItems(activeChannel)) {
      const url = getUrlFromUnknown(mediaItem);

      if (isUsableUrl(url)) {
        urls.push(url);
      }

      if (urls.length >= MAX_PRELOADS) break;
    }

    return Array.from(new Set(urls));
  }, [activeSchedule, activeChannel]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const limitedUrls = preloadUrls.slice(0, getPreloadLimit());
    const validAbsoluteUrls = new Set(
      limitedUrls
        .map((url) => toAbsoluteUrl(url))
        .filter((url): url is string => Boolean(url)),
    );

    cleanupPreloadLinks(validAbsoluteUrls);
    addMissingPreloadLinks(limitedUrls);

    return () => {
      cleanupPreloadLinks(new Set());
    };
  }, [preloadUrls]);

  return null;
}

export default MediaPreloader;
