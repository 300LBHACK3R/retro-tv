"use client";

import { useEffect, useMemo } from "react";
import { blobToObjectUrl } from "@/lib/media-db";
import ChannelOverlay from "@/components/ChannelOverlay";
import CRTOverlay from "@/components/CRTOverlay";
import ChannelProgrammingPanel from "@/components/ChannelProgrammingPanel";
import MediaLibraryPanel from "@/components/MediaLibraryPanel";
import MultiGuide from "@/components/MultiGuide";
import NowNextBar from "@/components/NowNextBar";
import Player from "@/components/Player";
import Remote from "@/components/Remote";
import StationConfigPanel from "@/components/StationConfigPanel";
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
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const guideHeight = useStore((state) => state.guideHeight);
  const setSidebarWidth = useStore((state) => state.setSidebarWidth);
  const setGuideHeight = useStore((state) => state.setGuideHeight);
  const updateMediaFile = useStore((state) => state.updateMediaFile);

  useEffect(() => {
    const restore = async () => {
      for (const item of media) {
        if (item.storageKey && !item.file.startsWith("blob:")) {
          const restoredUrl = await blobToObjectUrl(item.storageKey);
          if (restoredUrl) {
            updateMediaFile(item.id, restoredUrl);
          }
        }
      }
    };

    void restore();
  }, [media, updateMediaFile]);

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
      <div className="mx-auto flex h-full max-w-[1800px] flex-col gap-4 p-4">
        <div className="shrink-0">
          <Remote />
        </div>

        <div
          className="grid min-h-0 flex-1 gap-4"
          style={{
            gridTemplateColumns: `${sidebarWidth}px minmax(0, 1fr)`,
          }}
        >
          <aside className="flex min-h-0 flex-col gap-4 overflow-hidden">
            <div className="rounded border border-blue-700 bg-[#0a2a4a] p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
                Layout Controls
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-blue-200">
                    Sidebar Width
                  </label>
                  <input
                    type="range"
                    min={320}
                    max={560}
                    value={sidebarWidth}
                    onChange={(e) => setSidebarWidth(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-[11px] text-blue-100/80">
                    {sidebarWidth}px
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-blue-200">
                    Guide Height
                  </label>
                  <input
                    type="range"
                    min={200}
                    max={420}
                    value={guideHeight}
                    onChange={(e) => setGuideHeight(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-[11px] text-blue-100/80">
                    {guideHeight}px
                  </div>
                </div>
              </div>
            </div>

            <UploadPanel />
            <ChannelProgrammingPanel />
            <MediaLibraryPanel />
            <StationConfigPanel />
          </aside>

          <section className="flex min-h-0 flex-col gap-4 overflow-hidden">
            <NowNextBar channel={activeChannel} schedule={activeSchedule} />

            <div className="relative min-h-0 flex-1 overflow-hidden rounded border border-blue-700 bg-black">
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
              <div
                className="overflow-auto rounded border border-blue-700 bg-[#081d36] p-2"
                style={{ height: `${guideHeight}px` }}
              >
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