"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BROADCAST_EPOCH_MS, getLiveState } from "@/lib/liveEngine";
import { usePlayerControls } from "@/lib/playerControls";
import { useStore } from "@/lib/store";
import { cleanDisplayText } from "@/lib/textClean";
import type { BroadcastItem, Channel } from "@/lib/types";

interface PlayerProps {
  schedule: BroadcastItem[];
}

type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "error";

type RemotePlaybackLike = {
  prompt?: () => Promise<void>;
};

type ScreenWakeLockSentinelLike = {
  released?: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: "release", listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request?: (type: "screen") => Promise<ScreenWakeLockSentinelLike>;
  };
};

type WebKitVideoElement = HTMLVideoElement & {
  disableRemotePlayback?: boolean;
  remote?: RemotePlaybackLike;
  webkitSupportsFullscreen?: boolean;
  webkitDisplayingFullscreen?: boolean;
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitEnterFullScreen?: () => void;
  webkitExitFullScreen?: () => void;
  webkitShowPlaybackTargetPicker?: () => void;
};

type WebKitFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  webkitRequestFullScreen?: () => Promise<void> | void;
};

type WebKitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitCancelFullScreen?: () => void;
};

const LIVE_TICK_MS = 1000;
const HARD_SYNC_DRIFT_SECONDS = 18;
const HARD_SYNC_COOLDOWN_MS = 4000;
const SOURCE_END_PADDING_SECONDS = 0.4;
const FULLSCREEN_BUSY_UNLOCK_MS = 900;
const CAST_MESSAGE_CLEAR_MS = 3500;
const SOURCE_TRANSITION_RELEASE_MS = 150;

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getPlaybackKey(item: BroadcastItem | null): string {
  if (!item) {
    return "empty";
  }

  return [
    item.id,
    item.file,
    item.sourceStart ?? 0,
    item.sourceEnd ?? item.duration,
    item.duration,
  ].join("|");
}

function getDisplayTitle(item: BroadcastItem): string {
  return cleanDisplayText(item.sourceTitle?.trim() || item.title || "Untitled");
}

function getSourceStart(item: BroadcastItem): number {
  return Math.max(0, Math.floor(item.sourceStart ?? 0));
}

function getSourceEnd(item: BroadcastItem): number | null {
  if (typeof item.sourceEnd !== "number" || !Number.isFinite(item.sourceEnd)) {
    return null;
  }

  return Math.max(0, Math.floor(item.sourceEnd));
}

function getSafeItemDuration(item: BroadcastItem): number {
  const duration = Math.floor(Number(item.duration));

  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function isBreakItem(item: BroadcastItem): boolean {
  return (
    item.hiddenFromGuide ||
    item.type === "commercial" ||
    item.type === "bumper"
  );
}

function getSafeTargetTime(
  video: HTMLVideoElement,
  item: BroadcastItem,
  sourceElapsed: number,
): number {
  const sourceStart = getSourceStart(item);
  const sourceEnd = getSourceEnd(item);
  const videoDuration = Number.isFinite(video.duration) ? video.duration : 0;

  let target = Math.max(sourceStart, Math.floor(sourceElapsed));

  if (sourceEnd && sourceEnd > sourceStart) {
    target = Math.min(
      target,
      Math.max(sourceStart, sourceEnd - SOURCE_END_PADDING_SECONDS),
    );
  }

  if (videoDuration > 0) {
    target = Math.min(
      target,
      Math.max(0, videoDuration - SOURCE_END_PADDING_SECONDS),
    );
  }

  return Math.max(0, target);
}

function getErrorMessage(video: HTMLVideoElement): string {
  const code = video.error?.code;

  if (code === MediaError.MEDIA_ERR_NETWORK) {
    return "Network error loading this video. Check the R2 URL.";
  }

  if (code === MediaError.MEDIA_ERR_DECODE) {
    return "Video decode issue. Convert it to MP4 H.264/AAC.";
  }

  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "This video format is not supported by this browser.";
  }

  if (code === MediaError.MEDIA_ERR_ABORTED) {
    return "Playback was interrupted. Tap to resume.";
  }

  return "Playback failed. Check the video URL or encoding.";
}

function isIPhoneSafariFullscreenPath(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iPhone|iPod/i.test(navigator.userAgent);
}

