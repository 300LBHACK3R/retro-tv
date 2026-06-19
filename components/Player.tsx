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
const SOURCE_END_PADDING_SECONDS = 0.4;
const FULLSCREEN_BUSY_UNLOCK_MS = 900;

const PULSE_COUNTS_STORAGE_KEY = "tatestv:pulse-counts:v1";
const PULSE_REACTIONS_STORAGE_KEY = "tatestv:pulse-user-reactions:v1";

const PULSE_REACTIONS = [
  {
    id: "fire",
    emoji: "🔥",
    label: "Fire",
  },
  {
    id: "funny",
    emoji: "😂",
    label: "Funny",
  },
  {
    id: "nostalgia",
    emoji: "📼",
    label: "Nostalgia",
  },
  {
    id: "classic",
    emoji: "⭐",
    label: "Classic",
  },
  {
    id: "faith",
    emoji: "🙏",
    label: "Faith Pick",
  },
] as const;

type PulseReactionId = (typeof PULSE_REACTIONS)[number]["id"];
type PulseCountsByMedia = Record<string, Partial<Record<PulseReactionId, number>>>;
type PulseUserReactions = Record<string, PulseReactionId>;

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

function isBreakItem(item: BroadcastItem): boolean {
  return (
    item.hiddenFromGuide ||
    item.type === "commercial" ||
    item.type === "bumper"
  );
}

function getPulseMediaKey(item: BroadcastItem | null): string {
  if (!item) {
    return "empty";
  }

  return cleanDisplayText(item.parentMediaId || item.id || item.title || "media");
}

function isPulseReactionId(value: unknown): value is PulseReactionId {
  return PULSE_REACTIONS.some((reaction) => reaction.id === value);
}

function readLocalJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local engagement storage is best-effort.
  }
}

function getReactionCount(
  counts: PulseCountsByMedia,
  mediaKey: string,
  reactionId: PulseReactionId,
): number {
  const value = counts[mediaKey]?.[reactionId];

  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function getTotalPulseCount(
  counts: PulseCountsByMedia,
  mediaKey: string,
): number {
  return PULSE_REACTIONS.reduce((total, reaction) => {
    return total + getReactionCount(counts, mediaKey, reaction.id);
  }, 0);
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

      return String(a.id).localeCompare(String(b.id));
    });
}

function getChannelLabel(channel: Channel | undefined): string {
  if (!channel) {
    return "CH --";
  }

  return `CH ${channel.number ?? channel.id}`;
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

  return "AirPlay or remote playback is not available in this browser.";
}

