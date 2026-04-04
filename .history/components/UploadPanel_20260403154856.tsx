"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { MediaItem, MediaType } from "@/lib/types";

function makeId() {
  return `media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState("1800");
  const [mediaType, setMediaType] = useState<MediaType>("show");
  const [channelId, setChannelId] = useState("1");
  const [lastMessage, setLastMessage] = useState("");

  const recentMedia = useMemo(() => {
    return [...media].slice(-6).reverse();
  }, [media]);

  const addHostedMedia = () => {
    if (!title.trim() || !url.trim()) {
      setLastMessage("Title and URL are required.");
      return;
    }

    const durationNumber = Number(duration);
    if (!Number.isFinite(durationNumber) || durationNumber <= 0) {
      setLastMessage("Duration must be a valid number of seconds.");
      return;
    }

    const mediaItem: MediaItem = {
      id: makeId(),
      title: title.trim(),
      type: mediaType,
      duration: durationNumber,
      file: url.trim(),
      originalName: title.trim(),
    };

    addMedia(mediaItem);
    assignMediaToChannel(channelId, mediaItem.id);

    setTitle("");
    setUrl("");
    setDuration("1800");
    setLastMessage(`Added "${mediaItem.title}" to CH ${channelId}.`);
  };

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="mb-3 text-sm font-semibold tracking-wide">
        Launch Media
      </div>

      <div className="grid gap-3">
        <div>
          <label
            className="mb-1 block text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Demo Show"
            className="w-full rounded-lg border px-3 py-2"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        <div>
          <label
            className="mb-1 block text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Public MP4 URL or /public path
          </label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/demo-show.mp4 or https://..."
            className="w-full rounded-lg border px-3 py-2"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label
              className="mb-1 block text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Type
            </label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as MediaType)}
              className="w-full rounded-lg border px-3 py-2"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              <option value="show">Show</option>
              <option value="movie">Movie</option>
              <option value="commercial">Commercial</option>
              <option value="bumper">Bumper</option>
            </select>
          </div>

          <div>
            <label
              className="mb-1 block text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Duration (seconds)
            </label>
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

          <div>
            <label
              className="mb-1 block text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Channel
            </label>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  CH {channel.id} • {channel.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={addHostedMedia}
          className="rounded-lg px-4 py-2 text-sm font-medium transition"
          style={{
            background: "var(--primary)",
            color: "var(--text)",
          }}
        >
          Add Media
        </button>

        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          {lastMessage || "For launch, use public MP4 paths or hosted MP4 URLs only."}
        </div>
      </div>

      <div
        className="mt-4 rounded-xl border p-3"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
        }}
      >
        <div
          className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--text-muted)" }}
        >
          Recent Media
        </div>

        <div className="space-y-2">
          {recentMedia.length === 0 ? (
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              No media yet.
            </div>
          ) : (
            recentMedia.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border px-3 py-2"
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="truncate text-sm font-medium">{item.title}</div>
                <div
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
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