function getFullscreenElement(): Element | null {
  const webkitDocument = document as WebKitDocument;

  return document.fullscreenElement ?? webkitDocument.webkitFullscreenElement ?? null;
}

async function exitElementFullscreen(): Promise<boolean> {
  const webkitDocument = document as WebKitDocument;

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return true;
    }

    if (webkitDocument.webkitFullscreenElement && webkitDocument.webkitExitFullscreen) {
      await webkitDocument.webkitExitFullscreen();
      return true;
    }

    if (webkitDocument.webkitFullscreenElement && webkitDocument.webkitCancelFullScreen) {
      webkitDocument.webkitCancelFullScreen();
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

async function requestElementFullscreen(element: HTMLElement): Promise<boolean> {
  const fullscreenElement = element as WebKitFullscreenElement;

  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen();
      return true;
    }

    if (fullscreenElement.webkitRequestFullscreen) {
      await fullscreenElement.webkitRequestFullscreen();
      return true;
    }

    if (fullscreenElement.webkitRequestFullScreen) {
      await fullscreenElement.webkitRequestFullScreen();
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function enterNativeVideoFullscreen(video: HTMLVideoElement): boolean {
  const webkitVideo = video as WebKitVideoElement;
  const enter =
    webkitVideo.webkitEnterFullscreen ?? webkitVideo.webkitEnterFullScreen;

  if (!enter) {
    return false;
  }

  if (webkitVideo.webkitSupportsFullscreen === false) {
    return false;
  }

  try {
    enter.call(webkitVideo);
    return true;
  } catch {
    return false;
  }
}

function exitNativeVideoFullscreen(video: HTMLVideoElement): boolean {
  const webkitVideo = video as WebKitVideoElement;
  const exit = webkitVideo.webkitExitFullscreen ?? webkitVideo.webkitExitFullScreen;

  if (!webkitVideo.webkitDisplayingFullscreen || !exit) {
    return false;
  }

  try {
    exit.call(webkitVideo);
    return true;
  } catch {
    return false;
  }
}

function sortChannelsByNumber(channels: Channel[]): Channel[] {
  return [...channels]
    .filter((channel) => channel.isEnabled !== false)
    .sort((a, b) => {
      const aNumber = Number(a.number ?? a.id);
      const bNumber = Number(b.number ?? b.id);

      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
        return aNumber - bNumber;
      }

      return String(a.id).localeCompare(String(b.id), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

function getChannelLabel(channel: Channel | undefined): string {
  if (!channel) {
    return "CH --";
  }

  return `CH ${channel.number ?? channel.id}`;
}

function configureVideoForAppPlayback(video: HTMLVideoElement): void {
  const castVideo = video as WebKitVideoElement;

  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("x5-playsinline", "true");
  video.setAttribute("x-webkit-airplay", "allow");

  castVideo.disableRemotePlayback = false;
}

async function requestPlaybackTarget(video: HTMLVideoElement): Promise<string> {
  const castVideo = video as WebKitVideoElement;

  try {
    if (castVideo.webkitShowPlaybackTargetPicker) {
      castVideo.webkitShowPlaybackTargetPicker();
      return "Opening AirPlay.";
    }

    if (castVideo.remote?.prompt) {
      await castVideo.remote.prompt();
      return "Opening TV playback picker.";
    }
  } catch {
    return "Could not open TV playback picker.";
  }

  return "TV casting is not available in this browser. On Apple, use AirPlay. On Samsung, use Smart View. On Android/Chrome, use Cast or screen mirroring.";
}

export default function Player({ schedule }: PlayerProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastPlaybackKeyRef = useRef("");
  const lastHardSyncRef = useRef(0);
  const handledFullscreenRequestRef = useRef(0);
  const fullscreenBusyRef = useRef(false);
  const sourceTransitionRef = useRef(false);
  const wakeLockRef = useRef<ScreenWakeLockSentinelLike | null>(null);
  const castMessageTimerRef = useRef<number | null>(null);
  const fullscreenBusyTimerRef = useRef<number | null>(null);

  const volume = usePlayerControls((state) => state.volume);
  const muted = usePlayerControls((state) => state.muted);
  const fitMode = usePlayerControls((state) => state.fitMode);
  const fullscreenRequestId = usePlayerControls(
    (state) => state.fullscreenRequestId,
  );

  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);
  const toggleGuide = useStore((state) => state.toggleGuide);

  const [nowMs, setNowMs] = useState(() => BROADCAST_EPOCH_MS);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [message, setMessage] = useState("");
  const [castMessage, setCastMessage] = useState("");
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const [isElementFullscreen, setIsElementFullscreen] = useState(false);
  const [isNativeVideoFullscreen, setIsNativeVideoFullscreen] = useState(false);

  const live = useMemo(() => getLiveState(schedule, nowMs), [schedule, nowMs]);
  const playbackKey = useMemo(() => getPlaybackKey(live.item), [live.item]);

  const orderedChannels = useMemo(() => sortChannelsByNumber(channels), [channels]);
  const currentChannel = useMemo(
    () => orderedChannels.find((channel) => channel.id === currentChannelId),
    [currentChannelId, orderedChannels],
  );

  const isBreak = Boolean(live.item && isBreakItem(live.item));
  const fullscreenActive =
    fallbackFullscreen || isElementFullscreen || isNativeVideoFullscreen;

  const clearCastMessageTimer = useCallback(() => {
    if (castMessageTimerRef.current) {
      window.clearTimeout(castMessageTimerRef.current);
      castMessageTimerRef.current = null;
    }
  }, []);

  const setTimedCastMessage = useCallback(
    (nextMessage: string) => {
      clearCastMessageTimer();
      setCastMessage(nextMessage);

      castMessageTimerRef.current = window.setTimeout(() => {
        setCastMessage("");
        castMessageTimerRef.current = null;
      }, CAST_MESSAGE_CLEAR_MS);
    },
    [clearCastMessageTimer],
  );

  const releaseFullscreenBusyLock = useCallback(() => {
    if (fullscreenBusyTimerRef.current) {
      window.clearTimeout(fullscreenBusyTimerRef.current);
    }

    fullscreenBusyTimerRef.current = window.setTimeout(() => {
      fullscreenBusyRef.current = false;
      fullscreenBusyTimerRef.current = null;
    }, FULLSCREEN_BUSY_UNLOCK_MS);
  }, []);

  const applyAudio = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.volume = Math.min(Math.max(volume, 0), 1);
    video.muted = muted || volume <= 0;
  }, [muted, volume]);

  const requestWakeLock = useCallback(async () => {
    if (typeof navigator === "undefined") {
      return;
    }

    const navigatorWithWakeLock = navigator as NavigatorWithWakeLock;

    if (!navigatorWithWakeLock.wakeLock?.request) {
      return;
    }

    if (wakeLockRef.current && wakeLockRef.current.released !== true) {
      return;
    }

    try {
      const wakeLock = await navigatorWithWakeLock.wakeLock.request("screen");

      wakeLock.addEventListener?.("release", () => {
        wakeLockRef.current = null;
      });

      wakeLockRef.current = wakeLock;
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    const wakeLock = wakeLockRef.current;

    if (!wakeLock) {
      return;
    }

    wakeLockRef.current = null;

    try {
      await wakeLock.release();
    } catch {
      // Wake lock may already be released by the browser.
    }
  }, []);

  const hardSyncPosition = useCallback(
    (options: { force?: boolean } = {}) => {
      const video = videoRef.current;
      const item = live.item;

      if (!video || !item || video.readyState < HTMLMediaElement.HAVE_METADATA) {
        return;
      }

      const target = getSafeTargetTime(video, item, live.sourceElapsed);
      const drift = Math.abs(video.currentTime - target);
      const now = Date.now();

      if (!options.force) {
        if (drift < HARD_SYNC_DRIFT_SECONDS) {
          return;
        }

        if (now - lastHardSyncRef.current < HARD_SYNC_COOLDOWN_MS) {
          return;
        }
      }

      try {
        video.currentTime = target;
        lastHardSyncRef.current = now;
      } catch {
        // Seeking can be rejected briefly while metadata settles.
      }
    },
    [live.item, live.sourceElapsed],
  );

  const tryPlay = useCallback(async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    try {
      configureVideoForAppPlayback(video);
      applyAudio();

      await video.play();

      setStatus("playing");
      setMessage("");
    } catch {
      setStatus("paused");
      setMessage("Tap to start playback.");
    }
  }, [applyAudio]);

  const loadCurrentSource = useCallback(() => {
    const video = videoRef.current;
    const item = live.item;

    if (!video || !item?.file) {
      setStatus("idle");
      setMessage("");
      return;
    }

    sourceTransitionRef.current = true;

    setStatus("loading");
    setMessage("");
    setCastMessage("");

    try {
      configureVideoForAppPlayback(video);
      applyAudio();

      video.pause();
      video.preload = "auto";
      video.src = item.file;
      video.load();
    } catch {
      setStatus("error");
      setMessage("Could not load this media source.");
    } finally {
      window.setTimeout(() => {
        sourceTransitionRef.current = false;
      }, SOURCE_TRANSITION_RELEASE_MS);
    }
  }, [applyAudio, live.item]);

  const resume = useCallback(() => {
    setNowMs(Date.now());
    hardSyncPosition({ force: true });
    void tryPlay();
  }, [hardSyncPosition, tryPlay]);

  const stepChannel = useCallback(
    (direction: "previous" | "next") => {
      if (orderedChannels.length === 0) {
        return;
      }

      const foundIndex = orderedChannels.findIndex(
        (channel) => channel.id === currentChannelId,
      );

      const currentIndex = foundIndex >= 0 ? foundIndex : 0;

      const nextIndex =
        direction === "next"
          ? (currentIndex + 1) % orderedChannels.length
          : (currentIndex - 1 + orderedChannels.length) % orderedChannels.length;

      const nextChannel = orderedChannels[nextIndex];

      if (nextChannel) {
        setChannel(nextChannel.id);
      }
    },
    [currentChannelId, orderedChannels, setChannel],
  );

  const exitFullscreenView = useCallback(async () => {
    const video = videoRef.current;

    if (video) {
      exitNativeVideoFullscreen(video);
    }

    await exitElementFullscreen();

    setFallbackFullscreen(false);
    setIsElementFullscreen(false);
    setIsNativeVideoFullscreen(false);
  }, []);

  const toggleFullscreenView = useCallback(async () => {
    if (fullscreenBusyRef.current) {
      return;
    }

    fullscreenBusyRef.current = true;

    const shell = shellRef.current;
    const video = videoRef.current;

    if (!shell || !video) {
      fullscreenBusyRef.current = false;
      return;
    }

    try {
      hardSyncPosition({ force: true });
      await tryPlay();

      if (fallbackFullscreen) {
        setFallbackFullscreen(false);
        setIsElementFullscreen(false);
        setIsNativeVideoFullscreen(false);
        releaseFullscreenBusyLock();
        return;
      }

      const nativeVideoExited = exitNativeVideoFullscreen(video);

      if (nativeVideoExited) {
        setFallbackFullscreen(false);
        setIsNativeVideoFullscreen(false);
        releaseFullscreenBusyLock();
        return;
      }

      if (getFullscreenElement()) {
        const didExit = await exitElementFullscreen();

        if (didExit) {
          setFallbackFullscreen(false);
          setIsElementFullscreen(false);
          releaseFullscreenBusyLock();
          return;
        }
      }

      if (isIPhoneSafariFullscreenPath()) {
        const didEnterNativeVideoFullscreen = enterNativeVideoFullscreen(video);

        if (didEnterNativeVideoFullscreen) {
          setFallbackFullscreen(false);
          setIsNativeVideoFullscreen(true);
          releaseFullscreenBusyLock();
          return;
        }

        setFallbackFullscreen(true);
        releaseFullscreenBusyLock();
        return;
      }

      const didEnterElementFullscreen = await requestElementFullscreen(shell);

      if (didEnterElementFullscreen) {
        setFallbackFullscreen(false);
        setIsElementFullscreen(true);
        releaseFullscreenBusyLock();
        return;
      }

      setFallbackFullscreen(true);
      releaseFullscreenBusyLock();
    } catch {
      setFallbackFullscreen((value) => !value);
      releaseFullscreenBusyLock();
    }
  }, [
    fallbackFullscreen,
    hardSyncPosition,
    releaseFullscreenBusyLock,
    tryPlay,
  ]);

  const openGuideFromFullscreen = useCallback(() => {
    void exitFullscreenView().finally(() => {
      toggleGuide();
    });
  }, [exitFullscreenView, toggleGuide]);

  const openPlaybackTarget = useCallback(async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const result = await requestPlaybackTarget(video);
    setTimedCastMessage(result);
  }, [setTimedCastMessage]);

  useEffect(() => {
    setNowMs(Date.now());

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, LIVE_TICK_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    configureVideoForAppPlayback(video);
  }, []);

  useEffect(() => {
    applyAudio();
  }, [applyAudio]);

  useEffect(() => {
    const video = videoRef.current;
    const item = live.item;

    if (!video || !item) {
      setStatus("idle");
      setMessage("");
      return;
    }

    if (lastPlaybackKeyRef.current !== playbackKey) {
      lastPlaybackKeyRef.current = playbackKey;
      loadCurrentSource();
    }
  }, [live.item, loadCurrentSource, playbackKey]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    configureVideoForAppPlayback(video);

    const handleLoadedMetadata = () => {
      hardSyncPosition({ force: true });
      void tryPlay();
    };

    const handleCanPlay = () => {
      if (!video.paused) {
        setStatus("playing");
        setMessage("");
      }
    };

    const handlePlaying = () => {
      setStatus("playing");
      setMessage("");
    };

    const handleWaiting = () => {
      setStatus((current) => (current === "loading" ? "loading" : "playing"));
    };

    const handlePause = () => {
      if (sourceTransitionRef.current) {
        return;
      }

      if (document.visibilityState === "visible") {
        setStatus("paused");
      }
    };

    const handleError = () => {
      setStatus("error");
      setMessage(getErrorMessage(video));
    };

    const handleEnded = () => {
      setNowMs(Date.now());
      hardSyncPosition({ force: true });
      void tryPlay();
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("pause", handlePause);
    video.addEventListener("error", handleError);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("error", handleError);
      video.removeEventListener("ended", handleEnded);
    };
  }, [hardSyncPosition, tryPlay]);

  useEffect(() => {
    if (status === "playing") {
      hardSyncPosition();
    }
  }, [hardSyncPosition, nowMs, status]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !live.item) {
      return;
    }

    const sourceEnd = getSourceEnd(live.item);

    if (!sourceEnd || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    if (video.currentTime >= sourceEnd - SOURCE_END_PADDING_SECONDS) {
      setNowMs(Date.now());
      hardSyncPosition({ force: true });
    }
  }, [hardSyncPosition, live.item, nowMs]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setNowMs(Date.now());
        hardSyncPosition({ force: true });
        void tryPlay();

        if (fullscreenActive && status === "playing") {
          void requestWakeLock();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    fullscreenActive,
    hardSyncPosition,
    requestWakeLock,
    status,
    tryPlay,
  ]);

  useEffect(() => {
    if (fullscreenRequestId === 0) {
      return;
    }

    if (handledFullscreenRequestRef.current === fullscreenRequestId) {
      return;
    }

    handledFullscreenRequestRef.current = fullscreenRequestId;
    void toggleFullscreenView();
  }, [fullscreenRequestId, toggleFullscreenView]);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "ttv-fallback-fullscreen-active",
      fallbackFullscreen,
    );
    document.body.classList.toggle("ttv-scroll-locked", fallbackFullscreen);

    return () => {
      document.documentElement.classList.remove("ttv-fallback-fullscreen-active");
      document.body.classList.remove("ttv-scroll-locked");
    };
  }, [fallbackFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(getFullscreenElement());

      setIsElementFullscreen(active);

      if (active) {
        setFallbackFullscreen(false);
      }

      setNowMs(Date.now());
      hardSyncPosition({ force: true });
      void tryPlay();
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
    };
  }, [hardSyncPosition, tryPlay]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    configureVideoForAppPlayback(video);

    const handleNativeVideoFullscreenStart = () => {
      setIsNativeVideoFullscreen(true);
      setFallbackFullscreen(false);
      setNowMs(Date.now());
      hardSyncPosition({ force: true });
      void tryPlay();
    };

    const handleNativeVideoFullscreenEnd = () => {
      setIsNativeVideoFullscreen(false);
      setFallbackFullscreen(false);
      setNowMs(Date.now());
      hardSyncPosition({ force: true });
      void tryPlay();
    };

    video.addEventListener(
      "webkitbeginfullscreen",
      handleNativeVideoFullscreenStart,
    );
    video.addEventListener(
      "webkitendfullscreen",
      handleNativeVideoFullscreenEnd,
    );

    return () => {
      video.removeEventListener(
        "webkitbeginfullscreen",
        handleNativeVideoFullscreenStart,
      );
      video.removeEventListener(
        "webkitendfullscreen",
        handleNativeVideoFullscreenEnd,
      );
    };
  }, [hardSyncPosition, tryPlay]);

  useEffect(() => {
    if (fullscreenActive && status === "playing") {
      void requestWakeLock();
      return;
    }

    void releaseWakeLock();
  }, [fullscreenActive, releaseWakeLock, requestWakeLock, status]);

  useEffect(() => {
    return () => {
      clearCastMessageTimer();

      if (fullscreenBusyTimerRef.current) {
        window.clearTimeout(fullscreenBusyTimerRef.current);
      }

      void releaseWakeLock();

      const video = videoRef.current;

      if (!video) {
        return;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [clearCastMessageTimer, releaseWakeLock]);

  if (!live.item) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-black px-6 text-center"
        style={{ color: "var(--text)" }}
      >
        <div>
          <div className="text-lg font-semibold">No media scheduled</div>
          <div className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Add media to this channel from the admin panel.
          </div>
        </div>
      </div>
    );
  }

  const title = getDisplayTitle(live.item);
  const itemDuration = getSafeItemDuration(live.item);

  return (
    <div
      ref={shellRef}
      className={`ttv-player-shell group relative h-full w-full bg-black ${
        fallbackFullscreen ? "ttv-player-expanded" : ""
      }`}
    >
      <video
        ref={videoRef}
        playsInline
        autoPlay
        preload="auto"
        controls={false}
        muted={muted || volume <= 0}
        className="h-full w-full bg-black"
        style={{
          objectFit: fitMode,
        }}
      />

      <button
        type="button"
        onClick={resume}
        className="absolute inset-0 z-[1] cursor-default"
        aria-label="Resume playback"
        tabIndex={-1}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 py-3 opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100">
        <div className="max-w-[70%] truncate text-sm font-semibold text-white drop-shadow">
          {isBreak ? "Commercial Break" : title}
        </div>

        <div className="mt-1 text-xs text-white/70">
          {formatTime(live.elapsed)} / {formatTime(itemDuration)}
          {live.item.segmentLabel && !isBreak ? ` / ${live.item.segmentLabel}` : ""}
        </div>
      </div>

      <div className="absolute bottom-3 left-1/2 z-30 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/10 bg-black/75 px-2 py-2 text-white opacity-100 shadow-2xl backdrop-blur-md transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            stepChannel("previous");
          }}
          className="ttv-touch-target rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] transition hover:bg-white/15"
        >
          CH -
        </button>

        <div className="hidden min-w-[4.5rem] rounded-xl bg-white/10 px-3 py-2 text-center text-[11px] font-black uppercase tracking-[0.1em] sm:block">
          {getChannelLabel(currentChannel)}
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            stepChannel("next");
          }}
          className="ttv-touch-target rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] transition hover:bg-white/15"
        >
          CH +
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openGuideFromFullscreen();
          }}
          className="ttv-touch-target rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] transition hover:bg-white/15"
        >
          Guide
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void toggleFullscreenView();
          }}
          className="ttv-touch-target rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] transition hover:bg-white/15"
        >
          Full
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void openPlaybackTarget();
          }}
          className="ttv-touch-target rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] transition hover:bg-white/15"
        >
          Cast
        </button>

        {fullscreenActive ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void exitFullscreenView();
            }}
            className="ttv-touch-target rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] transition hover:bg-white/15"
          >
            Exit
          </button>
        ) : null}
      </div>

      {castMessage ? (
        <div className="pointer-events-none absolute bottom-[5.8rem] left-1/2 z-40 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-xl border border-white/15 bg-black/80 px-3 py-2 text-center text-xs font-semibold text-white shadow-2xl backdrop-blur-md">
          {castMessage}
        </div>
      ) : null}

      {status === "loading" ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/10 bg-black/65 px-4 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-md">
          Loading channel...
        </div>
      ) : null}

      {message ? (
        <button
          type="button"
          onClick={resume}
          className="absolute left-1/2 top-1/2 z-40 max-w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-black/80 px-4 py-3 text-center text-sm font-semibold text-white shadow-2xl backdrop-blur-md transition hover:bg-black/90"
        >
          {message}
        </button>
      ) : null}

      <div
        className="pointer-events-none absolute left-3 top-16 z-10 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/70 opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden="true"
      >
        {status}
      </div>
    </div>
  );
}