export default function Player({ schedule }: PlayerProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastPlaybackKeyRef = useRef("");
  const lastHardSyncRef = useRef(0);
  const handledFullscreenRequestRef = useRef(0);
  const fullscreenBusyRef = useRef(false);
  const wakeLockRef = useRef<ScreenWakeLockSentinelLike | null>(null);

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
  const [isPulseOpen, setIsPulseOpen] = useState(true);
  const [pulseCounts, setPulseCounts] = useState<PulseCountsByMedia>(() =>
    readLocalJson<PulseCountsByMedia>(PULSE_COUNTS_STORAGE_KEY, {}),
  );
  const [pulseUserReactions, setPulseUserReactions] =
    useState<PulseUserReactions>(() =>
      readLocalJson<PulseUserReactions>(PULSE_REACTIONS_STORAGE_KEY, {}),
    );

  const live = useMemo(() => getLiveState(schedule, nowMs), [schedule, nowMs]);
  const playbackKey = useMemo(() => getPlaybackKey(live.item), [live.item]);

  const orderedChannels = useMemo(() => sortChannelsByNumber(channels), [channels]);
  const currentChannel = useMemo(
    () => orderedChannels.find((channel) => channel.id === currentChannelId),
    [currentChannelId, orderedChannels],
  );

  const pulseMediaKey = useMemo(() => getPulseMediaKey(live.item), [live.item]);
  const selectedPulseReaction = pulseUserReactions[pulseMediaKey];
  const totalPulseCount = getTotalPulseCount(pulseCounts, pulseMediaKey);
  const isBreak = Boolean(live.item && isBreakItem(live.item));
  const fullscreenActive =
    fallbackFullscreen || isElementFullscreen || isNativeVideoFullscreen;

  const applyAudio = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.volume = Math.min(Math.max(volume, 0), 1);
    video.muted = muted || volume <= 0;
  }, [muted, volume]);

  const requestWakeLock = useCallback(async () => {
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

  const hardSyncPosition = useCallback(() => {
    const video = videoRef.current;
    const item = live.item;

    if (!video || !item || video.readyState < HTMLMediaElement.HAVE_METADATA) {
      return;
    }

    const target = getSafeTargetTime(video, item, live.sourceElapsed);
    const drift = Math.abs(video.currentTime - target);
    const now = Date.now();

    if (drift < HARD_SYNC_DRIFT_SECONDS && now - lastHardSyncRef.current < 8000) {
      return;
    }

    try {
      video.currentTime = target;
      lastHardSyncRef.current = now;
    } catch {
      // Seeking can be rejected briefly while metadata settles.
    }
  }, [live.item, live.sourceElapsed]);

  const tryPlay = useCallback(async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    try {
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

    setStatus("loading");
    setMessage("");
    setCastMessage("");

    try {
      video.pause();
      video.preload = "auto";
      video.src = item.file;
      video.load();
    } catch {
      setStatus("error");
      setMessage("Could not load this media source.");
    }
  }, [live.item]);

  const resume = useCallback(() => {
    setNowMs(Date.now());
    hardSyncPosition();
    void tryPlay();
  }, [hardSyncPosition, tryPlay]);

  const stepChannel = useCallback(
    (direction: "previous" | "next") => {
      if (orderedChannels.length === 0) {
        return;
      }

      const currentIndex = Math.max(
        0,
        orderedChannels.findIndex((channel) => channel.id === currentChannelId),
      );

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
    setCastMessage(result);

    window.setTimeout(() => {
      setCastMessage("");
    }, 3500);
  }, []);

  const reactToCurrentProgram = useCallback(
    (reactionId: PulseReactionId) => {
      const item = live.item;

      if (!item || isBreakItem(item)) {
        return;
      }

      const mediaKey = getPulseMediaKey(item);
      const previousReaction = pulseUserReactions[mediaKey];

      if (previousReaction === reactionId) {
        return;
      }

      setPulseCounts((currentCounts) => {
        const currentMediaCounts = currentCounts[mediaKey] ?? {};
        const nextMediaCounts: Partial<Record<PulseReactionId, number>> = {
          ...currentMediaCounts,
        };

        if (previousReaction && isPulseReactionId(previousReaction)) {
          nextMediaCounts[previousReaction] = Math.max(
            0,
            getReactionCount(currentCounts, mediaKey, previousReaction) - 1,
          );
        }

        nextMediaCounts[reactionId] =
          getReactionCount(currentCounts, mediaKey, reactionId) + 1;

        return {
          ...currentCounts,
          [mediaKey]: nextMediaCounts,
        };
      });

      setPulseUserReactions((current) => ({
        ...current,
        [mediaKey]: reactionId,
      }));
    },
    [live.item, pulseUserReactions],
  );

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

    const castVideo = video as WebKitVideoElement;

    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.setAttribute("x5-playsinline", "true");
    video.setAttribute("x-webkit-airplay", "allow");
    castVideo.disableRemotePlayback = false;
  }, []);

  useEffect(() => {
    writeLocalJson(PULSE_COUNTS_STORAGE_KEY, pulseCounts);
  }, [pulseCounts]);

  useEffect(() => {
    writeLocalJson(PULSE_REACTIONS_STORAGE_KEY, pulseUserReactions);
  }, [pulseUserReactions]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PULSE_COUNTS_STORAGE_KEY) {
        setPulseCounts(
          readLocalJson<PulseCountsByMedia>(PULSE_COUNTS_STORAGE_KEY, {}),
        );
      }

      if (event.key === PULSE_REACTIONS_STORAGE_KEY) {
        setPulseUserReactions(
          readLocalJson<PulseUserReactions>(PULSE_REACTIONS_STORAGE_KEY, {}),
        );
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
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

    const handleLoadedMetadata = () => {
      hardSyncPosition();
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
      hardSyncPosition();
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
      hardSyncPosition();
    }
  }, [hardSyncPosition, live.item, nowMs]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setNowMs(Date.now());
        hardSyncPosition();
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

    if (fullscreenBusyRef.current) {
      return;
    }

    handledFullscreenRequestRef.current = fullscreenRequestId;
    fullscreenBusyRef.current = true;

    const shell = shellRef.current;
    const video = videoRef.current;

    if (!shell || !video) {
      fullscreenBusyRef.current = false;
      return;
    }

    const releaseBusyLock = () => {
      window.setTimeout(() => {
        fullscreenBusyRef.current = false;
      }, FULLSCREEN_BUSY_UNLOCK_MS);
    };

    const run = async () => {
      hardSyncPosition();
      await tryPlay();

      const nativeVideoExited = exitNativeVideoFullscreen(video);

      if (nativeVideoExited) {
        setFallbackFullscreen(false);
        setIsNativeVideoFullscreen(false);
        releaseBusyLock();
        return;
      }

      if (getFullscreenElement()) {
        const didExit = await exitElementFullscreen();

        if (didExit) {
          setFallbackFullscreen(false);
          setIsElementFullscreen(false);
          releaseBusyLock();
          return;
        }
      }

      if (isIPhoneSafariFullscreenPath()) {
        const didEnterNativeVideoFullscreen = enterNativeVideoFullscreen(video);

        if (didEnterNativeVideoFullscreen) {
          setFallbackFullscreen(false);
          setIsNativeVideoFullscreen(true);
          releaseBusyLock();
          return;
        }

        setFallbackFullscreen((value) => !value);
        releaseBusyLock();
        return;
      }

      const didEnterElementFullscreen = await requestElementFullscreen(shell);

      if (didEnterElementFullscreen) {
        setFallbackFullscreen(false);
        setIsElementFullscreen(true);
        releaseBusyLock();
        return;
      }

      setFallbackFullscreen((value) => !value);
      releaseBusyLock();
    };

    void run();
  }, [fullscreenRequestId, hardSyncPosition, tryPlay]);

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
      hardSyncPosition();
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

    const handleNativeVideoFullscreenStart = () => {
      setIsNativeVideoFullscreen(true);
      setFallbackFullscreen(false);
      setNowMs(Date.now());
      hardSyncPosition();
      void tryPlay();
    };

    const handleNativeVideoFullscreenEnd = () => {
      setIsNativeVideoFullscreen(false);
      setFallbackFullscreen(false);
      setNowMs(Date.now());
      hardSyncPosition();
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
      void releaseWakeLock();

      const video = videoRef.current;

      if (!video) {
        return;
      }

      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [releaseWakeLock]);

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
        <div className="flex max-w-full flex-wrap items-center gap-2 text-white drop-shadow">
          <div className="max-w-[70%] truncate text-sm font-semibold">
            {isBreak ? "Commercial Break" : title}
          </div>

          {!isBreak && totalPulseCount > 0 ? (
            <div className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/80 backdrop-blur-md">
              Pulse {totalPulseCount}
            </div>
          ) : null}
        </div>

        <div className="mt-1 text-xs text-white/70">
          {formatTime(live.elapsed)} / {formatTime(live.item.duration)}
          {live.item.segmentLabel && !isBreak ? ` / ${live.item.segmentLabel}` : ""}
        </div>
      </div>

      {!isBreak && isPulseOpen ? (
        <div className="absolute bottom-20 left-1/2 z-30 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/70 px-2 py-2 shadow-2xl backdrop-blur-md md:bottom-16">
          {PULSE_REACTIONS.map((reaction) => {
            const count = getReactionCount(pulseCounts, pulseMediaKey, reaction.id);
            const active = selectedPulseReaction === reaction.id;

            return (
              <button
                key={reaction.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  reactToCurrentProgram(reaction.id);
                }}
                className="ttv-touch-target rounded-full border px-2.5 py-1.5 text-xs font-black text-white transition hover:scale-105"
                style={{
                  borderColor: active
                    ? "var(--primary)"
                    : "rgba(255,255,255,0.14)",
                  background: active
                    ? "color-mix(in srgb, var(--primary) 34%, rgba(0,0,0,0.72))"
                    : "rgba(255,255,255,0.08)",
                }}
                aria-label={`React ${reaction.label}`}
                title={reaction.label}
              >
                <span className="mr-1">{reaction.emoji}</span>
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      ) : null}

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
            setIsPulseOpen((value) => !value);
          }}
          className="ttv-touch-target rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] transition hover:bg-white/15"
        >
          React
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void openPlaybackTarget();
          }}
          className="ttv-touch-target rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] transition hover:bg-white/15"
        >
          TV
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