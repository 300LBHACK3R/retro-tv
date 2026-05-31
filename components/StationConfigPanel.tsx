"use client";

import { useRef, useState } from "react";
import {
  programmingStoreName,
  programmingStoreVersion,
} from "@/lib/store";
import {
  sanitizeProgrammingSnapshot,
  type ProgrammingSnapshot,
} from "@/lib/programmingSnapshot";
import type { AppMode, Channel, MediaItem, ThemeId } from "@/lib/types";

type ExportPayload = ProgrammingSnapshot & {
  schemaVersion: 2;
  exportedAt: string;
  app: "tates-tv";
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

const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function buildExportPayload(snapshot: StoreSnapshot): ExportPayload {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    app: "tates-tv",
    media: snapshot.media,
    channels: snapshot.channels,
    currentChannelId: snapshot.currentChannelId,
    sidebarWidth: snapshot.sidebarWidth,
    guideHeight: snapshot.guideHeight,

    /**
     * Never export admin mode as the restored/default state.
     * Admin access should always require local re-authentication.
     */
    appMode: "viewer",

    themeId: snapshot.themeId,
    ownedPremiumThemes: snapshot.ownedPremiumThemes,
    updatedAt: new Date().toISOString(),
  };
}

function parseImportPayload(raw: unknown): ProgrammingSnapshot {
  const sanitized = sanitizeProgrammingSnapshot(raw);

  if (!sanitized) {
    throw new Error(
      "Import failed. This JSON file does not contain valid Tate's TV programming data.",
    );
  }

  return {
    ...sanitized,
    appMode: "viewer",
    updatedAt: new Date().toISOString(),
  };
}

function createExportFilename(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);

  return `tates-tv-station-config-${stamp}.json`;
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

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 500);
}

function buildZustandPayload(snapshot: ProgrammingSnapshot) {
  return {
    state: {
      media: snapshot.media,
      channels: snapshot.channels,
      currentChannelId: snapshot.currentChannelId,
      sidebarWidth: snapshot.sidebarWidth,
      guideHeight: snapshot.guideHeight,
      appMode: "viewer",
      themeId: snapshot.themeId,
      ownedPremiumThemes: snapshot.ownedPremiumThemes,
      isGuideOpen: false,
      deletedMediaIds: [],
    },
    version: programmingStoreVersion,
  };
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

    downloadJson(createExportFilename(), payload);
    setMessage(
      `Config exported: ${payload.media.length} media items and ${payload.channels.length} channels.`,
    );
  };

  const importConfig = async (file: File) => {
    try {
      setIsImporting(true);
      setMessage("Importing config...");

      if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
        throw new Error("Import failed. Config file is too large.");
      }

      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const snapshot = parseImportPayload(parsed);
      const zustandPayload = buildZustandPayload(snapshot);

      localStorage.setItem(programmingStoreName, JSON.stringify(zustandPayload));

      setMessage(
        `Config imported: ${snapshot.media.length} media items and ${snapshot.channels.length} channels. Reloading...`,
      );

      window.setTimeout(() => {
        window.location.reload();
      }, 400);
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
      className="rounded-2xl border p-3 sm:p-4"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="mb-3">
        <div
          className="text-xs font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--primary)" }}
        >
          Station Backup
        </div>

        <h2 className="mt-1 text-sm font-semibold tracking-wide">
          Station Config
        </h2>

        <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
          Backup or restore this browser&apos;s Tate&apos;s TV programming setup,
          including channels, R2 URLs, themes, layout, breakpoints, slot lengths,
          and commercial settings.
        </p>
      </div>

      <div
        className="grid gap-2 rounded-xl border p-3 sm:grid-cols-3"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
        }}
      >
        <div>
          <div className="text-lg font-black">{media.length}</div>
          <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Media Items
          </div>
        </div>

        <div>
          <div className="text-lg font-black">{channels.length}</div>
          <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Channels
          </div>
        </div>

        <div>
          <div className="truncate text-lg font-black">{themeId}</div>
          <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>
            Active Theme
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={exportConfig}
          className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.01]"
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
          className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))",
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
        className="mt-3 rounded-xl border px-3 py-2 text-xs leading-5"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
          color: "var(--text-muted)",
        }}
      >
        {message}
      </div>

      <div className="mt-3 text-[11px] leading-5" style={{ color: "var(--text-muted)" }}>
        This backs up programming metadata and Cloudflare/R2 URLs only. It does
        not export actual MP4 files. Imported configs always restore in viewer
        mode; admin access must be re-authenticated.
      </div>
    </section>
  );
}