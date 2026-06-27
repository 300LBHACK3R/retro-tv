"use client";

import { useEffect, useMemo, useState } from "react";
import { probeVideoDuration } from "@/lib/mediaDuration";
import {
  createMediaItemFromUrl,
  formatDuration,
  formatDurationClock,
  getVideoCompatibilityWarning,
  inferNameFromUrl,
  isLikelyVideoUrl,
  normalizeAirStartTime,
  normalizeUrl,
  parseManualDuration,
  sanitizeCommercialCategory,
  titleCase,
  WEEKDAYS,
} from "@/lib/mediaUtils";
import { useStore } from "@/lib/store";
import {
  GLOBAL_AD_CHANNEL_TARGET,
  type AdPlacement,
  type Channel,
  type MediaItem,
  type MediaType,
  type Weekday,
} from "@/lib/types";

type DurationMode = "seconds" | "minutes";
type AdTargetMode = "channel" | "all";

type ValidationResult = {
  ok: boolean;
  message: string;
};

const DEFAULT_STATUS =
  "Simple mode: add one show, movie, music video, commercial, or bumper. Commercials are channel-targeted by default.";

const DEFAULT_DURATION_STATUS =
  "Auto-detect will try first. Manual duration always works.";

const DEFAULT_AD_PLACEMENTS: AdPlacement[] = [
  "mid-roll",
  "between-programs",
  "post-roll",
  "filler",
];

function isProgramType(type: MediaType): boolean {
  return (
    type === "show" ||
    type === "movie" ||
    type === "music" ||
    type === "music-video"
  );
}

function isAdType(type: MediaType): boolean {
  return type === "commercial" || type === "bumper";
}

function getTypeLabel(type: MediaType): string {
  if (type === "movie") return "Movie";
  if (type === "music") return "Music";
  if (type === "music-video") return "Music Video";
  if (type === "commercial") return "Commercial";
  if (type === "bumper") return "Bumper";

  return "Show";
}

