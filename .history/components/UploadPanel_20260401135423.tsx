"use client";

import { useState } from "react";
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
      const duration = Math.max(Math.floor(video.duration || 0), 1);
      resolve(duration);
    };

    video.onerror = () => {
      resolve(1800);
    };
  });
}

export default function UploadPanel() {
  const channels = useStore((state) => state.channels);
  const addMedia = useStore((state) => state.addMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);

  const [mediaType, setMediaType] = useState<MediaType>("show");
  const [channelId, setChannelId] = useState("1");
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
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
    <div className="rounded border border-blue-700 bg-[#0a2a4a] p-4 text-white">
      <div className="mb-3 text-sm font-semibold tracking-wide">
        Upload Media
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-blue-200">Media Type</label>
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
          <label className="mb-1 block text-xs text-blue-200">Assign to Channel</label>
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

        <div>
          <label className="mb-1 block text-xs text-blue-200">Files</label>
          <input
            type="file"
            multiple
            accept="video/*"
            onChange={(e) => handleUpload(e.target.files)}
            className="block w-full rounded border border-blue-700 bg-[#11345a] px-3 py-2 text-white file:mr-3 file:rounded file:border-0 file:bg-blue-700 file:px-3 file:py-1 file:text-white"
          />
        </div>
      </div>

      <div className="mt-3 text-xs text-blue-200">
        {isUploading
          ? "Reading video metadata and adding files..."
          : "Upload MP4/WebM/etc. Duration is read automatically and assigned to the selected channel."}
      </div>
    </div>
  );
}