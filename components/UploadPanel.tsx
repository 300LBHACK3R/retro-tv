"use client";

import { useEffect, useMemo, useState } from "react";
import { probeVideoDuration } from "@/lib/mediaDuration";
import {
  createMediaItemFromUrl,
  formatBreakpoints,
  formatDuration,
  formatDurationClock,
  getDefaultSlotLengthForDuration,
  getVideoCompatibilityWarning,
  inferNameFromUrl,
  isLikelyVideoUrl,
  normalizeUrl,
  parseBreakpoints,
  parseDurationList,
  parseManualDuration,
  sanitizeCommercialCategory,
  titleCase,
  WEEKDAYS,
} from "@/lib/mediaUtils";
import { useStore } from "@/lib/store";
import type {
  Channel,
  CommercialStrategy,
  MediaItem,
  MediaType,
  Weekday,
} from "@/lib/types";

type DurationMode = "seconds" | "minutes";
type UploadPreset = "cartoon" | "sitcom" | "drama" | "movie" | "music";

type ValidationResult = {
  ok: boolean;
  message: string;
};

const DEFAULT_STATUS =
  "Add videos, commercials, runtime, broadcast slots, ad blocks, and optional air days.";

const DEFAULT_DURATION_STATUS =
  "Auto-detect will try first. Manual duration always works.";

function getDurationHelperText(value: string, mode: DurationMode): string {
  const seconds = parseManualDuration(value, mode);

  if (seconds <= 0) {
    return mode === "minutes"
      ? "Type minutes, like 22.5, or use 22:19."
      : "Type seconds, like 1339, or use 22:19.";
  }

  return `${formatDuration(seconds)} / ${formatDurationClock(seconds)}`;
}

function getSlotHelperText(
  slotLengthSeconds: number,
  durationSeconds: number,
): string {
  if (slotLengthSeconds <= 0) {
    return "Optional. Example: 30:00 for a half-hour block.";
  }

  if (durationSeconds > 0 && slotLengthSeconds <= durationSeconds) {
    return "Slot must be longer than the media runtime.";
  }

  return `${formatDuration(slotLengthSeconds)} broadcast block`;
}

function shouldShowBroadcastFields(type: MediaType): boolean {
  return type === "show" || type === "movie";
}

function shouldShowCommercialFields(type: MediaType): boolean {
  return type === "commercial" || type === "bumper";
}

function isMusicType(type: MediaType): boolean {
  return type === "music" || type === "music-video";
}

function getChannelLabel(channel: Channel | undefined): string {
  if (!channel) {
    return "CH --";
  }

  return `CH ${channel.number ?? channel.id}`;
}

function getChannelName(channel: Channel | undefined): string {
  if (!channel) {
    return "Unknown Channel";
  }

  return channel.branding?.displayName ?? channel.name;
}

function sortChannels(channels: Channel[]): Channel[] {
  return [...channels]
    .filter((channel) => channel.isEnabled !== false)
    .sort((a, b) => {
      const aNumber = Number(a.number ?? a.id);
      const bNumber = Number(b.number ?? b.id);

      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
        return aNumber - bNumber;
      }

      return String(a.id).localeCompare(String(b.id));
    });
}

function getTypeLabel(type: MediaType): string {
  if (type === "movie") return "Movie";
  if (type === "music") return "Music";
  if (type === "music-video") return "Music Video";
  if (type === "commercial") return "Commercial";
  if (type === "bumper") return "Bumper";

  return "Show";
}

function getExistingUrlMatch(
  media: MediaItem[],
  normalizedFile: string,
): MediaItem | null {
  if (!normalizedFile) {
    return null;
  }

  const normalizedTarget = normalizeUrl(normalizedFile);

  return (
    media.find((item) => normalizeUrl(item.file) === normalizedTarget) ?? null
  );
}

