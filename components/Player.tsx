"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BROADCAST_EPOCH_MS, getLiveState } from "@/lib/liveEngine";
import { useGoogleCast, type CastQueueEntry } from "@/components/GoogleCastProvider";
import WatchOnTVModal from "@/components/WatchOnTVModal";
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
const CONTROLS_HIDE_DELAY_MS = 3500;

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

function getPublicProgramKey(item: BroadcastItem): string {
  return (
    item.parentMediaId?.trim() ||
    item.sourceTitle?.trim() ||
    item.id
  );
}

function isPublicProgramItem(
  item: BroadcastItem | undefined,
): item is BroadcastItem {
  return Boolean(
    item &&
      item.file &&
      getSafeItemDuration(item) > 0 &&
      !isBreakItem(item),
  );
}

function getPreviousPublicProgramIndex(
  schedule: BroadcastItem[],
  fromIndex: number,
): number {
  for (let offset = 1; offset <= schedule.length; offset += 1) {
    const index =
      (fromIndex - offset + schedule.length) %
      schedule.length;

    if (isPublicProgramItem(schedule[index])) {
      return index;
    }
  }

  return -1;
}

function getPublicBlockStartIndex(
  schedule: BroadcastItem[],
  contextIndex: number,
): number {
  const contextItem = schedule[contextIndex];

  if (!contextItem || schedule.length === 0) {
    return contextIndex;
  }

  const contextKey = getPublicProgramKey(contextItem);
  let index = contextIndex;

  for (let guard = 0; guard < schedule.length; guard += 1) {
    const candidate = schedule[index];

    if (
      candidate &&
      isPublicProgramItem(candidate) &&
      getPublicProgramKey(candidate) === contextKey
    ) {
      const sourceStart = Math.max(
        0,
        Math.floor(Number(candidate.sourceStart ?? 0)),
      );

      if (sourceStart === 0) {
        return index;
      }
    }

    index =
      (index - 1 + schedule.length) % schedule.length;
  }

  return contextIndex;
}

