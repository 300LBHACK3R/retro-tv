"use client";

import { useEffect, useMemo, useRef } from "react";
import { useStore } from "@/lib/store";

const LOCAL_BACKUP_KEY = "tatestv:last-known-good-programming:v3";
const LOCAL_MIRROR_KEY = "tatestv:last-known-good-programming:mirror:v3";

const SAVE_DEBOUNCE_MS = 900;
const SERVER_PULL_DELAY_MS = 450;
const SERVER_POLL_MS = 30_000;

type StoreState = ReturnType<typeof useStore.getState>;

type DurableProgrammingSnapshot = {
  version: 3;
  savedAt: string;
  media: StoreState["media"];
  channels: StoreState["channels"];
  currentChannelId: StoreState["currentChannelId"];
  themeId: StoreState["themeId"];
  appMode: StoreState["appMode"];
  sidebarWidth: StoreState["sidebarWidth"];
  guideHeight: StoreState["guideHeight"];
  viewerSettings: StoreState["viewerSettings"];
};

type ProgrammingPayload = Partial<DurableProgrammingSnapshot> & {
  updatedAt?: string;
  programming?: unknown;
  state?: unknown;
  data?: unknown;
};

type ProgrammingPersistenceGuardProps = {
  isAdminAuthorized?: boolean;
};

function getAssignmentCount(channels: StoreState["channels"]): number {
  return channels.reduce((total, channel) => {
    return total + (Array.isArray(channel.mediaIds) ? channel.mediaIds.length : 0);
  }, 0);
}

function getBrandedChannelCount(channels: StoreState["channels"]): number {
  return channels.reduce((total, channel) => {
    const branding = channel.branding;

    if (!branding) {
      return total;
    }

    const hasBranding = Object.values(branding).some((value) => {
      return typeof value === "string" && value.trim().length > 0;
    });

    return total + (hasBranding ? 1 : 0);
  }, 0);
}

function getSnapshotScore(snapshot: Pick<DurableProgrammingSnapshot, "media" | "channels">): number {
  return (
    snapshot.media.length * 10 +
    getAssignmentCount(snapshot.channels) * 2 +
    getBrandedChannelCount(snapshot.channels) * 4
  );
}

function getDateScore(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : 0;
}

function createSnapshot(): DurableProgrammingSnapshot {
  const state = useStore.getState();

  return {
    version: 3,
    savedAt: new Date().toISOString(),
    media: state.media,
    channels: state.channels,
    currentChannelId: state.currentChannelId,
    themeId: state.themeId,
    appMode: state.appMode,
    sidebarWidth: state.sidebarWidth,
    guideHeight: state.guideHeight,
    viewerSettings: state.viewerSettings,
  };
}

function isSnapshotLike(value: unknown): value is ProgrammingPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as ProgrammingPayload;

  return Array.isArray(candidate.media) && Array.isArray(candidate.channels);
}

function unwrapProgrammingPayload(value: unknown): ProgrammingPayload | null {
  if (isSnapshotLike(value)) {
    return value;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as ProgrammingPayload;

  const candidates = [record.programming, record.state, record.data];

  for (const candidate of candidates) {
    if (isSnapshotLike(candidate)) {
      return candidate as ProgrammingPayload;
    }
  }

  return null;
}

function normalizePayload(value: ProgrammingPayload): DurableProgrammingSnapshot | null {
  if (!Array.isArray(value.media) || !Array.isArray(value.channels)) {
    return null;
  }

  const current = useStore.getState();

  return {
    version: 3,
    savedAt: value.savedAt ?? value.updatedAt ?? new Date().toISOString(),
    media: value.media,
    channels: value.channels,
    currentChannelId: value.currentChannelId ?? current.currentChannelId,
    themeId: value.themeId ?? current.themeId,
    appMode: value.appMode ?? current.appMode,
    sidebarWidth: value.sidebarWidth ?? current.sidebarWidth,
    guideHeight: value.guideHeight ?? current.guideHeight,
    viewerSettings: value.viewerSettings ?? current.viewerSettings,
  };
}

function readLocalSnapshot(key: string): DurableProgrammingSnapshot | null {
  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const payload = unwrapProgrammingPayload(parsed);

    return payload ? normalizePayload(payload) : null;
  } catch {
    return null;
  }
}

function readBestLocalBackup(): DurableProgrammingSnapshot | null {
  const primary = readLocalSnapshot(LOCAL_BACKUP_KEY);
  const mirror = readLocalSnapshot(LOCAL_MIRROR_KEY);

  if (!primary) return mirror;
  if (!mirror) return primary;

  const primaryScore = getSnapshotScore(primary);
  const mirrorScore = getSnapshotScore(mirror);

  if (mirrorScore > primaryScore) {
    return mirror;
  }

  if (mirrorScore === primaryScore && getDateScore(mirror.savedAt) > getDateScore(primary.savedAt)) {
    return mirror;
  }

  return primary;
}

function writeLocalBackup(snapshot: DurableProgrammingSnapshot): void {
  const payload = JSON.stringify(snapshot);

  window.localStorage.setItem(LOCAL_BACKUP_KEY, payload);
  window.localStorage.setItem(LOCAL_MIRROR_KEY, payload);
}

