"use client";

import Script from "next/script";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type GoogleCastSdkState =
  | "loading"
  | "ready"
  | "unavailable"
  | "error";

export interface CastQueueEntry {
  id: string;
  url: string;
  mimeType: string;
  title: string;
  subtitle?: string;
  poster?: string;
  startTime: number;
  playbackDuration: number;
}

export interface CastQueueRequest {
  entries: CastQueueEntry[];
  queueName: string;
  queueDescription?: string;
  channelId?: string;
}

interface CastDeviceLike {
  friendlyName?: string;
}

interface MediaSessionLike {
  getEstimatedTime?: () => number;
}

interface CastSessionLike {
  getCastDevice: () => CastDeviceLike;
  getMediaSession: () => MediaSessionLike | null;
  loadMedia: (request: unknown) => Promise<unknown>;
}

interface CastContextLike {
  setOptions: (options: {
    receiverApplicationId: string;
    autoJoinPolicy?: string;
  }) => void;
  addEventListener: (type: string, handler: (event: unknown) => void) => void;
  removeEventListener: (type: string, handler: (event: unknown) => void) => void;
  getCastState: () => string;
  getSessionState: () => string;
  getCurrentSession: () => CastSessionLike | null;
  requestSession: () => Promise<unknown>;
  endCurrentSession: (stopCasting: boolean) => void;
}

interface RemotePlayerLike {
  isConnected: boolean;
  isMediaLoaded: boolean;
  isPaused: boolean;
  isMuted: boolean;
  canPause: boolean;
  canSeek: boolean;
  canControlVolume: boolean;
  currentTime: number;
  duration: number;
  volumeLevel: number;
  title?: string | null;
  displayStatus?: string;
  playerState?: string | null;
}

interface RemotePlayerControllerLike {
  addEventListener: (type: string, handler: (event: unknown) => void) => void;
  removeEventListener: (type: string, handler: (event: unknown) => void) => void;
  playOrPause: () => void;
  muteOrUnmute: () => void;
  seek: () => void;
  setVolumeLevel: () => void;
  stop: () => void;
}

interface MediaInfoLike {
  streamType?: string;
  metadata?: GenericMetadataLike;
  customData?: Record<string, unknown>;
}

interface GenericMetadataLike {
  title?: string;
  subtitle?: string;
  images?: Array<{ url: string }>;
}

interface QueueItemLike {
  media: MediaInfoLike;
  autoplay: boolean;
  startTime: number;
  playbackDuration: number;
  preloadTime: number;
  customData?: Record<string, unknown>;
}

interface QueueDataLike {
  queueType?: string;
  customData?: Record<string, unknown>;
}

interface LoadRequestLike {
  autoplay: boolean;
  currentTime: number;
  queueData?: QueueDataLike;
  customData?: Record<string, unknown>;
}

interface GoogleCastWindow extends Window {
  __onGCastApiAvailable?: (isAvailable: boolean) => void;
  cast?: {
    framework: {
      CastContext: {
        getInstance: () => CastContextLike;
      };
      CastContextEventType: {
        CAST_STATE_CHANGED: string;
        SESSION_STATE_CHANGED: string;
      };
      RemotePlayerEventType: {
        ANY_CHANGE: string;
      };
      RemotePlayer: new () => RemotePlayerLike;
      RemotePlayerController: new (
        player: RemotePlayerLike,
      ) => RemotePlayerControllerLike;
    };
  };
  chrome?: {
    cast?: {
      AutoJoinPolicy: {
        ORIGIN_SCOPED: string;
      };
      Image?: new (url: string) => { url: string };
      media: {
        DEFAULT_MEDIA_RECEIVER_APP_ID: string;
        StreamType: {
          BUFFERED: string;
        };
        QueueType: {
          LIVE_TV: string;
          VIDEO_PLAYLIST: string;
        };
        RepeatMode: {
          OFF: string;
        };
        MediaInfo: new (url: string, mimeType: string) => MediaInfoLike;
        GenericMediaMetadata: new () => GenericMetadataLike;
        QueueItem: new (mediaInfo: MediaInfoLike) => QueueItemLike;
        QueueData: new (
          id?: string,
          name?: string,
          description?: string,
          repeatMode?: string,
          items?: QueueItemLike[],
          startIndex?: number,
          startTime?: number,
        ) => QueueDataLike;
        LoadRequest: new (mediaInfo: MediaInfoLike) => LoadRequestLike;
      };
    };
  };
}

