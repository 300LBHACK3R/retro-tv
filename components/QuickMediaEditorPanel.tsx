"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatBreakpoints,
  formatDurationClock,
  normalizeAirStartTime,
  parseBreakpoints,
  parseDurationList,
  parseManualDuration,
  sanitizeCommercialCategory,
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

type MediaFilter = "all" | MediaType | "embedded-ads";

type EditorPreset = "cartoon" | "sitcom" | "drama";

type ValidationResult = {
  ok: boolean;
  message: string;
};

const MEDIA_FILTERS: { id: MediaFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "show", label: "Shows" },
  { id: "movie", label: "Movies" },
  { id: "music", label: "Music" },
  { id: "music-video", label: "Music Videos" },
  { id: "commercial", label: "Commercials" },
  { id: "bumper", label: "Bumpers" },
  { id: "embedded-ads", label: "Embedded Ads" },
];

const MAX_MEDIA_LIST_HEIGHT = 640;
const MAX_TITLE_LENGTH = 140;
const UNASSIGNED_TARGET = "";

function getChannelNumber(
  channelId: string,
  channels: { id: string; number?: number }[],
): string | number {
  const channel = channels.find((item) => item.id === channelId);
  return channel?.number ?? channelId;
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

function getMediaSearchLabel(item: MediaItem): string {
  return [
    item.title,
    item.type,
    item.file,
    item.originalName,
    item.description,
    item.provider,
    item.mimeType,
    item.commercialCategory,
    item.airStartTime,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isValidAirTime(value: string): boolean {
  if (!value.trim()) return true;

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return false;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return (
    Number.isFinite(hours) &&
    Number.isFinite(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  );
}

function isProgramType(type: MediaType): boolean {
  return (
    type === "show" ||
    type === "movie" ||
    type === "music" ||
    type === "music-video"
  );
}

function isCommercialType(type: MediaType): boolean {
  return type === "commercial" || type === "bumper";
}

function getMediaTypeLabel(type: MediaType): string {
  if (type === "commercial") return "Commercial";
  if (type === "bumper") return "Bumper";
  if (type === "movie") return "Movie";
  if (type === "music") return "Music";
  if (type === "music-video") return "Music Video";
  return "Show";
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

function sortMedia(media: MediaItem[]): MediaItem[] {
  return [...media].sort((a, b) => {
    const typeCompare = a.type.localeCompare(b.type);

    if (typeCompare !== 0) {
      return typeCompare;
    }

    return a.title.localeCompare(b.title, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function createAssignedChannelIds(
  item: MediaItem | undefined,
  channels: Channel[],
): string[] {
  if (!item) {
    return [];
  }

  return channels
    .filter((channel) => channel.mediaIds.includes(item.id))
    .map((channel) => channel.id);
}

function getSelectedChannelLabel(
  assignedChannelIds: string[],
  channels: Channel[],
): string {
  if (assignedChannelIds.length === 0) {
    return "Not assigned";
  }

  return assignedChannelIds
    .map((channelId) => `CH ${getChannelNumber(channelId, channels)}`)
    .join(", ");
}

function getItemChannelSummary(item: MediaItem, channels: Channel[]): string {
  const assigned = channels
    .filter((channel) => channel.mediaIds.includes(item.id))
    .map((channel) => `CH ${channel.number ?? channel.id}`)
    .join(", ");

  return assigned || "No channel";
}

function isEmbeddedAd(item: MediaItem, channels: Channel[]): boolean {
  return (
    isCommercialType(item.type) &&
    channels.some((channel) => channel.mediaIds.includes(item.id))
  );
}

function getBroadcastSummary({
  parsedSlotLength,
  parsedDuration,
  parsedBreakpoints,
  parsedBreakDurations,
  selectedChannelLabel,
  isCommercialInventory,
}: {
  parsedSlotLength: number;
  parsedDuration: number;
  parsedBreakpoints: number[];
  parsedBreakDurations: number[];
  selectedChannelLabel: string;
  isCommercialInventory: boolean;
}): string {
  if (isCommercialInventory) {
    return [
      `Runtime: ${
        parsedDuration > 0 ? formatDurationClock(parsedDuration) : "invalid"
      }`,
      "Mode: global ad inventory",
      "Playlist assignment: blocked",
    ].join(" • ");
  }

  return [
    `Slot: ${parsedSlotLength > 0 ? formatDurationClock(parsedSlotLength) : "none"}`,
    `Runtime: ${
      parsedDuration > 0 ? formatDurationClock(parsedDuration) : "invalid"
    }`,
    `Breaks: ${formatBreakpoints(parsedBreakpoints) || "none"}`,
    `Ad blocks: ${formatBreakpoints(parsedBreakDurations) || "none"}`,
    `Current channel: ${selectedChannelLabel}`,
  ].join(" • ");
}

function validateEditorState({
  selectedMedia,
  title,
  type,
  parsedDuration,
  fillSlotWithCommercials,
  parsedSlotLength,
  airStartTime,
  targetChannelId,
  enabledChannels,
}: {
  selectedMedia: MediaItem | undefined;
  title: string;
  type: MediaType;
  parsedDuration: number;
  fillSlotWithCommercials: boolean;
  parsedSlotLength: number;
  airStartTime: string;
  targetChannelId: string;
  enabledChannels: Channel[];
}): ValidationResult {
  if (!selectedMedia) {
    return {
      ok: false,
      message: "Select a media item first.",
    };
  }

  if (!title.trim()) {
    return {
      ok: false,
      message: "Title cannot be blank.",
    };
  }

  if (parsedDuration <= 0) {
    return {
      ok: false,
      message: "Duration must be valid. Example: 21:57.",
    };
  }

  if (!isValidAirTime(airStartTime)) {
    return {
      ok: false,
      message: "Air time must be HH:mm format, like 16:00.",
    };
  }

  if (
    isProgramType(type) &&
    fillSlotWithCommercials &&
    parsedSlotLength <= parsedDuration
  ) {
    return {
      ok: false,
      message: "Slot length must be longer than runtime. Example: 30:00.",
    };
  }

  if (
    isProgramType(type) &&
    targetChannelId &&
    !enabledChannels.some((channel) => channel.id === targetChannelId)
  ) {
    return {
      ok: false,
      message: "Select a valid enabled channel.",
    };
  }

  return {
    ok: true,
    message: "Valid.",
  };
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ttv-touch-target shrink-0 rounded-xl border px-3 py-3 text-xs font-black uppercase tracking-[0.1em]"
      style={{
        background: active ? "var(--primary)" : "var(--button-bg)",
        borderColor: active ? "var(--primary)" : "var(--border)",
        color: "var(--text)",
      }}
    >
      {label}
    </button>
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

export default function QuickMediaEditorPanel() {
  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const updateMedia = useStore((state) => state.updateMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);
  const removeMediaFromChannel = useStore(
    (state) => state.removeMediaFromChannel,
  );

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [selectedMediaId, setSelectedMediaId] = useState("");

  const [title, setTitle] = useState("");
  const [type, setType] = useState<MediaType>("show");
  const [durationInput, setDurationInput] = useState("");

  const [breakpointsInput, setBreakpointsInput] = useState("");
  const [breakDurationsInput, setBreakDurationsInput] = useState("");
  const [slotLengthInput, setSlotLengthInput] = useState("");
  const [fillSlotWithCommercials, setFillSlotWithCommercials] = useState(false);
  const [commercialStrategy, setCommercialStrategy] =
    useState<CommercialStrategy>("best-fit");

  const [allowCommercialSlicing, setAllowCommercialSlicing] = useState(false);
  const [commercialCategory, setCommercialCategory] = useState("");

  const [airStartTime, setAirStartTime] = useState("");
  const [airDays, setAirDays] = useState<Weekday[]>([]);
  const [targetChannelId, setTargetChannelId] = useState(currentChannelId);

  const [message, setMessage] = useState(
    "Select any loaded media item to edit it quickly.",
  );

  const enabledChannels = useMemo(() => sortChannels(channels), [channels]);

  const selectedMedia = useMemo(
    () => media.find((item) => item.id === selectedMediaId),
    [media, selectedMediaId],
  );

  const assignedChannelIds = useMemo(
    () => createAssignedChannelIds(selectedMedia, channels),
    [channels, selectedMedia],
  );

  const selectedIsCommercialInventory = isCommercialType(type);
  const selectedIsEmbeddedAd = Boolean(
    selectedMedia && isEmbeddedAd(selectedMedia, channels),
  );

  const filteredMedia = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return sortMedia(media).filter((item) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "embedded-ads"
            ? isEmbeddedAd(item, channels)
            : item.type === filter;

      const matchesSearch =
        !cleanSearch || getMediaSearchLabel(item).includes(cleanSearch);

      return matchesFilter && matchesSearch;
    });
  }, [channels, filter, media, search]);

  const parsedDuration = useMemo(
    () => parseManualDuration(durationInput, "seconds"),
    [durationInput],
  );

  const parsedBreakpoints = useMemo(
    () => parseBreakpoints(breakpointsInput, parsedDuration),
    [breakpointsInput, parsedDuration],
  );

  const parsedBreakDurations = useMemo(
    () => parseDurationList(breakDurationsInput),
    [breakDurationsInput],
  );

  const parsedSlotLength = useMemo(
    () => parseManualDuration(slotLengthInput, "seconds"),
    [slotLengthInput],
  );

  const selectedChannelLabel = useMemo(
    () => getSelectedChannelLabel(assignedChannelIds, channels),
    [assignedChannelIds, channels],
  );

  const validation = useMemo(
    () =>
      validateEditorState({
        selectedMedia,
        title,
        type,
        parsedDuration,
        fillSlotWithCommercials,
        parsedSlotLength,
        airStartTime,
        targetChannelId,
        enabledChannels,
      }),
    [
      airStartTime,
      enabledChannels,
      fillSlotWithCommercials,
      parsedDuration,
      parsedSlotLength,
      selectedMedia,
      targetChannelId,
      title,
      type,
    ],
  );

  useEffect(() => {
    if (!selectedMedia) return;

    setTitle(selectedMedia.title);
    setType(selectedMedia.type);
    setDurationInput(formatDurationClock(selectedMedia.duration));
    setBreakpointsInput(formatBreakpoints(selectedMedia.breakpoints));
    setBreakDurationsInput(formatBreakpoints(selectedMedia.breakDurations));
    setSlotLengthInput(
      selectedMedia.slotLengthSeconds
        ? formatDurationClock(selectedMedia.slotLengthSeconds)
        : "",
    );
    setFillSlotWithCommercials(Boolean(selectedMedia.fillSlotWithCommercials));
    setCommercialStrategy(selectedMedia.commercialStrategy ?? "best-fit");
    setAllowCommercialSlicing(Boolean(selectedMedia.allowCommercialSlicing));
    setCommercialCategory(selectedMedia.commercialCategory ?? "");
    setAirStartTime(selectedMedia.airStartTime ?? "");
    setAirDays(selectedMedia.airDays ?? []);

    const firstAssignedChannelId = channels.find((channel) =>
      channel.mediaIds.includes(selectedMedia.id),
    )?.id;

    setTargetChannelId(
      isCommercialType(selectedMedia.type)
        ? UNASSIGNED_TARGET
        : firstAssignedChannelId ?? currentChannelId,
    );

    setMessage(`Editing "${selectedMedia.title}".`);
  }, [channels, currentChannelId, selectedMedia]);

  useEffect(() => {
    if (enabledChannels.length === 0 || selectedIsCommercialInventory) {
      return;
    }

    if (targetChannelId === UNASSIGNED_TARGET) {
      return;
    }

    const targetExists = enabledChannels.some(
      (channel) => channel.id === targetChannelId,
    );

    if (!targetExists) {
      setTargetChannelId(enabledChannels[0]?.id ?? currentChannelId);
    }
  }, [
    currentChannelId,
    enabledChannels,
    selectedIsCommercialInventory,
    targetChannelId,
  ]);

  const toggleAirDay = (day: Weekday) => {
    setAirDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  };

  const clearAirDays = () => {
    setAirDays([]);
    setMessage("Air days cleared. Item will be eligible every day.");
  };

  const applyPreset = (preset: EditorPreset) => {
    if (!isProgramType(type)) {
      setMessage("Presets are only available for shows, movies, music, and music videos.");
      return;
    }

    if (preset === "cartoon") {
      setSlotLengthInput("30:00");
      setBreakpointsInput("7:30, 15:00");
      setBreakDurationsInput("2:00, 2:00");
      setFillSlotWithCommercials(true);
      setCommercialStrategy("best-fit");
      setMessage("Applied 30-minute cartoon/anime slot preset.");
      return;
    }

    if (preset === "sitcom") {
      setSlotLengthInput("30:00");
      setBreakpointsInput("11:00");
      setBreakDurationsInput("3:00");
      setFillSlotWithCommercials(true);
      setCommercialStrategy("best-fit");
      setMessage("Applied 30-minute sitcom slot preset.");
      return;
    }

    setSlotLengthInput("60:00");
    setBreakpointsInput("12:00, 24:00, 36:00");
    setBreakDurationsInput("3:00, 3:00, 3:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setMessage("Applied 60-minute drama slot preset.");
  };

  const clearCommercialLogic = () => {
    setSlotLengthInput("");
    setBreakpointsInput("");
    setBreakDurationsInput("");
    setFillSlotWithCommercials(false);
    setMessage("Commercial slot logic cleared for this item.");
  };

  const handleTypeChange = (nextType: MediaType) => {
    setType(nextType);

    if (isCommercialType(nextType)) {
      setBreakpointsInput("");
      setBreakDurationsInput("");
      setSlotLengthInput("");
      setFillSlotWithCommercials(false);
      setTargetChannelId(UNASSIGNED_TARGET);
      setMessage(`${getMediaTypeLabel(nextType)} mode selected. Playlist assignment is blocked.`);
      return;
    }

    setAllowCommercialSlicing(false);
    setMessage(`${getMediaTypeLabel(nextType)} mode selected.`);
  };

  const removeSelectedFromAllChannels = () => {
    if (!selectedMedia) {
      setMessage("Select a media item first.");
      return;
    }

    const assignedChannels = channels.filter((channel) =>
      channel.mediaIds.includes(selectedMedia.id),
    );

    assignedChannels.forEach((channel) => {
      removeMediaFromChannel(channel.id, selectedMedia.id);
    });

    setTargetChannelId(
      isCommercialType(type) ? UNASSIGNED_TARGET : currentChannelId,
    );

    setMessage(
      `Removed "${selectedMedia.title}" from ${assignedChannels.length} channel playlist(s).`,
    );
  };

  const saveChanges = () => {
    if (!validation.ok) {
      setMessage(validation.message);
      return;
    }

    if (!selectedMedia) {
      setMessage("Select a media item first.");
      return;
    }

    const cleanTitle = title.trim().replace(/\s+/g, " ");
    const normalizedAirStartTime = normalizeAirStartTime(airStartTime.trim());
    const programType = isProgramType(type);
    const commercialType = isCommercialType(type);

    updateMedia(selectedMedia.id, {
      title: cleanTitle.slice(0, MAX_TITLE_LENGTH),
      type,
      duration: parsedDuration,

      breakpoints: programType ? parsedBreakpoints : [],
      breakDurations: programType ? parsedBreakDurations : [],
      slotLengthSeconds:
        programType && parsedSlotLength > parsedDuration
          ? parsedSlotLength
          : undefined,
      fillSlotWithCommercials: programType ? fillSlotWithCommercials : false,
      commercialStrategy,

      allowCommercialSlicing: commercialType ? allowCommercialSlicing : false,
      commercialCategory: commercialType
        ? sanitizeCommercialCategory(commercialCategory)
        : undefined,

      airDays: programType ? airDays : [],
      airStartTime: programType ? normalizedAirStartTime : undefined,
      updatedAt: new Date().toISOString(),
    });

    if (commercialType) {
      const assignedChannels = channels.filter((channel) =>
        channel.mediaIds.includes(selectedMedia.id),
      );

      assignedChannels.forEach((channel) => {
        removeMediaFromChannel(channel.id, selectedMedia.id);
      });

      setTargetChannelId(UNASSIGNED_TARGET);
      setMessage(
        `Saved "${cleanTitle}" as global ad inventory and removed it from ${assignedChannels.length} playlist(s).`,
      );
      return;
    }

    const wasAlreadyAssigned =
      targetChannelId && assignedChannelIds.includes(targetChannelId);

    if (targetChannelId && !wasAlreadyAssigned) {
      assignMediaToChannel(targetChannelId, selectedMedia.id);
    }

    setMessage(
      !targetChannelId
        ? `Saved "${cleanTitle}". No new channel assignment was added.`
        : wasAlreadyAssigned
          ? `Saved "${cleanTitle}". Channel assignments were left unchanged.`
          : `Saved "${cleanTitle}" and added it to CH ${getChannelNumber(
              targetChannelId,
              channels,
            )}.`,
    );
  };

  const selectedTargetChannel = enabledChannels.find(
    (channel) => channel.id === targetChannelId,
  );

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
            Quick Edit
          </div>

          <h2 className="mt-1 text-base font-black tracking-tight">
            Safe Media Editor
          </h2>

          <p
            className="mt-1 max-w-3xl text-xs leading-5"
            style={{ color: "var(--text-muted)" }}
          >
            Edit runtime, slot logic, fixed air time, air days, title, type, and
            commercial pool settings. Programs can be assigned to channels.
            Commercials and bumpers stay in global ad inventory.
          </p>
        </div>

        <div
          className="w-fit rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
          style={{
            borderColor: "var(--border)",
            background: "var(--panel-alt-bg)",
            color: "var(--text-muted)",
          }}
        >
          {filteredMedia.length} visible / {media.length} total
        </div>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search loaded media..."
            className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
            spellCheck={false}
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />

          <div className="ttv-no-scrollbar flex gap-2 overflow-x-auto">
            {MEDIA_FILTERS.map((item) => (
              <FilterButton
                key={item.id}
                label={item.label}
                active={filter === item.id}
                onClick={() => setFilter(item.id)}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[0.82fr_1.18fr]">
          <div
            className="space-y-2 overflow-auto pr-1"
            style={{ maxHeight: MAX_MEDIA_LIST_HEIGHT }}
          >
            {filteredMedia.length === 0 ? (
              <div
                className="rounded-2xl border px-3 py-8 text-center text-xs"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                No media found.
              </div>
            ) : (
              filteredMedia.map((item) => {
                const active = item.id === selectedMediaId;
                const itemChannels = getItemChannelSummary(item, channels);
                const embeddedAd = isEmbeddedAd(item, channels);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedMediaId(item.id)}
                    className="ttv-touch-target w-full rounded-2xl border p-3 text-left transition hover:opacity-95"
                    style={{
                      background: embeddedAd
                        ? "rgba(248, 113, 113, 0.08)"
                        : active
                          ? "rgba(255,255,255,0.08)"
                          : "var(--panel-alt-bg)",
                      borderColor: embeddedAd
                        ? "rgba(248, 113, 113, 0.45)"
                        : active
                          ? "var(--primary)"
                          : "var(--border)",
                      color: "var(--text)",
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className="truncate text-sm font-black"
                        title={item.title}
                      >
                        {item.title}
                      </div>

                      {embeddedAd ? (
                        <span className="rounded-full border border-red-300/40 bg-red-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-red-100">
                          Embedded Ad
                        </span>
                      ) : null}
                    </div>

                    <div
                      className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <span>{getMediaTypeLabel(item.type).toUpperCase()}</span>
                      <span>•</span>
                      <span>{formatDurationClock(item.duration)}</span>
                      <span>•</span>
                      <span>{itemChannels}</span>
                    </div>

                    {item.fillSlotWithCommercials || item.commercialCategory ? (
                      <div
                        className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.1em]"
                        style={{ color: embeddedAd ? "#fecaca" : "var(--primary)" }}
                      >
                        {item.fillSlotWithCommercials
                          ? "Slot filler enabled"
                          : item.commercialCategory}
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          <div
            className="rounded-2xl border p-3"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
            }}
          >
            {!selectedMedia ? (
              <div
                className="flex min-h-[320px] items-center justify-center text-center text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Select a media item from the list.
              </div>
            ) : (
              <div className="grid gap-3">
                <div
                  className="rounded-2xl border px-3 py-2 text-xs leading-5"
                  style={{
                    background: selectedIsEmbeddedAd
                      ? "rgba(248, 113, 113, 0.10)"
                      : "var(--panel-bg)",
                    borderColor: selectedIsEmbeddedAd
                      ? "rgba(248, 113, 113, 0.45)"
                      : "var(--border)",
                    color: selectedIsEmbeddedAd ? "#fecaca" : "var(--text-muted)",
                  }}
                >
                  Editing:{" "}
                  <span style={{ color: "var(--text)" }}>{selectedMedia.title}</span>{" "}
                  • Current channel: {selectedChannelLabel}
                  {selectedIsEmbeddedAd
                    ? " • This ad/bump is inside a playlist and will be cleaned when saved."
                    : ""}
                </div>

                <div>
                  <label
                    htmlFor="quick-edit-title"
                    className="mb-1 block text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Title
                  </label>

                  <input
                    id="quick-edit-title"
                    value={title}
                    maxLength={MAX_TITLE_LENGTH}
                    onChange={(event) => setTitle(event.target.value)}
                    className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor: title.trim() ? "var(--border)" : "#ef4444",
                      color: "var(--text)",
                    }}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    value={type}
                    onChange={(event) =>
                      handleTypeChange(event.target.value as MediaType)
                    }
                    className="w-full rounded-xl border px-3 py-3 text-base sm:text-sm"
                    style={{
                      background: "var(--panel-bg)",
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

                  <input
                    value={durationInput}
                    onChange={(event) =>
                      setDurationInput(event.target.value.replace(/[^\d:.]/g, ""))
                    }
                    placeholder="Runtime 21:57"
                    className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor:
                        durationInput && parsedDuration <= 0
                          ? "#ef4444"
                          : "var(--border)",
                      color: "var(--text)",
                    }}
                  />

                  <select
                    value={targetChannelId}
                    onChange={(event) => setTargetChannelId(event.target.value)}
                    disabled={selectedIsCommercialInventory}
                    className="w-full rounded-xl border px-3 py-3 text-base disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor:
                        selectedIsCommercialInventory ||
                        targetChannelId === UNASSIGNED_TARGET ||
                        selectedTargetChannel
                          ? "var(--border)"
                          : "#ef4444",
                      color: "var(--text)",
                    }}
                  >
                    <option value={UNASSIGNED_TARGET}>
                      {selectedIsCommercialInventory
                        ? "Global ad inventory only"
                        : "Do not add to channel"}
                    </option>

                    {enabledChannels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {getChannelLabel(channel)} / {getChannelName(channel)}
                      </option>
                    ))}
                  </select>
                </div>

                {isProgramType(type) ? (
                  <div
                    className="rounded-2xl border p-3"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <div
                      className="mb-2 text-xs font-black uppercase tracking-[0.14em]"
                      style={{ color: "var(--primary)" }}
                    >
                      Broadcast Slot / Commercial Logic
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <input
                        value={slotLengthInput}
                        onChange={(event) =>
                          setSlotLengthInput(
                            event.target.value.replace(/[^\d:.]/g, ""),
                          )
                        }
                        placeholder="Optional slot 30:00"
                        className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                        style={{
                          background: "var(--panel-alt-bg)",
                          borderColor:
                            fillSlotWithCommercials &&
                            parsedSlotLength <= parsedDuration
                              ? "#ef4444"
                              : "var(--border)",
                          color: "var(--text)",
                        }}
                      />

                      <input
                        value={breakpointsInput}
                        onChange={(event) =>
                          setBreakpointsInput(
                            event.target.value.replace(/[^\d:.,\s]/g, ""),
                          )
                        }
                        placeholder="Optional breaks 7:30, 15:00"
                        className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                        style={{
                          background: "var(--panel-alt-bg)",
                          borderColor: "var(--border)",
                          color: "var(--text)",
                        }}
                      />

                      <input
                        value={breakDurationsInput}
                        onChange={(event) =>
                          setBreakDurationsInput(
                            event.target.value.replace(/[^\d:.,\s]/g, ""),
                          )
                        }
                        placeholder="Optional ad blocks 2:00, 2:00"
                        className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                        style={{
                          background: "var(--panel-alt-bg)",
                          borderColor: "var(--border)",
                          color: "var(--text)",
                        }}
                      />
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <PresetButton
                        label="30m Cartoon"
                        onClick={() => applyPreset("cartoon")}
                      />
                      <PresetButton
                        label="30m Sitcom"
                        onClick={() => applyPreset("sitcom")}
                      />
                      <PresetButton
                        label="60m Drama"
                        onClick={() => applyPreset("drama")}
                      />
                      <PresetButton
                        label="Clear Logic"
                        onClick={clearCommercialLogic}
                      />
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label
                        className="flex items-center gap-3 rounded-xl border p-3 text-sm"
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
                          background: "var(--panel-alt-bg)",
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

                {selectedIsCommercialInventory ? (
                  <div
                    className="rounded-2xl border p-3"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor: selectedIsEmbeddedAd
                        ? "rgba(248, 113, 113, 0.45)"
                        : "var(--border)",
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
                          background: "var(--panel-alt-bg)",
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
                        <span>Allow slicing for exact ad blocks</span>
                      </label>

                      <input
                        value={commercialCategory}
                        onChange={(event) =>
                          setCommercialCategory(event.target.value)
                        }
                        placeholder="Category: general, kids, anime..."
                        className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                        style={{
                          background: "var(--panel-alt-bg)",
                          borderColor: "var(--border)",
                          color: "var(--text)",
                        }}
                      />
                    </div>

                    <div
                      className="mt-3 rounded-xl border px-3 py-2 text-[11px] leading-5"
                      style={{
                        background: selectedIsEmbeddedAd
                          ? "rgba(248, 113, 113, 0.10)"
                          : "rgba(34, 197, 94, 0.08)",
                        borderColor: selectedIsEmbeddedAd
                          ? "rgba(248, 113, 113, 0.30)"
                          : "rgba(34, 197, 94, 0.24)",
                        color: selectedIsEmbeddedAd ? "#fecaca" : "#bbf7d0",
                      }}
                    >
                      {selectedIsEmbeddedAd
                        ? "This ad/bump is currently assigned to a channel playlist. Saving will remove it from playlists and keep it as global ad inventory."
                        : "This item is clean global ad inventory. Do not add it directly to a channel playlist."}
                    </div>
                  </div>
                ) : null}

                {isProgramType(type) ? (
                  <input
                    value={airStartTime}
                    onChange={(event) =>
                      setAirStartTime(event.target.value.replace(/[^\d:]/g, ""))
                    }
                    placeholder="Optional fixed air time 16:00"
                    className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor:
                        airStartTime && !isValidAirTime(airStartTime)
                          ? "#ef4444"
                          : "var(--border)",
                      color: "var(--text)",
                    }}
                  />
                ) : null}

                {isProgramType(type) ? (
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Air Days
                      </div>

                      <button
                        type="button"
                        onClick={clearAirDays}
                        className="ttv-action-button rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.1em]"
                      >
                        Every Day
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {WEEKDAYS.map((day) => {
                        const active = airDays.includes(day.id);

                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleAirDay(day.id)}
                            className="ttv-touch-target rounded-lg px-2 py-3 text-[11px] font-black uppercase tracking-[0.08em]"
                            style={{
                              background: active
                                ? "var(--primary)"
                                : "var(--button-bg)",
                              color: "var(--text)",
                            }}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div
                  className="rounded-2xl border px-3 py-2 text-xs leading-5"
                  style={{
                    background: "var(--panel-bg)",
                    borderColor: validation.ok
                      ? "var(--border)"
                      : "rgba(248, 113, 113, 0.45)",
                    color: validation.ok ? "var(--text-muted)" : "#fecaca",
                  }}
                >
                  {validation.ok
                    ? getBroadcastSummary({
                        parsedSlotLength,
                        parsedDuration,
                        parsedBreakpoints,
                        parsedBreakDurations,
                        selectedChannelLabel,
                        isCommercialInventory: selectedIsCommercialInventory,
                      })
                    : validation.message}
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <button
                    type="button"
                    onClick={saveChanges}
                    disabled={!validation.ok}
                    className="ttv-touch-target rounded-xl px-4 py-4 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))",
                      color: "var(--text)",
                    }}
                  >
                    Save Changes
                  </button>

                  {assignedChannelIds.length > 0 ? (
                    <button
                      type="button"
                      onClick={removeSelectedFromAllChannels}
                      className="ttv-touch-target rounded-xl px-4 py-4 text-sm font-black uppercase tracking-[0.12em] transition hover:opacity-90"
                      style={{
                        background: "#7f1d1d",
                        color: "#fff",
                      }}
                    >
                      Remove From Playlists
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="rounded-2xl border px-3 py-2 text-xs leading-5"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
          aria-live="polite"
        >
          {message}
        </div>
      </div>
    </section>
  );
}