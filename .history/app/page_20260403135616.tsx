"use client";

import { useEffect, useMemo, useState } from "react";
import { blobToObjectUrl } from "@/lib/media-db";
import { buildSchedule } from "@/lib/scheduler";
import { useStore } from "@/lib/store";
import AdminAccessPanel from "@/components/AdminAccessPanel";
import ChannelBrandingPanel from "@/components/ChannelBrandingPanel";
import ChannelOverlay from "@/components/ChannelOverlay";
import ChannelProgrammingPanel from "@/components/ChannelProgrammingPanel";
import CRTOverlay from "@/components/CRTOverlay";
import MediaLibraryPanel from "@/components/MediaLibraryPanel";
import MultiGuide from "@/components/MultiGuide";
import NowNextBar from "@/components/NowNextBar";
import Player from "@/components/Player";
import Remote from "@/components/Remote";
import StationConfigPanel from "@/components/StationConfigPanel";
import StaticTransition from "@/components/StaticTransition";
import ThemeButton from "@/components/ThemeButton";
import UploadPanel from "@/components/UploadPanel";
import ViewerHeader from "@/components/ViewerHeader";

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
  const appMode = useStore((state) => state.appMode);

  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);

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

  if (appMode === "viewer") {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 p-4">
          <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="min-w-0">
              <AdminAccessPanel onAuthChange={setIsAdminAuthorized} />
            </div>

            <div className="flex flex-wrap items-start justify-end gap-3">
              <ThemeButton />
              <Remote />
            </div>
          </div>

          <ViewerHeader channel={activeChannel} />
          <NowNextBar channel={activeChannel} schedule={activeSchedule} />

          <div className="relative min-h-[520px] overflow-hidden rounded-2xl border border-slate-800 bg-black">
            <StaticTransition trigger={currentChannelId} />
            <ChannelOverlay />
            <Player schedule={activeSchedule} />
            <CRTOverlay />

            {isGuideOpen && (
              <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-[2px] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold tracking-wide text-white">
                    Live Guide
                  </div>
                  <button
                    onClick={closeGuide}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
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
              className="overflow-auto rounded-2xl border border-slate-800 bg-slate-950/80 p-2"
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
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-slate-950 text-white">
      <div className="mx-auto flex h-full max-w-[1800px] flex-col gap-4 p-4">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-[320px] flex-col gap-3">
            <AdminAccessPanel onAuthChange={setIsAdminAuthorized} />
          </div>

          <div className="flex flex-wrap gap-3">
            <ThemeButton />
            <Remote />
          </div>
        </div>

        <div
          className="grid min-h-0 flex-1 gap-4"
          style={{
            gridTemplateColumns: `${sidebarWidth}px minmax(0, 1fr)`,
          }}
        >
          <aside className="flex min-h-0 flex-col gap-4 overflow-hidden">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Layout Controls
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">
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
                  <div className="text-[11px] text-slate-500">
                    {sidebarWidth}px
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-400">
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
                  <div className="text-[11px] text-slate-500">
                    {guideHeight}px
                  </div>
                </div>
              </div>
            </div>

            <UploadPanel />
            <ChannelBrandingPanel />
            <ChannelProgrammingPanel />
            <MediaLibraryPanel />
            <StationConfigPanel />
          </aside>

          <section className="flex min-h-0 flex-col gap-4 overflow-hidden">
            <ViewerHeader channel={activeChannel} />
            <NowNextBar channel={activeChannel} schedule={activeSchedule} />

            <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-800 bg-black">
              <StaticTransition trigger={currentChannelId} />
              <ChannelOverlay />
              <Player schedule={activeSchedule} />
              <CRTOverlay />

              {isGuideOpen && (
                <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-[2px] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="text-sm font-semibold tracking-wide text-white">
                      Live Guide
                    </div>
                    <button
                      onClick={closeGuide}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
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
                className="overflow-auto rounded-2xl border border-slate-800 bg-slate-950/80 p-2"
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