interface RemoteSnapshot {
  isConnected: boolean;
  isMediaLoaded: boolean;
  isPaused: boolean;
  isMuted: boolean;
  canPause: boolean;
  canSeek: boolean;
  canControlVolume: boolean;
  currentTime: number;
  duration: number;
  volumeLevel: number;
  title: string;
  displayStatus: string;
  playerState: string;
}

interface GoogleCastContextValue {
  sdkState: GoogleCastSdkState;
  castState: string;
  sessionState: string;
  deviceName: string;
  errorMessage: string;
  remote: RemoteSnapshot;
  requestSession: () => Promise<boolean>;
  disconnect: () => void;
  loadQueue: (request: CastQueueRequest) => Promise<boolean>;
  playOrPause: () => void;
  muteOrUnmute: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  getEstimatedTime: () => number;
}

const DEFAULT_REMOTE_SNAPSHOT: RemoteSnapshot = {
  isConnected: false,
  isMediaLoaded: false,
  isPaused: false,
  isMuted: false,
  canPause: false,
  canSeek: false,
  canControlVolume: false,
  currentTime: 0,
  duration: 0,
  volumeLevel: 1,
  title: "",
  displayStatus: "",
  playerState: "",
};

const GoogleCastContext = createContext<GoogleCastContextValue | null>(null);

function getCastWindow(): GoogleCastWindow | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window as GoogleCastWindow;
}

function getErrorText(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Google Cast could not complete the request.";
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(Math.max(value, 0), 1);
}

function createRemoteSnapshot(player: RemotePlayerLike | null): RemoteSnapshot {
  if (!player) {
    return DEFAULT_REMOTE_SNAPSHOT;
  }

  return {
    isConnected: Boolean(player.isConnected),
    isMediaLoaded: Boolean(player.isMediaLoaded),
    isPaused: Boolean(player.isPaused),
    isMuted: Boolean(player.isMuted),
    canPause: Boolean(player.canPause),
    canSeek: Boolean(player.canSeek),
    canControlVolume: Boolean(player.canControlVolume),
    currentTime: Number.isFinite(player.currentTime) ? player.currentTime : 0,
    duration: Number.isFinite(player.duration) ? player.duration : 0,
    volumeLevel: clampVolume(player.volumeLevel),
    title: player.title?.trim() || "",
    displayStatus: player.displayStatus?.trim() || "",
    playerState: player.playerState?.trim() || "",
  };
}

