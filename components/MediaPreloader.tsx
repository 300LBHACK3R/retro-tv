"use client";

import { useEffect, useMemo } from "react";
import { buildSchedule } from "@/lib/scheduler";
import { useStore } from "@/lib/store";
import type { BroadcastItem, Channel, MediaItem } from "@/lib/types";

const MAX_METADATA_WARM_ITEMS = 4;
const MAX_ORIGIN_HINTS = 6;
const ACTIVE_SCHEDULE_LOOKAHEAD = 4;
const NEARBY_CHANNEL_RADIUS = 2;
const NEARBY_CHANNEL_LOOKAHEAD = 2;
const IDLE_TIMEOUT_MS = 1200;

interface MediaPreloaderProps {
  activeSchedule: BroadcastItem[];
  activeChannel: Channel | undefined;
}
function getMediaForChannel(
  channel: Channel | undefined,
  media: MediaItem[],
): MediaItem[] {
  if (!channel) {
    return [];
  }

  const mediaById = new Map(media.map((item) => [item.id, item]));

  return channel.mediaIds
    .map((mediaId) => mediaById.get(mediaId))
    .filter((item): item is MediaItem => Boolean(item));
}

function sortChannelsByNumber(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) => {
    const aNumber = Number(a.number ?? a.id);
    const bNumber = Number(b.number ?? b.id);

    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
      return aNumber - bNumber;
    }

    return a.id.localeCompare(b.id);
  });
}

function isPlayableUrl(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  return value.startsWith("https://") || value.startsWith("/");
}

function isRemoteUrl(value: string): boolean {
  return value.startsWith("https://");
}

function getOrigin(value: string): string | null {
  if (!isRemoteUrl(value)) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getUniquePlayableUrls(items: BroadcastItem[]): string[] {
  return uniqueValues(
    items
      .map((item) => item.file)
      .filter(isPlayableUrl),
  );
}

function getNearbyChannels(
  channels: Channel[],
  activeChannel: Channel | undefined,
): Channel[] {
  const enabledChannels = sortChannelsByNumber(
    channels.filter((channel) => channel.isEnabled !== false),
  );

  const activeIndex = activeChannel
    ? enabledChannels.findIndex((channel) => channel.id === activeChannel.id)
    : -1;

  if (activeIndex < 0) {
    return enabledChannels.slice(0, NEARBY_CHANNEL_RADIUS * 2 + 1);
  }

  const start = Math.max(0, activeIndex - NEARBY_CHANNEL_RADIUS);
  const end = Math.min(enabledChannels.length, activeIndex + NEARBY_CHANNEL_RADIUS + 1);

  return enabledChannels.slice(start, end);
}

function createOriginHintLink(
  origin: string,
  rel: "preconnect" | "dns-prefetch",
): HTMLLinkElement {
  const link = document.createElement("link");

  link.rel = rel;
  link.href = origin;

  if (rel === "preconnect") {
    link.crossOrigin = "anonymous";
  }

  link.dataset.ttvPreloader = "true";

  return link;
}

function warmVideoMetadata(url: string): HTMLVideoElement {
  const video = document.createElement("video");

  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.src = url;

  /**
   * Do not append this video to the DOM and do not call play().
   * This only asks the browser to fetch enough metadata to speed up readiness.
   */
  video.load();

  return video;
}

function cleanupWarmVideo(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute("src");
  video.load();
}

function scheduleIdleTask(task: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (window.requestIdleCallback && window.cancelIdleCallback) {
    const handle = window.requestIdleCallback(
      () => {
        task();
      },
      { timeout: IDLE_TIMEOUT_MS },
    );

    return () => {
      window.cancelIdleCallback?.(handle);
    };
  }

  const timeout = window.setTimeout(task, 250);

  return () => {
    window.clearTimeout(timeout);
  };
}

export default function MediaPreloader({
  activeSchedule,
  activeChannel,
}: MediaPreloaderProps) {
  const channels = useStore((state) => state.channels);
  const media = useStore((state) => state.media);
  const preferReducedMotion = useStore(
    (state) => state.viewerSettings.preferReducedMotion,
  );

  const preloadUrls = useMemo(() => {
    const nearbyChannels = getNearbyChannels(channels, activeChannel);

    const nearbyFirstItems = nearbyChannels.flatMap((channel) => {
      const channelMedia = getMediaForChannel(channel, media);
      const schedule = buildSchedule(channelMedia, { channel });

      return schedule.slice(0, NEARBY_CHANNEL_LOOKAHEAD);
    });

    return getUniquePlayableUrls([
      ...activeSchedule.slice(0, ACTIVE_SCHEDULE_LOOKAHEAD),
      ...nearbyFirstItems,
    ]);
  }, [activeChannel, activeSchedule, channels, media]);

  const originHints = useMemo(() => {
    return uniqueValues(
      preloadUrls
        .map(getOrigin)
        .filter((origin): origin is string => Boolean(origin)),
    ).slice(0, MAX_ORIGIN_HINTS);
  }, [preloadUrls]);

  const metadataWarmUrls = useMemo(() => {
    /**
     * Keep this intentionally small. Big MP4s should not all be aggressively
     * fetched, or the active player can stall during channel switching.
     */
    return preloadUrls.slice(0, preferReducedMotion ? 2 : MAX_METADATA_WARM_ITEMS);
  }, [preferReducedMotion, preloadUrls]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const links = originHints.flatMap((origin) => [
      createOriginHintLink(origin, "dns-prefetch"),
      createOriginHintLink(origin, "preconnect"),
    ]);

    links.forEach((link) => {
      document.head.appendChild(link);
    });

    return () => {
      links.forEach((link) => {
        link.remove();
      });
    };
  }, [originHints]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const warmVideos: HTMLVideoElement[] = [];

    const cancelIdleTask = scheduleIdleTask(() => {
      metadataWarmUrls.forEach((url) => {
        warmVideos.push(warmVideoMetadata(url));
      });
    });

    return () => {
      cancelIdleTask();

      warmVideos.forEach((video) => {
        cleanupWarmVideo(video);
      });
    };
  }, [metadataWarmUrls]);

  return null;
}
