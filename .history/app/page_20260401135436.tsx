"use client";

import { useEffect, useMemo, useState } from "react";
import ChannelOverlay from "@/components/ChannelOverlay";
import CRTOverlay from "@/components/CRTOverlay";
import MultiGuide, { type GuideHoverPayload } from "@/components/MultiGuide";
import Player from "@/components/Player";
import PreviewPlayer from "@/components/PreviewPlayer";
import Remote from "@/components/Remote";
import StaticTransition from "@/components/StaticTransition";
import UploadPanel from "@/components/UploadPanel";
import { getLiveState } from "@/lib/liveEngine";
import { buildSchedule } from "@/lib/scheduler";
import { useStore } from "@/lib/store";

export default function Home() {
  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);
  const isGuideOpen = useStore((state) => state.isGuideOpen);
  const toggleGuide = useStore((state) => state.toggleGuide);
  const closeGuide = useStore((state) => state.closeGuide);

  const [mounted, setMounted] = useState(false);
  const [hoveredPreview, setHoveredPreview] = useState<GuideHoverPayload | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeChannel = channels.find(
    (channel) => channel.id === currentChannelId
  );

  const activeChannelMedia = useMemo(() => {
    if (!activeChannel) return [];
    return media.filter((item) => activeChannel.mediaIds.includes(item.id));
  }, [media, activeChannel]);

  const activeSchedule = useMemo(
    () => buildSchedule(activeChannelMedia),
    [activeChannelMedia]
  );

  const channelSchedules = useMemo(() => {
    return channels.map((channel) => {
      const channelMedia = media.filter((item) =>
        channel.mediaIds.includes(item.id)
      );

      return {
        channel,
        schedule: buildSchedule(channelMedia),
      };
    });
  }, [channels, media]);

  const currentLive = mounted ? getLiveState(activeSchedule) : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "g") {
        toggleGuide();
        return;
      }

      const currentIndex = channels.findIndex(
        (channel) => channel.id === currentChannelId
      );

      if (!isGuideOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!channels.length) return;
        const nextIndex = (currentIndex + 1) % channels.length;
        setChannel(channels[nextIndex].id);
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!channels.length) return;
        const prevIndex = (currentIndex - 1 + channels.length) % channels.length;
        setChannel(channels[prevIndex].id);
      }

      if (e.key === "Escape") {
        e.preventDefault();
        closeGuide();
        setHoveredPreview(null);
      }

      if (e.key === "Enter") {
        e.preventDefault();
        closeGuide();
        setHoveredPreview(null);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    channels,
    closeGuide,
    currentChannelId,
    isGuideOpen,
    setChannel,
    toggleGuide,
  ]);

  const hoverPreviewStyle =
    hoveredPreview && typeof window !== "undefined"
      ? {
          left: `${Math.min(
            hoveredPreview.rect.right + 12,
            window.innerWidth - 300
          )}px`,
          top: `${Math.max(24, hoveredPreview.rect.top - 20)}px`,
        }
      : undefined;

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto max-w-7xl space-y-4">
        <Remote />
        <UploadPanel />

        {/* main guide always visible again */}
        <MultiGuide
          data={channelSchedules}
          onProgramHover={(payload) => setHoveredPreview(payload)}
          onProgramLeave={() => setHoveredPreview(null)}
          onProgramSelect={({ channel }) => {
            setChannel(channel.id);
            setHoveredPreview(null);
            closeGuide();
          }}
        />

        <div className="relative overflow-hidden rounded border border-blue-700 bg-black">
          <StaticTransition trigger={currentChannelId} />
          <ChannelOverlay />
          <Player schedule={activeSchedule} />
          <CRTOverlay />

          {/* top-right current show preview */}
          <div className="absolute right-4 top-4 z-30 w-[280px]">
            <PreviewPlayer
              item={currentLive?.item ?? null}
              startAt={currentLive?.elapsed ?? 0}
              title="Now Watching"
              subtitle={
                activeChannel
                  ? `CH ${activeChannel.id} • ${activeChannel.name}`
                  : "No active channel"
              }
              compact
            />
          </div>

          {/* guide overlay */}
          {isGuideOpen && (
            <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-[2px] p-4">
              <MultiGuide
                data={channelSchedules}
                onProgramHover={(payload) => setHoveredPreview(payload)}
                onProgramLeave={() => setHoveredPreview(null)}
                onProgramSelect={({ channel }) => {
                  setChannel(channel.id);
                  setHoveredPreview(null);
                  closeGuide();
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* hover popup preview */}
      {hoveredPreview && hoverPreviewStyle ? (
        <div
          className="pointer-events-none fixed z-[80] w-[280px]"
          style={hoverPreviewStyle}
        >
          <PreviewPlayer
            item={hoveredPreview.item}
            title="Hover Preview"
            subtitle={`CH ${hoveredPreview.channel.id} • ${hoveredPreview.channel.name}`}
            compact
          />
        </div>
      ) : null}
    </main>
  );
}