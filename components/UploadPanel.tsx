"use client";

import { useMemo, useRef, useState } from "react";
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

function stripExtension(filename: string) {
  return filename.replace(/\.[^/.]+$/, "");
}

function normalizeLocalFolder(folder: string) {
  const trimmed = folder.trim().replace(/\\/g, "/");
  if (!trimmed) return "/media";
  const clean = trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
  return `/${clean}`;
}

function buildLocalPath(folder: string, filename: string) {
  return `${normalizeLocalFolder(folder)}/${filename.trim().replace(/^\/+/, "")}`;
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
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [sourceMode, setSourceMode] = useState<"cloud" | "local">("cloud");
  const [title, setTitle] = useState("");
  const [cloudUrl, setCloudUrl] = useState("");
  const [folder, setFolder] = useState("/media");
  const [filename, setFilename] = useState("");
  const [duration, setDuration] = useState("1800");
  const [mediaType, setMediaType] = useState<MediaType>("show");
  const [channelId, setChannelId] = useState("1");
  const [lastMessage, setLastMessage] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const finalPath = useMemo(() => {
    if (sourceMode === "cloud") return cleanUrl(cloudUrl);
    if (!filename.trim()) return "";
    return buildLocalPath(folder, filename);
  }, [sourceMode, cloudUrl, folder, filename]);

  const recentMedia = useMemo(() => [...media].slice(-8).reverse(), [media]);

  const handleLocalBrowse = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    setSourceMode("local");
    setTitle(stripExtension(file.name));
    setFilename(file.name);
    setLastMessage(
      `Loaded "${file.name}". This does not upload it. It must already exist at ${buildLocalPath(folder, file.name)}.`
    );

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const testPath = () => {
    if (!finalPath) {
      setLastMessage("Enter a Cloudflare URL or local file path first.");
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
      setLastMessage("Media URL/path is required.");
      return;
    }

    if (sourceMode === "cloud" && !isRemoteUrl(cleanPath)) {
      setLastMessage("Cloudflare/R2 source must start with https://");
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
      setLastMessage(`Already added: "${duplicate.title}"`);
      return;
    }

    try {
      setIsAdding(true);

      const mediaItem: MediaItem = {
        id: makeId(),
        title: cleanTitle,
        type: mediaType,
        duration: durationNumber,
        file: cleanPath,
        originalName:
          sourceMode === "cloud"
            ? cleanPath.split("/").pop() ?? cleanTitle
            : filename.trim(),
      };

      addMedia(mediaItem);
      assignMediaToChannel(channelId, mediaItem.id);

      setLastMessage(`Added "${mediaItem.title}" to CH ${channelId}.`);

      setTitle("");
      setCloudUrl("");
      setFilename("");
      setDuration("1800");
    } catch (error) {
      console.error(error);
      setLastMessage("Failed to add media. Check console.");
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
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSourceMode("cloud")}
            className="rounded-lg px-3 py-2 text-sm font-semibold"
            style={{
              background:
                sourceMode === "cloud" ? "var(--primary)" : "var(--button-bg)",
              color: "var(--text)",
            }}
          >
            Cloudflare URL
          </button>

          <button
            type="button"
            onClick={() => setSourceMode("local")}
            className="rounded-lg px-3 py-2 text-sm font-semibold"
            style={{
              background:
                sourceMode === "local" ? "var(--primary)" : "var(--button-bg)",
              color: "var(--text)",
            }}
          >
            Local Public File
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs" style={{ color: "var(--text-muted)" }}>
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

        {sourceMode === "cloud" ? (
          <div>
            <label className="mb-1 block text-xs" style={{ color: "var(--text-muted)" }}>
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
        ) : (
          <>
            <div
              className="rounded-xl border p-3"
              style={{
                borderColor: "var(--border)",
                background: "var(--panel-alt-bg)",
              }}
            >
              <div
                className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--text-muted)" }}
              >
                Quick File Helper
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition"
                style={{
                  background: "var(--button-bg)",
                  color: "var(--text)",
                }}
              >
                Browse Local File
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => handleLocalBrowse(event.target.files)}
              />

              <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                This only fills title and filename. It does not upload to
                Cloudflare or Vercel.
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--text-muted)" }}>
                  Folder inside public
                </label>
                <input
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                  placeholder="/media"
                  className="w-full rounded-lg border px-3 py-2"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs" style={{ color: "var(--text-muted)" }}>
                  Filename
                </label>
                <input
                  value={filename}
                  onChange={(event) => setFilename(event.target.value)}
                  placeholder="show.mp4"
                  className="w-full rounded-lg border px-3 py-2"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />
              </div>
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-xs" style={{ color: "var(--text-muted)" }}>
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
            <label className="mb-1 block text-xs" style={{ color: "var(--text-muted)" }}>
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
            <label className="mb-1 block text-xs" style={{ color: "var(--text-muted)" }}>
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
            <label className="mb-1 block text-xs" style={{ color: "var(--text-muted)" }}>
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
                <div className="truncate text-sm font-medium">{item.title}</div>
                <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {item.type.toUpperCase()} • {prettyDuration(item.duration)}
                </div>
                <div className="mt-1 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {item.file}
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