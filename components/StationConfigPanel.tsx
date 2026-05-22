"use client";

import { useRef, useState } from "react";
import { programmingStoreName, programmingStoreVersion } from "@/lib/store";
import { isThemeId } from "@/lib/themes";
import type { AppMode, Channel, MediaItem, ThemeId } from "@/lib/types";

type ExportPayload = {
  schemaVersion: 1;
  exportedAt: string;
  app: "tates-tv";
  media: MediaItem[];
  channels: Channel[];
  currentChannelId: string;
  sidebarWidth: number;
  guideHeight: number;
  appMode: AppMode;
  themeId: ThemeId;
  ownedPremiumThemes: ThemeId[];
};

type StoreSnapshot = {
  media: MediaItem[];
  channels: Channel[];
  currentChannelId: string;
  sidebarWidth: number;
  guideHeight: number;
  appMode: AppMode;
  themeId: ThemeId;
  ownedPremiumThemes: ThemeId[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMediaItem(value: unknown): value is MediaItem {
  if (!isObject(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.file === "string" &&
    typeof value.duration === "number" &&
    value.duration > 0 &&
    ["show", "commercial", "movie", "bumper"].includes(String(value.type))
  );
}

function isChannel(value: unknown): value is Channel {
  if (!isObject(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    Array.isArray(value.mediaIds) &&
    value.mediaIds.every((id) => typeof id === "string")
  );
}

function getValidAppMode(value: unknown): AppMode {
  return value === "admin" || value === "viewer" ? value : "viewer";
}

function getValidThemeId(value: unknown): ThemeId {
  return isThemeId(value) ? value : "shaw-2006";
}

function getValidOwnedPremiumThemes(value: unknown): ThemeId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((item): item is ThemeId => isThemeId(item))),
  );
}

function getValidNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildExportPayload(snapshot: StoreSnapshot): ExportPayload {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: "tates-tv",
    ...snapshot,
  };
}

function parseImportPayload(raw: unknown): StoreSnapshot {
  if (!isObject(raw)) {
    throw new Error("Invalid config file. Expected a JSON object.");
  }

  const media = Array.isArray(raw.media) ? raw.media.filter(isMediaItem) : [];
  const channels = Array.isArray(raw.channels)
    ? raw.channels.filter(isChannel)
    : [];

  if (media.length === 0) {
    throw new Error("Import failed. No valid media entries were found.");
  }

  if (channels.length === 0) {
    throw new Error("Import failed. No valid channels were found.");
  }

  const currentChannelId =
    typeof raw.currentChannelId === "string" &&
    channels.some((channel) => channel.id === raw.currentChannelId)
      ? raw.currentChannelId
      : channels[0]?.id ?? "1";

  return {
    media,
    channels,
    currentChannelId,
    sidebarWidth: getValidNumber(raw.sidebarWidth, 420),
    guideHeight: getValidNumber(raw.guideHeight, 290),
    appMode: getValidAppMode(raw.appMode),
    themeId: getValidThemeId(raw.themeId),
    ownedPremiumThemes: getValidOwnedPremiumThemes(raw.ownedPremiumThemes),
  };
}

function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener noreferrer";
  anchor.click();

  URL.revokeObjectURL(url);
}

interface StationConfigPanelProps {
  media: MediaItem[];
  channels: Channel[];
  currentChannelId: string;
  sidebarWidth: number;
  guideHeight: number;
  appMode: AppMode;
  themeId: ThemeId;
  ownedPremiumThemes: ThemeId[];
}

export default function StationConfigPanel({
  media,
  channels,
  currentChannelId,
  sidebarWidth,
  guideHeight,
  appMode,
  themeId,
  ownedPremiumThemes,
}: StationConfigPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState(
    "Export and restore channels, media metadata, layout, mode, and theme settings.",
  );
  const [isImporting, setIsImporting] = useState(false);

  const exportConfig = () => {
    const payload = buildExportPayload({
      media,
      channels,
      currentChannelId,
      sidebarWidth,
      guideHeight,
      appMode,
      themeId,
      ownedPremiumThemes,
    });

    downloadJson("tates-tv-station-config.json", payload);
    setMessage("Config exported successfully.");
  };

  const importConfig = async (file: File) => {
    try {
      setIsImporting(true);
      setMessage("Importing config...");

      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const snapshot = parseImportPayload(parsed);

      const zustandPayload = {
        state: snapshot,
        version: programmingStoreVersion,
      };

      localStorage.setItem(programmingStoreName, JSON.stringify(zustandPayload));

      setMessage("Config imported successfully. Reloading...");
      window.location.reload();
    } catch (error) {
      console.error(error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Import failed. Check the JSON file and try again.";

      setMessage(errorMessage);
    } finally {
      setIsImporting(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="mb-3">
        <h2 className="text-sm font-semibold tracking-wide">Station Config</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Backup or restore this browser&apos;s Tate&apos;s TV programming setup.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportConfig}
          className="rounded-lg px-3 py-2 text-sm font-medium transition hover:opacity-90"
          style={{
            background: "var(--button-bg)",
            color: "var(--text)",
          }}
        >
          Export Config
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="rounded-lg px-3 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: "var(--button-bg)",
            color: "var(--text)",
          }}
        >
          {isImporting ? "Importing..." : "Import Config"}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              void importConfig(file);
            }
          }}
        />
      </div>

      <div
        className="mt-3 rounded-lg border px-3 py-2 text-xs"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
          color: "var(--text-muted)",
        }}
      >
        {message}
      </div>

      <div className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
        This only backs up programming metadata and Cloudflare/R2 URLs. It does
        not export actual MP4 files.
      </div>
    </section>
  );
}