function validateUpload({
  normalizedTitle,
  normalizedFile,
  parsedDurationSeconds,
  channelId,
  enabledChannels,
  type,
  fillSlotWithCommercials,
  parsedSlotLengthSeconds,
}: {
  normalizedTitle: string;
  normalizedFile: string;
  parsedDurationSeconds: number;
  channelId: string;
  enabledChannels: Channel[];
  type: MediaType;
  fillSlotWithCommercials: boolean;
  parsedSlotLengthSeconds: number;
}): ValidationResult {
  if (!normalizedTitle) {
    return {
      ok: false,
      message: "Enter a title first.",
    };
  }

  if (!normalizedFile) {
    return {
      ok: false,
      message: "Paste a public https:// video URL.",
    };
  }

  if (!normalizedFile.startsWith("https://")) {
    return {
      ok: false,
      message: "Use a full public https:// video URL.",
    };
  }

  if (parsedDurationSeconds <= 0) {
    return {
      ok: false,
      message: "Enter a valid duration manually or use Auto.",
    };
  }

  if (!channelId.trim()) {
    return {
      ok: false,
      message: "Select a channel first.",
    };
  }

  if (!enabledChannels.some((channel) => channel.id === channelId)) {
    return {
      ok: false,
      message: "Selected channel is not enabled or does not exist.",
    };
  }

  if (
    shouldShowBroadcastFields(type) &&
    fillSlotWithCommercials &&
    parsedSlotLengthSeconds <= parsedDurationSeconds
  ) {
    return {
      ok: false,
      message: "Slot length must be longer than runtime. Example: 30:00.",
    };
  }

  return {
    ok: true,
    message: "Ready to add media.",
  };
}

function SummaryPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn" | "danger";
}) {
  const color =
    tone === "good"
      ? "#86efac"
      : tone === "warn"
        ? "#fde68a"
        : tone === "danger"
          ? "#fecaca"
          : "var(--text-muted)";

  return (
    <div
      className="rounded-2xl border px-3 py-2"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="text-[10px] font-black uppercase tracking-[0.14em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>

      <div className="mt-1 truncate text-xs font-black" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function PresetButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ttv-action-button ttv-touch-target rounded-xl px-3 py-3 text-xs font-black uppercase tracking-[0.1em]"
    >
      {label}
    </button>
  );
}

