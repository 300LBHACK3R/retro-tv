"use client";

import { getLiveState } from "@/lib/liveEngine";

const PX_PER_MINUTE = 4;
const ROW_HEIGHT = 60;

export default function MultiGuide({ data }: any) {
  const now = new Date();

  return (
    <div className="rounded border border-blue-700 bg-[#0a2a4a] text-white overflow-x-auto">

      {/* HEADER */}
      <div className="flex justify-between p-3 border-b border-blue-600 text-sm">
        <div className="font-bold">TATE'S TV</div>
        <div>Listings • Shaw 2006</div>
        <div>{now.toLocaleTimeString()}</div>
      </div>

      {/* GRID */}
      <div className="flex min-w-max">

        {/* LEFT CHANNEL COLUMN */}
        <div className="flex flex-col">
          {data.map(({ channel }: any) => (
            <div
              key={channel.id}
              className="h-[60px] w-[80px] border-b border-blue-600 flex items-center justify-center bg-[#102f52]"
            >
              CH {channel.id}
            </div>
          ))}
        </div>

        {/* RIGHT GUIDE */}
        <div className="flex flex-col relative">

          {data.map(({ channel, schedule }: any, rowIndex: number) => {
            const live = getLiveState(schedule);

            let cumulative = 0;

            return (
              <div
                key={channel.id}
                className="relative h-[60px] border-b border-blue-600"
              >
                {schedule.map((item: any, i: number) => {
                  const width = Math.max((item.duration / 60) * PX_PER_MINUTE, 40);
                  const left = (cumulative / 60) * PX_PER_MINUTE;
                  cumulative += item.duration;

                  return (
                    <div
                      key={i}
                      style={{
                        width,
                        left,
                        position: "absolute",
                      }}
                      className={`h-full border border-blue-500 p-2 text-xs ${
                        i === live.index
                          ? "bg-yellow-300 text-black"
                          : "bg-blue-800"
                      }`}
                    >
                      <div className="truncate font-semibold">
                        {item.title}
                      </div>
                    </div>
                  );
                })}

                {/* LIVE LINE */}
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-red-500"
                  style={{
                    left: `${(live.offsetInLoop / live.totalDuration) * 100}%`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}