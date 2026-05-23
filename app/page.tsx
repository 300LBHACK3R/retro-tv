"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { buildSchedule } from "@/lib/scheduler";
import { getThemeById } from "@/lib/themes";
import { useStore } from "@/lib/store";
import AdminAccessPanel from "@/components/AdminAccessPanel";
import ChannelBrandingPanel from "@/components/ChannelBrandingPanel";
import ChannelProgrammingPanel from "@/components/ChannelProgrammingPanel";
import GlobalProgrammingSync from "@/components/GlobalProgrammingSync";
import MediaLibraryPanel from "@/components/MediaLibraryPanel";
import MultiGuide from "@/components/MultiGuide";
import NowNextBar from "@/components/NowNextBar";
import Player from "@/components/Player";
import Remote from "@/components/Remote";
import StationConfigPanel from "@/components/StationConfigPanel";
import ThemeButton from "@/components/ThemeButton";
import UploadPanel from "@/components/UploadPanel";
import ViewerHeader from "@/components/ViewerHeader";
import type { Channel, MediaItem } from "@/lib/types";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
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

function createThemeVars(theme: ReturnType<typeof getThemeById>): CSSProperties {
  return {
    "--app-bg": theme.colors.appBg,
    "--panel-bg": theme.colors.panelBg,
    "--panel-alt-bg": theme.colors.panelAltBg,
    "--border": theme.colors.border,
    "--text": theme.colors.text,
    "--text-muted": theme.colors.textMuted,
    "--button-bg": theme.colors.buttonBg,
    "--button-hover": theme.colors.buttonHover,
    "--primary": theme.colors.primary,
    "--guide-header-bg": theme.colors.guideHeaderBg,
    "--guide-row-bg": theme.colors.guideRowBg,
    "--guide-row-alt-bg": theme.colors.guideRowAltBg,
    "--guide-active-bg": theme.colors.guideActiveBg,
    "--guide-current-bg": theme.colors.guideCurrentBg,
  } as CSSProperties;
}

