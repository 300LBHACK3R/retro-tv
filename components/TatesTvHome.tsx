"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSpatialNavigation } from "@/components/viewer/useSpatialNavigation";
import DailyDiscovery from "@/components/viewer/DailyDiscovery";
import SaveButton from "@/components/viewer/SaveButton";
import ChannelOverlay from "@/components/ChannelOverlay";
import GlobalProgrammingSync from "@/components/GlobalProgrammingSync";
import MediaPreloader from "@/components/MediaPreloader";
import NowNextBar from "@/components/NowNextBar";
import Player from "@/components/Player";
import Remote from "@/components/Remote";
import StaticTransition from "@/components/StaticTransition";
import ViewerHeader from "@/components/ViewerHeader";
import ChannelBrowserDialog from "@/components/viewer/ChannelBrowserDialog";
import ChannelTuneOverlay from "@/components/viewer/ChannelTuneOverlay";
import ChannelRail from "@/components/viewer/ChannelRail";
import MobileViewerNavigation from "@/components/viewer/MobileViewerNavigation";
import ViewerFooter from "@/components/viewer/ViewerFooter";
import ViewerGuideDialog from "@/components/viewer/ViewerGuideDialog";
import ViewerMoreDialog from "@/components/viewer/ViewerMoreDialog";
import ViewerTopBar from "@/components/viewer/ViewerTopBar";
import { useBroadcastDayAnchor } from "@/components/viewer/useBroadcastDayAnchor";
import { useNumericChannelTune } from "@/components/viewer/useNumericChannelTune";
import { buildSchedule } from "@/lib/scheduler";
import { useStore } from "@/lib/store";
import { getThemeLayoutClass } from "@/lib/themeLayouts";
import { createThemeCssVars, getThemeById } from "@/lib/themes";
import {
  getMediaForChannel,
  getPlayerFrameClass,
  isCommercialInventoryItem,
  isTypingTarget,
  sortEnabledChannels,
} from "@/lib/viewer";
import type { Channel, MediaItem } from "@/lib/types";

const MultiGuide = dynamic(() => import("@/components/MultiGuide"), {
  ssr: false,
  loading: () => (
    <div className="ttv-guide-loading-state" role="status" aria-live="polite">
      <span className="ttv-guide-loading-spinner" aria-hidden="true" />
      <strong>Opening Live Guide</strong>
      <small>Preparing the current Tate&apos;s TV schedule.</small>
    </div>
  ),
});

function EmptyStationState() {
  return (
    <section className="ttv-premium-empty-state ttv-premium-station-empty">
      <span className="ttv-section-kicker">Tate&apos;s TV</span>
      <strong>We will be right back</strong>
      <p>
        The channel lineup is temporarily unavailable. Please try again shortly.
      </p>
      <Link href="/help">Get help with playback</Link>
    </section>
  );
}

export interface TatesTvHomeProps {
  tvMode?: boolean;
}

