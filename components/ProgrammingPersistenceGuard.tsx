"use client";

import { useEffect, useMemo, useRef } from "react";
import { useStore } from "@/lib/store";

const PRIMARY_BACKUP_KEY = "tatestv:last-known-good-programming:v2";
const MIRROR_BACKUP_KEY = "tatestv:last-known-good-programming:mirror:v2";
const SAVE_DEBOUNCE_MS = 650;
const FIRST_RESTORE_DELAY_MS = 900;
const SECOND_RESTORE_DELAY_MS = 2400;

type StoreState = ReturnType<typeof useStore.getState>;

type DurableProgrammingSnapshot = {
  version: 2;
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

function createSnapshot(): DurableProgrammingSnapshot {
  const state = useStore.getState();

  return {
    version: 2,
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

function isValidSnapshot(value: unknown): value is DurableProgrammingSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const snapshot = value as DurableProgrammingSnapshot;

  return (
    snapshot.version === 2 &&
    Array.isArray(snapshot.media) &&
    Array.isArray(snapshot.channels) &&
    typeof snapshot.savedAt === "string"
  );
}

function readJson(key: string): DurableProgrammingSnapshot | null {
  try {
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    return isValidSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readBestBackup(): DurableProgrammingSnapshot | null {
  const primary = readJson(PRIMARY_BACKUP_KEY);
  const mirror = readJson(MIRROR_BACKUP_KEY);

  if (!primary) return mirror;
  if (!mirror) return primary;

  const primaryScore =
    primary.media.length +
    getAssignmentCount(primary.channels) +
    getBrandedChannelCount(primary.channels);

  const mirrorScore =
    mirror.media.length +
    getAssignmentCount(mirror.channels) +
    getBrandedChannelCount(mirror.channels);

  return mirrorScore > primaryScore ? mirror : primary;
}

function writeBackup(snapshot: DurableProgrammingSnapshot): void {
  const payload = JSON.stringify(snapshot);

  window.localStorage.setItem(PRIMARY_BACKUP_KEY, payload);
  window.localStorage.setItem(MIRROR_BACKUP_KEY, payload);
}

function shouldRestoreFromBackup(
  current: DurableProgrammingSnapshot,
  backup: DurableProgrammingSnapshot,
): boolean {
  const currentMedia = current.media.length;
  const backupMedia = backup.media.length;

  const currentAssignments = getAssignmentCount(current.channels);
  const backupAssignments = getAssignmentCount(backup.channels);

  const currentBrandedChannels = getBrandedChannelCount(current.channels);
  const backupBrandedChannels = getBrandedChannelCount(backup.channels);

  if (backupMedia > currentMedia) {
    return true;
  }

  if (backupAssignments > currentAssignments) {
    return true;
  }

  if (backupBrandedChannels > currentBrandedChannels) {
    return true;
  }

  return false;
}

function shouldWriteBackup(
  current: DurableProgrammingSnapshot,
  backup: DurableProgrammingSnapshot | null,
): boolean {
  if (current.media.length === 0 && getAssignmentCount(current.channels) === 0) {
    return false;
  }

  if (!backup) {
    return true;
  }

  return !shouldRestoreFromBackup(current, backup);
}

function restoreSnapshot(snapshot: DurableProgrammingSnapshot): void {
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

async function requestPersistentBrowserStorage(): Promise<void> {
  try {
    if (!navigator.storage?.persist) {
      return;
    }

    await navigator.storage.persist();
  } catch {
    // Browser storage persistence is best-effort.
  }
}

async function pushAdminProgrammingBackup(
  snapshot: DurableProgrammingSnapshot,
): Promise<void> {
  const body = JSON.stringify({
    media: snapshot.media,
    channels: snapshot.channels,
    currentChannelId: snapshot.currentChannelId,
    themeId: snapshot.themeId,
    sidebarWidth: snapshot.sidebarWidth,
    guideHeight: snapshot.guideHeight,
    viewerSettings: snapshot.viewerSettings,
    savedAt: snapshot.savedAt,
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
    // Local last-known-good backup is still the source of protection.
  }
}

export default function ProgrammingPersistenceGuard({
  isAdminAuthorized = false,
}: ProgrammingPersistenceGuardProps) {
  const saveTimerRef = useRef<number | null>(null);
  const lastSavedSignatureRef = useRef("");

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
      mediaCount: media.length,
      assignmentCount: getAssignmentCount(channels),
      brandedChannelCount: getBrandedChannelCount(channels),
      currentChannelId,
      themeId,
      appMode,
      sidebarWidth,
      guideHeight,
      viewerSettings,
      mediaIds: media.map((item) => item.id),
      channelIds: channels.map((channel) => ({
        id: channel.id,
        mediaIds: channel.mediaIds,
        branding: channel.branding,
      })),
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
    const restoreIfNeeded = () => {
      const backup = readBestBackup();

      if (!backup) {
        return;
      }

      const current = createSnapshot();

      if (shouldRestoreFromBackup(current, backup)) {
        restoreSnapshot(backup);
      }
    };

    const first = window.setTimeout(restoreIfNeeded, FIRST_RESTORE_DELAY_MS);
    const second = window.setTimeout(restoreIfNeeded, SECOND_RESTORE_DELAY_MS);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
    };
  }, []);

  useEffect(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      const current = createSnapshot();
      const backup = readBestBackup();

      if (backup && shouldRestoreFromBackup(current, backup)) {
        restoreSnapshot(backup);
        return;
      }

      if (!shouldWriteBackup(current, backup)) {
        return;
      }

      const nextSignature = JSON.stringify({
        media: current.media,
        channels: current.channels,
        currentChannelId: current.currentChannelId,
        themeId: current.themeId,
        sidebarWidth: current.sidebarWidth,
        guideHeight: current.guideHeight,
        viewerSettings: current.viewerSettings,
      });

      if (lastSavedSignatureRef.current === nextSignature) {
        return;
      }

      lastSavedSignatureRef.current = nextSignature;
      writeBackup(current);

      if (isAdminAuthorized) {
        void pushAdminProgrammingBackup(current);
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