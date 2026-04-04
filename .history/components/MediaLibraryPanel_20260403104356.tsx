"use client";

import { useMemo, useState } from "react";
import { deleteMediaBlob } from "@/lib/media-db";
import { useStore } from "@/lib/store";
import type { MediaType } from "@/lib/types";

function prettyDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const hours = Math.floor(mins / 60);

  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

export default function MediaLibraryPanel() {
  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const removeMedia = useStore((state) => state.removeMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);
  const removeMediaFromChannel = useStore(
    (state) => state.removeMediaFromChannel
  );

  const [filter, setFilter] = useState<MediaType | "all">("all");

  const filteredMedia = useMemo(() => {
    if (filter === "all") return media;
    return media.filter((item) => item.type === filter);
  }, [filter, media]);

  const getAssignedChannels = (mediaId: string) => {
    return channels.filter((channel) => channel.mediaIds.includes(mediaId));
  };

  return (
    <div className="rounded border border-blue-700 bg-[#0a2a4a] p-4 text-white">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold tracking-wide">Media Manager</div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as MediaType | "all")}
          className="rounded border border-blue-700 bg-[#11345a] px-3 py-2 text-xs text-white"
        >
          <option value="all">All</option>
          <option value="show">Shows</option>
          <option value="movie">Movies</option>
          <option value="commercial">Commercials</option>
          <option value="bumper">Bumpers</option>
        </select>
      </div>

      <div className="max-h-[320px] space-y-2 overflow-auto">
        {filteredMedia.length === 0 ? (
          <div className="text-xs text-blue-200">No media found.</div>
        ) : (
          filteredMedia.map((item) => {
            const assignedChannels = getAssignedChannels(item.id);
            const isAssignedToCurrent = assignedChannels.some(
              (channel) => channel.id === currentChannelId
            );

            return (
              <div
                key={item.id}
                className="rounded border border-blue-700 bg-[#11345a]/70 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {item.title}
                    </div>
                    <div className="mt-1 text-[11px] text-blue-200">
                      {item.type.toUpperCase()} • {prettyDuration(item.duration)}
                    </div>
                    <div className="mt-2 text-[11px] text-blue-100/80">
                      Channels:{" "}
                      {assignedChannels.length
                        ? assignedChannels.map((c) => `CH ${c.id}`).join(", ")
                        : "None"}
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (item.storageKey) {
                        await deleteMediaBlob(item.storageKey);
                      }
                      removeMedia(item.id);
                    }}
                    className="rounded border border-red-700 bg-red-900/50 px-2 py-1 text-xs text-white hover:bg-red-800/70"
                  >
                    Delete
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {!isAssignedToCurrent ? (
                    <button
                      onClick={() =>
                        assignMediaToChannel(currentChannelId, item.id)
                      }
                      className="rounded border border-blue-700 bg-[#0d3157] px-2 py-1 text-xs hover:bg-[#174675]"
                    >
                      Add to CH {currentChannelId}
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        removeMediaFromChannel(currentChannelId, item.id)
                      }
                      className="rounded border border-blue-700 bg-[#0d3157] px-2 py-1 text-xs hover:bg-[#174675]"
                    >
                      Remove from CH {currentChannelId}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}