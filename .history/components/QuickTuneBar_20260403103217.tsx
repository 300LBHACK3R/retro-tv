"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";

export default function QuickTuneBar() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);

  const [value, setValue] = useState(currentChannelId);

  const validChannelIds = useMemo(
    () => new Set(channels.map((channel) => channel.id)),
    [channels]
  );

  const handleTune = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!validChannelIds.has(trimmed)) return;
    setChannel(trimmed);
  };

  return (
    <div className="flex items-center gap-2 rounded border border-blue-700 bg-[#0a2a4a] p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-blue-200">
        Quick Tune
      </div>

      <input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleTune();
        }}
        className="w-24 rounded border border-blue-700 bg-[#11345a] px-3 py-2 text-white outline-none"
        placeholder="CH #"
      />

      <button
        onClick={handleTune}
        className="rounded border border-blue-700 bg-[#11345a] px-4 py-2 text-white transition hover:bg-[#174675]"
      >
        Tune
      </button>

      <div className="ml-auto text-xs text-blue-100/80">
        Current: CH {currentChannelId}
      </div>
    </div>
  );
}