export function GoogleCastProvider({ children }: { children: ReactNode }) {
  const castContextRef = useRef<CastContextLike | null>(null);
  const remotePlayerRef = useRef<RemotePlayerLike | null>(null);
  const remoteControllerRef = useRef<RemotePlayerControllerLike | null>(null);
  const castStateHandlerRef = useRef<((event: unknown) => void) | null>(null);
  const sessionStateHandlerRef = useRef<((event: unknown) => void) | null>(null);
  const remoteChangeHandlerRef = useRef<((event: unknown) => void) | null>(null);
  const initializedRef = useRef(false);

  const [sdkState, setSdkState] = useState<GoogleCastSdkState>("loading");
  const [castState, setCastState] = useState("NO_DEVICES_AVAILABLE");
  const [sessionState, setSessionState] = useState("NO_SESSION");
  const [deviceName, setDeviceName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [remote, setRemote] = useState<RemoteSnapshot>(DEFAULT_REMOTE_SNAPSHOT);

  const refreshSessionState = useCallback(() => {
    const context = castContextRef.current;
    const session = context?.getCurrentSession() ?? null;

    setCastState(context?.getCastState() ?? "NO_DEVICES_AVAILABLE");
    setSessionState(context?.getSessionState() ?? "NO_SESSION");
    setDeviceName(session?.getCastDevice().friendlyName?.trim() || "");
    setRemote(createRemoteSnapshot(remotePlayerRef.current));
  }, []);

  const initializeCast = useCallback(() => {
    if (initializedRef.current) {
      refreshSessionState();
      return;
    }

    const castWindow = getCastWindow();
    const framework = castWindow?.cast?.framework;
    const chromeCast = castWindow?.chrome?.cast;

    if (!framework || !chromeCast?.media) {
      setSdkState("unavailable");
      return;
    }

    try {
      const context = framework.CastContext.getInstance();

      context.setOptions({
        receiverApplicationId:
          chromeCast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
        autoJoinPolicy: chromeCast.AutoJoinPolicy.ORIGIN_SCOPED,
      });

      const remotePlayer = new framework.RemotePlayer();
      const remoteController = new framework.RemotePlayerController(remotePlayer);

      const handleCastStateChange = () => {
        refreshSessionState();
      };

      const handleSessionStateChange = () => {
        refreshSessionState();
      };

      const handleRemoteChange = () => {
        refreshSessionState();
      };

      context.addEventListener(
        framework.CastContextEventType.CAST_STATE_CHANGED,
        handleCastStateChange,
      );
      context.addEventListener(
        framework.CastContextEventType.SESSION_STATE_CHANGED,
        handleSessionStateChange,
      );
      remoteController.addEventListener(
        framework.RemotePlayerEventType.ANY_CHANGE,
        handleRemoteChange,
      );

      castContextRef.current = context;
      remotePlayerRef.current = remotePlayer;
      remoteControllerRef.current = remoteController;
      castStateHandlerRef.current = handleCastStateChange;
      sessionStateHandlerRef.current = handleSessionStateChange;
      remoteChangeHandlerRef.current = handleRemoteChange;
      initializedRef.current = true;

      setSdkState("ready");
      setErrorMessage("");
      refreshSessionState();
    } catch (error) {
      setSdkState("error");
      setErrorMessage(getErrorText(error));
    }
  }, [refreshSessionState]);

  useEffect(() => {
    const castWindow = getCastWindow();

    if (!castWindow) {
      return;
    }

    const previousHandler = castWindow.__onGCastApiAvailable;

    castWindow.__onGCastApiAvailable = (isAvailable) => {
      previousHandler?.(isAvailable);

      if (isAvailable) {
        initializeCast();
      } else {
        setSdkState("unavailable");
      }
    };

    if (castWindow.cast?.framework && castWindow.chrome?.cast?.media) {
      initializeCast();
    }

    return () => {
      castWindow.__onGCastApiAvailable = previousHandler;
    };
  }, [initializeCast]);

  useEffect(() => {
    return () => {
      const castWindow = getCastWindow();
      const framework = castWindow?.cast?.framework;
      const context = castContextRef.current;
      const controller = remoteControllerRef.current;

      if (context && framework) {
        if (castStateHandlerRef.current) {
          context.removeEventListener(
            framework.CastContextEventType.CAST_STATE_CHANGED,
            castStateHandlerRef.current,
          );
        }

        if (sessionStateHandlerRef.current) {
          context.removeEventListener(
            framework.CastContextEventType.SESSION_STATE_CHANGED,
            sessionStateHandlerRef.current,
          );
        }
      }

      if (controller && framework && remoteChangeHandlerRef.current) {
        controller.removeEventListener(
          framework.RemotePlayerEventType.ANY_CHANGE,
          remoteChangeHandlerRef.current,
        );
      }
    };
  }, []);

  const requestSession = useCallback(async (): Promise<boolean> => {
    const context = castContextRef.current;

    if (!context) {
      setErrorMessage(
        "Google Cast is not available here. Use Chrome or Edge on the same Wi-Fi as the TV.",
      );
      return false;
    }

    try {
      setErrorMessage("");
      await context.requestSession();
      refreshSessionState();
      return Boolean(context.getCurrentSession());
    } catch (error) {
      const message = getErrorText(error);

      if (!/cancel/i.test(message)) {
        setErrorMessage(message);
      }

      refreshSessionState();
      return false;
    }
  }, [refreshSessionState]);

  const disconnect = useCallback(() => {
    castContextRef.current?.endCurrentSession(true);
    refreshSessionState();
  }, [refreshSessionState]);

  const loadQueue = useCallback(
    async (request: CastQueueRequest): Promise<boolean> => {
      const castWindow = getCastWindow();
      const mediaApi = castWindow?.chrome?.cast?.media;
      const session = castContextRef.current?.getCurrentSession();

      if (!mediaApi || !session || request.entries.length === 0) {
        return false;
      }

      try {
        const queueItems = request.entries.map((entry, index) => {
          const mediaInfo = new mediaApi.MediaInfo(entry.url, entry.mimeType);
          const metadata = new mediaApi.GenericMediaMetadata();

          metadata.title = entry.title;
          metadata.subtitle = entry.subtitle || request.queueName;

          if (entry.poster) {
            const CastImage = castWindow?.chrome?.cast?.Image;
            metadata.images = CastImage
              ? [new CastImage(entry.poster)]
              : [{ url: entry.poster }];
          }

          mediaInfo.streamType = mediaApi.StreamType.BUFFERED;
          mediaInfo.metadata = metadata;
          mediaInfo.customData = {
            tatesTv: true,
            queueEntryId: entry.id,
            channelId: request.channelId,
          };

          const queueItem = new mediaApi.QueueItem(mediaInfo);
          queueItem.autoplay = true;
          queueItem.startTime = Math.max(0, entry.startTime);
          queueItem.playbackDuration = Math.max(1, entry.playbackDuration);
          queueItem.preloadTime = index === 0 ? 0 : 10;
          queueItem.customData = {
            tatesTv: true,
            queueEntryId: entry.id,
          };

          return queueItem;
        });

        const firstEntry = request.entries[0];
        const firstMediaInfo = queueItems[0]?.media;

        if (!firstEntry || !firstMediaInfo) {
          return false;
        }

        const queueData = new mediaApi.QueueData(
          `tates-tv-${request.channelId ?? "live"}-${Date.now()}`,
          request.queueName,
          request.queueDescription || "Tate's TV live channel",
          mediaApi.RepeatMode.OFF,
          queueItems,
          0,
          Math.max(0, firstEntry.startTime),
        );

        queueData.queueType = mediaApi.QueueType.LIVE_TV;
        queueData.customData = {
          tatesTv: true,
          channelId: request.channelId,
        };

        const loadRequest = new mediaApi.LoadRequest(firstMediaInfo);
        loadRequest.autoplay = true;
        loadRequest.currentTime = Math.max(0, firstEntry.startTime);
        loadRequest.queueData = queueData;
        loadRequest.customData = {
          tatesTv: true,
          channelId: request.channelId,
        };

        await session.loadMedia(loadRequest);
        setErrorMessage("");
        refreshSessionState();
        return true;
      } catch (error) {
        setErrorMessage(getErrorText(error));
        refreshSessionState();
        return false;
      }
    },
    [refreshSessionState],
  );

  const playOrPause = useCallback(() => {
    remoteControllerRef.current?.playOrPause();
  }, []);

  const muteOrUnmute = useCallback(() => {
    remoteControllerRef.current?.muteOrUnmute();
  }, []);

  const seek = useCallback((seconds: number) => {
    const player = remotePlayerRef.current;
    const controller = remoteControllerRef.current;

    if (!player || !controller || !player.canSeek || !Number.isFinite(seconds)) {
      return;
    }

    player.currentTime = Math.max(0, seconds);
    controller.seek();
  }, []);

  const setVolume = useCallback((volume: number) => {
    const player = remotePlayerRef.current;
    const controller = remoteControllerRef.current;

    if (!player || !controller || !player.canControlVolume) {
      return;
    }

    player.volumeLevel = clampVolume(volume);
    controller.setVolumeLevel();
  }, []);

  const getEstimatedTime = useCallback((): number => {
    const session = castContextRef.current?.getCurrentSession();
    const mediaSession = session?.getMediaSession();
    const estimatedTime = mediaSession?.getEstimatedTime?.();

    if (typeof estimatedTime === "number" && Number.isFinite(estimatedTime)) {
      return estimatedTime;
    }

    const currentTime = remotePlayerRef.current?.currentTime;
    return typeof currentTime === "number" && Number.isFinite(currentTime)
      ? currentTime
      : 0;
  }, []);

  const value = useMemo<GoogleCastContextValue>(
    () => ({
      sdkState,
      castState,
      sessionState,
      deviceName,
      errorMessage,
      remote,
      requestSession,
      disconnect,
      loadQueue,
      playOrPause,
      muteOrUnmute,
      seek,
      setVolume,
      getEstimatedTime,
    }),
    [
      sdkState,
      castState,
      sessionState,
      deviceName,
      errorMessage,
      remote,
      requestSession,
      disconnect,
      loadQueue,
      playOrPause,
      muteOrUnmute,
      seek,
      setVolume,
      getEstimatedTime,
    ],
  );

  return (
    <GoogleCastContext.Provider value={value}>
      {children}
      <Script
        id="google-cast-web-sender"
        src="https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1"
        strategy="afterInteractive"
        onReady={initializeCast}
        onError={() => {
          setSdkState("error");
          setErrorMessage("The Google Cast sender library could not be loaded.");
        }}
      />
    </GoogleCastContext.Provider>
  );
}

export function useGoogleCast(): GoogleCastContextValue {
  const context = useContext(GoogleCastContext);

  if (!context) {
    throw new Error("useGoogleCast must be used inside GoogleCastProvider.");
  }

  return context;
}
