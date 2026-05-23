"use client";

import { useMemo, useState } from "react";
import { probeVideoDuration } from "@/lib/mediaDuration";
import { useStore } from "@/lib/store";
import type { MediaItem, MediaType } from "@/lib/types";

type DurationMode = "seconds" | "minutes";

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

function normalizeUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\s/g, "%20");
  }

  if (trimmed.includes(".r2.dev/")) {
    return `https://${trimmed}`.replace(/\s/g, "%20");
  }

  return trimmed.replace(/\s/g, "%20");
}

function isLikelyVideoUrl(value: string): boolean {
  const clean = value.toLowerCase();

  return (
    clean.startsWith("https://") &&
    (clean.includes(".mp4") ||
      clean.includes(".webm") ||
      clean.includes(".mov") ||
      clean.includes(".m4v"))
  );
}

function inferNameFromUrl(url: string): string {
  try {
    const parsed = new URL(normalizeUrl(url));
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

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

function parseManualDuration(value: string, mode: DurationMode): number {
  const clean = value.trim();

  if (!clean) {
    return 0;
  }

  // Supports:
  // 22:19
  // 1:22:19
  // 22.5 minutes
  // 1339 seconds
  if (clean.includes(":")) {
    const parts = clean
      .split(":")
      .map((part) => Number(part.trim()))
      .filter((part) => Number.isFinite(part));

    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      return Math.floor(minutes * 60 + seconds);
    }

    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      return Math.floor(hours * 3600 + minutes * 60 + seconds);
    }

    return 0;
  }

  const numeric = Number(clean);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  if (mode === "minutes") {
    return Math.round(numeric * 60);
  }

  return Math.round(numeric);
}

function getDurationHelperText(value: string, mode: DurationMode): string {
  const seconds = parseManualDuration(value, mode);

  if (seconds <= 0) {
    return mode === "minutes"
      ? "Type minutes, like 22.5, or use 22:19."
      : "Type seconds, like 1339, or use 22:19.";
  }

  return formatDuration(seconds);
}