function shouldApplySnapshot(
  current: DurableProgrammingSnapshot,
  incoming: DurableProgrammingSnapshot,
): boolean {
  const currentScore = getSnapshotScore(current);
  const incomingScore = getSnapshotScore(incoming);

  if (incomingScore > currentScore) {
    return true;
  }

  if (incomingScore < currentScore) {
    return false;
  }

  return getDateScore(incoming.savedAt) > getDateScore(current.savedAt);
}

function applySnapshot(snapshot: DurableProgrammingSnapshot): void {
  useStore.setState({
    media: snapshot.media,
    channels: snapshot.channels,
    currentChannelId: snapshot.currentChannelId,
    themeId: snapshot.themeId,
    appMode: snapshot.appMode,
    sidebarWidth: snapshot.sidebarWidth,
    guideHeight: snapshot.guideHeight,
    viewerSettings: snapshot.viewerSettings,
  });
}

function hasProgrammingContent(snapshot: DurableProgrammingSnapshot): boolean {
  return snapshot.media.length > 0 || getAssignmentCount(snapshot.channels) > 0;
}

async function fetchServerProgramming(): Promise<DurableProgrammingSnapshot | null> {
  try {
    const response = await fetch(`/api/programming?ts=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const payload = unwrapProgrammingPayload(json);

    return payload ? normalizePayload(payload) : null;
  } catch {
    return null;
  }
}

async function saveServerProgramming(snapshot: DurableProgrammingSnapshot): Promise<void> {
  const body = JSON.stringify({
    media: snapshot.media,
    channels: snapshot.channels,
    currentChannelId: snapshot.currentChannelId,
    themeId: snapshot.themeId,
    sidebarWidth: snapshot.sidebarWidth,
    guideHeight: snapshot.guideHeight,
    viewerSettings: snapshot.viewerSettings,
    savedAt: snapshot.savedAt,
    updatedAt: snapshot.savedAt,
  });

  const headers = {
    "Content-Type": "application/json",
  };

  try {
    const put = await fetch("/api/admin/programming", {
      method: "PUT",
      headers,
      body,
      cache: "no-store",
    });

    if (put.ok) {
      return;
    }

    await fetch("/api/admin/programming", {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    // Local backup still protects the current browser session.
  }
}

async function requestPersistentBrowserStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Best-effort only.
  }
}

export default function ProgrammingPersistenceGuard({
  isAdminAuthorized = false,
}: ProgrammingPersistenceGuardProps) {
  const saveTimerRef = useRef<number | null>(null);
  const lastSavedSignatureRef = useRef("");
  const isApplyingRemoteRef = useRef(false);

  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const themeId = useStore((state) => state.themeId);
  const appMode = useStore((state) => state.appMode);
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const guideHeight = useStore((state) => state.guideHeight);
  const viewerSettings = useStore((state) => state.viewerSettings);

  const signature = useMemo(() => {
    return JSON.stringify({
      media,
      channels,
      currentChannelId,
      themeId,
      appMode,
      sidebarWidth,
      guideHeight,
      viewerSettings,
    });
  }, [
    media,
    channels,
    currentChannelId,
    themeId,
    appMode,
    sidebarWidth,
    guideHeight,
    viewerSettings,
  ]);

  useEffect(() => {
    void requestPersistentBrowserStorage();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncFromServer = async () => {
      const serverSnapshot = await fetchServerProgramming();

      if (cancelled) {
        return;
      }

      const current = createSnapshot();

      if (serverSnapshot && hasProgrammingContent(serverSnapshot)) {
        writeLocalBackup(serverSnapshot);

        if (shouldApplySnapshot(current, serverSnapshot)) {
          isApplyingRemoteRef.current = true;
          applySnapshot(serverSnapshot);
          window.setTimeout(() => {
            isApplyingRemoteRef.current = false;
          }, 500);
        }

        return;
      }

      const localBackup = readBestLocalBackup();

      if (localBackup && shouldApplySnapshot(current, localBackup)) {
        isApplyingRemoteRef.current = true;
        applySnapshot(localBackup);
        window.setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 500);
      }
    };

    const initialTimer = window.setTimeout(syncFromServer, SERVER_PULL_DELAY_MS);
    const interval = window.setInterval(syncFromServer, SERVER_POLL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isApplyingRemoteRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      const snapshot = createSnapshot();

      if (!hasProgrammingContent(snapshot)) {
        return;
      }

      const nextSignature = JSON.stringify({
        media: snapshot.media,
        channels: snapshot.channels,
        currentChannelId: snapshot.currentChannelId,
        themeId: snapshot.themeId,
        sidebarWidth: snapshot.sidebarWidth,
        guideHeight: snapshot.guideHeight,
        viewerSettings: snapshot.viewerSettings,
      });

      if (lastSavedSignatureRef.current === nextSignature) {
        return;
      }

      lastSavedSignatureRef.current = nextSignature;
      writeLocalBackup(snapshot);

      if (isAdminAuthorized) {
        void saveServerProgramming(snapshot);
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [signature, isAdminAuthorized]);

  return null;
}