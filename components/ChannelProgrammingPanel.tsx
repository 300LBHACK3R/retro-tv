"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";

function prettyDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const hours = Math.floor(mins / 60);

  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

export default function ChannelProgrammingPanel() {
  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const removeMediaFromChannel = useStore(
    (state) => state.removeMediaFromChannel
  );
  const moveMediaInChannel = useStore((state) => state.moveMediaInChannel);

  const activeChannel = channels.find(
    (channel) => channel.id === currentChannelId
  );

  const programmedItems = useMemo(() => {
    if (!activeChannel) return [];
    return activeChannel.mediaIds
      .map((id) => media.find((item) => item.id === id))
      .filter(Boolean);
  }, [activeChannel, media]);

  return (
    <div className="rounded border border-blue-700 bg-[#0a2a4a] p-4 text-white">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold tracking-wide">
          Channel Programming
        </div>
        <div className="text-xs text-blue-200">
          {activeChannel ? `CH ${activeChannel.id} • ${activeChannel.name}` : "No Channel"}
        </div>
      </div>

      <div className="max-h-[340px] space-y-2 overflow-auto">
        {!activeChannel || programmedItems.length === 0 ? (
          <div className="text-xs text-blue-200">
            No programmed items for this channel yet.
          </div>
        ) : (
          programmedItems.map((item, index) => (
            <div
              key={`${item!.id}-${index}`}
              className="rounded border border-blue-700 bg-[#11345a]/70 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {item!.title}
                  </div>
                  <div className="mt-1 text-[11px] text-blue-200">
                    {item!.type.toUpperCase()} • {prettyDuration(item!.duration)}
                  </div>
                </div>

                <div className="text-[11px] text-blue-200">
                  Slot {index + 1}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    moveMediaInChannel(currentChannelId, index, index - 1)
                  }
                  disabled={index === 0}
                  className="rounded border border-blue-700 bg-[#0d3157] px-2 py-1 text-xs hover:bg-[#174675] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Move Up
                </button>

                <button
                  onClick={() =>
                    moveMediaInChannel(currentChannelId, index, index + 1)
                  }
                  disabled={index === programmedItems.length - 1}
                  className="rounded border border-blue-700 bg-[#0d3157] px-2 py-1 text-xs hover:bg-[#174675] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Move Down
                </button>

                <button
                  onClick={() =>
                    removeMediaFromChannel(currentChannelId, item!.id)
                  }
                  className="rounded border border-red-700 bg-red-900/50 px-2 py-1 text-xs text-white hover:bg-red-800/70"
                >
                  Remove from Channel
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}