function getDurationHelperText(value: string, mode: DurationMode): string {
  const seconds = parseManualDuration(value, mode);

  if (seconds <= 0) {
    return mode === "minutes"
      ? "Type minutes, like 22.5, or use 22:19."
      : "Type seconds, like 1339, or use 22:19.";
  }

  return `${formatDuration(seconds)} / ${formatDurationClock(seconds)}`;
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

      return String(a.id).localeCompare(String(b.id), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
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
  adTargetMode,
}: {
  normalizedTitle: string;
  normalizedFile: string;
  parsedDurationSeconds: number;
  channelId: string;
  enabledChannels: Channel[];
  type: MediaType;
  adTargetMode: AdTargetMode;
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

  if (isProgramType(type) || adTargetMode === "channel") {
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
  tone?: "default" | "good" | "warn";
}) {
  const color =
    tone === "good"
      ? "#86efac"
      : tone === "warn"
        ? "#fde68a"
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
  const [isDetectingDuration, setIsDetectingDuration] = useState(false);
  const [durationStatus, setDurationStatus] = useState(DEFAULT_DURATION_STATUS);

  const [channelId, setChannelId] = useState(currentChannelId);
  const [adTargetMode, setAdTargetMode] = useState<AdTargetMode>("channel");
  const [commercialCategory, setCommercialCategory] = useState("");
  const [selectedAirDays, setSelectedAirDays] = useState<Weekday[]>([]);
  const [airStartTime, setAirStartTime] = useState("");
  const [status, setStatus] = useState(DEFAULT_STATUS);

  const normalizedFile = useMemo(() => normalizeUrl(file), [file]);

  const parsedDurationSeconds = useMemo(
    () => parseManualDuration(durationInput, durationMode),
    [durationInput, durationMode],
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

  const compatibilityWarning = useMemo(
    () => (normalizedFile ? getVideoCompatibilityWarning(normalizedFile) : null),
    [normalizedFile],
  );

  const normalizedTitle = title.trim().replace(/\s+/g, " ");
  const selectedIsAd = isAdType(type);

  const validation = useMemo(
    () =>
      validateUpload({
        normalizedTitle,
        normalizedFile,
        parsedDurationSeconds,
        channelId,
        enabledChannels,
        type,
        adTargetMode,
      }),
    [
      adTargetMode,
      channelId,
      enabledChannels,
      normalizedFile,
      normalizedTitle,
      parsedDurationSeconds,
      type,
    ],
  );

  useEffect(() => {
    const fallbackChannel =
      enabledChannels.find((channel) => channel.id === currentChannelId) ??
      enabledChannels[0];

    if (!selectedChannel && fallbackChannel) {
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
    setStatus("Days cleared. This item can air every day.");
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

    if (isAdType(nextType)) {
      setAdTargetMode("channel");
      setAirStartTime("");
      setStatus(
        `${getTypeLabel(nextType)} selected. It will save as channel-targeted ad inventory.`,
      );
      return;
    }

    setStatus(`${getTypeLabel(nextType)} selected. It will save to the selected channel playlist.`);
  };

  const resetFormAfterAdd = () => {
    setTitle("");
    setFile("");
    setType("show");
    setDurationInput("");
    setDurationMode("seconds");
    setDurationStatus(DEFAULT_DURATION_STATUS);
    setAdTargetMode("channel");
    setCommercialCategory("");
    setSelectedAirDays([]);
    setAirStartTime("");
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

    const isAd = isAdType(type);
    const isProgram = isProgramType(type);
    const sanitizedCategory = sanitizeCommercialCategory(commercialCategory);
    const normalizedAirStartTime = normalizeAirStartTime(airStartTime.trim());

    const baseItem = createMediaItemFromUrl({
      url: normalizedFile,
      title: normalizedTitle,
      type,
      duration: parsedDurationSeconds,
      breakpoints: [],
      breakDurations: [],
      slotLengthSeconds: undefined,
      fillSlotWithCommercials: false,
      commercialStrategy: "best-fit",
      allowCommercialSlicing: false,
      commercialCategory: isAd ? sanitizedCategory : undefined,
      airDays: isProgram ? selectedAirDays : [],
      airStartTime: isProgram ? normalizedAirStartTime : undefined,
    });

    const item: MediaItem = isAd
      ? {
          ...baseItem,
          adChannelIds:
            adTargetMode === "all"
              ? [GLOBAL_AD_CHANNEL_TARGET]
              : [String(channelId)],
          adPlacements: [...DEFAULT_AD_PLACEMENTS],
          adCategories: sanitizedCategory ? [sanitizedCategory] : ["general"],
          adDays: selectedAirDays,
          commercialCategory: sanitizedCategory,
          allowCommercialSlicing: false,
        }
      : baseItem;

    addMedia(item);

    if (!isAd) {
      assignMediaToChannel(channelId, item.id);
    }

    const targetLabel = isAd
      ? adTargetMode === "all"
        ? "global ad inventory"
        : `${getChannelLabel(selectedChannel)} ad inventory`
      : `${getChannelLabel(selectedChannel)} playlist`;

    setStatus(
      `Added "${item.title}" to ${targetLabel} / ${formatDuration(item.duration)}.`,
    );

    resetFormAfterAdd();
  };

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
            Simple TV Station Uploader
          </h2>

          <p
            className="mt-1 max-w-3xl text-xs leading-5"
            style={{ color: "var(--text-muted)" }}
          >
            Shows, movies, and music videos go to the selected channel playlist.
            Commercials and bumpers save as ad inventory for the selected
            channel. Break timing is handled automatically by the TV scheduler.
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
          label={selectedIsAd ? "Ad Target" : "Channel"}
          value={
            selectedIsAd && adTargetMode === "all"
              ? "All Channels"
              : getChannelLabel(selectedChannel)
          }
          tone={selectedChannel || adTargetMode === "all" ? "good" : "warn"}
        />
        <SummaryPill
          label={selectedIsAd ? "Campaign Days" : "Air Days"}
          value={
            selectedAirDays.length === 0
              ? "Every Day"
              : `${selectedAirDays.length} selected`
          }
        />
        <SummaryPill
          label="Break Logic"
          value="Automatic"
          tone="good"
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
            Duplicate warning: this URL is already saved as{" "}
            <span className="font-black">
              &quot;{existingUrlMatch.title}&quot;
            </span>
            .
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
            disabled={selectedIsAd && adTargetMode === "all"}
            className="w-full rounded-xl border px-3 py-3 text-base disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor:
                selectedChannel || (selectedIsAd && adTargetMode === "all")
                  ? "var(--border)"
                  : "#f87171",
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

        {selectedIsAd ? (
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
              Commercial Targeting
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label
                className="flex items-center gap-3 rounded-xl border p-3 text-sm"
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                }}
              >
                <input
                  type="radio"
                  checked={adTargetMode === "channel"}
                  onChange={() => setAdTargetMode("channel")}
                  className="h-5 w-5"
                />
                <span>Selected channel only</span>
              </label>

              <label
                className="flex items-center gap-3 rounded-xl border p-3 text-sm"
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                }}
              >
                <input
                  type="radio"
                  checked={adTargetMode === "all"}
                  onChange={() => setAdTargetMode("all")}
                  className="h-5 w-5"
                />
                <span>All channels</span>
              </label>

              <input
                value={commercialCategory}
                onChange={(event) => setCommercialCategory(event.target.value)}
                className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                placeholder="Category: general, kids, anime..."
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />
            </div>

            <div
              className="mt-2 text-[11px] leading-5"
              style={{ color: "var(--text-muted)" }}
            >
              Default: commercials belong to the selected channel. Use All
              Channels only for Tate&apos;s TV-wide station promos.
            </div>
          </div>
        ) : null}

        {isProgramType(type) ? (
          <div
            className="rounded-2xl border p-3"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
            }}
          >
            <label
              className="mb-1 block text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Optional Fixed Air Time
            </label>

            <input
              value={airStartTime}
              onChange={(event) =>
                setAirStartTime(event.target.value.replace(/[^\d:]/g, ""))
              }
              className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
              placeholder="Optional HH:mm, like 16:00"
              style={{
                background: "var(--panel-bg)",
                borderColor:
                  airStartTime && !normalizeAirStartTime(airStartTime)
                    ? "#f87171"
                    : "var(--border)",
                color: "var(--text)",
              }}
            />

            <div
              className="mt-1 text-[11px] leading-5"
              style={{ color: "var(--text-muted)" }}
            >
              Leave blank for normal cable rotation.
            </div>
          </div>
        ) : null}

        <div>
          <div
            className="mb-2 flex items-center justify-between gap-2 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <span>{selectedIsAd ? "Campaign Days" : "Air Days"}</span>

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
            No days selected means every day.
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
            ? selectedIsAd
              ? "Ready to add as channel-targeted commercial inventory."
              : "Ready to add to the selected channel playlist."
            : validation.message}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() =>
              window.open(normalizedFile, "_blank", "noopener,noreferrer")
            }
            disabled={!normalizedFile.startsWith("https://")}
            className="ttv-action-button ttv-touch-target rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Test URL
          </button>

          <button
            type="button"
            onClick={addItem}
            disabled={!validation.ok}
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