export default function TatesTvHome({ tvMode = false }: TatesTvHomeProps) {
  useSpatialNavigation(tvMode);
  const channels = useStore((state) => state.channels);
  const media = useStore((state) => state.media);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);
  const setAppMode = useStore((state) => state.setAppMode);

  const isGuideOpen = useStore((state) => state.isGuideOpen);
  const toggleGuide = useStore((state) => state.toggleGuide);
  const closeGuide = useStore((state) => state.closeGuide);

  const themeId = useStore((state) => state.themeId);
  const playerViewMode = useStore(
    (state) => state.viewerSettings.playerViewMode,
  );
  const preferReducedMotion = useStore(
    (state) => state.viewerSettings.preferReducedMotion,
  );
  const isMoreOpen = useStore((state) => state.viewerSettings.isSettingsOpen);
  const setMoreOpen = useStore((state) => state.setSettingsOpen);

  const [isChannelBrowserOpen, setChannelBrowserOpen] = useState(false);
  const channelFromUrlApplied = useRef(false);
  const liveSectionRef = useRef<HTMLElement | null>(null);

  const mediaById = useMemo(
    () => new Map(media.map((item) => [item.id, item])),
    [media],
  );

  const theme = useMemo(() => getThemeById(themeId), [themeId]);
  const themeVars = useMemo(
    () => createThemeCssVars(theme) as CSSProperties,
    [theme],
  );
  const themeLayoutClass = useMemo(
    () => getThemeLayoutClass(themeId),
    [themeId],
  );

  const enabledChannels = useMemo(
    () => sortEnabledChannels(channels),
    [channels],
  );

  const activeChannel = useMemo(
    () =>
      enabledChannels.find((channel) => channel.id === currentChannelId) ??
      enabledChannels[0],
    [currentChannelId, enabledChannels],
  );

  const activeChannelMedia = useMemo(
    () => getMediaForChannel(activeChannel, mediaById),
    [activeChannel, mediaById],
  );

  const availableAds = useMemo(
    () => media.filter(isCommercialInventoryItem),
    [media],
  );

  const scheduleAnchor = useBroadcastDayAnchor();

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

  const isAnyOverlayOpen = isGuideOpen || isChannelBrowserOpen || isMoreOpen;

  const scrollToLive = useCallback(() => {
    liveSectionRef.current?.scrollIntoView({
      behavior:
        preferReducedMotion ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      block: "start",
    });
  }, [preferReducedMotion]);

  const selectChannel = useCallback(
    (channelId: string, shouldScroll = true) => {
      setChannel(channelId);

      if (shouldScroll) {
        window.setTimeout(scrollToLive, 0);
      }
    },
    [scrollToLive, setChannel],
  );

  const numericTune = useNumericChannelTune(
    enabledChannels,
    selectChannel,
    isAnyOverlayOpen,
  );

  const openGuide = useCallback(() => {
    setChannelBrowserOpen(false);
    setMoreOpen(false);

    if (!isGuideOpen) {
      toggleGuide();
    }
  }, [isGuideOpen, setMoreOpen, toggleGuide]);

  const openChannelBrowser = useCallback(() => {
    closeGuide();
    setMoreOpen(false);
    setChannelBrowserOpen(true);
  }, [closeGuide, setMoreOpen]);

  const openMore = useCallback(() => {
    closeGuide();
    setChannelBrowserOpen(false);
    setMoreOpen(true);
  }, [closeGuide, setMoreOpen]);

  useEffect(() => {
    setAppMode("viewer");
  }, [setAppMode]);

  useEffect(() => {
    if (channelFromUrlApplied.current) return;
    const params = new URLSearchParams(window.location.search);
    const requestedChannel = params.get("ch");

    if (!requestedChannel) {
      return;
    }

    const channelExists = enabledChannels.some(
      (channel) => channel.id === requestedChannel,
    );

    if (channelExists) {
      channelFromUrlApplied.current = true;
      setChannel(requestedChannel);
    }
  }, [enabledChannels, setChannel]);

  useEffect(() => {
    if (enabledChannels.some((channel) => channel.id === currentChannelId)) {
      return;
    }

    const firstEnabledChannel = enabledChannels[0];

    if (firstEnabledChannel) {
      setChannel(firstEnabledChannel.id);
    }
  }, [currentChannelId, enabledChannels, setChannel]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    const previousOverlayState = document.body.dataset.ttvOverlayOpen;
    const previousGuideState = document.body.dataset.ttvGuideOpen;

    if (isAnyOverlayOpen) {
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "none";
      document.body.dataset.ttvOverlayOpen = "true";
    }

    if (isGuideOpen) {
      document.body.dataset.ttvGuideOpen = "true";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;

      if (previousOverlayState) {
        document.body.dataset.ttvOverlayOpen = previousOverlayState;
      } else {
        delete document.body.dataset.ttvOverlayOpen;
      }

      if (previousGuideState) {
        document.body.dataset.ttvGuideOpen = previousGuideState;
      } else {
        delete document.body.dataset.ttvGuideOpen;
      }
    };
  }, [isAnyOverlayOpen, isGuideOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        openMore();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openMore]);

  const playerFrameClass = getPlayerFrameClass(playerViewMode, tvMode);

  return (
    <main
      className={`ttv-app-shell ttv-premium-viewer-shell ${themeLayoutClass} ${
        tvMode ? "ttv-tv-mode" : ""
      } min-h-screen overflow-x-hidden`}
      data-player-mode={tvMode ? "tv" : playerViewMode}
      style={{
        ...themeVars,
        background:
          "radial-gradient(circle at top right, rgba(255,255,255,0.045), transparent 32%), var(--app-bg)",
        color: "var(--text)",
      }}
    >
      <a className="ttv-skip-link" href="#ttv-live-player">
        Skip to player
      </a>
      <GlobalProgrammingSync isAdminAuthorized={false} visibility="problems" />
      <MediaPreloader
        activeSchedule={activeSchedule}
        activeChannel={activeChannel}
      />

      <div className="ttv-premium-frame">
        <ViewerTopBar
          channel={activeChannel}
          tvMode={tvMode}
          onOpenGuide={openGuide}
          onOpenChannels={openChannelBrowser}
          onOpenMore={openMore}
          onScrollToLive={scrollToLive}
        />

        {enabledChannels.length === 0 ? (
          <EmptyStationState />
        ) : (
          <>
            <div
              className="ttv-premium-stage-grid"
              data-tv-mode={tvMode ? "true" : "false"}
            >
              <div className="ttv-premium-stage-player">
                <section
                  ref={liveSectionRef}
                  id="ttv-live-player"
                  tabIndex={-1}
                  className="ttv-live-stage"
                  aria-label="Live Tate's TV player"
                >
                  {!tvMode && playerViewMode === "mini" ? (
                    <div className="ttv-mini-player-placeholder">
                      <span className="ttv-section-kicker">
                        Mini player active
                      </span>
                      <strong>
                        The live player is floating above the page.
                      </strong>
                      <p>
                        Use More to return to Normal or Theater mode, or keep
                        browsing channels while the current program continues.
                      </p>
                    </div>
                  ) : null}

                  <div
                    className={playerFrameClass}
                    style={{ borderColor: "var(--border)" }}
                  >
                    <Player schedule={activeSchedule} />
                    <ChannelOverlay
                      compact={!tvMode && playerViewMode === "mini"}
                    />
                    <StaticTransition trigger={activeChannel?.id ?? ""} />
                    <Remote tvMode={tvMode} />
                  </div>
                </section>
              </div>

              {!tvMode ? (
                <aside
                  className="ttv-premium-stage-sidebar"
                  aria-label="Current channel and upcoming programming"
                >
                  <ViewerHeader channel={activeChannel} variant="compact" />
                  {activeChannel && (
                    <div className="ttv-channel-favourite">
                      <SaveButton
                        kind="channel"
                        id={activeChannel.id}
                        title={
                          activeChannel.branding?.displayName ||
                          activeChannel.name
                        }
                      />
                    </div>
                  )}
                  <NowNextBar
                    channel={activeChannel}
                    schedule={activeSchedule}
                    variant="compact"
                  />
                </aside>
              ) : null}
            </div>

            {!tvMode ? (
              <ChannelRail
                channels={enabledChannels}
                currentChannelId={activeChannel?.id ?? currentChannelId}
                onSelectChannel={selectChannel}
                onBrowseAll={openChannelBrowser}
              />
            ) : null}
          </>
        )}

        {!tvMode ? <DailyDiscovery onTune={selectChannel} /> : null}
        {!tvMode ? <ViewerFooter /> : null}
      </div>

      <ViewerGuideDialog open={isGuideOpen} onClose={closeGuide}>
        <MultiGuide
          data={channelGuideData}
          onProgramSelect={({
            channel,
          }: {
            channel: Channel;
            media?: MediaItem;
          }) => {
            selectChannel(channel.id);
            closeGuide();
          }}
        />
      </ViewerGuideDialog>

      <ChannelBrowserDialog
        open={isChannelBrowserOpen}
        channels={enabledChannels}
        currentChannelId={activeChannel?.id ?? currentChannelId}
        onClose={() => setChannelBrowserOpen(false)}
        onSelectChannel={selectChannel}
      />

      <ViewerMoreDialog
        open={isMoreOpen}
        channel={activeChannel}
        tvMode={tvMode}
        onClose={() => setMoreOpen(false)}
      />

      <ChannelTuneOverlay {...numericTune} />

      {!tvMode ? (
        <MobileViewerNavigation
          hidden={isAnyOverlayOpen}
          onLive={scrollToLive}
          onGuide={openGuide}
          onChannels={openChannelBrowser}
          onMore={openMore}
        />
      ) : null}
    </main>
  );
}
