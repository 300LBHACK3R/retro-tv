"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Image from "next/image";
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
import { getThemeLayoutClass, getThemeLayoutMode } from "@/lib/themeLayouts";
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

function getCurrentTimeLabel(): string {
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
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
  const [clockLabel, setClockLabel] = useState(getCurrentTimeLabel);

  const theme = useMemo(() => getThemeById(themeId), [themeId]);
  const themeVars = useMemo(() => createThemeVars(theme), [theme]);
  const themeLayoutMode = useMemo(() => getThemeLayoutMode(themeId), [themeId]);
  const themeLayoutClass = useMemo(() => getThemeLayoutClass(themeId), [themeId]);

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

  const activeSchedule = useMemo(
    () =>
      buildSchedule(activeChannelMedia, {
        channel: activeChannel,
      }),
    [activeChannel, activeChannelMedia],
  );

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

  const activeChannelIndex = enabledChannels.findIndex(
    (channel) => channel.id === activeChannel?.id,
  );

  const previewChannels = enabledChannels.slice(0, 12);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockLabel(getCurrentTimeLabel());
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

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
      className={`theme-${themeId} ${themeLayoutClass} min-h-screen overflow-x-hidden`}
      data-theme={themeId}
      data-theme-layout={themeLayoutMode}
      style={{
        ...themeVars,
        background:
          "radial-gradient(circle at top right, rgba(34,211,238,0.08), transparent 30%), radial-gradient(circle at top left, rgba(147,51,234,0.12), transparent 32%), var(--app-bg)",
        color: "var(--text)",
      }}
    >
      <TextEncodingCleaner />
      <GlobalProgrammingSync isAdminAuthorized={isAdminAuthorized} />
      <MediaPreloader activeSchedule={activeSchedule} activeChannel={activeChannel} />

      <div className="ttv-command-shell mx-auto flex w-full max-w-[1900px] flex-col gap-4 p-3 sm:p-4 xl:p-5">
        <header className="ttv-command-topbar rounded-3xl border px-3 py-3 shadow-2xl shadow-black/30 sm:px-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="shrink-0">
                <Image
                  src="/retro-logo.png"
                  alt="Tate's Retro TV"
                  width={300}
                  height={110}
                  className="h-auto w-[180px] max-w-[48vw] sm:w-[240px] xl:w-[280px]"
                  draggable={false}
                  priority
                />
              </div>

              <div className="hidden min-w-0 xl:block">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-200">
                  Live TV Dashboard
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-white/80">
                  {activeChannel ? `CH ${activeChannel.number ?? activeChannel.id} · ${getChannelDisplayName(activeChannel)}` : "No channel selected"}
                </div>
              </div>
            </div>

            <nav className="ttv-command-nav flex min-w-0 gap-2 overflow-x-auto pb-1 xl:justify-center xl:pb-0">
              <button type="button" className="is-active">
                Live TV
              </button>
              <button type="button">Guide</button>
              <button type="button">Categories</button>
              <button type="button">Schedule</button>
              <button type="button">Search</button>
              <button type="button" onClick={() => setLocalSettingsOpen(true)}>
                Settings
              </button>
            </nav>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <div className="ttv-command-pill">
                <span>{clockLabel}</span>
              </div>

              <div className="ttv-command-quality">
                <span>Stream Quality</span>
                <strong>Excellent</strong>
              </div>

              <ThemeButton />
              <ShowLibrary />
            </div>
          </div>
        </header>

        <div
          className={`grid gap-4 ${
            showAdminSidebar
              ? "xl:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]"
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
            <aside className="order-2 flex min-w-0 flex-col gap-3 xl:order-1">
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
            className={`order-1 flex min-w-0 flex-col gap-4 ${
              showAdminSidebar ? "xl:order-2" : ""
            }`}
          >
            <ViewerHeader channel={activeChannel} />

            <NowNextBar channel={activeChannel} schedule={activeSchedule} />

            <QuickTuneBar />

            <div className="ttv-command-main-grid grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
              <section className="flex min-w-0 flex-col gap-4">
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

                <div
                  className={`ttv-command-player ${playerFrameClass}`}
                  style={{ borderColor: "var(--border)" }}
                >
                  <Player schedule={activeSchedule} />
                  <ChannelOverlay compact={playerViewMode === "mini"} />
                  <StaticTransition trigger={activeChannel?.id ?? ""} />

                  {isGuideOpen ? (
                    <div className="absolute inset-0 z-40 bg-black/85 p-3 backdrop-blur-[2px] sm:p-4">
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

                <section className="ttv-command-info-grid grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                  <article className="ttv-command-card">
                    <div className="flex gap-3">
                      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-cyan-300/20 bg-black/40">
                        <Image
                          src="/retro-logo.png"
                          alt=""
                          fill
                          sizes="112px"
                          className="object-contain p-2"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">
                          On Air Now
                        </div>
                        <h2 className="mt-1 truncate text-2xl font-black tracking-tight text-white">
                          {getChannelDisplayName(activeChannel)}
                        </h2>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/70">
                          Live retro programming, custom channels, scheduled shows,
                          commercials, bumpers, and Tate&apos;s TV channel flow.
                        </p>
                      </div>
                    </div>
                  </article>

                  <article className="ttv-command-card">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">
                      Up Next
                    </div>
                    <h3 className="mt-2 text-xl font-black tracking-tight text-white">
                      Guide-controlled schedule
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-white/70">
                      Use the side guide or remote guide button to jump channels.
                    </p>
                  </article>
                </section>
              </section>

              <aside className="ttv-command-side flex min-w-0 flex-col gap-4">
                <section className="ttv-command-side-panel">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">
                        TV Guide
                      </div>
                      <div className="mt-1 text-xs text-white/55">
                        Current lineup
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-100"
                    >
                      View All
                    </button>
                  </div>

                  <div className="ttv-command-guide-dock">
                    {guideDock}
                  </div>
                </section>

                <section className="ttv-command-side-panel">
                  <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">
                    Remote Control
                  </div>
                  <div className="ttv-command-remote-dock">
                    <Remote />
                  </div>
                </section>
              </aside>
            </div>

            <section className="ttv-command-channel-rail">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">
                  Channels
                </div>
                <div className="text-xs text-white/50">
                  {enabledChannels.length} active
                </div>
              </div>

              <div className="ttv-command-channel-scroll">
                {previewChannels.map((channel, index) => {
                  const isActive = channel.id === activeChannel?.id;

                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => setChannel(channel.id)}
                      className={isActive ? "is-active" : ""}
                    >
                      <span>{channel.branding?.logoText ?? channel.name}</span>
                      <strong>CH {channel.number ?? index + 1}</strong>
                    </button>
                  );
                })}
              </div>
            </section>

            <footer className="ttv-command-ticker">
              <span>Welcome to Tate&apos;s Retro TV</span>
              <strong>
                Now Playing · {getChannelDisplayName(activeChannel)}
              </strong>
              <em>
                Channel {activeChannelIndex >= 0 ? activeChannelIndex + 1 : 1} of{" "}
                {enabledChannels.length}
              </em>
            </footer>
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
