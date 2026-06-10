"use client";

import { useEffect, useMemo } from "react";
import { useTvStore } from "@/lib/store";

const MAX_DESKTOP_PRELOADS = 5;
const MAX_MOBILE_PRELOADS = 3;

function isVideoUrl(url: string | undefined): url is string {
  return Boolean(url && typeof url === "string" && url.trim().length > 0);
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

function createPreloadLink(url: string): HTMLLinkElement {
  const link = document.createElement("link");

  link.rel = "preload";
  link.as = "video";
  link.href = url;
  link.dataset.ttvPreload = "true";

  return link;
}

function cleanupPreloadLinks(validUrls: Set<string>) {
  const existingLinks = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[data-ttv-preload="true"]'),
  );

  for (const link of existingLinks) {
    if (!validUrls.has(link.href)) {
      link.remove();
    }
  }
}

function addMissingPreloadLinks(urls: string[]) {
  const existingUrls = new Set(
    Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[data-ttv-preload="true"]'),
    ).map((link) => link.href),
  );

  for (const url of urls) {
    const absoluteUrl = new URL(url, window.location.href).href;

    if (existingUrls.has(absoluteUrl)) continue;

    document.head.appendChild(createPreloadLink(absoluteUrl));
    existingUrls.add(absoluteUrl);
  }
}

export function MediaPreloader() {
  const channels = useTvStore((state) => state.channels);
  const selectedChannelId = useTvStore((state) => state.selectedChannelId);
  const channelSchedules = useTvStore((state) => state.channelSchedules);

  const preloadUrls = useMemo(() => {
    const activeChannel = channels.find((channel) => channel.id === selectedChannelId);
    const activeSchedule = selectedChannelId
      ? channelSchedules[selectedChannelId] ?? []
      : [];

    const urls: string[] = [];

    for (const item of activeSchedule) {
      if (isVideoUrl(item.media.url)) {
        urls.push(item.media.url);
      }

      if (urls.length >= MAX_DESKTOP_PRELOADS) break;
    }

    if (activeChannel) {
      for (const media of activeChannel.library) {
        if (isVideoUrl(media.url)) {
          urls.push(media.url);
        }

        if (urls.length >= MAX_DESKTOP_PRELOADS) break;
      }
    }

    return Array.from(new Set(urls));
  }, [channelSchedules, channels, selectedChannelId]);

  useEffect(() => {
    if (typeof document === "undefined" || preloadUrls.length === 0) return;

    const limit = getPreloadLimit();
    const limitedUrls = preloadUrls.slice(0, limit);
    const validAbsoluteUrls = new Set(
      limitedUrls.map((url) => new URL(url, window.location.href).href),
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
