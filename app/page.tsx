"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import AdminAccessPanel from "@/components/AdminAccessPanel";
import AdminDashboard from "@/components/AdminDashboard";
import AppModeToggle from "@/components/AppModeToggle";
import ChannelOverlay from "@/components/ChannelOverlay";
import GlobalProgrammingSync from "@/components/GlobalProgrammingSync";
import MediaPreloader from "@/components/MediaPreloader";
import MultiGuide from "@/components/MultiGuide";
import NowNextBar from "@/components/NowNextBar";
import Player from "@/components/Player";
import QuickTuneBar from "@/components/QuickTuneBar";
import Remote from "@/components/Remote";
import ShowLibrary from "@/components/ShowLibrary";
import StaticTransition from "@/components/StaticTransition";
import TextEncodingCleaner from "@/components/TextEncodingCleaner";
import ThemeButton from "@/components/ThemeButton";
import ViewerHeader from "@/components/ViewerHeader";
import { buildGuideSchedule } from "@/lib/guideSchedule";
import { buildSchedule } from "@/lib/scheduler";
import { useStore } from "@/lib/store";
import { getThemeById } from "@/lib/themes";
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

function getChannelDisplayName(channel: Channel | undefined): string {
  if (!channel) {
    return "No channel";
  }

  return channel.branding?.displayName ?? channel.name;
}

