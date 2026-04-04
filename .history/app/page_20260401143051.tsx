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
    <main className="h-screen overflow-hidden bg-slate-950 text-white">
      <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-4 p-4">
        <div className="shrink-0">
          <Remote />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)] gap-4">
          <aside className="flex min-h-0 flex-col gap-4 overflow-hidden">
            <UploadPanel />

            <div className="min-h-0 flex-1 overflow-auto rounded border border-blue-700 bg-[#0a2a4a] p-4">
              <div className="mb-3 text-sm font-semibold tracking-wide text-white">
                Active Channel
              </div>

              <div className="rounded border border-blue-700 bg-[#11345a] p-3">
                <div className="text-lg font-bold">
                  CH {activeChannel?.id ?? "-"}
                </div>
                <div className="mt-1 text-sm text-blue-100">
                  {activeChannel?.name ?? "No Channel"}
                </div>
                <div className="mt-3 text-xs text-blue-200">
                  Media items on this channel: {activeChannelMedia.length}
                </div>
              </div>

              <div className="mt-4 text-xs text-blue-200">
                Press <span className="font-semibold">G</span> to open or close
                the guide overlay.
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col gap-4 overflow-hidden">
            <div className="relative min-h-0 flex-[1.3] overflow-hidden rounded border border-blue-700 bg-black">
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

                  <div className="h-[calc(100%-56px)] overflow-auto">
                    <MultiGuide
                      data={channelSchedules}
                      onProgramSelect={({ channel }) => {
                        setChannel(channel.id);
                        closeGuide();
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {!isGuideOpen && (
              <div className="min-h-0 flex-[0.95] overflow-auto rounded border border-blue-700 bg-[#081d36] p-2">
                <MultiGuide
                  data={channelSchedules}
                  onProgramSelect={({ channel }) => {
                    setChannel(channel.id);
                  }}
                />
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}