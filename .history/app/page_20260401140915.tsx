"use client";

import { useEffect, useMemo } from "react";
import ChannelOverlay from "@/components/ChannelOverlay";
import CRTOverlay from "@/components/CRTOverlay";
import MultiGuide from "@/components/MultiGuide";
import Player from "@/components/Player";
import Remote from "@/components/Remote";
import StaticTransition from "@/components/StaticTransition";
import UploadPanel from "@/components/UploadPanel";
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

      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        closeGuide();
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

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto max-w-7xl space-y-4">
        <Remote />
        <UploadPanel />

        {!isGuideOpen && (
          <MultiGuide
            data={channelSchedules}
            onProgramSelect={({ channel }) => {
              setChannel(channel.id);
            }}
          />
        )}

        <div className="relative overflow-hidden rounded border border-blue-700 bg-black">
          <StaticTransition trigger={currentChannelId} />
          <ChannelOverlay />
          <Player schedule={activeSchedule} />
          <CRTOverlay />

          {isGuideOpen && (
            <div className="absolute inset-0 z-40 bg-black/78 backdrop-blur-[2px] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold tracking-wide text-white">
                  Guide Overlay
                </div>
                <button
                  onClick={closeGuide}
                  className="rounded border border-blue-700 bg-[#11345a] px-3 py-2 text-sm text-white hover:bg-[#174675]"
                >
                  Close Guide
                </button>
              </div>

              <MultiGuide
                data={channelSchedules}
                onProgramSelect={({ channel }) => {
                  setChannel(channel.id);
                  closeGuide();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}