"use client";

import { getLiveState } from "@/lib/liveEngine";
import type { MediaItem } from "@/lib/types";

export default function GuideGrid({ schedule }: { schedule: MediaItem[] }) {
  const live = getLiveState(schedule);

  if (!schedule.length) {
    return (
      <div className="rounded border border-blue-700 bg-[#0a2a4a] p-4 text-white">
        No schedule loaded.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-blue-700 bg-[#0a2a4a] p-4 text-white">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-bold tracking-wide">SHAW TV Listings</span>
        <span>{new Date().toLocaleTimeString()}</span>
      </div>

      <div className="relative flex min-w-max">
        {schedule.map((item, index) => (
          <div
            key={`${item.id}-${index}`}
            style={{ width: `${Math.max(item.duration / 8, 90)}px` }}
            className={`border border-blue-500 p-2 text-xs ${
              index === live.index
                ? "bg-yellow-300 text-black"
                : "bg-blue-800 text-white"
            }`}
          >
            <div className="font-semibold">{item.title}</div>
            <div className="mt-1 opacity-80">{item.duration}s</div>
          </div>
        ))}

        <div
          className="absolute bottom-0 top-0 w-[2px] bg-red-500"
          style={{
            left:
              live.totalDuration > 0
                ? `${(live.offsetInLoop / live.totalDuration) * 100}%`
                : "0%",
          }}
        />
      </div>
    </div>
  );
}