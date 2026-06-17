"use client";

import { useEffect, useMemo } from "react";
import type { BroadcastItem, Channel, MediaItem } from "@/lib/types";

type MediaPreloaderProps = {
  activeSchedule: BroadcastItem[];
  activeChannel?: Channel;
};

type UrlLike = {
  file?: string;
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

type IdleCallbackOptions = {
  timeout?: number;
};

type IdleCallbackWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: IdleCallbackOptions,
  ) => IdleCallbackHandle;
  cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
};

const MAX_DESKTOP_PRELOADS = 4;
const MAX_MOBILE_PRELOADS = 2;
const IDLE_TIMEOUT_MS = 2_000;
const FALLBACK_DELAY_MS = 250;
const PRELOAD_DATA_ATTRIBUTE = "ttv-preload";
const PRELOAD_SELECTOR = `link[data-${PRELOAD_DATA_ATTRIBUTE}="true"]`;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function isUsableUrl(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getUrlFromUnknown(value: unknown): string | undefined {
  const item = value as UrlLike | undefined;

  if (!item) {
    return undefined;
  }

  return (
    item.file ??
    item.url ??
    item.sourceUrl ??
    item.mediaUrl ??
    item.fileUrl ??
    item.src ??
    item.media?.file ??
    item.media?.url ??
    item.media?.sourceUrl ??
    item.mediaItem?.file ??
    item.mediaItem?.url ??
    item.mediaItem?.sourceUrl ??
    item.item?.file ??
    item.item?.url ??
    item.item?.sourceUrl
  );
}

function getChannelMediaItems(channel?: Channel): MediaItem[] {
  if (!channel) {
    return [];
  }

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
  if (!isBrowser()) {
    return false;
  }

  return (
    window.matchMedia("(max-width: 768px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function getPreloadLimit(): number {
  return isLikelyMobile() ? MAX_MOBILE_PRELOADS : MAX_DESKTOP_PRELOADS;
}

function toAbsoluteUrl(url: string): string | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    return new URL(url, window.location.href).href;
  } catch {
    return null;
  }
}

function getOrigin(url: string): string | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    return new URL(url, window.location.href).origin;
  } catch {
    return null;
  }
}

function getExistingManagedLinks(): HTMLLinkElement[] {
  if (!isBrowser()) {
    return [];
  }

  return Array.from(document.querySelectorAll<HTMLLinkElement>(PRELOAD_SELECTOR));
}

function cleanupManagedLinks(validHrefs: Set<string>): void {
  for (const link of getExistingManagedLinks()) {
    if (!validHrefs.has(link.href)) {
      link.remove();
    }
  }
}

function linkAlreadyExists(rel: string, href: string): boolean {
  if (!isBrowser()) {
    return true;
  }

  return Array.from(document.querySelectorAll<HTMLLinkElement>("link")).some(
    (link) => link.rel === rel && link.href === href,
  );
}

function appendLink(rel: string, href: string, as?: string): void {
  if (!isBrowser() || linkAlreadyExists(rel, href)) {
    return;
  }

  const link = document.createElement("link");

  link.rel = rel;
  link.href = href;
  link.setAttribute(`data-${PRELOAD_DATA_ATTRIBUTE}`, "true");

  if (as) {
    link.as = as;
  }

  document.head.appendChild(link);
}

function addPerformanceLinks(urls: string[]): void {
  if (!isBrowser()) {
    return;
  }

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

  const validHrefs = new Set<string>();

  for (const url of absoluteUrls) {
    validHrefs.add(url);
  }

  for (const origin of origins) {
    validHrefs.add(`${origin}/`);
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
  if (!isBrowser()) {
    return () => {};
  }

  const idleWindow = window as IdleCallbackWindow;

  if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
    const handle = idleWindow.requestIdleCallback(callback, {
      timeout: IDLE_TIMEOUT_MS,
    });

    return () => {
      idleWindow.cancelIdleCallback?.(handle);
    };
  }

  const timeout = window.setTimeout(callback, FALLBACK_DELAY_MS);

  return () => {
    window.clearTimeout(timeout);
  };
}

function createPreloadUrlList(
  activeSchedule: BroadcastItem[],
  activeChannel?: Channel,
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const addUrl = (value: unknown) => {
    const url = getUrlFromUnknown(value);

    if (!isUsableUrl(url)) {
      return;
    }

    const trimmedUrl = url.trim();

    if (seen.has(trimmedUrl)) {
      return;
    }

    seen.add(trimmedUrl);
    urls.push(trimmedUrl);
  };

  for (const item of activeSchedule) {
    addUrl(item);

    if (urls.length >= MAX_DESKTOP_PRELOADS) {
      break;
    }
  }

  if (urls.length < MAX_DESKTOP_PRELOADS) {
    for (const mediaItem of getChannelMediaItems(activeChannel)) {
      addUrl(mediaItem);

      if (urls.length >= MAX_DESKTOP_PRELOADS) {
        break;
      }
    }
  }

  return urls;
}

export function MediaPreloader({
  activeSchedule,
  activeChannel,
}: MediaPreloaderProps) {
  const preloadUrls = useMemo(
    () => createPreloadUrlList(activeSchedule, activeChannel),
    [activeSchedule, activeChannel],
  );

  useEffect(() => {
    if (!isBrowser()) {
      return;
    }

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