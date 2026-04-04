"use client";

import { getLiveState } from "@/lib/liveEngine";
import type { Channel, MediaItem } from "@/lib/types";

const PX_PER_MINUTE = 4;
const ROW_HEIGHT = 60;
const MIN_ITEM_WIDTH = 40;

type MultiGuideRow = {
  channel: Channel;
  schedule: MediaItem[];
};

function formatTime(date: Date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function MultiGuide({ data }: { data: MultiGuideRow[] }) {
  const now = new Date();

  return (
    <div className="overflow-x-auto rounded border border-blue-700 bg-[#0a2a4a] text-white">
      <div className="flex items-center justify-between border-b border-blue-600 p-3 text-sm">
        <div className="font-bold">TATE&apos;S TV</div>
        <div className="text-blue-200">Listings • Shaw 2006</div>
        <div>{formatTime(now)}</div>
      </div>

      <div className="flex min-w-max">
        <div className="flex flex-col">
          {data.map(({ channel }) => (
            <div
              key={channel.id}
              style={{ height: `${ROW_HEIGHT}px` }}
              className="flex w-[90px] items-center justify-center border-b border-r border-blue-600 bg-[#102f52] text-sm font-semibold"
            >
              CH {channel.id}
            </div>
          ))}
        </div>

        <div className="relative flex flex-col">
          {data.map(({ channel, schedule }) => {
            const live = getLiveState(schedule);

            let cumulativeSeconds = 0;

            return (
              <div
                key={channel.id}
                style={{ height: `${ROW_HEIGHT}px` }}
                className="relative border-b border-blue-600 bg-[#103456]"
              >
                {schedule.map((item, index) => {
                  const width = Math.max(
                    (item.duration / 60) * PX_PER_MINUTE,
                    MIN_ITEM_WIDTH
                  );

                  const left = (cumulativeSeconds / 60) * PX_PER_MINUTE;
                  cumulativeSeconds += item.duration;

                  return (
                    <div
                      key={`${item.id}-${index}`}
                      style={{
                        width: `${width}px`,
                        left: `${left}px`,
                        position: "absolute",
                        top: 0,
                        height: `${ROW_HEIGHT}px`,
                      }}
                      className={`border border-blue-500 p-2 text-xs ${
                        index === live.index
                          ? "bg-yellow-300 text-black"
                          : "bg-blue-800 text-white"
                      }`}
                    >
                      <div className="truncate font-semibold">{item.title}</div>
                      <div className="mt-1 text-[10px] opacity-80">
                        {item.duration >= 60
                          ? `${Math.floor(item.duration / 60)} min`
                          : `${item.duration}s`}
                      </div>
                    </div>
                  );
                })}

                {live.totalDuration > 0 && (
                  <div
                    className="absolute bottom-0 top-0 w-[2px] bg-red-500"
                    style={{
                      left: `${(live.offsetInLoop / live.totalDuration) * Math.max((cumulativeSeconds / 60) * PX_PER_MINUTE, 1)}px`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}