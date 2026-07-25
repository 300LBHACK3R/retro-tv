"use client";

import { useEffect, useMemo, useState } from "react";
import AdminDirectUploadCard from "@/components/AdminDirectUploadCard";
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
  parseBreakpoints,
  parseDurationList,
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
  type CommercialStrategy,
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
  "Add one public R2 or HTTPS video URL. Programs go to a channel playlist; commercials stay in targeted ad inventory.";

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

function isBroadcastType(type: MediaType): boolean {
  return type === "show" || type === "movie";
}

function getTypeLabel(type: MediaType): string {
  if (type === "movie") return "Movie";
  if (type === "music") return "Music";
  if (type === "music-video") return "Music Video";
  if (type === "commercial") return "Commercial";
  if (type === "bumper") return "Bumper";

  return "Show";
}

function getR2FolderForType(type: MediaType): string {
  if (type === "movie") return "Movies";
  if (type === "music") return "Music";
  if (type === "music-video") return "MusicVideos";
  if (type === "commercial") return "Commercials";
  if (type === "bumper") return "Bumpers";
  return "Shows";
}

function getDurationHelperText(value: string, mode: DurationMode): string {
  const seconds = parseManualDuration(value, mode);

  if (seconds <= 0) {
    return mode === "minutes"
      ? "Type minutes, such as 22.5, or use 22:19."
      : "Type seconds, such as 1339, or use 22:19.";
  }

  return `${formatDuration(seconds)} • ${formatDurationClock(seconds)}`;
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
  if (!channel) return "CH --";
  return `CH ${channel.number ?? channel.id}`;
}

function getChannelName(channel: Channel | undefined): string {
  if (!channel) return "Unknown Channel";
  return channel.branding?.displayName ?? channel.name;
}