export default function Home() {
  const channels = useStore((state) => state.channels);
  const media = useStore((state) => state.media);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);
  const isGuideOpen = useStore((state) => state.isGuideOpen);
  const closeGuide = useStore((state) => state.closeGuide);
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const guideHeight = useStore((state) => state.guideHeight);
  const setSidebarWidth = useStore((state) => state.setSidebarWidth);
  const setGuideHeight = useStore((state) => state.setGuideHeight);
  const appMode = useStore((state) => state.appMode);
  const themeId = useStore((state) => state.themeId);
  const ownedPremiumThemes = useStore((state) => state.ownedPremiumThemes);

  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);

  const theme = useMemo(() => getThemeById(themeId), [themeId]);
  const themeVars = useMemo(() => createThemeVars(theme), [theme]);

  const enabledChannels = useMemo(
    () =>
      channels
        .filter((channel) => channel.isEnabled !== false)
        .sort((a, b) => {
          const aNumber = Number(a.number ?? a.id);
          const bNumber = Number(b.number ?? b.id);

          if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
            return aNumber - bNumber;
          }

          return a.id.localeCompare(b.id);
        }),
    [channels],
  );

  const activeChannel = useMemo(
    () =>
      channels.find((channel) => channel.id === currentChannelId) ??
      enabledChannels[0],
    [channels, currentChannelId, enabledChannels],
  );

  const activeChannelMedia = useMemo(
    () => getMediaForChannel(activeChannel, media),
    [activeChannel, media],
  );

  const activeSchedule = useMemo(
    () =>
      buildSchedule(activeChannelMedia, {
        seed: `channel-${activeChannel?.id ?? "unknown"}`,
      }),
    [activeChannel?.id, activeChannelMedia],
  );

  const channelSchedules = useMemo(() => {
    return enabledChannels.map((channel) => {
      const channelMedia = getMediaForChannel(channel, media);

      return {
        channel,
        schedule: buildSchedule(channelMedia, {
          seed: `channel-${channel.id}`,
        }),
      };
    });
  }, [enabledChannels, media]);

  const showAdminSidebar = appMode === "admin" && isAdminAuthorized;

  useEffect(() => {
    if (!activeChannel && enabledChannels.length > 0) {
      setChannel(enabledChannels[0].id);
    }
  }, [activeChannel, enabledChannels, setChannel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (isGuideOpen && event.key === "Escape") {
        event.preventDefault();
        closeGuide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeGuide, isGuideOpen]);

  const guideDock = (
    <MultiGuide
      data={channelSchedules}
      onProgramSelect={({ channel }) => {
        setChannel(channel.id);
      }}
    />
  );

  const guideOverlay = (
    <MultiGuide
      data={channelSchedules}
      onProgramSelect={({ channel }) => {
        setChannel(channel.id);
        closeGuide();
      }}
    />
  );

  return (
    <main
      className="min-h-screen overflow-x-hidden"
      style={{
        ...themeVars,
        background: "var(--app-bg)",
        color: "var(--text)",
      }}
    >
      <GlobalProgrammingSync isAdminAuthorized={isAdminAuthorized} />

      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3 p-3 sm:p-4">
        <header className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="w-full xl:max-w-[360px]">
            <AdminAccessPanel onAuthChange={setIsAdminAuthorized} />
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start xl:w-auto xl:justify-end">
            <ThemeButton />
            <Remote />
          </div>
        </header>

        <div
          className={`grid gap-3 ${
            showAdminSidebar
              ? "lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]"
              : "grid-cols-1"
          }`}
          style={
            showAdminSidebar
              ? {
                  gridTemplateColumns: `minmax(340px, ${sidebarWidth}px) minmax(0, 1fr)`,
                }
              : undefined
          }
        >
          {showAdminSidebar ? (
            <aside className="order-2 flex min-w-0 flex-col gap-3 lg:order-1">
              <section
                className="rounded-2xl border p-4"
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              >
                <div
                  className="mb-3 text-xs font-semibold uppercase tracking-[0.16em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Layout Controls
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="sidebar-width"
                      className="mb-1 block text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Sidebar Width
                    </label>

                    <input
                      id="sidebar-width"
                      type="range"
                      min={340}
                      max={560}
                      value={sidebarWidth}
                      onChange={(event) =>
                        setSidebarWidth(Number(event.target.value))
                      }
                      className="w-full accent-current"
                    />

                    <div
                      className="text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {sidebarWidth}px
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="guide-height"
                      className="mb-1 block text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Guide Height
                    </label>

                    <input
                      id="guide-height"
                      type="range"
                      min={220}
                      max={560}
                      value={guideHeight}
                      onChange={(event) =>
                        setGuideHeight(Number(event.target.value))
                      }
                      className="w-full accent-current"
                    />

                    <div
                      className="text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {guideHeight}px
                    </div>
                  </div>
                </div>
              </section>

              <UploadPanel />
              <ChannelBrandingPanel />
              <ChannelProgrammingPanel />
              <MediaLibraryPanel />

              <StationConfigPanel
                media={media}
                channels={channels}
                currentChannelId={currentChannelId}
                sidebarWidth={sidebarWidth}
                guideHeight={guideHeight}
                appMode={appMode}
                themeId={themeId}
                ownedPremiumThemes={ownedPremiumThemes}
              />
            </aside>
          ) : null}

          <section
            className={`order-1 flex min-w-0 flex-col gap-3 ${
              showAdminSidebar ? "lg:order-2" : ""
            }`}
          >
            <ViewerHeader channel={activeChannel} />
            <NowNextBar channel={activeChannel} schedule={activeSchedule} />

            <div
              className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-black shadow-2xl shadow-black/30"
              style={{ borderColor: "var(--border)" }}
            >
              <Player schedule={activeSchedule} />

              {isGuideOpen ? (
                <div className="absolute inset-0 z-40 bg-black/80 p-3 backdrop-blur-[2px] sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold tracking-wide text-white">
                      Live Guide
                    </div>

                    <button
                      type="button"
                      onClick={closeGuide}
                      className="rounded-lg px-3 py-2 text-sm font-semibold transition hover:opacity-90"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      Close Guide
                    </button>
                  </div>

                  <div className="h-[calc(100%-56px)] overflow-auto">
                    {guideOverlay}
                  </div>
                </div>
              ) : null}
            </div>

            {!isGuideOpen ? (
              <div
                className="overflow-auto rounded-2xl border p-2 shadow-2xl shadow-black/20"
                style={{
                  height: `${guideHeight}px`,
                  minHeight: "220px",
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                }}
              >
                {guideDock}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}