"use client";

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
  const live = getLiveState(schedule);

  if (!channel || !live.item) {
    return (
      <div className="rounded border border-blue-700 bg-[#0a2a4a] p-3 text-sm text-white">
        No active channel data.
      </div>
    );
  }

  const nextItem =
    live.index >= 0 && live.index + 1 < schedule.length
      ? schedule[live.index + 1]
      : schedule[0];

  const elapsed = live.elapsed;
  const total = live.item.duration;

  return (
    <div className="rounded border border-blue-700 bg-[#0a2a4a] p-3 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-blue-200">
            Channel
          </div>
          <div className="text-sm font-semibold">
            CH {channel.id} • {channel.name}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-blue-200">
            Now
          </div>
          <div className="text-sm font-semibold">{live.item.title}</div>
          <div className="text-[11px] text-blue-100/80">
            {formatClock(elapsed)} / {formatClock(total)}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-blue-200">
            Next
          </div>
          <div className="text-sm font-semibold">
            {nextItem ? nextItem.title : "Nothing queued"}
          </div>
        </div>
      </div>
    </div>
  );
}