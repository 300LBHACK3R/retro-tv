"use client";

import { useRef } from "react";
import { useStore } from "@/lib/store";
import type { Channel, MediaItem } from "@/lib/types";

type ExportPayload = {
  media: Array<
    Omit<MediaItem, "file"> & {
      file: string;
    }
  >;
  channels: Channel[];
  currentChannelId: string;
  sidebarWidth: number;
  guideHeight: number;
};

export default function StationConfigPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const guideHeight = useStore((state) => state.guideHeight);
  const setMedia = useStore((state) => state.setMedia);
  const setChannel = useStore((state) => state.setChannel);
  const setSidebarWidth = useStore((state) => state.setSidebarWidth);
  const setGuideHeight = useStore((state) => state.setGuideHeight);

  const exportConfig = () => {
    const payload: ExportPayload = {
      media: media.map((item) => ({
        ...item,
        file: item.file,
      })),
      channels,
      currentChannelId,
      sidebarWidth,
      guideHeight,
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
    const parsed = JSON.parse(text) as ExportPayload;

    setMedia(parsed.media ?? []);
    setSidebarWidth(parsed.sidebarWidth ?? 420);
    setGuideHeight(parsed.guideHeight ?? 290);

    const raw = localStorage.getItem("retro-tv-final-v1");
    if (raw) {
      const existing = JSON.parse(raw);
      existing.state = {
        ...existing.state,
        media: parsed.media ?? [],
        channels: parsed.channels ?? [],
        currentChannelId: parsed.currentChannelId ?? "1",
        sidebarWidth: parsed.sidebarWidth ?? 420,
        guideHeight: parsed.guideHeight ?? 290,
      };
      localStorage.setItem("retro-tv-final-v1", JSON.stringify(existing));
    }

    if (parsed.currentChannelId) {
      setChannel(parsed.currentChannelId);
    }

    window.location.reload();
  };

  return (
    <div className="rounded border border-blue-700 bg-[#0a2a4a] p-4 text-white">
      <div className="mb-3 text-sm font-semibold tracking-wide">
        Station Config
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={exportConfig}
          className="rounded border border-blue-700 bg-[#11345a] px-3 py-2 text-sm hover:bg-[#174675]"
        >
          Export Config
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded border border-blue-700 bg-[#11345a] px-3 py-2 text-sm hover:bg-[#174675]"
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

      <div className="mt-3 text-xs text-blue-200">
        Export and restore your station layout, channels, and metadata.
      </div>
    </div>
  );
}