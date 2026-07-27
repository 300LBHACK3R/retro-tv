"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { createPortal } from "react-dom";
import AdminAccessPanel from "@/components/AdminAccessPanel";
import AdminDashboard from "@/components/AdminDashboard";
import AppModeToggle from "@/components/AppModeToggle";
import ChannelOverlay from "@/components/ChannelOverlay";
import GlobalProgrammingSync from "@/components/GlobalProgrammingSync";
import MediaPreloader from "@/components/MediaPreloader";
import NowNextBar from "@/components/NowNextBar";
import OpenAdminWindowButton from "@/components/OpenAdminWindowButton";
import Player from "@/components/Player";
import QuickTuneBar from "@/components/QuickTuneBar";
import Remote from "@/components/Remote";
import StaticTransition from "@/components/StaticTransition";
import TextEncodingCleaner from "@/components/TextEncodingCleaner";
import ThemeButton from "@/components/ThemeButton";
import ViewerHeader from "@/components/ViewerHeader";
import { buildSchedule } from "@/lib/scheduler";
import { useStore } from "@/lib/store";
import { getThemeLayoutClass } from "@/lib/themeLayouts";
import { createThemeCssVars, getThemeById } from "@/lib/themes";
import type { Channel, MediaItem } from "@/lib/types";

const MultiGuide = dynamic(() => import("@/components/MultiGuide"), {
  ssr: false,
  loading: () => (
    <div
      className="ttv-glass-panel flex h-full min-h-[20rem] items-center justify-center rounded-2xl border p-6 text-center"
      style={{
        borderColor: "var(--border)",
        color: "var(--text-muted)",
      }}
    >
      <div>
        <div
          className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-current"
          style={{ color: "var(--primary)" }}
          aria-hidden="true"
        />
        <div className="mt-4 text-xs font-black uppercase tracking-[0.16em]">
          Opening Live Guide
        </div>
        <div className="mt-2 text-xs">Loading guide code and preparing channel rows...</div>
      </div>
    </div>
  ),
});

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
  mediaById: Map<string, MediaItem>,
): MediaItem[] {
  if (!channel) {
    return [];
  }

  return channel.mediaIds
    .map((mediaId) => mediaById.get(mediaId))
    .filter((item): item is MediaItem => Boolean(item));
}

function isCommercialInventoryItem(item: MediaItem): boolean {
  return item.type === "commercial" || item.type === "bumper";
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

      <h2
        className="mt-2 text-lg font-black tracking-tight"
        style={{ color: "var(--text)" }}
      >
        No Enabled Channels
      </h2>

      <p className="mt-2 leading-6">
        Enable at least one channel in admin mode so the live player, guide, and
        schedule engine have a channel to run.
      </p>
    </section>
  );
}

export interface TatesTvHomeProps {
  tvMode?: boolean;
}

export default function TatesTvHome({ tvMode = false }: TatesTvHomeProps) {
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
  const [canUseGuidePortal, setCanUseGuidePortal] = useState(false);
  const guideCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  const mediaById = useMemo(
    () => new Map(media.map((item) => [item.id, item])),
    [media],
  );

  const theme = useMemo(() => getThemeById(themeId), [themeId]);
  const themeVars = useMemo(
    () => createThemeCssVars(theme) as CSSProperties,
    [theme],
  );
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
    () => getMediaForChannel(activeChannel, mediaById),
    [activeChannel, mediaById],
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

  const channelGuideData = useMemo(() => {
    if (!isGuideOpen) {
      return [];
    }

    return enabledChannels.map((channel) => ({
      channel,
      media: getMediaForChannel(channel, mediaById),
      availableAds,
    }));
  }, [availableAds, enabledChannels, isGuideOpen, mediaById]);

  const showAdminSidebar = !tvMode && appMode === "admin" && isAdminAuthorized;
  const playerFrameClass = tvMode
    ? "ttv-tv-player-frame relative aspect-video w-full overflow-hidden rounded-2xl border bg-black shadow-2xl shadow-black/50"
    : getPlayerFrameClass(playerViewMode);

  useEffect(() => {
    setCanUseGuidePortal(true);
  }, []);

  useEffect(() => {
    if (!isGuideOpen || !canUseGuidePortal) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      guideCloseButtonRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [canUseGuidePortal, isGuideOpen]);

  useEffect(() => {
    if (!tvMode) {
      return;
    }

    setAppMode("viewer");
    setSettingsOpen(false);
  }, [setAppMode, setSettingsOpen, tvMode]);

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
    const previousGuideOpen = document.body.dataset.ttvGuideOpen;

    if (isGuideOpen) document.body.dataset.ttvGuideOpen = "true";
    else delete document.body.dataset.ttvGuideOpen;

    if (shouldLockPage) {
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
      if (previousGuideOpen) document.body.dataset.ttvGuideOpen = previousGuideOpen;
      else delete document.body.dataset.ttvGuideOpen;
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
      data={channelGuideData}
      onProgramSelect={({ channel }) => {
        setChannel(channel.id);
        closeGuide();
      }}
    />
  );

  return (
    <main
      className={`ttv-app-shell ${themeLayoutClass} ${tvMode ? "ttv-tv-mode" : ""} min-h-screen overflow-x-hidden`}
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

      <div className="ttv-page-frame mx-auto flex w-full max-w-[1800px] flex-col gap-3 p-3 sm:p-4">
        <header className="ttv-main-header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="ttv-brand-lockup min-w-0">
            <Image
              src="/tatestv-logo.png"
              alt="TatesTv"
              width={260}
              height={90}
              className="h-auto w-full max-w-[220px] sm:max-w-[260px]"
              style={{ width: "100%", height: "auto" }}
              draggable={false}
              priority
            />
          </div>

          <div className="ttv-header-actions flex flex-wrap items-start gap-2 sm:justify-end">
            <ThemeButton />
            <OpenAdminWindowButton />
            <a
              href="/library"
              className="ttv-touch-target inline-flex items-center justify-center rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em] transition hover:scale-[1.02] hover:opacity-95"
              style={{
                background: "var(--button-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              Library
            </a>
            <a
              href="/submit"
              className="ttv-primary-action ttv-touch-target inline-flex items-center justify-center rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em] transition hover:scale-[1.02] hover:opacity-95"
            >
              Submit Clip
            </a>
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

              {!tvMode ? <QuickTuneBar /> : null}

              {!tvMode && playerViewMode === "mini" ? (
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

                <ChannelOverlay compact={!tvMode && playerViewMode === "mini"} />
                <StaticTransition trigger={activeChannel?.id ?? ""} />
                <Remote />
              </div>

              {!tvMode && !isGuideOpen ? (
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

      {canUseGuidePortal && isGuideOpen
        ? createPortal(
            <div
              className="ttv-guide-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ttv-live-guide-title"
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) {
                  closeGuide();
                }
              }}
            >
              <header className="ttv-guide-dialog-header">
                <div className="ttv-guide-dialog-title">
                  <span>Tate&apos;s TV</span>
                  <strong id="ttv-live-guide-title">Live Guide</strong>
                </div>

                <button
                  ref={guideCloseButtonRef}
                  type="button"
                  onClick={closeGuide}
                  className="ttv-guide-close"
                  aria-label="Close live guide"
                >
                  <span aria-hidden="true">×</span>
                  <span>Close</span>
                </button>
              </header>

              <div className="ttv-guide-dialog-body">{guideOverlay}</div>
            </div>,
            document.body,
          )
        : null}

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