function getPublicPlaybackTimeline(
  schedule: BroadcastItem[],
  currentIndex: number,
  currentItemElapsed: number,
): {
  item: BroadcastItem;
  elapsed: number;
  duration: number;
} | null {
  const currentItem = schedule[currentIndex];

  if (!currentItem) {
    return null;
  }

  const contextIndex = isBreakItem(currentItem)
    ? getPreviousPublicProgramIndex(schedule, currentIndex)
    : currentIndex;

  const contextItem = schedule[contextIndex];

  if (!contextItem) {
    return null;
  }

  const blockStartIndex = getPublicBlockStartIndex(
    schedule,
    contextIndex,
  );

  let elapsed = 0;
  let index = blockStartIndex;
  let guard = 0;

  while (
    index !== currentIndex &&
    guard < schedule.length
  ) {
    const item = schedule[index];

    if (!item) {
      break;
    }

    elapsed += getSafeItemDuration(item);
    index = (index + 1) % schedule.length;
    guard += 1;
  }

  if (index === currentIndex) {
    elapsed += Math.max(
      0,
      Math.floor(currentItemElapsed),
    );
  }

  const guideDuration = Math.floor(
    Number(contextItem.guideDuration),
  );

  const duration =
    Number.isFinite(guideDuration) && guideDuration > 0
      ? guideDuration
      : getSafeItemDuration(contextItem);

  return {
    item: contextItem,
    elapsed: Math.min(elapsed, duration),
    duration,
  };
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

async function requestAirPlayTarget(video: HTMLVideoElement): Promise<string> {
  const castVideo = video as WebKitVideoElement;

  try {
    if (castVideo.webkitShowPlaybackTargetPicker) {
      castVideo.webkitShowPlaybackTargetPicker();
      return "Opening AirPlay.";
    }

    if (castVideo.remote?.prompt) {
      await castVideo.remote.prompt();
      return "Opening the browser TV playback picker.";
    }
  } catch {
    return "Could not open TV playback picker.";
  }

  return "AirPlay is not available in this browser. Use Google Cast, TV Mode, screen mirroring, or HDMI instead.";
}


const CAST_QUEUE_MAX_ITEMS = 180;
const CAST_QUEUE_MAX_SECONDS = 8 * 60 * 60;

function getCastMimeType(item: BroadcastItem): string {
  const explicit = item.mimeType?.trim();

  if (explicit) {
    return explicit;
  }

  const cleanUrl = item.file.split("?")[0]?.toLowerCase() ?? "";

  if (cleanUrl.endsWith(".m3u8")) {
    return "application/x-mpegURL";
  }

  if (cleanUrl.endsWith(".webm")) {
    return "video/webm";
  }

  if (cleanUrl.endsWith(".mp3")) {
    return "audio/mpeg";
  }

  if (cleanUrl.endsWith(".m4a")) {
    return "audio/mp4";
  }

  return "video/mp4";
}

function getAbsoluteAssetUrl(value: string | undefined): string | undefined {
  const cleanValue = value?.trim();

  if (!cleanValue) {
    return undefined;
  }

  try {
    return new URL(cleanValue, window.location.origin).toString();
  } catch {
    return undefined;
  }
}

function buildCastQueueEntries(
  schedule: BroadcastItem[],
  currentIndex: number,
  currentElapsed: number,
  currentSourceElapsed: number,
  channelName: string,
): CastQueueEntry[] {
  if (schedule.length === 0 || currentIndex < 0) {
    return [];
  }

  const entries: CastQueueEntry[] = [];
  let queuedSeconds = 0;

  for (let offset = 0; offset < CAST_QUEUE_MAX_ITEMS; offset += 1) {
    if (queuedSeconds >= CAST_QUEUE_MAX_SECONDS) {
      break;
    }

    const index = (currentIndex + offset) % schedule.length;
    const item = schedule[index];

    if (!item?.file || getSafeItemDuration(item) <= 0) {
      continue;
    }

    const firstItem = offset === 0;
    const itemDuration = getSafeItemDuration(item);
    const playbackDuration = firstItem
      ? Math.max(1, itemDuration - Math.max(0, currentElapsed))
      : itemDuration;
    const startTime = firstItem
      ? Math.max(0, currentSourceElapsed)
      : getSourceStart(item);

    const mediaUrl = getAbsoluteAssetUrl(item.file);

    if (!mediaUrl) {
      continue;
    }

    entries.push({
      id: `${item.id}-${index}-${offset}`,
      url: mediaUrl,
      mimeType: getCastMimeType(item),
      title: getDisplayTitle(item),
      subtitle: `${channelName}${item.segmentLabel ? ` • ${item.segmentLabel}` : ""}`,
      poster: getAbsoluteAssetUrl(item.poster),
      startTime,
      playbackDuration,
    });

    queuedSeconds += playbackDuration;
  }

  return entries;
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
  const controlsHideTimerRef = useRef<number | null>(null);
  const lastCastQueueKeyRef = useRef("");
  const wasCastingRef = useRef(false);
  const isCastingRef = useRef(false);

  const volume = usePlayerControls((state) => state.volume);
  const muted = usePlayerControls((state) => state.muted);
  const fitMode = usePlayerControls((state) => state.fitMode);
  const {
    remote: castRemote,
    deviceName: castDeviceName,
    loadQueue: loadCastQueue,
  } = useGoogleCast();

  isCastingRef.current = castRemote.isConnected;

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
  const [watchOnTvOpen, setWatchOnTvOpen] = useState(false);
  const [castSyncRequestId, setCastSyncRequestId] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);

  const live = useMemo(() => getLiveState(schedule, nowMs), [schedule, nowMs]);
  const liveRef = useRef(live);
  liveRef.current = live;

  const playbackKey = useMemo(() => getPlaybackKey(live.item), [live.item]);
  const scheduleSignature = useMemo(
    () => schedule.map((item) => getPlaybackKey(item)).join("~"),
    [schedule],
  );

  const orderedChannels = useMemo(() => sortChannelsByNumber(channels), [channels]);
  const currentChannel = useMemo(
    () => orderedChannels.find((channel) => channel.id === currentChannelId),
    [currentChannelId, orderedChannels],
  );

  const isBreak = Boolean(live.item && isBreakItem(live.item));
  const fullscreenActive =
    fallbackFullscreen || isElementFullscreen || isNativeVideoFullscreen;

  const clearControlsHideTimer = useCallback(() => {
    if (controlsHideTimerRef.current !== null) {
      window.clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
    clearControlsHideTimer();

    if (status !== "playing" || watchOnTvOpen) {
      setControlsVisible(true);
      return;
    }

    controlsHideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      controlsHideTimerRef.current = null;
    }, CONTROLS_HIDE_DELAY_MS);
  }, [clearControlsHideTimer, status, watchOnTvOpen]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  useEffect(() => {
    if (status === "playing" && !watchOnTvOpen) {
      scheduleControlsHide();
    } else {
      clearControlsHideTimer();
      setControlsVisible(true);
    }

    return clearControlsHideTimer;
  }, [
    clearControlsHideTimer,
    scheduleControlsHide,
    status,
    watchOnTvOpen,
  ]);

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

      if (castRemote.isConnected) {
        return;
      }

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
    [castRemote.isConnected, live.item, live.sourceElapsed],
  );

  const tryPlay = useCallback(async () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (castRemote.isConnected) {
      video.pause();
      setStatus("playing");
      setMessage("");
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
  }, [applyAudio, castRemote.isConnected]);

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

  const openAirPlayTarget = useCallback(async (): Promise<string> => {
    const video = videoRef.current;

    if (!video) {
      return "The video player is not ready yet.";
    }

    const result = await requestAirPlayTarget(video);
    setTimedCastMessage(result);
    return result;
  }, [setTimedCastMessage]);

  const requestCastLiveSync = useCallback(() => {
    lastCastQueueKeyRef.current = "";
    setTimedCastMessage("Resyncing the live channel on your TV...");
    setCastSyncRequestId((value) => value + 1);
  }, [setTimedCastMessage]);

  useEffect(() => {
    const video = videoRef.current;

    if (!castRemote.isConnected) {
      lastCastQueueKeyRef.current = "";

      if (wasCastingRef.current) {
        wasCastingRef.current = false;
        setNowMs(Date.now());
        loadCurrentSource();
      }

      return;
    }

    wasCastingRef.current = true;
    video?.pause();
    setStatus("playing");
    setMessage("");

    const channelName = currentChannel?.branding?.displayName ?? currentChannel?.name ?? "Tate's TV";
    const queueKey = `${currentChannelId}|${scheduleSignature}|${playbackKey}`;

    if (lastCastQueueKeyRef.current === queueKey) {
      return;
    }

    const castLive = liveRef.current;
    const entries = buildCastQueueEntries(
      schedule,
      castLive.index,
      castLive.elapsed,
      castLive.sourceElapsed,
      `${getChannelLabel(currentChannel)} • ${channelName}`,
    );

    if (entries.length === 0) {
      setTimedCastMessage("Nothing is scheduled to send to the TV.");
      return;
    }

    lastCastQueueKeyRef.current = queueKey;

    void loadCastQueue({
      entries,
      queueName: `${getChannelLabel(currentChannel)} • ${channelName}`,
      queueDescription: "Tate's TV live scheduled channel",
      channelId: currentChannelId,
    }).then((loaded) => {
      if (loaded) {
        setTimedCastMessage(
          `Playing on ${castDeviceName || "your TV"}.`,
        );
        return;
      }

      lastCastQueueKeyRef.current = "";
      setTimedCastMessage("The TV connected, but the live channel could not be loaded.");
    });
  }, [
    castDeviceName,
    castRemote.isConnected,
    castSyncRequestId,
    currentChannel,
    currentChannelId,
    loadCastQueue,
    loadCurrentSource,
    playbackKey,
    schedule,
    scheduleSignature,
    setTimedCastMessage,
  ]);

  useEffect(() => {
    if (!castRemote.isConnected) {
      return;
    }

    const video = videoRef.current;
    video?.pause();
  }, [castRemote.isConnected]);

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

    if (castRemote.isConnected) {
      lastPlaybackKeyRef.current = playbackKey;
      video.pause();
      return;
    }

    if (lastPlaybackKeyRef.current !== playbackKey) {
      lastPlaybackKeyRef.current = playbackKey;
      loadCurrentSource();
    }
  }, [castRemote.isConnected, live.item, loadCurrentSource, playbackKey]);

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
      if (sourceTransitionRef.current || isCastingRef.current) {
        return;
      }

      if (document.visibilityState === "visible") {
        setStatus("paused");
      }
    };

    const handleError = () => {
      if (isCastingRef.current) {
        return;
      }

      setStatus("error");
      setMessage(getErrorMessage(video));
    };

    const handleEnded = () => {
      if (isCastingRef.current) {
        return;
      }

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
      clearControlsHideTimer();

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
  }, [clearCastMessageTimer, clearControlsHideTimer, releaseWakeLock]);

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

  const publicTimeline = getPublicPlaybackTimeline(
    schedule,
    live.index,
    live.elapsed,
  );

  const publicDisplayItem =
    publicTimeline?.item ?? live.item;

  const title = getDisplayTitle(publicDisplayItem);

  const itemDuration =
    publicTimeline?.duration ??
    getSafeItemDuration(publicDisplayItem);

  const displayElapsed =
    publicTimeline?.elapsed ?? live.elapsed;

  return (
    <div
      ref={shellRef}
      className={`ttv-player-shell group relative h-full w-full bg-black ${
        fallbackFullscreen ? "ttv-player-expanded" : ""
      }`}
      data-controls-visible={controlsVisible ? "true" : "false"}
      onPointerDown={revealControls}
      onPointerMove={revealControls}
      onTouchStart={revealControls}
      onFocusCapture={revealControls}
      onKeyDown={revealControls}
      onMouseLeave={scheduleControlsHide}
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

      <div
        className={`pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 py-3 transition-opacity duration-300 md:group-hover:opacity-100 ${
          controlsVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="max-w-[70%] truncate text-sm font-semibold text-white drop-shadow">
          {title}
        </div>

        <div className="mt-1 text-xs text-white/70">
          {formatTime(displayElapsed)} / {formatTime(itemDuration)}
          {live.item.segmentLabel && !isBreak ? ` / ${live.item.segmentLabel}` : ""}
        </div>
      </div>

      <div
        className={`absolute bottom-3 left-1/2 z-30 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/10 bg-black/75 px-2 py-2 text-white shadow-2xl backdrop-blur-md transition-[opacity,transform] duration-300 md:group-hover:pointer-events-auto md:group-hover:translate-y-0 md:group-hover:opacity-100 ${
          controlsVisible
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0"
        }`}
      >
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
            setWatchOnTvOpen(true);
          }}
          className="ttv-touch-target rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] transition hover:bg-white/15"
        >
          Watch on TV
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

      {castRemote.isConnected ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setWatchOnTvOpen(true);
          }}
          className="absolute right-3 top-3 z-40 max-w-[calc(100%-1.5rem)] rounded-full border border-emerald-300/30 bg-emerald-300/15 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 shadow-xl backdrop-blur-md transition hover:bg-emerald-300/20"
        >
          Playing on {castDeviceName || "TV"}
        </button>
      ) : null}

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

      <WatchOnTVModal
        open={watchOnTvOpen}
        onClose={() => {
          setWatchOnTvOpen(false);
          revealControls();
        }}
        onAirPlay={openAirPlayTarget}
        onPreviousChannel={() => stepChannel("previous")}
        onNextChannel={() => stepChannel("next")}
        onOpenGuide={() => {
          setWatchOnTvOpen(false);
          openGuideFromFullscreen();
        }}
        onSyncLive={requestCastLiveSync}
        currentTitle={title}
        channelLabel={getChannelLabel(currentChannel)}
        channelName={
          currentChannel?.branding?.displayName ?? currentChannel?.name ?? "Tate's TV"
        }
        channelId={currentChannelId}
      />
    </div>
  );
}