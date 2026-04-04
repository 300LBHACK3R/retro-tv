"use client";

import { getLiveState } from "@/lib/liveEngine";
import type { MediaItem } from "@/lib/types";

const PX_PER_MINUTE = 4; // tweak this for zoom level

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function GuideGrid({ schedule }: { schedule: MediaItem[] }) {
  const live = getLiveState(schedule);

  if (!schedule.length) {
    return (
      <div className="rounded border border-blue-700 bg-[#0a2a4a] p-4 text-white">
        No schedule loaded.
      </div>
    );
  }

  // 🧠 start time = current time minus elapsed into current show
  const now = new Date();
  const startTime = new Date(now.getTime() - live.elapsed * 1000);

  return (
    <div className="overflow-x-auto rounded border border-blue-700 bg-[#0a2a4a] p-4 text-white">

      {/* HEADER */}
      <div className="mb-3 flex items-center justify-between border-b border-blue-600 pb-2 text-sm">
        <div className="font-bold">TATE&apos;S TV</div>
        <div className="text-blue-200">Listings • Shaw 2006</div>
        <div>{formatTime(now)}</div>
      </div>

      {/* TIME AXIS */}
      <div className="relative mb-2 flex min-w-max text-xs text-blue-200">
        {[...Array(6)].map((_, i) => {
          const time = new Date(startTime.getTime() + i * 30 * 60000);
          return (
            <div
              key={i}
              style={{ width: `${30 * PX_PER_MINUTE}px` }}
              className="border-r border-blue-500 px-1"
            >
              {formatTime(time)}
            </div>
          );
        })}
      </div>

      {/* GUIDE ROW */}
      <div className="relative flex min-w-max">
        {schedule.map((item, index) => {
          const minutes = item.duration / 60;

          return (
            <div
              key={`${item.id}-${index}`}
              style={{ width: `${minutes * PX_PER_MINUTE}px` }}
              className={`border border-blue-500 p-2 text-xs ${
                index === live.index
                  ? "bg-yellow-300 text-black"
                  : "bg-blue-800 text-white"
              }`}
            >
              <div className="font-semibold truncate">{item.title}</div>
              <div className="text-[10px] opacity-80">
                {Math.floor(minutes)} min
              </div>
            </div>
          );
        })}

        {/* 🔴 LIVE LINE */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-red-500"
          style={{
            left: `${live.progress * 100}%`,
          }}
        />
      </div>
    </div>
  );
}