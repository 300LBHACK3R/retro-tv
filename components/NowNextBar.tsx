"use client";

import { useEffect, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import type { Channel, MediaItem } from "@/lib/types";

function formatClock(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

interface NowNextBarProps {
  channel: Channel | undefined;
  schedule: MediaItem[];
}

export default function NowNextBar({ channel, schedule }: NowNextBarProps) {
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <div
        className="rounded-2xl border p-4"
        style={{
          background: "var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div className="text-sm font-medium">Loading channel data...</div>
      </div>
    );
  }

  const live = getLiveState(schedule);
  void tick;

  if (!channel || !live.item) {
    return (
      <div
        className="rounded-2xl border p-4"
        style={{
          background: "var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div className="text-sm font-medium">No active channel data</div>
        <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Load or assign media to begin playback.
        </div>
      </div>
    );
  }

  const nextItem =
    live.index >= 0 && live.index + 1 < schedule.length
      ? schedule[live.index + 1]
      : schedule[0];

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            Channel
          </div>
          <div className="mt-1 text-base font-semibold">
            CH {channel.id} • {channel.branding?.displayName || channel.name}
          </div>
        </div>

        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            Now Playing
          </div>
          <div className="mt-1 text-base font-semibold">{live.item.title}</div>
          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {formatClock(live.elapsed)} / {formatClock(live.item.duration)}
          </div>
        </div>

        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            Next Up
          </div>
          <div className="mt-1 text-base font-semibold">
            {nextItem ? nextItem.title : "Nothing queued"}
          </div>
        </div>
      </div>
    </div>
  );
}