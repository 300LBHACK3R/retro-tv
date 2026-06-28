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
import StaticTransition from "@/components/StaticTransition";
import TextEncodingCleaner from "@/components/TextEncodingCleaner";
import ThemeButton from "@/components/ThemeButton";
import ViewerHeader from "@/components/ViewerHeader";
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

function isCommercialInventoryItem(item: MediaItem): boolean {
  return item.type === "commercial" || item.type === "bumper";
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

function getSharedScheduleAnchor(): Date {
  /*
    One source of truth for schedule generation.

    Broadcast schedules must be anchored to the start of the local day.
    The player and guide both calculate positions inside this same
    midnight-based schedule, so CH2 Now Playing and CH2 Guide cannot drift.
  */
  const anchor = new Date();
  anchor.setHours(0, 0, 0, 0);
  return anchor;
}

function sortChannelsByNumber(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) => {
    const aNumber = Number(a.number ?? a.id);
    const bNumber = Number(b.number ?? b.id);

    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
      return aNumber - bNumber;
    }

    return String(a.id).localeCompare(String(b.id));
  });
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

function getChannelDisplayName(channel: Channel | undefined): string {
  if (!channel) {
    return "No channel selected";
  }

  return channel.branding?.displayName ?? channel.name;
}

function getChannelLabel(channel: Channel | undefined): string {
  if (!channel) {
    return "CH --";
  }

  return `CH ${channel.number ?? channel.id}`;
}

function EmptyStationState() {
  return (
    <section
      className="rounded-2xl border p-5 text-sm shadow-2xl shadow-black/20"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text-muted)",
      }}
    >
      <div
        className="text-xs font-black uppercase tracking-[0.18em]"
        style={{ color: "var(--primary)" }}
      >
        Tate&apos;s TV
      </div>

      <h2 className="mt-2 text-lg font-black tracking-tight text-white">
        No Enabled Channels
      </h2>

      <p className="mt-2 leading-6">
        Enable at least one channel in admin mode so the live player, guide, and
        schedule engine have a channel to run.
      </p>
    </section>
  );
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
  const isSettingsOpen = useStore(
    (state) => state.viewerSettings.isSettingsOpen,
  );
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);

  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);

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

  const availableAds = useMemo(
    () => media.filter(isCommercialInventoryItem),
    [media],
  );

  const scheduleAnchor = useMemo(() => getSharedScheduleAnchor(), []);

  const activeSchedule = useMemo(
    () =>
      buildSchedule(activeChannelMedia, {
        channel: activeChannel,
        availableAds,
        now: scheduleAnchor,
      }),
    [activeChannel, activeChannelMedia, availableAds, scheduleAnchor],
  );

  const channelSchedules = useMemo(
    () =>
      enabledChannels.map((channel) => {
        const channelMedia = getMediaForChannel(channel, media);
        const playbackSchedule = buildSchedule(channelMedia, {
          channel,
          availableAds,
          now: scheduleAnchor,
        });

        return {
          channel,
          schedule: playbackSchedule,
          media: channelMedia,
          availableAds,
        };
      }),
    [availableAds, enabledChannels, media, scheduleAnchor],
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
    if (activeChannel) {
      return;
    }

    const firstEnabledChannel = enabledChannels[0];

    if (firstEnabledChannel) {
      setChannel(firstEnabledChannel.id);
    }
  }, [activeChannel, enabledChannels, setChannel]);

  useEffect(() => {
    const shouldLockPage = isGuideOpen || isSettingsOpen;

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    const previousTouchAction = document.body.style.touchAction;

    if (shouldLockPage) {
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
      document.body.style.touchAction = "none";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [isGuideOpen, isSettingsOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setSettingsOpen(true);
        return;
      }

      if (isGuideOpen && event.key === "Escape") {
        event.preventDefault();
        closeGuide();
        return;
      }

      if (isSettingsOpen && event.key === "Escape") {
        event.preventDefault();
        setSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeGuide, isGuideOpen, isSettingsOpen, setSettingsOpen]);

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
            <Image
              src="/tatestv-logo.png"
              alt="TatesTv"
              width={260}
              height={90}
              className="h-auto w-full max-w-[220px] sm:max-w-[260px]"
              draggable={false}
              priority
            />
          </div>

          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
            <ThemeButton />
<div className="fixed bottom-5 left-5 z-40">
  <a
    href="/library"
    className="inline-flex items-center justify-center rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-white/80 shadow-[0_0_30px_rgba(255,255,255,0.08)] backdrop-blur-xl transition hover:border-pink-300/40 hover:bg-pink-500/15 hover:text-pink-100"
  >
    Library
  </a>
</div>
<button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="ttv-touch-target rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em] transition hover:scale-[1.02] hover:opacity-95"
              style={{
                background: "var(--button-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              Settings
            </button>
          </div>
        </header>

        {enabledChannels.length === 0 ? (
          <EmptyStationState />
        ) : (
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

              <div
                className={playerFrameClass}
                style={{ borderColor: "var(--border)" }}
              >
                <Player schedule={activeSchedule} />

                <ChannelOverlay compact={playerViewMode === "mini"} />
                <StaticTransition trigger={activeChannel?.id ?? ""} />
                <Remote />
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
                  Press <span style={{ color: "var(--text)" }}>Guide</span> on
                  the remote to open the premium live guide.
                </section>
              ) : null}
            </section>
          </div>
        )}

        <footer
          className="rounded-2xl border px-4 py-4 text-center text-xs shadow-2xl shadow-black/20 sm:px-5"
          style={{
            background: "var(--panel-bg)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          <div className="font-semibold uppercase tracking-[0.16em]">
            Tate&apos;s TV
          </div>

          <div className="mt-2 leading-5">
            Built, managed, and maintained by{" "}
            <a
              href="https://lltechsolutions.ca"
              target="_blank"
              rel="noopener noreferrer"
              className="font-black transition hover:opacity-80"
              style={{ color: "var(--primary)" }}
            >
              L&amp;L Tech Solutions
            </a>
            .
          </div>
        </footer>
      </div>

      {isGuideOpen ? (
        <div
          className="fixed inset-0 z-[90] flex h-[100dvh] min-h-0 flex-col bg-black/90 p-2 backdrop-blur-md sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Tate's TV live guide"
        >
          <div className="mb-2 flex shrink-0 items-center justify-between gap-3 sm:mb-3">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.2em] text-white/55">
                Tate&apos;s TV
              </div>

              <div className="text-lg font-black text-white sm:text-xl">
                Live Guide
              </div>
            </div>

            <button
              type="button"
              onClick={closeGuide}
              className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.01]"
              style={{
                background: "var(--button-bg)",
                color: "var(--text)",
              }}
            >
              Close Guide
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">{guideOverlay}</div>
        </div>
      ) : null}

      {isSettingsOpen ? (
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
                onClick={() => setSettingsOpen(false)}
                className="rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em] transition hover:scale-[1.01]"
                style={{
                  background: "var(--button-bg)",
                  color: "var(--text)",
                }}
              >
                Close
              </button>
            </div>

            <div
              className="rounded-xl border px-3 py-2 text-xs leading-5"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              Current station:{" "}
              <span style={{ color: "var(--text)" }}>
                {getChannelLabel(activeChannel)} / {getChannelDisplayName(activeChannel)}
              </span>
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



