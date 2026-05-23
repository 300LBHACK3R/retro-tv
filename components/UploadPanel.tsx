"use client";

import { useMemo, useState } from "react";
import { probeVideoDuration } from "@/lib/mediaDuration";
import { useStore } from "@/lib/store";
import type { MediaItem, MediaType } from "@/lib/types";

function createMediaId(title: string): string {
  const clean = title
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : String(Date.now()).slice(-8);

  return `${clean || "media"}-${suffix}`;
}

function inferProvider(file: string): MediaItem["provider"] {
  if (file.includes(".r2.dev") || file.toLowerCase().includes("cloudflare")) {
    return "cloudflare-r2";
  }

  if (file.startsWith("/")) {
    return "local-dev";
  }

  if (file.startsWith("http://") || file.startsWith("https://")) {
    return "external-url";
  }

  return "unknown";
}

function inferNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const lastPart = decodeURIComponent(
      parsed.pathname.split("/").filter(Boolean).at(-1) ?? "",
    );

    return lastPart
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function formatDurationLabel(seconds: string): string {
  const value = Number(seconds);

  if (!Number.isFinite(value) || value <= 0) {
    return "Duration not set";
  }

  const total = Math.floor(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remaining}s`;
  }

  return `${minutes}m ${remaining}s`;
}

export default function UploadPanel() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const addMedia = useStore((state) => state.addMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);

  const [title, setTitle] = useState("");
  const [file, setFile] = useState("");
  const [type, setType] = useState<MediaType>("show");
  const [duration, setDuration] = useState("");
  const [channelId, setChannelId] = useState(currentChannelId);
  const [status, setStatus] = useState("");
  const [durationStatus, setDurationStatus] = useState("");
  const [isDetectingDuration, setIsDetectingDuration] = useState(false);

  const enabledChannels = useMemo(
    () =>
      channels
        .filter((channel) => channel.isEnabled !== false)
        .sort((a, b) => Number(a.number ?? a.id) - Number(b.number ?? b.id)),
    [channels],
  );

  const canAdd =
    title.trim().length > 0 &&
    file.trim().length > 0 &&
    Number.isFinite(Number(duration)) &&
    Number(duration) > 0 &&
    channelId.trim().length > 0;

  const detectDuration = async (url: string) => {
    const cleanUrl = url.trim();

    if (!cleanUrl) {
      setDurationStatus("Paste a video URL first.");
      return;
    }

    setIsDetectingDuration(true);
    setDurationStatus("Reading video duration...");

    try {
      const result = await probeVideoDuration(cleanUrl);

      setDuration(String(result.duration));
      setDurationStatus(`Detected ${result.durationLabel}.`);
    } catch (error) {
      setDurationStatus(
        error instanceof Error
          ? error.message
          : "Could not detect duration. Enter it manually.",
      );
    } finally {
      setIsDetectingDuration(false);
    }
  };

  const handleUrlChange = (value: string) => {
    setFile(value);
    setStatus("");

    if (!title.trim()) {
      const inferredTitle = inferNameFromUrl(value);

      if (inferredTitle) {
        setTitle(inferredTitle);
      }
    }
  };

  const addItem = () => {
    if (!canAdd) {
      setStatus("Fill in title, URL, duration, and channel first.");
      return;
    }

    const cleanTitle = title.trim();
    const cleanFile = file.trim();
    const cleanDuration = Math.max(1, Math.floor(Number(duration)));
    const id = createMediaId(cleanTitle);

    const item: MediaItem = {
      id,
      title: cleanTitle,
      type,
      duration: cleanDuration,
      file: cleanFile,
      mimeType: "video/mp4",
      originalName: cleanFile.split("/").at(-1) ?? cleanTitle,
      provider: inferProvider(cleanFile),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addMedia(item);
    assignMediaToChannel(channelId, item.id);

    setStatus(`Added "${item.title}" to CH ${channelId}.`);
    setTitle("");
    setFile("");
    setDuration("");
    setDurationStatus("");
  };

  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="mb-3">
        <div
          className="text-xs font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--primary)" }}
        >
          Add Media
        </div>

        <h2 className="mt-1 text-sm font-semibold">
          Cloudflare/R2 Video Entry
        </h2>

        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Paste a public video URL. Duration can be detected automatically from
          the video metadata.
        </p>
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
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            placeholder="Naruto S01E01"
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
            value={file}
            onChange={(event) => handleUrlChange(event.target.value)}
            onBlur={(event) => {
              if (!duration.trim()) {
                void detectDuration(event.target.value);
              }
            }}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            placeholder="https://pub-xxxx.r2.dev/video.mp4"
            spellCheck={false}
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
          <div>
            <label
              className="mb-1 block text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Type
            </label>

            <select
              value={type}
              onChange={(event) => setType(event.target.value as MediaType)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
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
              Duration Seconds
            </label>

            <div className="flex gap-2">
              <input
                value={duration}
                onChange={(event) =>
                  setDuration(event.target.value.replace(/[^\d]/g, ""))
                }
                className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                placeholder="Auto"
                inputMode="numeric"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />

              <button
                type="button"
                onClick={() => void detectDuration(file)}
                disabled={isDetectingDuration || !file.trim()}
                className="rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: "var(--button-bg)",
                  color: "var(--text)",
                }}
              >
                {isDetectingDuration ? "..." : "Auto"}
              </button>
            </div>

            <div
              className="mt-1 text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              {durationStatus || formatDurationLabel(duration)}
            </div>
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
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              {enabledChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  CH {channel.number ?? channel.id} •{" "}
                  {channel.branding?.displayName ?? channel.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={addItem}
          disabled={!canAdd}
          className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.01] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))",
            color: "var(--text)",
          }}
        >
          Add Media
        </button>

        {status ? (
          <div
            className="rounded-xl border px-3 py-2 text-xs"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          >
            {status}
          </div>
        ) : null}
      </div>
    </section>
  );
}