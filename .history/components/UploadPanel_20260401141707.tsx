"use client";

import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { MediaType } from "@/lib/types";

function makeId() {
  return `media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getVideoDuration(fileUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = fileUrl;

    video.onloadedmetadata = () => {
      resolve(Math.max(Math.floor(video.duration || 0), 1));
    };

    video.onerror = () => {
      resolve(1800);
    };
  });
}

function prettyDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const hours = Math.floor(mins / 60);

  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

export default function UploadPanel() {
  const channels = useStore((state) => state.channels);
  const media = useStore((state) => state.media);
  const addMedia = useStore((state) => state.addMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [mediaType, setMediaType] = useState<MediaType>("show");
  const [channelId, setChannelId] = useState("1");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const recentMedia = useMemo(() => {
    return [...media].slice(-6).reverse();
  }, [media]);

  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    setIsUploading(true);

    for (const file of fileArray) {
      const objectUrl = URL.createObjectURL(file);
      const duration = await getVideoDuration(objectUrl);

      const mediaItem = {
        id: makeId(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        type: mediaType,
        duration,
        file: objectUrl,
      };

      addMedia(mediaItem);
      assignMediaToChannel(channelId, mediaItem.id);
    }

    setIsUploading(false);
  };

  return (
    <div className="rounded border border-blue-700 bg-[#0a2a4a] p-4">
      <div className="mb-3 text-sm font-semibold tracking-wide text-white">
        Media Library
      </div>

      <div className="grid gap-3">
        <div>
          <label className="mb-1 block text-xs text-blue-200">Type</label>
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as MediaType)}
            className="w-full rounded border border-blue-700 bg-[#11345a] px-3 py-2 text-white"
          >
            <option value="show">Show</option>
            <option value="movie">Movie</option>
            <option value="commercial">Commercial</option>
            <option value="bumper">Bumper</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs text-blue-200">Channel</label>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="w-full rounded border border-blue-700 bg-[#11345a] px-3 py-2 text-white"
          >
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                CH {channel.id} • {channel.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="rounded border border-blue-700 bg-[#11345a] px-4 py-2 text-white hover:bg-[#174675]"
        >
          Browse Video Files
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void processFiles(e.target.files);
          }}
        />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            void processFiles(e.dataTransfer.files);
          }}
          className={`rounded border border-dashed p-4 text-center text-sm transition ${
            isDragging
              ? "border-blue-300 bg-blue-500/10"
              : "border-blue-700 bg-[#0d3157]/40"
          }`}
        >
          Drag and drop video files here
        </div>

        <div className="text-xs text-blue-200">
          {isUploading
            ? "Uploading and reading metadata..."
            : "Uploads currently work in browser session mode."}
        </div>
      </div>

      <div className="mt-4 rounded border border-blue-700 bg-[#0d3157]/50 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-200">
          Recent Media
        </div>

        <div className="space-y-2">
          {recentMedia.length === 0 ? (
            <div className="text-xs text-blue-200">No media yet.</div>
          ) : (
            recentMedia.map((item) => (
              <div
                key={item.id}
                className="rounded border border-blue-700 bg-[#11345a]/70 px-3 py-2"
              >
                <div className="truncate text-sm font-medium text-white">
                  {item.title}
                </div>
                <div className="text-[11px] text-blue-200">
                  {item.type.toUpperCase()} • {prettyDuration(item.duration)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}