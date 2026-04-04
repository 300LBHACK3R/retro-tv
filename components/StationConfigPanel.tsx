"use client";

import { useRef } from "react";
import { useStore } from "@/lib/store";
import type { Channel, MediaItem, ThemeId } from "@/lib/types";

type ExportPayload = {
  media: MediaItem[];
  channels: Channel[];
  currentChannelId: string;
  sidebarWidth: number;
  guideHeight: number;
  appMode: "viewer" | "admin";
  themeId: ThemeId;
  ownedPremiumThemes: ThemeId[];
};

export default function StationConfigPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const guideHeight = useStore((state) => state.guideHeight);
  const appMode = useStore((state) => state.appMode);
  const themeId = useStore((state) => state.themeId);
  const ownedPremiumThemes = useStore((state) => state.ownedPremiumThemes);

  const exportConfig = () => {
    const payload: ExportPayload = {
      media,
      channels,
      currentChannelId,
      sidebarWidth,
      guideHeight,
      appMode,
      themeId,
      ownedPremiumThemes,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tates-tv-station-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConfig = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<ExportPayload>;

    const existingRaw = localStorage.getItem("retro-tv-launch-v1");
    const existing = existingRaw ? JSON.parse(existingRaw) : { state: {} };

    existing.state = {
      ...existing.state,
      media: parsed.media ?? existing.state.media ?? [],
      channels: parsed.channels ?? existing.state.channels ?? [],
      currentChannelId:
        parsed.currentChannelId ?? existing.state.currentChannelId ?? "1",
      sidebarWidth: parsed.sidebarWidth ?? existing.state.sidebarWidth ?? 420,
      guideHeight: parsed.guideHeight ?? existing.state.guideHeight ?? 290,
      appMode: parsed.appMode ?? existing.state.appMode ?? "viewer",
      themeId: parsed.themeId ?? existing.state.themeId ?? "shaw-2006",
      ownedPremiumThemes:
        parsed.ownedPremiumThemes ?? existing.state.ownedPremiumThemes ?? [],
    };

    localStorage.setItem("retro-tv-launch-v1", JSON.stringify(existing));
    window.location.reload();
  };

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="mb-3 text-sm font-semibold tracking-wide">
        Station Config
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={exportConfig}
          className="rounded-lg px-3 py-2 text-sm font-medium transition"
          style={{
            background: "var(--button-bg)",
            color: "var(--text)",
          }}
        >
          Export Config
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg px-3 py-2 text-sm font-medium transition"
          style={{
            background: "var(--button-bg)",
            color: "var(--text)",
          }}
        >
          Import Config
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importConfig(file);
          }}
        />
      </div>

      <div className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
        Export and restore channels, media metadata, layout, mode, and theme settings.
      </div>
    </div>
  );
}