export default function UploadPanel() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const addMedia = useStore((state) => state.addMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);

  const [title, setTitle] = useState("");
  const [file, setFile] = useState("");
  const [type, setType] = useState<MediaType>("show");
  const [durationInput, setDurationInput] = useState("");
  const [durationMode, setDurationMode] = useState<DurationMode>("seconds");
  const [channelId, setChannelId] = useState(currentChannelId);
  const [status, setStatus] = useState("");
  const [durationStatus, setDurationStatus] = useState(
    "Auto-detect will try first. Manual duration always works.",
  );
  const [isDetectingDuration, setIsDetectingDuration] = useState(false);

  const normalizedFile = useMemo(() => normalizeUrl(file), [file]);
  const parsedDurationSeconds = useMemo(
    () => parseManualDuration(durationInput, durationMode),
    [durationInput, durationMode],
  );

  const enabledChannels = useMemo(
    () =>
      channels
        .filter((channel) => channel.isEnabled !== false)
        .sort((a, b) => Number(a.number ?? a.id) - Number(b.number ?? b.id)),
    [channels],
  );

  const canAdd =
    title.trim().length > 0 &&
    normalizedFile.length > 0 &&
    normalizedFile.startsWith("https://") &&
    parsedDurationSeconds > 0 &&
    channelId.trim().length > 0;

  const detectDuration = async (url: string) => {
    const cleanUrl = normalizeUrl(url);

    if (!cleanUrl) {
      setDurationStatus("Paste a video URL first.");
      return;
    }

    if (!cleanUrl.startsWith("https://")) {
      setDurationStatus("Use a full public https:// video URL.");
      return;
    }

    setIsDetectingDuration(true);
    setDurationStatus("Reading video duration...");

    try {
      const result = await probeVideoDuration(cleanUrl);

      setDurationMode("seconds");
      setDurationInput(String(result.duration));
      setDurationStatus(`Detected ${result.durationLabel}.`);
    } catch {
      setDurationStatus(
        "Auto-detect failed. No problem — enter duration manually as seconds, minutes, or 22:19.",
      );
    } finally {
      setIsDetectingDuration(false);
    }
  };

  const handleUrlChange = (value: string) => {
    const nextUrl = normalizeUrl(value);

    setFile(nextUrl);
    setStatus("");

    if (!title.trim()) {
      const inferredTitle = inferNameFromUrl(nextUrl);

      if (inferredTitle) {
        setTitle(titleCase(inferredTitle));
      }
    }
  };

  const addItem = () => {
    if (!canAdd) {
      if (!normalizedFile.startsWith("https://")) {
        setStatus("Use a full public https:// video URL.");
        return;
      }

      if (parsedDurationSeconds <= 0) {
        setStatus("Enter a valid duration manually or use Auto.");
        return;
      }

      setStatus("Fill in title, URL, duration, and channel first.");
      return;
    }

    if (!isLikelyVideoUrl(normalizedFile)) {
      const confirmed = window.confirm(
        "This URL does not clearly look like a video file. Add it anyway?",
      );

      if (!confirmed) {
        return;
      }
    }

    const cleanTitle = title.trim();
    const id = createMediaId(cleanTitle);

    const item: MediaItem = {
      id,
      title: cleanTitle,
      type,
      duration: parsedDurationSeconds,
      file: normalizedFile,
      mimeType: "video/mp4",
      originalName: normalizedFile.split("/").at(-1) ?? cleanTitle,
      provider: inferProvider(normalizedFile),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addMedia(item);
    assignMediaToChannel(channelId, item.id);

    setStatus(
      `Added "${item.title}" to CH ${channelId} • ${formatDuration(item.duration)}.`,
    );

    setTitle("");
    setFile("");
    setDurationInput("");
    setDurationMode("seconds");
    setDurationStatus("Auto-detect will try first. Manual duration always works.");
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
          Paste a public video URL. Auto-duration will try first, but manual
          duration is always available.
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
            placeholder="Corner Gas S04E18 Happy Campers"
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
              if (!durationInput.trim()) {
                void detectDuration(event.target.value);
              }
            }}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            placeholder="https://pub-xxxx.r2.dev/video.mp4"
            spellCheck={false}
            style={{
              background: "var(--panel-alt-bg)",
              borderColor:
                normalizedFile && !normalizedFile.startsWith("https://")
                  ? "#f87171"
                  : "var(--border)",
              color: "var(--text)",
            }}
          />

          {normalizedFile && normalizedFile !== file ? (
            <div
              className="mt-1 text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              Normalized URL: {normalizedFile}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_1fr]">
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
              Duration
            </label>

            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <input
                value={durationInput}
                onChange={(event) =>
                  setDurationInput(event.target.value.replace(/[^\d:.]/g, ""))
                }
                className="min-w-0 rounded-lg border px-3 py-2 text-sm outline-none"
                placeholder="Auto, 1339, 22.3, or 22:19"
                inputMode="decimal"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor:
                    durationInput && parsedDurationSeconds <= 0
                      ? "#f87171"
                      : "var(--border)",
                  color: "var(--text)",
                }}
              />

              <select
                value={durationMode}
                onChange={(event) =>
                  setDurationMode(event.target.value as DurationMode)
                }
                className="rounded-lg border px-2 py-2 text-xs outline-none"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              >
                <option value="seconds">sec</option>
                <option value="minutes">min</option>
              </select>

              <button
                type="button"
                onClick={() => void detectDuration(file)}
                disabled={isDetectingDuration || !normalizedFile}
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
              {durationStatus} • {getDurationHelperText(durationInput, durationMode)}
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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.open(normalizedFile, "_blank", "noopener")}
            disabled={!normalizedFile.startsWith("https://")}
            className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.01] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "var(--button-bg)",
              color: "var(--text)",
            }}
          >
            Test URL
          </button>

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
        </div>

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