"use client";

import { useEffect, useMemo } from "react";
import { buildSchedule } from "@/lib/scheduler";
import { useStore } from "@/lib/store";
import type { BroadcastItem, Channel, MediaItem } from "@/lib/types";

const MAX_PRELOAD_ITEMS = 8;

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

function getUniquePlayableUrls(items: BroadcastItem[]): string[] {
  const urls = items
    .map((item) => item.file)
    .filter((file): file is string => typeof file === "string" && file.length > 0);

  return Array.from(new Set(urls)).slice(0, MAX_PRELOAD_ITEMS);
}

function createPreloadLink(url: string): HTMLLinkElement {
  const link = document.createElement("link");

  link.rel = "preload";
  link.as = "video";
  link.href = url;
  link.crossOrigin = "anonymous";

  return link;
}

function warmVideoMetadata(url: string): HTMLVideoElement {
  const video = document.createElement("video");

  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.src = url;
  video.load();

  return video;
}

export default function MediaPreloader({
  activeSchedule,
  activeChannel,
}: MediaPreloaderProps) {
  const channels = useStore((state) => state.channels);
  const media = useStore((state) => state.media);

  const preloadUrls = useMemo(() => {
    const enabledChannels = sortChannelsByNumber(
      channels.filter((channel) => channel.isEnabled !== false),
    );

    const activeIndex = activeChannel
      ? enabledChannels.findIndex((channel) => channel.id === activeChannel.id)
      : -1;

    const nearbyChannels =
      activeIndex >= 0
        ? [
            enabledChannels[activeIndex - 2],
            enabledChannels[activeIndex - 1],
            enabledChannels[activeIndex],
            enabledChannels[activeIndex + 1],
            enabledChannels[activeIndex + 2],
          ].filter((channel): channel is Channel => Boolean(channel))
        : enabledChannels.slice(0, 5);

    const nearbyFirstItems = nearbyChannels.flatMap((channel) => {
      const channelMedia = getMediaForChannel(channel, media);
      const schedule = buildSchedule(channelMedia, { channel });

      return schedule.slice(0, 2);
    });

    return getUniquePlayableUrls([
      ...activeSchedule.slice(0, 4),
      ...nearbyFirstItems,
    ]);
  }, [activeChannel, activeSchedule, channels, media]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const links = preloadUrls.map(createPreloadLink);
    const warmVideos = preloadUrls.map(warmVideoMetadata);

    links.forEach((link) => {
      document.head.appendChild(link);
    });

    return () => {
      links.forEach((link) => {
        link.remove();
      });

      warmVideos.forEach((video) => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      });
    };
  }, [preloadUrls]);

  return null;
}