export default function UploadPanel() {
  const channels = useStore((state) => state.channels);
  const media = useStore((state) => state.media);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const addMedia = useStore((state) => state.addMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);

  const [title, setTitle] = useState("");
  const [file, setFile] = useState("");
  const [type, setType] = useState<MediaType>("show");

  const [durationInput, setDurationInput] = useState("");
  const [durationMode, setDurationMode] = useState<DurationMode>("seconds");

  const [breakpointsInput, setBreakpointsInput] = useState("7:30, 15:00");
  const [breakDurationsInput, setBreakDurationsInput] = useState("2:00, 2:00");
  const [slotLengthInput, setSlotLengthInput] = useState("30:00");
  const [fillSlotWithCommercials, setFillSlotWithCommercials] = useState(true);
  const [commercialStrategy, setCommercialStrategy] =
    useState<CommercialStrategy>("best-fit");

  const [allowCommercialSlicing, setAllowCommercialSlicing] = useState(true);
  const [commercialCategory, setCommercialCategory] = useState("");

  const [selectedAirDays, setSelectedAirDays] = useState<Weekday[]>([]);
  const [channelId, setChannelId] = useState(currentChannelId);

  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [durationStatus, setDurationStatus] = useState(DEFAULT_DURATION_STATUS);
  const [isDetectingDuration, setIsDetectingDuration] = useState(false);

  const normalizedFile = useMemo(() => normalizeUrl(file), [file]);

  const parsedDurationSeconds = useMemo(
    () => parseManualDuration(durationInput, durationMode),
    [durationInput, durationMode],
  );

  const parsedSlotLengthSeconds = useMemo(
    () => parseManualDuration(slotLengthInput, "seconds"),
    [slotLengthInput],
  );

  const parsedBreakpoints = useMemo(
    () => parseBreakpoints(breakpointsInput, parsedDurationSeconds),
    [breakpointsInput, parsedDurationSeconds],
  );

  const parsedBreakDurations = useMemo(
    () => parseDurationList(breakDurationsInput),
    [breakDurationsInput],
  );

  const compatibilityWarning = useMemo(
    () => (normalizedFile ? getVideoCompatibilityWarning(normalizedFile) : null),
    [normalizedFile],
  );

  const enabledChannels = useMemo(() => sortChannels(channels), [channels]);

  const selectedChannel = useMemo(
    () => enabledChannels.find((channel) => channel.id === channelId),
    [channelId, enabledChannels],
  );

  const existingUrlMatch = useMemo(
    () => getExistingUrlMatch(media, normalizedFile),
    [media, normalizedFile],
  );

  const normalizedTitle = title.trim().replace(/\s+/g, " ");

  const validation = useMemo(
    () =>
      validateUpload({
        normalizedTitle,
        normalizedFile,
        parsedDurationSeconds,
        channelId,
        enabledChannels,
        type,
        fillSlotWithCommercials,
        parsedSlotLengthSeconds,
      }),
    [
      channelId,
      enabledChannels,
      fillSlotWithCommercials,
      normalizedFile,
      normalizedTitle,
      parsedDurationSeconds,
      parsedSlotLengthSeconds,
      type,
    ],
  );

  const canAdd = validation.ok;

  useEffect(() => {
    if (selectedChannel) {
      return;
    }

    const fallbackChannel =
      enabledChannels.find((channel) => channel.id === currentChannelId) ??
      enabledChannels[0];

    if (fallbackChannel) {
      setChannelId(fallbackChannel.id);
    }
  }, [currentChannelId, enabledChannels, selectedChannel]);

  const toggleAirDay = (day: Weekday) => {
    setSelectedAirDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  };

  const selectEveryDay = () => {
    setSelectedAirDays([]);
    setStatus("Air days cleared. This media can air every day.");
  };

  const applyPreset = (preset: UploadPreset) => {
    if (preset === "cartoon") {
      setType("show");
      setSlotLengthInput("30:00");
      setBreakpointsInput("7:30, 15:00");
      setBreakDurationsInput("2:00, 2:00");
      setFillSlotWithCommercials(true);
      setCommercialStrategy("best-fit");
      setAllowCommercialSlicing(false);
      setStatus("Applied 30-minute cartoon/anime broadcast preset.");
      return;
    }

    if (preset === "sitcom") {
      setType("show");
      setSlotLengthInput("30:00");
      setBreakpointsInput("11:00");
      setBreakDurationsInput("3:00");
      setFillSlotWithCommercials(true);
      setCommercialStrategy("best-fit");
      setAllowCommercialSlicing(false);
      setStatus("Applied 30-minute sitcom broadcast preset.");
      return;
    }

    if (preset === "drama") {
      setType("show");
      setSlotLengthInput("60:00");
      setBreakpointsInput("12:00, 24:00, 36:00");
      setBreakDurationsInput("3:00, 3:00, 3:00");
      setFillSlotWithCommercials(true);
      setCommercialStrategy("best-fit");
      setAllowCommercialSlicing(false);
      setStatus("Applied 60-minute drama broadcast preset.");
      return;
    }

    if (preset === "movie") {
      setType("movie");
      setSlotLengthInput("");
      setBreakpointsInput("");
      setBreakDurationsInput("");
      setFillSlotWithCommercials(false);
      setCommercialStrategy("best-fit");
      setAllowCommercialSlicing(false);
      setStatus("Applied movie preset. Runtime controls the full movie block.");
      return;
    }

    setType("music-video");
    setSlotLengthInput("");
    setBreakpointsInput("");
    setBreakDurationsInput("");
    setFillSlotWithCommercials(false);
    setCommercialStrategy("best-fit");
    setAllowCommercialSlicing(false);
    setStatus("Applied music video preset.");
  };

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
      setDurationStatus(
        `Detected ${result.durationLabel} / ${formatDurationClock(
          result.duration,
        )}.`,
      );

      const defaultSlotLength = getDefaultSlotLengthForDuration(
        result.duration,
        type,
      );

      if (
        defaultSlotLength &&
        shouldShowBroadcastFields(type) &&
        !slotLengthInput.trim()
      ) {
        setSlotLengthInput(formatDurationClock(defaultSlotLength));
      }
    } catch {
      setDurationStatus(
        "Auto-detect failed. Enter duration manually as seconds, minutes, or 22:19.",
      );
    } finally {
      setIsDetectingDuration(false);
    }
  };

  const handleUrlChange = (value: string) => {
    const nextUrl = normalizeUrl(value);

    setFile(nextUrl);
    setStatus(DEFAULT_STATUS);

    if (!title.trim()) {
      const inferredTitle = inferNameFromUrl(nextUrl);

      if (inferredTitle) {
        setTitle(titleCase(inferredTitle));
      }
    }
  };

  const handleTypeChange = (nextType: MediaType) => {
    setType(nextType);

    if (shouldShowCommercialFields(nextType)) {
      setBreakpointsInput("");
      setBreakDurationsInput("");
      setSlotLengthInput("");
      setFillSlotWithCommercials(false);
      setAllowCommercialSlicing(true);
      setStatus(`${getTypeLabel(nextType)} mode selected.`);
      return;
    }

    if (isMusicType(nextType)) {
      setBreakpointsInput("");
      setBreakDurationsInput("");
      setSlotLengthInput("");
      setFillSlotWithCommercials(false);
      setAllowCommercialSlicing(false);
      setStatus(`${getTypeLabel(nextType)} mode selected.`);
      return;
    }

    setAllowCommercialSlicing(false);

    if (parsedDurationSeconds > 0 && !slotLengthInput.trim()) {
      const defaultSlotLength = getDefaultSlotLengthForDuration(
        parsedDurationSeconds,
        nextType,
      );

      if (defaultSlotLength) {
        setSlotLengthInput(formatDurationClock(defaultSlotLength));
      }
    }

    setStatus(`${getTypeLabel(nextType)} mode selected.`);
  };

  const resetFormAfterAdd = () => {
    setTitle("");
    setFile("");
    setType("show");
    setDurationInput("");
    setDurationMode("seconds");
    setBreakpointsInput("7:30, 15:00");
    setBreakDurationsInput("2:00, 2:00");
    setSlotLengthInput("30:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setAllowCommercialSlicing(true);
    setCommercialCategory("");
    setSelectedAirDays([]);
    setDurationStatus(DEFAULT_DURATION_STATUS);
  };

  const addItem = () => {
    if (!validation.ok) {
      setStatus(validation.message);
      return;
    }

    if (existingUrlMatch) {
      const confirmed = window.confirm(
        `"${existingUrlMatch.title}" already uses this URL. Add a duplicate anyway?`,
      );

      if (!confirmed) return;
    }

    if (!isLikelyVideoUrl(normalizedFile)) {
      const confirmed = window.confirm(
        "This URL does not clearly look like a supported video file. Add it anyway?",
      );

      if (!confirmed) return;
    }

    const item = createMediaItemFromUrl({
      url: normalizedFile,
      title: normalizedTitle,
      type,
      duration: parsedDurationSeconds,
      breakpoints: shouldShowBroadcastFields(type) ? parsedBreakpoints : [],
      breakDurations: shouldShowBroadcastFields(type) ? parsedBreakDurations : [],
      slotLengthSeconds:
        shouldShowBroadcastFields(type) &&
        parsedSlotLengthSeconds > parsedDurationSeconds
          ? parsedSlotLengthSeconds
          : undefined,
      fillSlotWithCommercials: shouldShowBroadcastFields(type)
        ? fillSlotWithCommercials
        : false,
      commercialStrategy,
      allowCommercialSlicing: shouldShowCommercialFields(type)
        ? allowCommercialSlicing
        : false,
      commercialCategory: shouldShowCommercialFields(type)
        ? sanitizeCommercialCategory(commercialCategory)
        : undefined,
      airDays: selectedAirDays,
    });

    addMedia(item);
    assignMediaToChannel(channelId, item.id);

    setStatus(
      `Added "${item.title}" to ${getChannelLabel(selectedChannel)} / ${formatDuration(
        item.duration,
      )}.`,
    );

    resetFormAfterAdd();
  };

  const slotTone =
    shouldShowBroadcastFields(type) &&
    fillSlotWithCommercials &&
    parsedSlotLengthSeconds <= parsedDurationSeconds
      ? "danger"
      : parsedSlotLengthSeconds > parsedDurationSeconds
        ? "good"
        : "default";

  return (
    <section
      className="ttv-glass-panel rounded-2xl p-3 sm:p-4"
      style={{ color: "var(--text)" }}
    >
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div
            className="text-xs font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--primary)" }}
          >
            Add Media
          </div>

          <h2 className="mt-1 text-base font-black tracking-tight">
            Cloudflare R2 / Public URL Entry
          </h2>

          <p
            className="mt-1 max-w-3xl text-xs leading-5"
            style={{ color: "var(--text-muted)" }}
          >
            Add shows, movies, music videos, commercials, runtime, broadcast
            slots, ad blocks, commercial pool settings, and optional air days.
          </p>
        </div>

        <div
          className="w-fit rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
          style={{
            borderColor: validation.ok
              ? "rgba(34, 197, 94, 0.35)"
              : "var(--border)",
            background: validation.ok
              ? "rgba(34, 197, 94, 0.12)"
              : "var(--panel-alt-bg)",
            color: validation.ok ? "#86efac" : "var(--text-muted)",
          }}
        >
          {validation.ok ? "Ready" : "Incomplete"}
        </div>
      </div>

      <div
        className="mb-3 grid gap-2 rounded-2xl border p-3 sm:grid-cols-2 xl:grid-cols-5"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
        }}
      >
        <SummaryPill label="Type" value={getTypeLabel(type)} />
        <SummaryPill
          label="Runtime"
          value={
            parsedDurationSeconds > 0
              ? formatDurationClock(parsedDurationSeconds)
              : "Unset"
          }
          tone={parsedDurationSeconds > 0 ? "good" : "warn"}
        />
        <SummaryPill
          label="Slot"
          value={
            parsedSlotLengthSeconds > 0
              ? formatDurationClock(parsedSlotLengthSeconds)
              : "None"
          }
          tone={slotTone}
        />
        <SummaryPill
          label="Channel"
          value={getChannelLabel(selectedChannel)}
          tone={selectedChannel ? "good" : "warn"}
        />
        <SummaryPill
          label="Air Days"
          value={
            selectedAirDays.length === 0
              ? "Every Day"
              : `${selectedAirDays.length} selected`
          }
        />
      </div>

      <div className="grid gap-3">
        <div className="grid gap-3 lg:grid-cols-[1fr_1.25fr]">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
            placeholder="Title"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: normalizedTitle ? "var(--border)" : "#f87171",
              color: "var(--text)",
            }}
          />

          <input
            value={file}
            onChange={(event) => handleUrlChange(event.target.value)}
            onBlur={(event) => {
              if (!durationInput.trim()) {
                void detectDuration(event.target.value);
              }
            }}
            className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
            placeholder="https://pub-xxxx.r2.dev/video.mp4"
            spellCheck={false}
            style={{
              background: "var(--panel-alt-bg)",
              borderColor:
                normalizedFile && !normalizedFile.startsWith("https://")
                  ? "#f87171"
                  : existingUrlMatch
                    ? "rgba(250, 204, 21, 0.55)"
                    : "var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        {existingUrlMatch ? (
          <div
            className="rounded-2xl border px-3 py-2 text-xs leading-5"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "rgba(250, 204, 21, 0.35)",
              color: "#fde68a",
            }}
          >
            Duplicate warning: this URL is already saved as “
            {existingUrlMatch.title}”.
          </div>
        ) : null}

        {compatibilityWarning ? (
          <div
            className="rounded-2xl border px-3 py-2 text-xs leading-5"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "rgba(250, 204, 21, 0.35)",
              color: "#fde68a",
            }}
          >
            {compatibilityWarning}
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[0.8fr_1.8fr_1fr]">
          <select
            value={type}
            onChange={(event) => handleTypeChange(event.target.value as MediaType)}
            className="w-full rounded-xl border px-3 py-3 text-base sm:text-sm"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            <option value="show">Show</option>
            <option value="movie">Movie</option>
            <option value="music">Music</option>
            <option value="music-video">Music Video</option>
            <option value="commercial">Commercial</option>
            <option value="bumper">Bumper</option>
          </select>

          <div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <input
                value={durationInput}
                onChange={(event) =>
                  setDurationInput(event.target.value.replace(/[^\d:.]/g, ""))
                }
                className="min-w-0 rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                placeholder="Duration: 1339, 22.3, or 22:19"
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
                className="rounded-xl border px-2 py-3 text-sm outline-none"
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
                className="ttv-action-button ttv-touch-target rounded-xl px-3 py-3 text-xs font-black uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDetectingDuration ? "..." : "Auto"}
              </button>
            </div>

            <div
              className="mt-1 text-[11px] leading-5"
              style={{ color: "var(--text-muted)" }}
            >
              {durationStatus} / {getDurationHelperText(durationInput, durationMode)}
            </div>
          </div>

          <select
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
            className="w-full rounded-xl border px-3 py-3 text-base sm:text-sm"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: selectedChannel ? "var(--border)" : "#f87171",
              color: "var(--text)",
            }}
          >
            {enabledChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {getChannelLabel(channel)} / {getChannelName(channel)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2 sm:grid-cols-5">
          <PresetButton label="30m Cartoon" onClick={() => applyPreset("cartoon")} />
          <PresetButton label="30m Sitcom" onClick={() => applyPreset("sitcom")} />
          <PresetButton label="60m Drama" onClick={() => applyPreset("drama")} />
          <PresetButton label="Movie" onClick={() => applyPreset("movie")} />
          <PresetButton label="Music Video" onClick={() => applyPreset("music")} />
        </div>

        {shouldShowBroadcastFields(type) ? (
          <div
            className="rounded-2xl border p-3"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="mb-2 text-xs font-black uppercase tracking-[0.14em]"
              style={{ color: "var(--primary)" }}
            >
              Broadcast Slot / Commercial Logic
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div>
                <label
                  className="mb-1 block text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Slot Length
                </label>

                <input
                  value={slotLengthInput}
                  onChange={(event) =>
                    setSlotLengthInput(
                      event.target.value.replace(/[^\d:.]/g, ""),
                    )
                  }
                  className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                  placeholder="30:00"
                  style={{
                    background: "var(--panel-bg)",
                    borderColor:
                      fillSlotWithCommercials &&
                      parsedSlotLengthSeconds <= parsedDurationSeconds
                        ? "#f87171"
                        : "var(--border)",
                    color: "var(--text)",
                  }}
                />

                <div
                  className="mt-1 text-[11px] leading-5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {getSlotHelperText(
                    parsedSlotLengthSeconds,
                    parsedDurationSeconds,
                  )}
                </div>
              </div>

              <div>
                <label
                  className="mb-1 block text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Breakpoints
                </label>

                <input
                  value={breakpointsInput}
                  onChange={(event) =>
                    setBreakpointsInput(
                      event.target.value.replace(/[^\d:.,\s]/g, ""),
                    )
                  }
                  className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                  placeholder="7:30, 15:00"
                  style={{
                    background: "var(--panel-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />

                <div
                  className="mt-1 text-[11px] leading-5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatBreakpoints(parsedBreakpoints) || "No breakpoints"}
                </div>
              </div>

              <div>
                <label
                  className="mb-1 block text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Ad Blocks
                </label>

                <input
                  value={breakDurationsInput}
                  onChange={(event) =>
                    setBreakDurationsInput(
                      event.target.value.replace(/[^\d:.,\s]/g, ""),
                    )
                  }
                  className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                  placeholder="2:00, 2:00"
                  style={{
                    background: "var(--panel-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />

                <div
                  className="mt-1 text-[11px] leading-5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {formatBreakpoints(parsedBreakDurations) ||
                    "Auto commercial filler"}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label
                className="flex items-center gap-3 rounded-xl border p-3 text-sm"
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                }}
              >
                <input
                  type="checkbox"
                  checked={fillSlotWithCommercials}
                  onChange={(event) =>
                    setFillSlotWithCommercials(event.target.checked)
                  }
                  className="h-5 w-5"
                />
                <span>Fill remaining slot time with commercials</span>
              </label>

              <select
                value={commercialStrategy}
                onChange={(event) =>
                  setCommercialStrategy(
                    event.target.value as CommercialStrategy,
                  )
                }
                className="w-full rounded-xl border px-3 py-3 text-base sm:text-sm"
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              >
                <option value="best-fit">Best Fit Commercials</option>
                <option value="sequential">Sequential Commercials</option>
                <option value="random">Random Commercials</option>
              </select>
            </div>
          </div>
        ) : null}

        {shouldShowCommercialFields(type) ? (
          <div
            className="rounded-2xl border p-3"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="mb-2 text-xs font-black uppercase tracking-[0.14em]"
              style={{ color: "var(--primary)" }}
            >
              Commercial Pool Settings
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label
                className="flex items-center gap-3 rounded-xl border p-3 text-sm"
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                }}
              >
                <input
                  type="checkbox"
                  checked={allowCommercialSlicing}
                  onChange={(event) =>
                    setAllowCommercialSlicing(event.target.checked)
                  }
                  className="h-5 w-5"
                />
                <span>Allow this commercial to be sliced for exact ad blocks</span>
              </label>

              <input
                value={commercialCategory}
                onChange={(event) => setCommercialCategory(event.target.value)}
                className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                placeholder="Category: general, kids, anime, gaming..."
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />
            </div>
          </div>
        ) : null}

        <div>
          <div
            className="mb-2 flex items-center justify-between gap-2 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <span>Air Days</span>

            <button
              type="button"
              onClick={selectEveryDay}
              className="ttv-action-button rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.1em]"
            >
              Every Day
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => {
              const active = selectedAirDays.includes(day.id);

              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => toggleAirDay(day.id)}
                  className="ttv-touch-target rounded-lg px-2 py-3 text-[11px] font-black uppercase tracking-[0.08em]"
                  style={{
                    background: active ? "var(--primary)" : "var(--button-bg)",
                    color: "var(--text)",
                  }}
                >
                  {day.label}
                </button>
              );
            })}
          </div>

          <div
            className="mt-1 text-[11px] leading-5"
            style={{ color: "var(--text-muted)" }}
          >
            No days selected means this media can air every day.
          </div>
        </div>

        <div
          className="rounded-2xl border px-3 py-2 text-xs leading-5"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: validation.ok
              ? "var(--border)"
              : "rgba(248, 113, 113, 0.45)",
            color: validation.ok ? "var(--text-muted)" : "#fecaca",
          }}
        >
          {validation.ok
            ? "Ready to add media to the selected channel."
            : validation.message}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => window.open(normalizedFile, "_blank", "noopener")}
            disabled={!normalizedFile.startsWith("https://")}
            className="ttv-action-button ttv-touch-target rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Test URL
          </button>

          <button
            type="button"
            onClick={addItem}
            disabled={!canAdd}
            className="ttv-touch-target rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background:
                "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))",
              color: "var(--text)",
            }}
          >
            Add Media
          </button>
        </div>

        {status ? (
          <div
            className="rounded-2xl border px-3 py-2 text-xs leading-5"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: status.toLowerCase().includes("failed")
                ? "rgba(248, 113, 113, 0.45)"
                : "var(--border)",
              color: status.toLowerCase().includes("failed")
                ? "#fecaca"
                : "var(--text-muted)",
            }}
            aria-live="polite"
          >
            {status}
          </div>
        ) : null}
      </div>
    </section>
  );
}