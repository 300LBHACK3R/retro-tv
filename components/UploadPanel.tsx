"use client";

import { useEffect, useMemo, useState } from "react";
import { probeVideoDuration } from "@/lib/mediaDuration";
import {
  createMediaItemFromUrl,
  formatBreakpoints,
  formatDuration,
  formatDurationClock,
  getVideoCompatibilityWarning,
  inferNameFromUrl,
  isLikelyVideoUrl,
  normalizeUrl,
  normalizeAirStartTime,
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
type UploadPreset =
  | "clean-show"
  | "cartoon-breaks"
  | "sitcom-breaks"
  | "drama-breaks"
  | "movie"
  | "music-video"
  | "commercial"
  | "bumper";

type AdTargetMode = "all" | "channel";

type ValidationResult = {
  ok: boolean;
  message: string;
};

const DEFAULT_STATUS =
  "Add clean programs, movies, music videos, commercials, bumpers, fixed air time, and optional air days.";

const DEFAULT_DURATION_STATUS =
  "Auto-detect will try first. Manual duration always works.";

const DEFAULT_AD_PLACEMENTS: AdPlacement[] = ["between-programs", "filler"];

const AD_PLACEMENT_OPTIONS: Array<{ id: AdPlacement; label: string }> = [
  { id: "between-programs", label: "Between Programs" },
  { id: "filler", label: "Filler" },
  { id: "post-roll", label: "Post-Roll" },
  { id: "mid-roll", label: "Mid-Roll" },
  { id: "pre-roll", label: "Pre-Roll" },
  { id: "top-of-hour", label: "Top Of Hour" },
];

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
    return "Optional. Leave blank for clean runtime-only scheduling.";
  }

  if (durationSeconds > 0 && slotLengthSeconds <= durationSeconds) {
    return "Slot must be longer than the media runtime.";
  }

  return `${formatDuration(slotLengthSeconds)} deliberate broadcast block`;
}

