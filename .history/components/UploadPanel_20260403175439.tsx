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

function normalizeFolderPath(folder: string) {
  const trimmed = folder.trim().replace(/\\/g, "/");
  if (!trimmed) return "/media";
  const noLeading = trimmed.replace(/^\/+/, "");
  const noTrailing = noLeading.replace(/\/+$/, "");
  return `/${noTrailing}`;
}

function buildPublicPath(folder: string, filename: string) {
  const normalizedFolder = normalizeFolderPath(folder);
  const cleanFilename = filename.trim().replace(/^\/+/, "");
  return `${normalizedFolder}/${cleanFilename}`;
}

export default function UploadPanel() {
  const channels = useStore((state) => state.channels);
  const media = useStore((state) => state.media);
  const addMedia = useStore((state) => state.addMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState("/media");
  const [filename, setFilename] = useState("");
  const [duration, setDuration] = useState("1800");
  const [mediaType, setMediaType] = useState<MediaType>("show");
  const [channelId, setChannelId] = useState("1");
  const [lastMessage, setLastMessage] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const recentMedia = useMemo(() => {
    return [...media].slice(-6).reverse();
  }, [media]);

  const finalPath = useMemo(() => {
    if (!filename.trim()) return "";
    return buildPublicPath(folder, filename);
  }, [folder, filename]);

  const addHostedMedia = () => {
    setLastMessage("");

    if (!title.trim()) {
      setLastMessage("Title is required.");
      return;
    }

    if (!filename.trim()) {
      setLastMessage("Filename is required.");
      return;
    }

    const durationNumber = Number(duration);
    if (!Number.isFinite(durationNumber) || durationNumber <= 0) {
      setLastMessage("Duration must be a valid number of seconds.");
      return;
    }

    const channelExists = channels.some((channel) => channel.id === channelId);
    if (!channelExists) {
      setLastMessage("Selected channel does not exist.");
      return;
    }

    const duplicate = media.find(
      (item) =>
        item.file.trim().toLowerCase() === finalPath.trim().toLowerCase() &&
        item.title.trim().toLowerCase() === title.trim().toLowerCase()
    );

    if (duplicate) {
      setLastMessage("That media item already exists.");
      return;
    }

    try {
      setIsAdding(true);

      const mediaItem: MediaItem = {
        id: makeId(),
        title: title.trim(),
        type: mediaType,
        duration: durationNumber,
        file: finalPath,
        originalName: filename.trim(),
      };

      addMedia(mediaItem);
      assignMediaToChannel(channelId, mediaItem.id);

      setLastMessage(
        `Added "${mediaItem.title}" to CH ${channelId} using ${mediaItem.file}`
      );

      setTitle("");
      setFilename("");
      setDuration("1800");
    } catch (error) {
      console.error("Add media failed:", error);
      setLastMessage("Failed to add media. Check the console for details.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleLocalBrowse = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    setTitle(stripExtension(file.name));
    setFilename(file.name);
    setLastMessage(
      `Loaded "${file.name}". Make sure it really exists at ${buildPublicPath(
        folder,
        file.name
      )}`
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const testPath = () => {
    if (!finalPath) {
      setLastMessage("Enter a filename first.");
      return;
    }
    window.open(finalPath, "_blank", "noopener,noreferrer");
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
            onChange={(e) => handleLocalBrowse(e.target.files)}
          />

          <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            This only fills the title and filename. Your file must already exist
            inside the matching <code>public</code> folder.
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
            onChange={(e) => setTitle(e.target.value)}
            placeholder="DragonBall Z EP:01"
            className="w-full rounded-lg border px-3 py-2"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label
              className="mb-1 block text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Folder inside public
            </label>
            <input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="/media/channel1"
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
              Filename
            </label>
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
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

        <div>
          <label
            className="mb-1 block text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Final public path
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
          {lastMessage || "Make the final path work in a browser first, then add it."}
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
                <div
                  className="mt-1 truncate text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
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