function getPlayerFrameClass(playerViewMode: "normal" | "mini" | "theater"): string {
  if (playerViewMode === "mini") {
    return [
      "fixed bottom-3 right-3 z-[70]",
      "aspect-video w-[min(440px,calc(100vw-24px))]",
      "overflow-hidden rounded-2xl border bg-black shadow-2xl shadow-black/60",
      "sm:bottom-4 sm:right-4",
    ].join(" ");
  }

  if (playerViewMode === "theater") {
    return [
      "relative aspect-video w-full overflow-hidden rounded-2xl border bg-black shadow-2xl shadow-black/40",
      "xl:max-h-[78vh]",
    ].join(" ");
  }

  return "relative aspect-video w-full overflow-hidden rounded-2xl border bg-black shadow-2xl shadow-black/30";
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
  const setAppMode = useStore((state) => state.setAppMode);
  const themeId = useStore((state) => state.themeId);

  
  const playerViewMode = useStore(
    (state) => state.viewerSettings.playerViewMode,
  );

  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [localSettingsOpen, setLocalSettingsOpen] = useState(false);

  const theme = useMemo(() => getThemeById(themeId), [themeId]);
  const themeVars = useMemo(() => createThemeVars(theme), [theme]);

  const enabledChannels = useMemo(
    () =>
      sortChannelsByNumber(
        channels.filter((channel) => channel.isEnabled !== false),
      ),
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

  /**
   * Real playback schedule.
   * This includes virtual show slices, commercials, bumpers, and hidden guide items.
   * Player and Now/Next need this schedule so commercial breaks work correctly.
   */
  const activeSchedule = useMemo(
    () =>
      buildSchedule(activeChannelMedia, {
        channel: activeChannel,
      }),
    [activeChannel, activeChannelMedia],
  );

  /**
   * Clean public guide schedule.
   * This hides/merges commercials and bumpers into normal show blocks.
   */
  const activeGuideSchedule = useMemo(
    () => buildGuideSchedule(activeSchedule),
    [activeSchedule],
  );

  const channelSchedules = useMemo(
    () =>
      enabledChannels.map((channel) => {
        const channelMedia = getMediaForChannel(channel, media);
        const playbackSchedule = buildSchedule(channelMedia, { channel });

        return {
          channel,
          schedule: buildGuideSchedule(playbackSchedule),
        };
      }),
    [enabledChannels, media],
  );

  const showAdminSidebar = appMode === "admin" && isAdminAuthorized;
  const playerFrameClass = getPlayerFrameClass(playerViewMode);

  useEffect(() => {
    if (!isAdminAuthorized && appMode === "admin") {
      setAppMode("viewer");
    }
  }, [appMode, isAdminAuthorized, setAppMode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedChannel = params.get("ch");

    if (!requestedChannel) {
      return;
    }

    const channelExists = channels.some(
      (channel) => channel.id === requestedChannel,
    );

    if (channelExists) {
      setChannel(requestedChannel);
    }
  }, [channels, setChannel]);

  useEffect(() => {
    if (!activeChannel) {
      const firstEnabledChannel = enabledChannels[0];

      if (firstEnabledChannel) {
        setChannel(firstEnabledChannel.id);
      }
    }
  }, [activeChannel, enabledChannels, setChannel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setLocalSettingsOpen(true);
        return;
      }

      if (isGuideOpen && event.key === "Escape") {
        event.preventDefault();
        closeGuide();
        return;
      }

      if (localSettingsOpen && event.key === "Escape") {
        event.preventDefault();
        setLocalSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeGuide, isGuideOpen, localSettingsOpen]);

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
        background:
          "radial-gradient(circle at top right, rgba(255,255,255,0.045), transparent 32%), var(--app-bg)",
        color: "var(--text)",
      }}
    >
      <TextEncodingCleaner />
      <GlobalProgrammingSync isAdminAuthorized={isAdminAuthorized} />
      <MediaPreloader activeSchedule={activeSchedule} activeChannel={activeChannel} />

      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3 p-3 sm:p-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <img
              src="/retro-logo.png"
              alt="Tate's Retro TV"
              className="h-auto w-[min(220px,62vw)] max-w-full object-contain sm:w-[260px]"
              draggable={false}
            />
          </div>

          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
            <ThemeButton />
            <ShowLibrary />
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

              <AdminDashboard />
            </aside>
          ) : null}

          <section
            className={`order-1 flex min-w-0 flex-col gap-3 ${
              showAdminSidebar ? "lg:order-2" : ""
            }`}
          >
            <ViewerHeader channel={activeChannel} />

            <NowNextBar channel={activeChannel} schedule={activeSchedule} />

            <QuickTuneBar />

            {playerViewMode === "mini" ? (
              <section
                className="rounded-2xl border p-4 text-sm"
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                Mini-player is active. Use the floating player in the bottom
                right, or switch back to Normal/Theater from the remote.
              </section>
            ) : null}

            <div className={playerFrameClass} style={{ borderColor: "var(--border)" }}>
              <Player schedule={activeSchedule} />

              <ChannelOverlay compact={playerViewMode === "mini"} />
              <StaticTransition trigger={activeChannel?.id ?? ""} />
              <Remote />

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
              <section
                className="rounded-2xl border p-4 text-sm shadow-2xl shadow-black/20"
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                Press <span style={{ color: "var(--text)" }}>Guide</span> on the remote to open the full live channel guide.
              </section>
            ) : null}
          </section>
        </div>
      </div>

      {localSettingsOpen ? (
        <div
          className="fixed inset-0 z-[95] overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Settings and admin access"
        >
          <div
            className="mx-auto my-4 flex max-w-3xl flex-col gap-3 rounded-2xl border p-3 shadow-2xl sm:my-6 sm:p-4"
            style={{
              background: "var(--panel-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div
                  className="text-xs font-black uppercase tracking-[0.2em]"
                  style={{ color: "var(--primary)" }}
                >
                  Settings
                </div>

                <h2 className="mt-1 text-lg font-black tracking-tight">
                  Viewer & Admin Controls
                </h2>

                <p
                  className="mt-1 text-xs leading-5"
                  style={{ color: "var(--text-muted)" }}
                >
                  Theme, viewer mode, admin unlock, and protected station tools.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLocalSettingsOpen(false)}
                className="rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em] transition hover:scale-[1.01]"
                style={{
                  background: "var(--button-bg)",
                  color: "var(--text)",
                }}
              >
                Close
              </button>
            </div>

            <AdminAccessPanel onAuthChange={setIsAdminAuthorized} />

            <AppModeToggle isAdminAuthorized={isAdminAuthorized} />

            <div
              className="rounded-xl border px-3 py-2 text-xs leading-5"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              Public viewers should only see the premium watching experience.
              Admin tools stay locked unless the session is authorized.
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}















