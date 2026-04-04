"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

  const [, setIsAdminAuthorized] = useState(false);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    let isCancelled = false;

    const restorePersistedMedia = async () => {
      for (const item of media) {
        if (!item.storageKey || item.file.startsWith("blob:")) continue;

        const restoredUrl = await blobToObjectUrl(item.storageKey);
        if (!restoredUrl || isCancelled) continue;

        objectUrlsRef.current.push(restoredUrl);
        updateMediaFile(item.id, restoredUrl);
      }
    };

    void restorePersistedMedia();

    return () => {
      isCancelled = true;
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current = [];
    };
  }, [media, updateMediaFile]);

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === currentChannelId),
    [channels, currentChannelId]
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "g") {
        toggleGuide();
        return;
      }

      if (!isGuideOpen) return;

      const currentIndex = channels.findIndex(
        (channel) => channel.id === currentChannelId
      );

      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!channels.length) return;

        const nextIndex = (currentIndex + 1) % channels.length;
        setChannel(channels[nextIndex].id);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (!channels.length) return;

        const prevIndex = (currentIndex - 1 + channels.length) % channels.length;
        setChannel(channels[prevIndex].id);
        return;
      }

      if (event.key === "Escape" || event.key === "Enter") {
        event.preventDefault();
        closeGuide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    channels,
    closeGuide,
    currentChannelId,
    isGuideOpen,
    setChannel,
    toggleGuide,
  ]);

  const viewerGuide = (
    <MultiGuide
      data={channelSchedules}
      onProgramSelect={({ channel }) => {
        setChannel(channel.id);
      }}
    />
  );

  const overlayGuide = (
    <MultiGuide
      data={channelSchedules}
      onProgramSelect={({ channel }) => {
        setChannel(channel.id);
        closeGuide();
      }}
    />
  );

  if (appMode === "viewer") {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="w-full max-w-[320px]">
              <AdminAccessPanel onAuthChange={setIsAdminAuthorized} />
            </div>

            <div className="flex flex-wrap items-center gap-3">
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
              <div className="absolute inset-0 z-40 bg-black/80 p-4 backdrop-blur-[2px]">
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
                  {overlayGuide}
                </div>
              </div>
            )}
          </div>

          {!isGuideOpen && (
            <div
              className="overflow-auto rounded-2xl border border-slate-800 bg-slate-950/80 p-2"
              style={{ height: `${guideHeight}px` }}
            >
              {viewerGuide}
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
          <div className="w-full max-w-[320px]">
            <AdminAccessPanel onAuthChange={setIsAdminAuthorized} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
                    onChange={(event) =>
                      setSidebarWidth(Number(event.target.value))
                    }
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
                    onChange={(event) =>
                      setGuideHeight(Number(event.target.value))
                    }
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
                <div className="absolute inset-0 z-40 bg-black/80 p-4 backdrop-blur-[2px]">
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
                    {overlayGuide}
                  </div>
                </div>
              )}
            </div>

            {!isGuideOpen && (
              <div
                className="overflow-auto rounded-2xl border border-slate-800 bg-slate-950/80 p-2"
                style={{ height: `${guideHeight}px` }}
              >
                {viewerGuide}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}