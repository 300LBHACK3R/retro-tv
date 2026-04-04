"use client";

import { getLiveState } from "@/lib/liveEngine";
import type { MediaItem } from "@/lib/types";

const PX_PER_MINUTE = 4;
const SLOT_MINUTES = 30;
const AXIS_SLOTS = 6;
const MIN_ITEM_WIDTH = 40;

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);

  if (minutes >= 1) return `${minutes} min`;
  return `${seconds}s`;
}

export default function GuideGrid({ schedule }: { schedule: MediaItem[] }) {
  const live = getLiveState(schedule);

  if (!schedule.length || !live.item) {
    return (
      <div className="rounded border border-blue-700 bg-[#0a2a4a] p-4 text-white">
        No schedule loaded.
      </div>
    );
  }

  const now = new Date();
  const currentItemStart = new Date(now.getTime() - live.elapsed * 1000);

  const totalTimelineWidth = AXIS_SLOTS * SLOT_MINUTES * PX_PER_MINUTE;

  let cumulativeSeconds = 0;

  return (
    <div className="overflow-x-auto rounded border border-blue-700 bg-[#0a2a4a] p-4 text-white">
      <div className="mb-3 flex items-center justify-between border-b border-blue-600 pb-2 text-sm">
        <div className="font-bold">TATE&apos;S TV</div>
        <div className="text-blue-200">Listings • Shaw 2006</div>
        <div>{formatTime(now)}</div>
      </div>

      <div className="relative min-w-max" style={{ width: `${totalTimelineWidth}px` }}>
        <div className="mb-2 flex text-xs text-blue-200">
          {Array.from({ length: AXIS_SLOTS }).map((_, i) => {
            const tickTime = new Date(currentItemStart.getTime() + i * SLOT_MINUTES * 60000);

            return (
              <div
                key={i}
                style={{ width: `${SLOT_MINUTES * PX_PER_MINUTE}px` }}
                className="border-r border-blue-500 px-1 last:border-r-0"
              >
                {formatTime(tickTime)}
              </div>
            );
          })}
        </div>

        <div className="relative flex h-[60px]">
          {schedule.map((item, index) => {
            const minutes = item.duration / 60;
            const width = Math.max(minutes * PX_PER_MINUTE, MIN_ITEM_WIDTH);

            const left = cumulativeSeconds / 60 * PX_PER_MINUTE;
            cumulativeSeconds += item.duration;

            return (
              <div
                key={`${item.id}-${index}`}
                style={{
                  width: `${width}px`,
                  left: `${left}px`,
                  position: "absolute",
                }}
                className={`top-0 h-[60px] border border-blue-500 p-2 text-xs ${
                  index === live.index
                    ? "bg-yellow-300 text-black"
                    : "bg-blue-800 text-white"
                }`}
              >
                <div className="truncate font-semibold">{item.title}</div>
                <div className="mt-1 text-[10px] opacity-80">
                  {formatDuration(item.duration)}
                </div>
              </div>
            );
          })}

          <div
            className="absolute top-0 bottom-0 w-[2px] bg-red-500"
            style={{
              left: `${(live.offsetInLoop / live.totalDuration) * totalTimelineWidth}px`,
            }}
          />
        </div>
      </div>
    </div>
  );
}