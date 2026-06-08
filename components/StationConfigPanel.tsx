"use client";

import { useMemo, useRef, useState } from "react";
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

type ConfigStat = {
  label: string;
  value: string | number;
  helper: string;
};

const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const RELOAD_DELAY_MS = 500;

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
      "Import failed. This JSON file does not contain valid TatesTv programming data.",
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

  return `tatestv-station-config-${stamp}.json`;
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

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 0,
  }).format(value);
}

function getEnabledChannelCount(channels: Channel[]): number {
  return channels.filter((channel) => channel.isEnabled !== false).length;
}

function getCurrentChannelLabel(
  channels: Channel[],
  currentChannelId: string,
): string {
  const channel = channels.find((item) => item.id === currentChannelId);

  if (!channel) {
    return currentChannelId || "none";
  }

  return `CH ${channel.number ?? channel.id}`;
}

function getFileValidationError(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(".json")) {
    return "Import failed. Please select a .json station config file.";
  }

  if (file.size <= 0) {
    return "Import failed. The selected file is empty.";
  }

  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    return "Import failed. Config file is too large.";
  }

  return null;
}

async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Import failed. The selected file is not valid JSON.");
  }
}

function StatCard({ stat }: { stat: ConfigStat }) {
  return (
    <div
      className="rounded-2xl border p-3"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
      }}
    >
      <div className="truncate text-lg font-black tracking-tight">
        {stat.value}
      </div>

      <div
        className="mt-1 text-[10px] font-black uppercase tracking-[0.14em]"
        style={{ color: "var(--text-muted)" }}
      >
        {stat.label}
      </div>

      <div
        className="mt-2 line-clamp-2 text-[11px] leading-4"
        style={{ color: "var(--text-muted)" }}
      >
        {stat.helper}
      </div>
    </div>
  );
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

  const configStats = useMemo<ConfigStat[]>(
    () => [
      {
        label: "Media Items",
        value: formatCompactNumber(media.length),
        helper: "Saved metadata records and video URLs.",
      },
      {
        label: "Channels",
        value: formatCompactNumber(channels.length),
        helper: "Total channel records in this station.",
      },
      {
        label: "Enabled",
        value: formatCompactNumber(getEnabledChannelCount(channels)),
        helper: "Channels visible to public viewers.",
      },
      {
        label: "Current",
        value: getCurrentChannelLabel(channels, currentChannelId),
        helper: "Default active channel after restore.",
      },
      {
        label: "Theme",
        value: themeId,
        helper: "Active visual theme saved with config.",
      },
      {
        label: "Owned Themes",
        value: formatCompactNumber(ownedPremiumThemes.length),
        helper: "Premium/unlocked theme IDs in this browser config.",
      },
    ],
    [channels, currentChannelId, media.length, ownedPremiumThemes.length, themeId],
  );

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

      const validationError = getFileValidationError(file);

      if (validationError) {
        throw new Error(validationError);
      }

      const confirmed = window.confirm(
        "Importing this config will replace the station programming saved in this browser. Continue?",
      );

      if (!confirmed) {
        setMessage("Import cancelled.");
        return;
      }

      const parsed = await readJsonFile(file);
      const snapshot = parseImportPayload(parsed);
      const zustandPayload = buildZustandPayload(snapshot);

      localStorage.setItem(programmingStoreName, JSON.stringify(zustandPayload));

      setMessage(
        `Config imported: ${snapshot.media.length} media items and ${snapshot.channels.length} channels. Reloading...`,
      );

      window.setTimeout(() => {
        window.location.reload();
      }, RELOAD_DELAY_MS);
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
      className="ttv-glass-panel rounded-2xl p-3 sm:p-4"
      style={{ color: "var(--text)" }}
    >
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div
            className="text-xs font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--primary)" }}
          >
            Station Backup
          </div>

          <h2 className="mt-1 text-base font-black tracking-tight">
            Station Config
          </h2>

          <p
            className="mt-1 max-w-3xl text-xs leading-5"
            style={{ color: "var(--text-muted)" }}
          >
            Backup or restore this browser&apos;s TatesTv programming setup,
            including channels, R2 URLs, themes, layout, breakpoints, slot
            lengths, and commercial settings.
          </p>
        </div>

        <div
          className="w-fit rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
          style={{
            borderColor: "var(--border)",
            background: "var(--panel-alt-bg)",
            color: "var(--text-muted)",
          }}
        >
          Local Config
        </div>
      </div>

      <div
        className="mb-3 grid gap-2 rounded-2xl border p-3 sm:grid-cols-2 xl:grid-cols-6"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
        }}
      >
        {configStats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>

      <div
        className="rounded-2xl border p-3"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
        }}
      >
        <div
          className="mb-2 text-xs font-black uppercase tracking-[0.14em]"
          style={{ color: "var(--primary)" }}
        >
          Layout Snapshot
        </div>

        <div
          className="grid gap-2 text-xs sm:grid-cols-3"
          style={{ color: "var(--text-muted)" }}
        >
          <div>
            Sidebar Width:{" "}
            <span style={{ color: "var(--text)" }}>{sidebarWidth}px</span>
          </div>

          <div>
            Guide Height:{" "}
            <span style={{ color: "var(--text)" }}>{guideHeight}px</span>
          </div>

          <div>
            Current Mode:{" "}
            <span style={{ color: "var(--text)" }}>{appMode}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={exportConfig}
          disabled={isImporting}
          className="ttv-action-button ttv-touch-target rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Export Config
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="ttv-touch-target rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))",
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
        className="mt-3 rounded-2xl border px-3 py-2 text-xs leading-5"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: message.toLowerCase().includes("failed")
            ? "rgba(248, 113, 113, 0.45)"
            : "var(--border)",
          color: message.toLowerCase().includes("failed")
            ? "#fecaca"
            : "var(--text-muted)",
        }}
        aria-live="polite"
      >
        {message}
      </div>

      <div
        className="mt-3 rounded-2xl border px-3 py-2 text-[11px] leading-5"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
          color: "var(--text-muted)",
        }}
      >
        This backs up programming metadata and Cloudflare/R2 URLs only. It does
        not export actual MP4 files. Imported configs always restore in viewer
        mode; admin access must be re-authenticated.
      </div>
    </section>
  );
}