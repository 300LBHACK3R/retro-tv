"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Channel, MediaItem, MediaType } from "@/lib/types";

const DEFAULT_DURATION_SECONDS = "1800";

type PanelMessage = {
  type: "idle" | "success" | "warning" | "error";
  text: string;
};

const MEDIA_TYPE_OPTIONS: Array<{ value: MediaType; label: string }> = [
  { value: "show", label: "Show" },
  { value: "movie", label: "Movie" },
  { value: "commercial", label: "Commercial" },
  { value: "bumper", label: "Bumper" },
];

function makeId(title: string): string {
  const safe = title
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${safe || "media"}-${crypto.randomUUID().slice(0, 8)}`;
  }

  return `${safe || "media"}-${Date.now()}`;
}

function prettyDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));

  if (safeSeconds < 60) {
    return `${safeSeconds}s`;
  }

  const minutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  return `${minutes}m`;
}

function cleanUrl(value: string): string {
  return value.trim().replace(/\s/g, "%20");
}

function isRemoteUrl(value: string): boolean {
  return /^https:\/\/.+/i.test(value.trim());
}

function looksLikePlayableVideoUrl(value: string): boolean {
  const cleanValue = value.trim().toLowerCase();

  return (
    cleanValue.endsWith(".mp4") ||
    cleanValue.includes(".mp4?") ||
    cleanValue.includes(".mp4#")
  );
}

function getFileNameFromUrl(value: string): string {
  try {
    const url = new URL(value);
    const pathname = decodeURIComponent(url.pathname);
    const fileName = pathname.split("/").filter(Boolean).pop();

    return fileName ?? "";
  } catch {
    return value.split("/").filter(Boolean).pop() ?? "";
  }
}

function titleFromFilename(fileName: string): string {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getChannelLabel(channel: Channel): string {
  return `CH ${channel.number ?? channel.id}`;
}

function getProviderLabel(file: string): string {
  if (file.includes(".r2.dev") || file.toLowerCase().includes("cloudflare")) {
    return "Cloudflare R2";
  }

  if (file.startsWith("https://")) {
    return "Remote URL";
  }

  if (file.startsWith("/")) {
    return "Local Dev";
  }

  return "Unknown";
}

function getMessageStyles(type: PanelMessage["type"]) {
  if (type === "success") {
    return {
      borderColor: "rgba(34, 197, 94, 0.35)",
      background: "rgba(34, 197, 94, 0.08)",
      color: "#86efac",
    };
  }

  if (type === "warning") {
    return {
      borderColor: "rgba(250, 204, 21, 0.35)",
      background: "rgba(250, 204, 21, 0.08)",
      color: "#fde68a",
    };
  }

  if (type === "error") {
    return {
      borderColor: "rgba(248, 113, 113, 0.35)",
      background: "rgba(248, 113, 113, 0.08)",
      color: "#fca5a5",
    };
  }

  return {
    borderColor: "var(--border)",
    background: "var(--panel-alt-bg)",
    color: "var(--text-muted)",
  };
}

export default function UploadPanel() {
  const channels = useStore((state) => state.channels);
  const media = useStore((state) => state.media);
  const addMedia = useStore((state) => state.addMedia);
  const removeMedia = useStore((state) => state.removeMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);

  const [title, setTitle] = useState("");
  const [cloudUrl, setCloudUrl] = useState("");
  const [duration, setDuration] = useState(DEFAULT_DURATION_SECONDS);
  const [mediaType, setMediaType] = useState<MediaType>("show");
  const [channelId, setChannelId] = useState("1");
  const [message, setMessage] = useState<PanelMessage>({
    type: "idle",
    text: "Use Cloudflare R2 public MP4 URLs for live streaming media.",
  });
  const [isAdding, setIsAdding] = useState(false);

  const finalPath = useMemo(() => cleanUrl(cloudUrl), [cloudUrl]);

  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === channelId),
    [channels, channelId],
  );

  const recentMedia = useMemo(() => [...media].slice(-10).reverse(), [media]);

  const detectedFileName = useMemo(
    () => (finalPath ? getFileNameFromUrl(finalPath) : ""),
    [finalPath],
  );

  const suggestedTitle = useMemo(
    () => (detectedFileName ? titleFromFilename(detectedFileName) : ""),
    [detectedFileName],
  );

  const parsedDuration = Number(duration);
  const isDurationValid = Number.isFinite(parsedDuration) && parsedDuration > 0;

  const setPanelMessage = (type: PanelMessage["type"], text: string) => {
    setMessage({ type, text });
  };

  const handleUrlChange = (value: string) => {
    setCloudUrl(value);

    const nextPath = cleanUrl(value);
    const fileName = getFileNameFromUrl(nextPath);
    const nextSuggestedTitle = titleFromFilename(fileName);

    if (!title.trim() && nextSuggestedTitle) {
      setTitle(nextSuggestedTitle);
    }
  };

  const testPath = () => {
    if (!finalPath) {
      setPanelMessage("warning", "Paste a Cloudflare/R2 public URL first.");
      return;
    }

    if (!isRemoteUrl(finalPath)) {
      setPanelMessage("error", "Test path must be a valid https:// URL.");
      return;
    }

    window.open(finalPath, "_blank", "noopener,noreferrer");
    setPanelMessage("success", "Opened media URL in a new tab for testing.");
  };

  const addHostedMedia = () => {
    setPanelMessage("idle", "");

    const cleanTitle = title.trim();
    const cleanPath = finalPath.trim();

    if (!cleanTitle) {
      setPanelMessage("error", "Title is required.");
      return;
    }

    if (!cleanPath) {
      setPanelMessage("error", "Cloudflare/R2 URL is required.");
      return;
    }

    if (!isRemoteUrl(cleanPath)) {
      setPanelMessage("error", "Media URL must start with https://");
      return;
    }

    if (!looksLikePlayableVideoUrl(cleanPath)) {
      setPanelMessage(
        "warning",
        "This does not look like an MP4 URL. You can still add it only after confirming your browser can stream it.",
      );
      return;
    }

    if (!isDurationValid) {
      setPanelMessage("error", "Duration must be a valid number of seconds.");
      return;
    }

    const duplicate = media.find(
      (item) => item.file.trim().toLowerCase() === cleanPath.toLowerCase(),
    );

    if (duplicate) {
      assignMediaToChannel(channelId, duplicate.id);
      setPanelMessage(
        "success",
        `Already existed. Assigned "${duplicate.title}" to ${
          selectedChannel ? getChannelLabel(selectedChannel) : `CH ${channelId}`
        }.`,
      );
      return;
    }

    try {
      setIsAdding(true);

      const now = new Date().toISOString();

      const mediaItem: MediaItem = {
        id: makeId(cleanTitle),
        title: cleanTitle,
        type: mediaType,
        duration: Math.floor(parsedDuration),
        file: cleanPath,
        mimeType: "video/mp4",
        originalName: detectedFileName || cleanTitle,
        provider:
          cleanPath.includes(".r2.dev") ||
          cleanPath.toLowerCase().includes("cloudflare")
            ? "cloudflare-r2"
            : "external-url",
        createdAt: now,
        updatedAt: now,
      };

      addMedia(mediaItem);
      assignMediaToChannel(channelId, mediaItem.id);

      setPanelMessage(
        "success",
        `Added "${mediaItem.title}" to ${
          selectedChannel ? getChannelLabel(selectedChannel) : `CH ${channelId}`
        }.`,
      );

      setTitle("");
      setCloudUrl("");
      setDuration(DEFAULT_DURATION_SECONDS);
      setMediaType("show");
    } catch (error) {
      console.error(error);
      setPanelMessage("error", "Failed to add media. Check the console.");
    } finally {
      setIsAdding(false);
    }
  };

  const messageStyles = getMessageStyles(message.type);

  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-wide">Launch Media</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Add Cloudflare R2-hosted videos to the local programming library.
          </p>
        </div>

        <div
          className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{
            borderColor: "var(--border)",
            background: "var(--panel-alt-bg)",
            color: "var(--text-muted)",
          }}
        >
          Browser Saved
        </div>
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

          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Upload the MP4 to Cloudflare R2 first, copy the public URL, then paste
            it here. This saves programming metadata in this browser and assigns
            the media to the selected channel.
          </p>
        </div>

        <div>
          <label
            htmlFor="media-title"
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Title
          </label>

          <input
            id="media-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={suggestedTitle || "Naruto EP01"}
            className="w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="media-url"
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Cloudflare/R2 Public URL
          </label>

          <input
            id="media-url"
            value={cloudUrl}
            onChange={(event) => handleUrlChange(event.target.value)}
            placeholder="https://pub-xxxx.r2.dev/naruto-s01e01.mp4"
            className="w-full rounded-lg border px-3 py-2 outline-none transition focus:ring-2"
            spellCheck={false}
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="final-media-source"
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Final media source
          </label>

          <input
            id="final-media-source"
            value={finalPath}
            readOnly
            className="w-full rounded-lg border px-3 py-2 text-xs outline-none"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          />

          {detectedFileName ? (
            <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              Detected file: {detectedFileName}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label
              htmlFor="media-type"
              className="mb-1 block text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Type
            </label>

            <select
              id="media-type"
              value={mediaType}
              onChange={(event) => setMediaType(event.target.value as MediaType)}
              className="w-full rounded-lg border px-3 py-2 outline-none"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              {MEDIA_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="media-duration"
              className="mb-1 block text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Duration seconds
            </label>

            <input
              id="media-duration"
              value={duration}
              inputMode="numeric"
              onChange={(event) => setDuration(event.target.value)}
              className="w-full rounded-lg border px-3 py-2 outline-none"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: isDurationValid ? "var(--border)" : "#f87171",
                color: "var(--text)",
              }}
            />

            <div className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {isDurationValid
                ? prettyDuration(Math.floor(parsedDuration))
                : "Enter duration in seconds."}
            </div>
          </div>

          <div>
            <label
              htmlFor="media-channel"
              className="mb-1 block text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Channel
            </label>

            <select
              id="media-channel"
              value={channelId}
              onChange={(event) => setChannelId(event.target.value)}
              className="w-full rounded-lg border px-3 py-2 outline-none"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {getChannelLabel(channel)} •{" "}
                  {channel.branding?.displayName ?? channel.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={testPath}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
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
            className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "var(--primary)",
              color: "var(--text)",
            }}
          >
            {isAdding ? "Adding..." : "Add Media"}
          </button>
        </div>

        <div
          className="rounded-lg border px-3 py-2 text-xs"
          style={messageStyles}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text || "Ready."}
        </div>
      </div>

      <div
        className="mt-4 rounded-xl border p-3"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div
            className="text-xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--text-muted)" }}
          >
            Recent Media
          </div>

          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Showing latest {recentMedia.length} of {media.length}
          </div>
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
                    <div className="truncate text-sm font-medium" title={item.title}>
                      {item.title}
                    </div>

                    <div
                      className="text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {item.type.toUpperCase()} • {prettyDuration(item.duration)} •{" "}
                      {getProviderLabel(item.file)}
                    </div>

                    <div
                      className="mt-1 truncate text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                      title={item.file}
                    >
                      {item.file}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeMedia(item.id)}
                    className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold transition hover:opacity-90"
                    style={{
                      background: "var(--button-bg)",
                      color: "var(--text)",
                    }}
                    aria-label={`Remove ${item.title}`}
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-3">
                  <a
                    href={item.file}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline"
                    style={{ color: "var(--primary)" }}
                  >
                    Test media path
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setTitle(item.title);
                      setCloudUrl(item.file);
                      setDuration(String(item.duration));
                      setMediaType(item.type);
                      setPanelMessage(
                        "success",
                        `Loaded "${item.title}" into the form for review.`,
                      );
                    }}
                    className="text-xs underline"
                    style={{ color: "var(--primary)" }}
                  >
                    Load into form
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}