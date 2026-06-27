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

type ResourceHint = {
  rel: "preconnect" | "dns-prefetch";
  href: string;
  crossOrigin?: "anonymous";
};

const MAX_DESKTOP_URLS = 6;
const MAX_MOBILE_URLS = 3;
const MAX_DESKTOP_ORIGINS = 4;
const MAX_MOBILE_ORIGINS = 2;

const IDLE_TIMEOUT_MS = 2_000;
const FALLBACK_DELAY_MS = 250;

const MANAGED_ATTRIBUTE = "data-ttv-preload";
const MANAGED_KEY_ATTRIBUTE = "data-ttv-preload-key";
const MANAGED_SELECTOR = `link[${MANAGED_ATTRIBUTE}="true"]`;

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

function getUrlLimit(): number {
  return isLikelyMobile() ? MAX_MOBILE_URLS : MAX_DESKTOP_URLS;
}

function getOriginLimit(): number {
  return isLikelyMobile() ? MAX_MOBILE_ORIGINS : MAX_DESKTOP_ORIGINS;
}

function normalizeAbsoluteUrl(url: string): string | null {
  if (!isBrowser()) {
    return null;
  }

  const clean = url.trim();

  if (!clean || clean.startsWith("data:") || clean.startsWith("blob:")) {
    return null;
  }

  try {
    const parsed = new URL(clean, window.location.href);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

function getOriginHref(url: string): string | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const parsed = new URL(url, window.location.href);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return `${parsed.origin}/`;
  } catch {
    return null;
  }
}

function getManagedLinks(): HTMLLinkElement[] {
  if (!isBrowser()) {
    return [];
  }

  return Array.from(document.querySelectorAll<HTMLLinkElement>(MANAGED_SELECTOR));
}

function createHintKey(hint: ResourceHint): string {
  return `${hint.rel}:${hint.href}`;
}

function cleanupManagedLinks(validKeys: Set<string>): void {
  for (const link of getManagedLinks()) {
    const key = link.getAttribute(MANAGED_KEY_ATTRIBUTE);

    if (!key || !validKeys.has(key)) {
      link.remove();
    }
  }
}

function managedLinkExists(key: string): boolean {
  if (!isBrowser()) {
    return true;
  }

  return getManagedLinks().some(
    (link) => link.getAttribute(MANAGED_KEY_ATTRIBUTE) === key,
  );
}

function appendResourceHint(hint: ResourceHint): void {
  if (!isBrowser()) {
    return;
  }

  const key = createHintKey(hint);

  if (managedLinkExists(key)) {
    return;
  }

  const link = document.createElement("link");

  link.rel = hint.rel;
  link.href = hint.href;
  link.setAttribute(MANAGED_ATTRIBUTE, "true");
  link.setAttribute(MANAGED_KEY_ATTRIBUTE, key);

  if (hint.crossOrigin) {
    link.crossOrigin = hint.crossOrigin;
  }

  document.head.appendChild(link);
}

function createResourceHints(urls: string[]): ResourceHint[] {
  if (!isBrowser()) {
    return [];
  }

  const absoluteUrls = urls
    .map((url) => normalizeAbsoluteUrl(url))
    .filter((url): url is string => Boolean(url));

  const origins = Array.from(
    new Set(
      absoluteUrls
        .map((url) => getOriginHref(url))
        .filter((origin): origin is string => Boolean(origin)),
    ),
  ).slice(0, getOriginLimit());

  const currentOrigin = `${window.location.origin}/`;

  return origins.flatMap((origin) => {
    const isCrossOrigin = origin !== currentOrigin;

    return [
      {
        rel: "preconnect",
        href: origin,
        crossOrigin: isCrossOrigin ? "anonymous" : undefined,
      },
      {
        rel: "dns-prefetch",
        href: origin,
      },
    ] satisfies ResourceHint[];
  });
}

function applyResourceHints(urls: string[]): void {
  if (!isBrowser()) {
    return;
  }

  const hints = createResourceHints(urls);
  const validKeys = new Set(hints.map(createHintKey));

  cleanupManagedLinks(validKeys);

  for (const hint of hints) {
    appendResourceHint(hint);
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
  const maxUrls = getUrlLimit();

  const addUrl = (value: unknown) => {
    if (urls.length >= maxUrls) {
      return;
    }

    const url = getUrlFromUnknown(value);

    if (!isUsableUrl(url)) {
      return;
    }

    const absoluteUrl = normalizeAbsoluteUrl(url);

    if (!absoluteUrl || seen.has(absoluteUrl)) {
      return;
    }

    seen.add(absoluteUrl);
    urls.push(absoluteUrl);
  };

  for (const item of activeSchedule) {
    addUrl(item);

    if (urls.length >= maxUrls) {
      break;
    }
  }

  if (urls.length < maxUrls) {
    for (const mediaItem of getChannelMediaItems(activeChannel)) {
      addUrl(mediaItem);

      if (urls.length >= maxUrls) {
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

    if (preloadUrls.length === 0) {
      cleanupManagedLinks(new Set());
      return;
    }

    return scheduleIdleWork(() => {
      applyResourceHints(preloadUrls);
    });
  }, [preloadUrls]);

  useEffect(() => {
    return () => {
      cleanupManagedLinks(new Set());
    };
  }, []);

  return null;
}

export default MediaPreloader;