function getExistingUrlMatch(
  media: MediaItem[],
  normalizedFile: string,
): MediaItem | null {
  if (!normalizedFile) return null;

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
  breakpoints,
  breakDurations,
  slotLengthSeconds,
  fillSlotWithCommercials,
}: {
  normalizedTitle: string;
  normalizedFile: string;
  parsedDurationSeconds: number;
  channelId: string;
  enabledChannels: Channel[];
  type: MediaType;
  adTargetMode: AdTargetMode;
  breakpoints: number[];
  breakDurations: number[];
  slotLengthSeconds: number;
  fillSlotWithCommercials: boolean;
}): ValidationResult {
  if (!normalizedTitle) {
    return { ok: false, message: "Enter a title first." };
  }

  if (!normalizedFile) {
    return { ok: false, message: "Paste a public HTTPS video URL." };
  }

  if (!normalizedFile.startsWith("https://")) {
    return { ok: false, message: "Use a full public https:// video URL." };
  }

  if (parsedDurationSeconds <= 0) {
    return {
      ok: false,
      message: "Enter a valid duration manually or use Auto Detect.",
    };
  }

  if (isProgramType(type) || adTargetMode === "channel") {
    if (!channelId.trim()) {
      return { ok: false, message: "Select a channel first." };
    }

    if (!enabledChannels.some((channel) => channel.id === channelId)) {
      return {
        ok: false,
        message: "The selected channel is disabled or no longer exists.",
      };
    }
  }

  if (isBroadcastType(type) && breakpoints.length !== breakDurations.length) {
    return {
      ok: false,
      message: "Enter exactly one ad block length for each breakpoint.",
    };
  }

  if (
    isBroadcastType(type) &&
    fillSlotWithCommercials &&
    slotLengthSeconds <= parsedDurationSeconds
  ) {
    return {
      ok: false,
      message: "Broadcast slot must be longer than the actual runtime.",
    };
  }

  if (
    isBroadcastType(type) &&
    fillSlotWithCommercials &&
    slotLengthSeconds <
      parsedDurationSeconds +
        breakDurations.reduce((sum, seconds) => sum + seconds, 0)
  ) {
    return {
      ok: false,
      message: "Broadcast slot must fit the runtime plus every saved ad block.",
    };
  }

  return { ok: true, message: "Ready to add media." };
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-3xl border p-4 sm:p-5"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--panel-alt-bg) 92%, transparent), var(--panel-bg))",
        borderColor: "var(--border)",
        boxShadow: "0 18px 45px rgba(0,0,0,0.18)",
      }}
    >
      <div className="mb-4">
        <div
          className="text-[10px] font-black uppercase tracking-[0.18em]"
          style={{ color: "var(--primary)" }}
        >
          {eyebrow}
        </div>
        <h3 className="mt-1 text-base font-black tracking-tight">{title}</h3>
        {description ? (
          <p
            className="mt-1 max-w-3xl text-xs leading-5"
            style={{ color: "var(--text-muted)" }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-black" style={{ color: "var(--text)" }}>
        {label}
      </span>
      {children}
      {helper ? (
        <span className="text-[11px] leading-5" style={{ color: "var(--text-muted)" }}>
          {helper}
        </span>
      ) : null}
    </label>
  );
}

function SummaryRow({
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
        : "var(--text)";

  return (
    <div
      className="flex items-start justify-between gap-4 border-b py-3 last:border-b-0"
      style={{ borderColor: "color-mix(in srgb, var(--border) 65%, transparent)" }}
    >
      <span
        className="text-[10px] font-black uppercase tracking-[0.14em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span className="max-w-[65%] text-right text-xs font-black" style={{ color }}>
        {value}
      </span>
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
  const [breakpointsInput, setBreakpointsInput] = useState("");
  const [breakDurationsInput, setBreakDurationsInput] = useState("");
  const [slotLengthInput, setSlotLengthInput] = useState("");
  const [fillSlotWithCommercials, setFillSlotWithCommercials] = useState(false);
  const [commercialStrategy, setCommercialStrategy] =
    useState<CommercialStrategy>("best-fit");
  const [selectedAirDays, setSelectedAirDays] = useState<Weekday[]>([]);
  const [airStartTime, setAirStartTime] = useState("");
  const [status, setStatus] = useState(DEFAULT_STATUS);

  const normalizedFile = useMemo(() => normalizeUrl(file), [file]);

  const parsedDurationSeconds = useMemo(
    () => parseManualDuration(durationInput, durationMode),
    [durationInput, durationMode],
  );

  const parsedBreakpoints = useMemo(
    () => parseBreakpoints(breakpointsInput, parsedDurationSeconds),
    [breakpointsInput, parsedDurationSeconds],
  );

  const parsedBreakDurations = useMemo(
    () => parseDurationList(breakDurationsInput),
    [breakDurationsInput],
  );

  const parsedSlotLengthSeconds = useMemo(
    () => parseManualDuration(slotLengthInput, "seconds"),
    [slotLengthInput],
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
  const selectedIsBroadcast = isBroadcastType(type);

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
        breakpoints: parsedBreakpoints,
        breakDurations: parsedBreakDurations,
        slotLengthSeconds: parsedSlotLengthSeconds,
        fillSlotWithCommercials,
      }),
    [
      adTargetMode,
      breakpointsInput,
      breakDurationsInput,
      channelId,
      enabledChannels,
      normalizedFile,
      normalizedTitle,
      fillSlotWithCommercials,
      parsedBreakDurations,
      parsedBreakpoints,
      parsedDurationSeconds,
      parsedSlotLengthSeconds,
      slotLengthInput,
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
        `Detected ${result.durationLabel} • ${formatDurationClock(result.duration)}.`,
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

  const handleDirectUploadComplete = ({
    publicUrl,
    filename,
  }: {
    publicUrl: string;
    objectKey: string;
    filename: string;
  }) => {
    setFile(publicUrl);

    if (!title.trim()) {
      const inferredTitle = inferNameFromUrl(filename) || inferNameFromUrl(publicUrl);
      if (inferredTitle) setTitle(titleCase(inferredTitle));
    }

    setStatus("Direct R2 upload complete. Confirm the title, runtime, type, and channel before adding it to programming.");

    if (!durationInput.trim()) {
      void detectDuration(publicUrl);
    }
  };

  const handleTypeChange = (nextType: MediaType) => {
    setType(nextType);

    if (isAdType(nextType)) {
      setAdTargetMode("channel");
      setAirStartTime("");
      setStatus(
        `${getTypeLabel(nextType)} selected. It will save as targeted ad inventory.`,
      );
      return;
    }

    setStatus(
      `${getTypeLabel(nextType)} selected. It will save to the selected channel playlist.`,
    );
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
    setBreakpointsInput("");
    setBreakDurationsInput("");
    setSlotLengthInput("");
    setFillSlotWithCommercials(false);
    setCommercialStrategy("best-fit");
    setSelectedAirDays([]);
    setAirStartTime("");
  };

  const resetForm = () => {
    resetFormAfterAdd();
    setStatus(DEFAULT_STATUS);
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
      breakpoints: selectedIsBroadcast ? parsedBreakpoints : [],
      breakDurations: selectedIsBroadcast ? parsedBreakDurations : [],
      slotLengthSeconds:
        selectedIsBroadcast && parsedSlotLengthSeconds > parsedDurationSeconds
          ? parsedSlotLengthSeconds
          : undefined,
      fillSlotWithCommercials:
        selectedIsBroadcast && fillSlotWithCommercials,
      commercialStrategy,
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
      `Added "${item.title}" to ${targetLabel} • ${formatDuration(item.duration)}.`,
    );

    resetFormAfterAdd();
  };

  const targetSummary = selectedIsAd
    ? adTargetMode === "all"
      ? "All Channels"
      : `${getChannelLabel(selectedChannel)} • ${getChannelName(selectedChannel)}`
    : `${getChannelLabel(selectedChannel)} • ${getChannelName(selectedChannel)}`;

  const statusLooksSuccessful =
    status.startsWith("Added") || status.startsWith("Days cleared");

  return (
    <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]" style={{ color: "var(--text)" }}>
      <div className="grid min-w-0 gap-4">
        <header
          className="relative overflow-hidden rounded-3xl border p-4 sm:p-6"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--primary) 13%, var(--panel-bg)), var(--panel-bg) 65%)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full opacity-20 blur-3xl"
            style={{ background: "var(--primary)" }}
            aria-hidden="true"
          />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div
                className="text-[10px] font-black uppercase tracking-[0.2em]"
                style={{ color: "var(--primary)" }}
              >
                Media Ingest
              </div>
              <h2 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">
                Add Media to Tate&apos;s TV
              </h2>
              <p
                className="mt-2 max-w-3xl text-xs leading-5 sm:text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Paste a public R2 URL, confirm the title and runtime, choose the
                content type, then assign it to a channel or targeted ad inventory.
              </p>
            </div>

            <div
              className="w-fit rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em]"
              style={{
                borderColor: validation.ok
                  ? "rgba(34,197,94,0.38)"
                  : "var(--border)",
                background: validation.ok
                  ? "rgba(34,197,94,0.12)"
                  : "var(--panel-alt-bg)",
                color: validation.ok ? "#86efac" : "var(--text-muted)",
              }}
            >
              {validation.ok ? "Ready to Add" : "Needs Details"}
            </div>
          </div>
        </header>

        <AdminDirectUploadCard
          defaultFolder={getR2FolderForType(type)}
          onUploaded={handleDirectUploadComplete}
        />

        <SectionCard
          eyebrow="Step 1"
          title="Source and Identity"
          description="Use a direct public HTTPS video URL. Tate’s TV stores the URL and streams the media from R2."
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(15rem,0.85fr)_minmax(20rem,1.4fr)]">
            <FieldLabel label="Display Title" helper="Shown in the guide, player, library, and Now/Next display.">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-2xl border px-4 py-3 text-base outline-none transition focus:ring-2 sm:text-sm"
                placeholder="Example: Foster's Home S01E01"
                maxLength={140}
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: normalizedTitle ? "var(--border)" : "#f87171",
                  color: "var(--text)",
                }}
              />
            </FieldLabel>

            <FieldLabel label="Public Video URL" helper="Paste the direct .mp4, .webm, .mov, or compatible public R2 URL.">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  value={file}
                  onChange={(event) => handleUrlChange(event.target.value)}
                  onBlur={(event) => {
                    if (!durationInput.trim()) {
                      void detectDuration(event.target.value);
                    }
                  }}
                  className="min-w-0 rounded-2xl border px-4 py-3 text-base outline-none transition focus:ring-2 sm:text-sm"
                  placeholder="https://pub-xxxx.r2.dev/folder/video.mp4"
                  spellCheck={false}
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor:
                      normalizedFile && !normalizedFile.startsWith("https://")
                        ? "#f87171"
                        : existingUrlMatch
                          ? "rgba(250,204,21,0.55)"
                          : "var(--border)",
                    color: "var(--text)",
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    window.open(normalizedFile, "_blank", "noopener,noreferrer")
                  }
                  disabled={!normalizedFile.startsWith("https://")}
                  className="ttv-action-button ttv-touch-target rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Test URL
                </button>
              </div>
            </FieldLabel>
          </div>

          {existingUrlMatch || compatibilityWarning ? (
            <div className="mt-4 grid gap-3">
              {existingUrlMatch ? (
                <div
                  className="rounded-2xl border px-4 py-3 text-xs leading-5"
                  style={{
                    background: "rgba(250,204,21,0.08)",
                    borderColor: "rgba(250,204,21,0.35)",
                    color: "#fde68a",
                  }}
                >
                  Duplicate URL: already saved as <strong>{existingUrlMatch.title}</strong>.
                </div>
              ) : null}

              {compatibilityWarning ? (
                <div
                  className="rounded-2xl border px-4 py-3 text-xs leading-5"
                  style={{
                    background: "rgba(250,204,21,0.08)",
                    borderColor: "rgba(250,204,21,0.35)",
                    color: "#fde68a",
                  }}
                >
                  {compatibilityWarning}
                </div>
              ) : null}
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          eyebrow="Step 2"
          title="Content Details"
          description="Choose how the scheduler should treat this media and confirm its actual runtime."
        >
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[0.75fr_1.25fr_1fr]">
            <FieldLabel label="Media Type">
              <select
                value={type}
                onChange={(event) => handleTypeChange(event.target.value as MediaType)}
                className="w-full rounded-2xl border px-4 py-3 text-base outline-none sm:text-sm"
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
            </FieldLabel>

            <FieldLabel label="Runtime" helper={`${durationStatus} ${getDurationHelperText(durationInput, durationMode)}`}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                <input
                  value={durationInput}
                  onChange={(event) =>
                    setDurationInput(event.target.value.replace(/[^\d:.]/g, ""))
                  }
                  className="min-w-0 rounded-2xl border px-4 py-3 text-base outline-none sm:text-sm"
                  placeholder="22:19"
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
                  className="rounded-2xl border px-3 py-3 text-sm outline-none"
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
                  className="ttv-action-button ttv-touch-target rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isDetectingDuration ? "Reading" : "Auto"}
                </button>
              </div>
            </FieldLabel>

            <FieldLabel label={selectedIsAd ? "Primary Target Channel" : "Channel Assignment"}>
              <select
                value={channelId}
                onChange={(event) => setChannelId(event.target.value)}
                disabled={selectedIsAd && adTargetMode === "all"}
                className="w-full rounded-2xl border px-4 py-3 text-base disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
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
                    {getChannelLabel(channel)} • {getChannelName(channel)}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>
        </SectionCard>

        {selectedIsBroadcast ? (
          <SectionCard
            eyebrow="Step 3"
            title="Broadcast Slot and Commercial Logic"
            description="These values are saved exactly for this item. Nothing is invented from channel defaults."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <FieldLabel label="Broadcast Slot" helper="Leave blank for no fixed slot. Example: 30:00.">
                <input
                  value={slotLengthInput}
                  onChange={(event) =>
                    setSlotLengthInput(event.target.value.replace(/[^\d:]/g, ""))
                  }
                  className="w-full rounded-2xl border px-4 py-3 text-base outline-none sm:text-sm"
                  placeholder="30:00"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />
              </FieldLabel>

              <FieldLabel label="Breakpoints" helper="Source positions inside the program, such as 7:00, 14:00.">
                <input
                  value={breakpointsInput}
                  onChange={(event) =>
                    setBreakpointsInput(event.target.value.replace(/[^\d:,\s]/g, ""))
                  }
                  className="w-full rounded-2xl border px-4 py-3 text-base outline-none sm:text-sm"
                  placeholder="7:00, 14:00"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />
              </FieldLabel>

              <FieldLabel label="Ad Block Lengths" helper="One exact length per breakpoint, such as :52, :52.">
                <input
                  value={breakDurationsInput}
                  onChange={(event) =>
                    setBreakDurationsInput(event.target.value.replace(/[^\d:,\s]/g, ""))
                  }
                  className="w-full rounded-2xl border px-4 py-3 text-base outline-none sm:text-sm"
                  placeholder=":52, :52"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />
              </FieldLabel>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label
                className="flex items-center gap-3 rounded-2xl border p-4 text-sm"
                style={{
                  background: "var(--panel-alt-bg)",
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
                <span>
                  <strong className="block">Fill Remaining Slot Time</strong>
                  <span className="mt-1 block text-xs" style={{ color: "var(--text-muted)" }}>
                    Fill only the remaining time in this item&apos;s saved slot.
                  </span>
                </span>
              </label>

              <FieldLabel label="Commercial Selection Strategy">
                <select
                  value={commercialStrategy}
                  onChange={(event) =>
                    setCommercialStrategy(
                      event.target.value as CommercialStrategy,
                    )
                  }
                  className="w-full rounded-2xl border px-4 py-3 text-base sm:text-sm"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                >
                  <option value="best-fit">Best Fit</option>
                  <option value="sequential">Sequential</option>
                  <option value="random">Random</option>
                </select>
              </FieldLabel>
            </div>
          </SectionCard>
        ) : null}

        {selectedIsAd ? (
          <SectionCard
            eyebrow="Step 3"
            title="Commercial Targeting"
            description="Commercials remain outside normal playlists and are selected by the scheduler during eligible breaks."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setAdTargetMode("channel")}
                className="rounded-2xl border p-4 text-left transition hover:scale-[1.005]"
                style={{
                  background:
                    adTargetMode === "channel"
                      ? "color-mix(in srgb, var(--primary) 18%, var(--panel-bg))"
                      : "var(--panel-alt-bg)",
                  borderColor:
                    adTargetMode === "channel" ? "var(--primary)" : "var(--border)",
                }}
              >
                <div className="text-sm font-black">Selected Channel</div>
                <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
                  Run this ad only on {getChannelLabel(selectedChannel)}.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAdTargetMode("all")}
                className="rounded-2xl border p-4 text-left transition hover:scale-[1.005]"
                style={{
                  background:
                    adTargetMode === "all"
                      ? "color-mix(in srgb, var(--primary) 18%, var(--panel-bg))"
                      : "var(--panel-alt-bg)",
                  borderColor:
                    adTargetMode === "all" ? "var(--primary)" : "var(--border)",
                }}
              >
                <div className="text-sm font-black">All Eligible Channels</div>
                <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
                  Use for Tate&apos;s TV network promos and truly global campaigns.
                </div>
              </button>
            </div>

            <div className="mt-4">
              <FieldLabel label="Commercial Category" helper="Examples: general, kids, anime, gaming, local-business.">
                <input
                  value={commercialCategory}
                  onChange={(event) => setCommercialCategory(event.target.value)}
                  className="w-full rounded-2xl border px-4 py-3 text-base outline-none sm:text-sm"
                  placeholder="general"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />
              </FieldLabel>
            </div>
          </SectionCard>
        ) : null}

        <SectionCard
          eyebrow={selectedIsAd ? "Step 4" : "Step 3"}
          title={selectedIsAd ? "Campaign Schedule" : "Air Schedule"}
          description="No selected days means every day. Fixed air time is optional for normal cable rotation."
        >
          {isProgramType(type) ? (
            <div className="mb-4 max-w-sm">
              <FieldLabel label="Optional Fixed Air Time" helper="Use HH:mm, such as 16:00. Leave blank for regular rotation.">
                <input
                  value={airStartTime}
                  onChange={(event) =>
                    setAirStartTime(event.target.value.replace(/[^\d:]/g, ""))
                  }
                  className="w-full rounded-2xl border px-4 py-3 text-base outline-none sm:text-sm"
                  placeholder="16:00"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor:
                      airStartTime && !normalizeAirStartTime(airStartTime)
                        ? "#f87171"
                        : "var(--border)",
                    color: "var(--text)",
                  }}
                />
              </FieldLabel>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-black" style={{ color: "var(--text-muted)" }}>
                {selectedIsAd ? "Campaign Days" : "Air Days"}
              </div>
              <button
                type="button"
                onClick={selectEveryDay}
                className="ttv-action-button rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em]"
              >
                Every Day
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {WEEKDAYS.map((day) => {
                const active = selectedAirDays.includes(day.id);

                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleAirDay(day.id)}
                    className="ttv-touch-target rounded-2xl border px-2 py-3 text-[10px] font-black uppercase tracking-[0.08em] transition"
                    style={{
                      background: active
                        ? "color-mix(in srgb, var(--primary) 22%, var(--panel-bg))"
                        : "var(--button-bg)",
                      borderColor: active ? "var(--primary)" : "var(--border)",
                      color: "var(--text)",
                    }}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        </SectionCard>

        <div
          className="sticky bottom-2 z-20 rounded-3xl border p-3 shadow-2xl backdrop-blur-xl sm:p-4"
          style={{
            background: "color-mix(in srgb, var(--panel-bg) 94%, transparent)",
            borderColor: validation.ok
              ? "color-mix(in srgb, var(--primary) 45%, var(--border))"
              : "var(--border)",
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div
                className="text-[10px] font-black uppercase tracking-[0.14em]"
                style={{ color: validation.ok ? "#86efac" : "#fca5a5" }}
              >
                {validation.ok ? "Ready" : "Action Required"}
              </div>
              <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
                {validation.ok ? "Review the summary, then add the item." : validation.message}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={resetForm}
                className="ttv-action-button ttv-touch-target rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em]"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={addItem}
                disabled={!validation.ok}
                className="ttv-touch-target rounded-2xl px-6 py-3 text-xs font-black uppercase tracking-[0.14em] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))",
                  color: "var(--text)",
                  boxShadow: validation.ok
                    ? "0 14px 35px color-mix(in srgb, var(--primary) 24%, transparent)"
                    : "none",
                }}
              >
                Add Media
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside className="min-w-0 2xl:sticky 2xl:top-4 2xl:self-start">
        <div
          className="rounded-3xl border p-4 sm:p-5"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--panel-alt-bg) 94%, transparent), var(--panel-bg))",
            borderColor: "var(--border)",
            boxShadow: "0 20px 55px rgba(0,0,0,0.22)",
          }}
        >
          <div
            className="text-[10px] font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--primary)" }}
          >
            Review
          </div>
          <h3 className="mt-1 text-lg font-black tracking-tight">Media Summary</h3>

          <div className="mt-4">
            <SummaryRow label="Title" value={normalizedTitle || "Not set"} tone={normalizedTitle ? "good" : "warn"} />
            <SummaryRow label="Type" value={getTypeLabel(type)} />
            <SummaryRow
              label="Runtime"
              value={parsedDurationSeconds > 0 ? formatDurationClock(parsedDurationSeconds) : "Not set"}
              tone={parsedDurationSeconds > 0 ? "good" : "warn"}
            />
            {selectedIsBroadcast ? (
              <>
                <SummaryRow
                  label="Broadcast Slot"
                  value={
                    parsedSlotLengthSeconds > 0
                      ? formatDurationClock(parsedSlotLengthSeconds)
                      : "None"
                  }
                />
                <SummaryRow
                  label="Breaks"
                  value={
                    parsedBreakpoints.length > 0
                      ? parsedBreakpoints.map(formatDurationClock).join(", ")
                      : "None"
                  }
                />
                <SummaryRow
                  label="Ad Blocks"
                  value={
                    parsedBreakDurations.length > 0
                      ? parsedBreakDurations.map(formatDurationClock).join(", ")
                      : "None"
                  }
                />
              </>
            ) : null}
            <SummaryRow label={selectedIsAd ? "Ad Target" : "Channel"} value={targetSummary} tone={selectedChannel || adTargetMode === "all" ? "good" : "warn"} />
            <SummaryRow
              label={selectedIsAd ? "Campaign Days" : "Air Days"}
              value={selectedAirDays.length === 0 ? "Every Day" : `${selectedAirDays.length} selected`}
            />
            <SummaryRow label="URL" value={normalizedFile ? "Public URL set" : "Not set"} tone={normalizedFile ? "good" : "warn"} />
          </div>

          <div
            className="mt-5 rounded-2xl border p-4 text-xs leading-5"
            style={{
              background: statusLooksSuccessful
                ? "rgba(34,197,94,0.08)"
                : "var(--panel-alt-bg)",
              borderColor: statusLooksSuccessful
                ? "rgba(34,197,94,0.35)"
                : "var(--border)",
              color: statusLooksSuccessful ? "#86efac" : "var(--text-muted)",
            }}
            aria-live="polite"
          >
            {status}
          </div>

          <div
            className="mt-4 rounded-2xl border p-4 text-[11px] leading-5"
            style={{
              background: "rgba(14,165,233,0.06)",
              borderColor: "rgba(14,165,233,0.22)",
              color: "var(--text-muted)",
            }}
          >
            Add Media saves these item-specific broadcast settings immediately.
            Quick Edit can change the same exact values later.
          </div>
        </div>
      </aside>
    </section>
  );
}
