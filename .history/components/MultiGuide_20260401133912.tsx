"use client";

import { useEffect, useState } from "react";
import { getLiveState } from "@/lib/liveEngine";
import { useStore } from "@/lib/store";
import type { Channel, MediaItem } from "@/lib/types";

const PX_PER_MINUTE = 4;
const ROW_HEIGHT = 52;
const MIN_ITEM_WIDTH = 40;
const SLOT_MINUTES = 30;
const SLOT_COUNT = 6;
const CHANNEL_COLUMN_WIDTH = 96;

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

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)} min`;
}

export default function MultiGuide({ data }: { data: MultiGuideRow[] }) {
  const currentChannelId = useStore((state) => state.currentChannelId);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());

    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!mounted || !now) return null;

  const totalTimelineWidth = SLOT_COUNT * SLOT_MINUTES * PX_PER_MINUTE;

  const firstSchedule = data[0]?.schedule ?? [];
  const firstLive = getLiveState(firstSchedule);
  const startTime = new Date(now.getTime() - firstLive.elapsed * 1000);

  return (
    <div className="overflow-x-auto rounded border border-blue-700 bg-[#0a2a4a] text-white">
      <div className="flex items-center justify-between border-b border-blue-600 p-3 text-sm">
        <div className="font-bold tracking-wide">TATE&apos;S TV</div>
        <div className="text-blue-200">Listings • Shaw 2006</div>
        <div>{formatTime(now)}</div>
      </div>

      <div className="min-w-max">
        <div className="flex border-b border-blue-600 bg-[#0d3157] text-xs text-blue-200">
          <div
            className="shrink-0 border-r border-blue-600 px-2 py-2"
            style={{ width: `${CHANNEL_COLUMN_WIDTH}px` }}
          >
            Channels
          </div>

          <div className="flex" style={{ width: `${totalTimelineWidth}px` }}>
            {Array.from({ length: SLOT_COUNT }).map((_, i) => {
              const tickTime = new Date(
                startTime.getTime() + i * SLOT_MINUTES * 60 * 1000
              );

              return (
                <div
                  key={i}
                  className="border-r border-blue-500 px-2 py-2 last:border-r-0"
                  style={{ width: `${SLOT_MINUTES * PX_PER_MINUTE}px` }}
                >
                  {formatTime(tickTime)}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex">
          <div className="flex flex-col">
            {data.map(({ channel }) => {
              const isActive = channel.id === currentChannelId;

              return (
                <div
                  key={channel.id}
                  style={{
                    height: `${ROW_HEIGHT}px`,
                    width: `${CHANNEL_COLUMN_WIDTH}px`,
                  }}
                  className={`flex shrink-0 flex-col items-start justify-center border-b border-r border-blue-600 px-3 ${
                    isActive
                      ? "bg-[#d6dde8] text-[#0b1a2b]"
                      : "bg-[#0f2c4d] text-white"
                  }`}
                >
                  <div className="text-[13px] font-bold">CH {channel.id}</div>
                  <div className="text-[10px] tracking-wide opacity-80">
                    {channel.name.toUpperCase()}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col">
            {data.map(({ channel, schedule }, rowIndex) => {
              const isActive = channel.id === currentChannelId;
              const live = getLiveState(schedule);

              let cumulativeSeconds = 0;

              return (
                <div
                  key={channel.id}
                  style={{
                    height: `${ROW_HEIGHT}px`,
                    width: `${totalTimelineWidth}px`,
                  }}
                  className={`relative border-b border-blue-600 ${
                    isActive
                      ? "bg-[#1a4f85]"
                      : rowIndex % 2 === 0
                      ? "bg-[#103456]"
                      : "bg-[#0e2f4f]"
                  }`}
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
                          top: 0,
                          height: `${ROW_HEIGHT}px`,
                          position: "absolute",
                        }}
                        className={`border border-blue-500 px-2 py-1 text-[11px] leading-tight ${
                          index === live.index
                            ? "bg-yellow-300 text-black"
                            : "bg-blue-800 text-white"
                        }`}
                      >
                        <div className="truncate font-semibold tracking-tight">
                          {item.title}
                        </div>
                        <div className="mt-1 text-[10px] opacity-80">
                          {formatDuration(item.duration)}
                        </div>
                      </div>
                    );
                  })}

                  {live.totalDuration > 0 && (
                    <div
                      className="absolute bottom-0 top-0 w-[2px] bg-red-500"
                      style={{
                        left: `${(live.offsetInLoop / live.totalDuration) * totalTimelineWidth}px`,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}