function isProgramType(type: MediaType): boolean {
  return (
    type === "show" ||
    type === "movie" ||
    type === "music" ||
    type === "music-video"
  );
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

      return String(a.id).localeCompare(String(b.id), undefined, {
        numeric: true,
        sensitivity: "base",
      });
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
  adTargetMode,
}: {
  normalizedTitle: string;
  normalizedFile: string;
  parsedDurationSeconds: number;
  channelId: string;
  enabledChannels: Channel[];
  type: MediaType;
  fillSlotWithCommercials: boolean;
  parsedSlotLengthSeconds: number;
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

  if (isProgramType(type)) {
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

  if (shouldShowCommercialFields(type) && adTargetMode === "channel") {
    if (!enabledChannels.some((channel) => channel.id === channelId)) {
      return {
        ok: false,
        message: "Select a valid channel target or choose All Channels.",
      };
    }
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

  const [breakpointsInput, setBreakpointsInput] = useState("");
  const [breakDurationsInput, setBreakDurationsInput] = useState("");
  const [slotLengthInput, setSlotLengthInput] = useState("");
  const [fillSlotWithCommercials, setFillSlotWithCommercials] = useState(false);
  const [commercialStrategy, setCommercialStrategy] =
    useState<CommercialStrategy>("best-fit");

  const [allowCommercialSlicing, setAllowCommercialSlicing] = useState(false);
  const [commercialCategory, setCommercialCategory] = useState("");
  const [adTargetMode, setAdTargetMode] = useState<AdTargetMode>("all");
  const [adPlacements, setAdPlacements] =
    useState<AdPlacement[]>(DEFAULT_AD_PLACEMENTS);

  const [selectedAirDays, setSelectedAirDays] = useState<Weekday[]>([]);
  const [airStartTime, setAirStartTime] = useState("");
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
        adTargetMode,
      }),
    [
      adTargetMode,
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

  const toggleAdPlacement = (placement: AdPlacement) => {
    setAdPlacements((current) => {
      if (current.includes(placement)) {
        const next = current.filter((item) => item !== placement);

        return next.length > 0 ? next : DEFAULT_AD_PLACEMENTS;
      }

      return [...current, placement];
    });
  };

  const selectEveryDay = () => {
    setSelectedAirDays([]);
    setStatus("Air days cleared. This media can air every day.");
  };

  const clearBroadcastLogic = () => {
    setSlotLengthInput("");
    setBreakpointsInput("");
    setBreakDurationsInput("");
    setFillSlotWithCommercials(false);
    setStatus("Broadcast break logic cleared. This item will use clean runtime.");
  };

  const applyPreset = (preset: UploadPreset) => {
    if (preset === "clean-show") {
      setType("show");
      setSlotLengthInput("");
      setBreakpointsInput("");
      setBreakDurationsInput("");
      setFillSlotWithCommercials(false);
      setCommercialStrategy("best-fit");
      setAllowCommercialSlicing(false);
      setStatus("Applied clean show preset. No automatic breaks or slot filler.");
      return;
    }

    if (preset === "cartoon-breaks") {
      setType("show");
      setSlotLengthInput("30:00");
      setBreakpointsInput("7:30, 15:00");
      setBreakDurationsInput("2:00, 2:00");
      setFillSlotWithCommercials(true);
      setCommercialStrategy("best-fit");
      setAllowCommercialSlicing(false);
      setStatus("Applied deliberate 30-minute cartoon/anime break preset.");
      return;
    }

    if (preset === "sitcom-breaks") {
      setType("show");
      setSlotLengthInput("30:00");
      setBreakpointsInput("11:00");
      setBreakDurationsInput("3:00");
      setFillSlotWithCommercials(true);
      setCommercialStrategy("best-fit");
      setAllowCommercialSlicing(false);
      setStatus("Applied deliberate 30-minute sitcom break preset.");
      return;
    }

    if (preset === "drama-breaks") {
      setType("show");
      setSlotLengthInput("60:00");
      setBreakpointsInput("12:00, 24:00, 36:00");
      setBreakDurationsInput("3:00, 3:00, 3:00");
      setFillSlotWithCommercials(true);
      setCommercialStrategy("best-fit");
      setAllowCommercialSlicing(false);
      setStatus("Applied deliberate 60-minute drama break preset.");
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

    if (preset === "commercial") {
      setType("commercial");
      setSlotLengthInput("");
      setBreakpointsInput("");
      setBreakDurationsInput("");
      setFillSlotWithCommercials(false);
      setCommercialStrategy("best-fit");
      setAllowCommercialSlicing(false);
      setAdTargetMode("all");
      setAdPlacements(DEFAULT_AD_PLACEMENTS);
      setStatus("Applied commercial preset. Saved as global ad inventory.");
      return;
    }

    if (preset === "bumper") {
      setType("bumper");
      setSlotLengthInput("");
      setBreakpointsInput("");
      setBreakDurationsInput("");
      setFillSlotWithCommercials(false);
      setCommercialStrategy("best-fit");
      setAllowCommercialSlicing(false);
      setAdTargetMode("all");
      setAdPlacements(["between-programs"]);
      setStatus("Applied bumper preset. Saved as global ad inventory.");
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
      setAllowCommercialSlicing(false);
      setAdTargetMode("all");
      setStatus(`${getTypeLabel(nextType)} mode selected. This will save as ad inventory.`);
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
    setStatus(`${getTypeLabel(nextType)} mode selected.`);
  };

  const resetFormAfterAdd = () => {
    setTitle("");
    setFile("");
    setType("show");
    setDurationInput("");
    setDurationMode("seconds");
    setBreakpointsInput("");
    setBreakDurationsInput("");
    setSlotLengthInput("");
    setFillSlotWithCommercials(false);
    setCommercialStrategy("best-fit");
    setAllowCommercialSlicing(false);
    setCommercialCategory("");
    setAdTargetMode("all");
    setAdPlacements(DEFAULT_AD_PLACEMENTS);
    setSelectedAirDays([]);
    setAirStartTime("");
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

    const normalizedAirStartTime = normalizeAirStartTime(airStartTime.trim());
    const isAd = shouldShowCommercialFields(type);
    const sanitizedCategory = sanitizeCommercialCategory(commercialCategory);

    const baseItem = createMediaItemFromUrl({
      url: normalizedFile,
      title: normalizedTitle,
      type,
      duration: parsedDurationSeconds,
      breakpoints: shouldShowBroadcastFields(type) ? parsedBreakpoints : [],
      breakDurations: shouldShowBroadcastFields(type)
        ? parsedBreakDurations
        : [],
      slotLengthSeconds:
        shouldShowBroadcastFields(type) &&
        parsedSlotLengthSeconds > parsedDurationSeconds
          ? parsedSlotLengthSeconds
          : undefined,
      fillSlotWithCommercials:
        shouldShowBroadcastFields(type) &&
        parsedSlotLengthSeconds > parsedDurationSeconds
          ? fillSlotWithCommercials
          : false,
      commercialStrategy,
      allowCommercialSlicing: isAd ? allowCommercialSlicing : false,
      commercialCategory: isAd ? sanitizedCategory : undefined,
      airDays: isProgramType(type) ? selectedAirDays : [],
      airStartTime: isProgramType(type) ? normalizedAirStartTime : undefined,
    });

    const item: MediaItem = isAd
      ? {
          ...baseItem,
          adChannelIds:
            adTargetMode === "all"
              ? [GLOBAL_AD_CHANNEL_TARGET]
              : [String(channelId)],
          adPlacements,
          adCategories: sanitizedCategory ? [sanitizedCategory] : ["general"],
          adDays: selectedAirDays,
          commercialCategory: sanitizedCategory,
          allowCommercialSlicing,
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
      `Added "${item.title}" to ${targetLabel} / ${formatDuration(
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
            Clean uploads by default. Shows and movies only get breaks when you
            deliberately add breakpoints or apply a break preset. Commercials
            and bumpers save as ad inventory, not normal channel playlist items.
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
        className="mb-3 grid gap-2 rounded-2xl border p-3 sm:grid-cols-2 xl:grid-cols-6"
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
          label={shouldShowCommercialFields(type) ? "Ad Target" : "Channel"}
          value={
            shouldShowCommercialFields(type) && adTargetMode === "all"
              ? "All Channels"
              : getChannelLabel(selectedChannel)
          }
          tone={selectedChannel || adTargetMode === "all" ? "good" : "warn"}
        />
        <SummaryPill
          label={shouldShowCommercialFields(type) ? "Campaign Days" : "Air Days"}
          value={
            selectedAirDays.length === 0
              ? "Every Day"
              : `${selectedAirDays.length} selected`
          }
        />
        <SummaryPill
          label="Breaks"
          value={
            parsedBreakpoints.length > 0
              ? `${parsedBreakpoints.length} saved`
              : "Clean"
          }
          tone={parsedBreakpoints.length > 0 ? "warn" : "good"}
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
            Duplicate warning: this URL is already saved as "
            {existingUrlMatch.title}".
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
            disabled={shouldShowCommercialFields(type) && adTargetMode === "all"}
            className="w-full rounded-xl border px-3 py-3 text-base disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor:
                selectedChannel || shouldShowCommercialFields(type)
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

        <div className="grid gap-2 sm:grid-cols-4 xl:grid-cols-8">
          <PresetButton label="Clean Show" onClick={() => applyPreset("clean-show")} />
          <PresetButton label="Cartoon Breaks" onClick={() => applyPreset("cartoon-breaks")} />
          <PresetButton label="Sitcom Breaks" onClick={() => applyPreset("sitcom-breaks")} />
          <PresetButton label="Drama Breaks" onClick={() => applyPreset("drama-breaks")} />
          <PresetButton label="Movie" onClick={() => applyPreset("movie")} />
          <PresetButton label="Music Video" onClick={() => applyPreset("music-video")} />
          <PresetButton label="Commercial" onClick={() => applyPreset("commercial")} />
          <PresetButton label="Bumper" onClick={() => applyPreset("bumper")} />
        </div>

        {shouldShowBroadcastFields(type) ? (
          <div
            className="rounded-2xl border p-3"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
            }}
          >
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div
                className="text-xs font-black uppercase tracking-[0.14em]"
                style={{ color: "var(--primary)" }}
              >
                Broadcast Slot / Commercial Logic
              </div>

              <button
                type="button"
                onClick={clearBroadcastLogic}
                className="ttv-action-button rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.1em]"
              >
                Clear Logic
              </button>
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
                  placeholder="Blank, or 30:00"
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
                  Manual Breakpoints
                </label>

                <input
                  value={breakpointsInput}
                  onChange={(event) =>
                    setBreakpointsInput(
                      event.target.value.replace(/[^\d:.,\s]/g, ""),
                    )
                  }
                  className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                  placeholder="Blank, or 7:30, 15:00"
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
                  {formatBreakpoints(parsedBreakpoints) || "No manual breakpoints"}
                </div>
              </div>

              <div>
                <label
                  className="mb-1 block text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Manual Ad Blocks
                </label>

                <input
                  value={breakDurationsInput}
                  onChange={(event) =>
                    setBreakDurationsInput(
                      event.target.value.replace(/[^\d:.,\s]/g, ""),
                    )
                  }
                  className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                  placeholder="Blank, or 2:00, 2:00"
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
                    "No manual ad block durations"}
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
                <span>Fill remaining deliberate slot time with commercials</span>
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
              Commercial / Bumper Inventory Settings
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
                <span>Allow exact-time slicing for this ad</span>
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

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                <span>Target all channels</span>
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
                  checked={adTargetMode === "channel"}
                  onChange={() => setAdTargetMode("channel")}
                  className="h-5 w-5"
                />
                <span>Target selected channel only</span>
              </label>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {AD_PLACEMENT_OPTIONS.map((placement) => {
                const active = adPlacements.includes(placement.id);

                return (
                  <button
                    key={placement.id}
                    type="button"
                    onClick={() => toggleAdPlacement(placement.id)}
                    className="ttv-touch-target rounded-xl border px-3 py-3 text-left text-xs font-black uppercase tracking-[0.08em]"
                    style={{
                      background: active ? "var(--primary)" : "var(--panel-bg)",
                      borderColor: active ? "var(--primary)" : "var(--border)",
                      color: "var(--text)",
                    }}
                  >
                    {placement.label}
                  </button>
                );
              })}
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
              Fixed Air Time
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
              Leave blank for normal rotation. Use HH:mm for fixed daily slots.
            </div>
          </div>
        ) : null}

        <div>
          <div
            className="mb-2 flex items-center justify-between gap-2 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            <span>
              {shouldShowCommercialFields(type) ? "Campaign Days" : "Air Days"}
            </span>

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
            ? shouldShowCommercialFields(type)
              ? "Ready to add as commercial/bumper inventory."
              : "Ready to add media to the selected channel playlist."
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