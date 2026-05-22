"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { MediaItem, MediaType } from "@/lib/types";

function makeId(title: string) {
  const safe = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${safe || "media"}-${Date.now()}`;
}

function prettyDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;

  const mins = Math.floor(seconds / 60);
  const hours = Math.floor(mins / 60);

  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

function cleanUrl(value: string) {
  return value.trim().replace(/\s/g, "%20");
}

function isRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

export default function UploadPanel() {
  const channels = useStore((state) => state.channels);
  const media = useStore((state) => state.media);
  const addMedia = useStore((state) => state.addMedia);
  const removeMedia = useStore((state) => state.removeMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);

  const [title, setTitle] = useState("");
  const [cloudUrl, setCloudUrl] = useState("");
  const [duration, setDuration] = useState("1800");
  const [mediaType, setMediaType] = useState<MediaType>("show");
  const [channelId, setChannelId] = useState("1");
  const [lastMessage, setLastMessage] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const finalPath = useMemo(() => cleanUrl(cloudUrl), [cloudUrl]);
  const recentMedia = useMemo(() => [...media].slice(-10).reverse(), [media]);

  const testPath = () => {
    if (!finalPath) {
      setLastMessage("Paste a Cloudflare/R2 public URL first.");
      return;
    }

    window.open(finalPath, "_blank", "noopener,noreferrer");
  };

  const addHostedMedia = () => {
    setLastMessage("");

    const cleanTitle = title.trim();
    const cleanPath = finalPath.trim();

    if (!cleanTitle) {
      setLastMessage("Title is required.");
      return;
    }

    if (!cleanPath) {
      setLastMessage("Cloudflare/R2 URL is required.");
      return;
    }

    if (!isRemoteUrl(cleanPath)) {
      setLastMessage("Media URL must start with https://");
      return;
    }

    const durationNumber = Number(duration);

    if (!Number.isFinite(durationNumber) || durationNumber <= 0) {
      setLastMessage("Duration must be a valid number of seconds.");
      return;
    }

    const duplicate = media.find(
      (item) => item.file.trim().toLowerCase() === cleanPath.toLowerCase()
    );

    if (duplicate) {
      assignMediaToChannel(channelId, duplicate.id);
      setLastMessage(`Already existed. Assigned "${duplicate.title}" to CH ${channelId}.`);
      return;
    }

    try {
      setIsAdding(true);

      const mediaItem: MediaItem = {
        id: makeId(cleanTitle),
        title: cleanTitle,
        type: mediaType,
        duration: Math.floor(durationNumber),
        file: cleanPath,
        originalName: cleanPath.split("/").pop() ?? cleanTitle,
      };

      addMedia(mediaItem);
      assignMediaToChannel(channelId, mediaItem.id);

      setLastMessage(`Added "${mediaItem.title}" to CH ${channelId}.`);

      setTitle("");
      setCloudUrl("");
      setDuration("1800");
    } catch (error) {
      console.error(error);
      setLastMessage("Failed to add media. Check the console.");
    } finally {
      setIsAdding(false);
    }
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
        <div
          className="rounded-xl border p-3"
          style={{
            borderColor: "var(--border)",
            background: "var(--panel-alt-bg)",
          }}
        >
          <div
            className="mb-1 text-xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--text-muted)" }}
          >
            Cloudflare R2 Source
          </div>

          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Paste the public Cloudflare video URL. This stores the media entry
            in your browser and assigns it to the selected channel.
          </div>
        </div>

        <div>
          <label
            className="mb-1 block text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Title
          </label>

          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Naruto EP01"
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
            Cloudflare/R2 Public URL
          </label>

          <input
            value={cloudUrl}
            onChange={(event) => setCloudUrl(event.target.value)}
            placeholder="https://pub-xxxx.r2.dev/naruto-s01e01.mp4"
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
            Final media source
          </label>

          <input
            value={finalPath}
            readOnly
            className="w-full rounded-lg border px-3 py-2"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text-muted)",
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
              onChange={(event) => setMediaType(event.target.value as MediaType)}
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
              onChange={(event) => setDuration(event.target.value)}
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
              onChange={(event) => setChannelId(event.target.value)}
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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={testPath}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition"
            style={{
              background: "var(--button-bg)",
              color: "var(--text)",
            }}
          >
            Test Path
          </button>

          <button
            type="button"
            onClick={addHostedMedia}
            disabled={isAdding}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
            style={{
              background: "var(--primary)",
              color: "var(--text)",
            }}
          >
            {isAdding ? "Adding..." : "Add Media"}
          </button>
        </div>

        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          {lastMessage || "Use Cloudflare URLs for live streaming media."}
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
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {item.title}
                    </div>

                    <div
                      className="text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {item.type.toUpperCase()} •{" "}
                      {prettyDuration(item.duration)}
                    </div>

                    <div
                      className="mt-1 truncate text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {item.file}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeMedia(item.id)}
                    className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold"
                    style={{
                      background: "var(--button-bg)",
                      color: "var(--text)",
                    }}
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-2">
                  <a
                    href={item.file}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline"
                    style={{ color: "var(--primary)" }}
                  >
                    Test media path
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}