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
import {
  GLOBAL_AD_CHANNEL_TARGET,
  type AdPlacement,
  type Channel,
  type CommercialStrategy,
  type MediaItem,
  type MediaType,
  type Weekday,
} from "@/lib/types";

type MediaFilter = "all" | MediaType;
type AdTargetMode = "channels" | "global";

const MEDIA_FILTERS: { id: MediaFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "show", label: "Shows" },
  { id: "movie", label: "Movies" },
  { id: "music", label: "Music" },
  { id: "music-video", label: "Music Videos" },
  { id: "commercial", label: "Ads" },
  { id: "bumper", label: "Bumpers" },
];

const DEFAULT_AD_PLACEMENTS: AdPlacement[] = [
  "mid-roll",
  "filler",
  "between-programs",
  "post-roll",
];

function isProgramType(type: MediaType): boolean {
  return (
    type === "show" ||
    type === "movie" ||
    type === "music" ||
    type === "music-video"
  );
}

function isBroadcastType(type: MediaType): boolean {
  return type === "show" || type === "movie";
}

function isCommercialType(type: MediaType): boolean {
  return type === "commercial" || type === "bumper";
}

function getMediaTypeLabel(type: MediaType): string {
  if (type === "movie") return "Movie";
  if (type === "music") return "Music";
  if (type === "music-video") return "Music Video";
  if (type === "commercial") return "Commercial";
  if (type === "bumper") return "Bumper";

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
    if (a.type !== b.type) {
      return a.type.localeCompare(b.type);
    }

    return a.title.localeCompare(b.title, undefined, {
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

function getChannelOptionLabel(channel: Channel): string {
  return `${getChannelLabel(channel)} / ${getChannelName(channel)}`;
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
    ...(item.adCategories ?? []),
    ...(item.adChannelIds ?? []),
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

function getAssignedProgramChannelIds(
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

function normalizeAdChannelIds(item: MediaItem | undefined): string[] {
  if (!item) {
    return [];
  }

  return Array.from(
    new Set(
      (item.adChannelIds ?? [])
        .map((target) => String(target))
        .filter(
          (target) =>
            target &&
            target !== GLOBAL_AD_CHANNEL_TARGET &&
            target !== "all",
        ),
    ),
  );
}

function itemUsesGlobalAdTarget(item: MediaItem | undefined): boolean {
  if (!item) {
    return false;
  }

  return (item.adChannelIds ?? []).some((target) => {
    const clean = String(target);

    return clean === GLOBAL_AD_CHANNEL_TARGET || clean === "all";
  });
}

function createChannelSummary({
  item,
  channels,
}: {
  item: MediaItem | undefined;
  channels: Channel[];
}): string {
  if (!item) {
    return "No media selected";
  }

  if (isCommercialType(item.type)) {
    if (itemUsesGlobalAdTarget(item)) {
      return "Global ad inventory";
    }

    const targets = normalizeAdChannelIds(item);

    if (targets.length === 0) {
      return "No ad targets";
    }

    return targets
      .map((targetId) => {
        const channel = channels.find((item) => item.id === targetId);

        return channel ? getChannelLabel(channel) : `CH ${targetId}`;
      })
      .join(", ");
  }

  const assigned = getAssignedProgramChannelIds(item, channels);

  if (assigned.length === 0) {
    return "Not assigned";
  }

  return assigned
    .map((channelId) => {
      const channel = channels.find((item) => item.id === channelId);

      return channel ? getChannelLabel(channel) : `CH ${channelId}`;
    })
    .join(", ");
}

function getBroadcastSummary({
  parsedSlotLength,
  parsedDuration,
  parsedBreakpoints,
  parsedBreakDurations,
  selectedChannelLabel,
}: {
  parsedSlotLength: number;
  parsedDuration: number;
  parsedBreakpoints: number[];
  parsedBreakDurations: number[];
  selectedChannelLabel: string;
}): string {
  return [
    `Slot: ${
      parsedSlotLength > 0 ? formatDurationClock(parsedSlotLength) : "none"
    }`,
    `Runtime: ${
      parsedDuration > 0 ? formatDurationClock(parsedDuration) : "invalid"
    }`,
    `Breaks: ${
      parsedBreakpoints.length > 0 ? formatBreakpoints(parsedBreakpoints) : "auto"
    }`,
    `Ad blocks: ${
      parsedBreakDurations.length > 0
        ? formatBreakpoints(parsedBreakDurations)
        : "auto"
    }`,
    `Target: ${selectedChannelLabel}`,
  ].join(" • ");
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

  const [allowCommercialSlicing, setAllowCommercialSlicing] = useState(true);
  const [commercialCategory, setCommercialCategory] = useState("");

  const [airStartTime, setAirStartTime] = useState("");
  const [airDays, setAirDays] = useState<Weekday[]>([]);

  const [targetChannelId, setTargetChannelId] = useState(currentChannelId);
  const [adTargetMode, setAdTargetMode] = useState<AdTargetMode>("channels");
  const [adChannelIds, setAdChannelIds] = useState<string[]>([]);

  const [message, setMessage] = useState(
    "Select any loaded media item to edit it quickly.",
  );

  const enabledChannels = useMemo(() => sortChannels(channels), [channels]);

  const selectedMedia = useMemo(
    () => media.find((item) => item.id === selectedMediaId),
    [media, selectedMediaId],
  );

  const selectedIsAd = Boolean(selectedMedia && isCommercialType(type));
  const selectedIsProgram = isProgramType(type);
  const selectedIsBroadcast = isBroadcastType(type);

  const filteredMedia = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return sortMedia(media).filter((item) => {
      const matchesFilter = filter === "all" || item.type === filter;
      const matchesSearch =
        !cleanSearch || getMediaSearchLabel(item).includes(cleanSearch);

      return matchesFilter && matchesSearch;
    });
  }, [filter, media, search]);

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

  const selectedChannelSummary = useMemo(
    () => createChannelSummary({ item: selectedMedia, channels }),
    [channels, selectedMedia],
  );

  const selectedProgramChannel = useMemo(
    () => enabledChannels.find((channel) => channel.id === targetChannelId),
    [enabledChannels, targetChannelId],
  );

  useEffect(() => {
    if (!selectedMedia) return;

    setTitle(selectedMedia.title);
    setType(selectedMedia.type);
    setDurationInput(formatDurationClock(selectedMedia.duration));
    setBreakpointsInput(formatBreakpoints(selectedMedia.breakpoints ?? []));
    setBreakDurationsInput(formatBreakpoints(selectedMedia.breakDurations ?? []));
    setSlotLengthInput(
      selectedMedia.slotLengthSeconds
        ? formatDurationClock(selectedMedia.slotLengthSeconds)
        : "",
    );
    setFillSlotWithCommercials(Boolean(selectedMedia.fillSlotWithCommercials));
    setCommercialStrategy(selectedMedia.commercialStrategy ?? "best-fit");
    setAllowCommercialSlicing(
      selectedMedia.allowCommercialSlicing ?? isCommercialType(selectedMedia.type),
    );
    setCommercialCategory(selectedMedia.commercialCategory ?? "");
    setAirStartTime(selectedMedia.airStartTime ?? "");
    setAirDays(
      isCommercialType(selectedMedia.type)
        ? selectedMedia.adDays ?? []
        : selectedMedia.airDays ?? [],
    );

    const assignedProgramChannelId = channels.find((channel) =>
      channel.mediaIds.includes(selectedMedia.id),
    )?.id;

    setTargetChannelId(assignedProgramChannelId ?? currentChannelId);

    if (isCommercialType(selectedMedia.type)) {
      setAdTargetMode(itemUsesGlobalAdTarget(selectedMedia) ? "global" : "channels");

      const targets = normalizeAdChannelIds(selectedMedia);
      setAdChannelIds(targets.length > 0 ? targets : [currentChannelId]);
    } else {
      setAdTargetMode("channels");
      setAdChannelIds([]);
    }
  }, [channels, currentChannelId, selectedMedia]);

  useEffect(() => {
    if (enabledChannels.length === 0) return;

    const targetExists = enabledChannels.some(
      (channel) => channel.id === targetChannelId,
    );

    if (!targetExists) {
      setTargetChannelId(enabledChannels[0]?.id ?? currentChannelId);
    }
  }, [currentChannelId, enabledChannels, targetChannelId]);

  const toggleAirDay = (day: Weekday) => {
    setAirDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  };

  const clearAirDays = () => {
    setAirDays([]);
  };

  const toggleAdChannel = (channelId: string) => {
    setAdChannelIds((current) => {
      if (current.includes(channelId)) {
        return current.filter((item) => item !== channelId);
      }

      return [...current, channelId];
    });
  };

  const selectAllAdChannels = () => {
    setAdChannelIds(enabledChannels.map((channel) => channel.id));
    setAdTargetMode("channels");
  };

  const clearAdChannels = () => {
    setAdChannelIds([]);
    setAdTargetMode("channels");
  };

  const applyCartoonPreset = () => {
    setSlotLengthInput("30:00");
    setBreakpointsInput("15:00");
    setBreakDurationsInput("2:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setMessage("Applied 30-minute cartoon slot preset.");
  };

  const applySitcomPreset = () => {
    setSlotLengthInput("30:00");
    setBreakpointsInput("11:00");
    setBreakDurationsInput("2:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setMessage("Applied 30-minute sitcom slot preset.");
  };

  const applyDramaPreset = () => {
    setSlotLengthInput("60:00");
    setBreakpointsInput("14:00, 30:00");
    setBreakDurationsInput("2:00, 2:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setMessage("Applied 60-minute drama slot preset.");
  };

  const clearBroadcastLogic = () => {
    setSlotLengthInput("");
    setBreakpointsInput("");
    setBreakDurationsInput("");
    setFillSlotWithCommercials(false);
    setMessage("Broadcast slot and manual commercial logic cleared.");
  };

  const handleTypeChange = (nextType: MediaType) => {
    setType(nextType);

    if (isCommercialType(nextType)) {
      setBreakpointsInput("");
      setBreakDurationsInput("");
      setSlotLengthInput("");
      setFillSlotWithCommercials(false);
      setAllowCommercialSlicing(true);
      setAdTargetMode("channels");
      setAdChannelIds((current) =>
        current.length > 0 ? current : [targetChannelId || currentChannelId],
      );
      setMessage("Commercial mode selected. Choose channel targets below.");
      return;
    }

    setAdChannelIds([]);
    setAllowCommercialSlicing(false);
    setMessage(`${getMediaTypeLabel(nextType)} mode selected.`);
  };

  const validate = (): string | null => {
    if (!selectedMedia) {
      return "Select a media item first.";
    }

    if (!title.trim()) {
      return "Title cannot be blank.";
    }

    if (parsedDuration <= 0) {
      return "Duration must be valid. Example: 21:57.";
    }

    if (!isValidAirTime(airStartTime)) {
      return "Air time must be HH:mm format, like 16:00.";
    }

    if (selectedIsBroadcast && fillSlotWithCommercials && parsedSlotLength <= parsedDuration) {
      return "Slot length must be longer than runtime. Example: 30:00.";
    }

    if (
      selectedIsProgram &&
      targetChannelId &&
      !enabledChannels.some((channel) => channel.id === targetChannelId)
    ) {
      return "Select a valid enabled channel.";
    }

    if (selectedIsAd && adTargetMode === "channels" && adChannelIds.length === 0) {
      return "Choose at least one ad target channel, or select Global.";
    }

    return null;
  };

  const saveChanges = () => {
    if (!selectedMedia) {
      setMessage("Select a media item first.");
      return;
    }

    const error = validate();

    if (error) {
      setMessage(error);
      return;
    }

    const cleanTitle = title.trim().replace(/\s+/g, " ");
    const normalizedAirStartTime = normalizeAirStartTime(airStartTime.trim());
    const cleanCategory = sanitizeCommercialCategory(commercialCategory);
    const isAd = isCommercialType(type);
    const isProgram = isProgramType(type);
    const isBroadcast = isBroadcastType(type);

    const adTargets =
      adTargetMode === "global"
        ? [GLOBAL_AD_CHANNEL_TARGET]
        : Array.from(new Set(adChannelIds.map(String)));

    updateMedia(selectedMedia.id, {
      title: cleanTitle,
      type,
      duration: parsedDuration,

      breakpoints: isBroadcast ? parsedBreakpoints : [],
      breakDurations: isBroadcast ? parsedBreakDurations : [],
      slotLengthSeconds:
        isBroadcast && parsedSlotLength > parsedDuration
          ? parsedSlotLength
          : undefined,
      fillSlotWithCommercials: isBroadcast ? fillSlotWithCommercials : false,
      commercialStrategy: isBroadcast || isAd ? commercialStrategy : undefined,

      allowCommercialSlicing: isAd ? allowCommercialSlicing : false,
      commercialCategory: isAd ? cleanCategory || "general" : undefined,
      adCategories: isAd ? [cleanCategory || "general"] : undefined,
      adChannelIds: isAd ? adTargets : undefined,
      adPlacements: isAd ? DEFAULT_AD_PLACEMENTS : undefined,
      adDays: isAd ? airDays : undefined,

      airDays: isProgram && !isAd ? airDays : [],
      airStartTime: isProgram && !isAd ? normalizedAirStartTime ?? "" : undefined,
    });

    if (isAd) {
      channels.forEach((channel) => {
        if (channel.mediaIds.includes(selectedMedia.id)) {
          removeMediaFromChannel(channel.id, selectedMedia.id);
        }
      });

      setMessage(
        adTargetMode === "global"
          ? `Saved "${cleanTitle}" as global ad inventory.`
          : `Saved "${cleanTitle}" for ${adTargets.length} channel target(s).`,
      );

      return;
    }

    channels.forEach((channel) => {
      if (channel.id !== targetChannelId && channel.mediaIds.includes(selectedMedia.id)) {
        removeMediaFromChannel(channel.id, selectedMedia.id);
      }
    });

    if (targetChannelId) {
      assignMediaToChannel(targetChannelId, selectedMedia.id);
    }

    setMessage(
      `Saved "${cleanTitle}" to ${
        selectedProgramChannel ? getChannelLabel(selectedProgramChannel) : "selected channel"
      }.`,
    );
  };

  const broadcastSummary = getBroadcastSummary({
    parsedSlotLength,
    parsedDuration,
    parsedBreakpoints,
    parsedBreakDurations,
    selectedChannelLabel: selectedChannelSummary,
  });

  return (
    <section
      className="grid gap-4 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.4fr)]"
      style={{ color: "var(--text)" }}
    >
      <div className="ttv-glass-panel rounded-2xl p-3 sm:p-4">
        <div
          className="text-xs font-black uppercase tracking-[0.18em]"
          style={{ color: "var(--primary)" }}
        >
          Quick Edit
        </div>

        <h2 className="mt-1 text-base font-black tracking-tight">
          Media Library
        </h2>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mt-3 w-full rounded-xl border px-3 py-3 text-sm outline-none"
          placeholder="Search title, URL, type, category..."
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />

        <div className="ttv-no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {MEDIA_FILTERS.map((item) => (
            <FilterButton
              key={item.id}
              label={item.label}
              active={filter === item.id}
              onClick={() => setFilter(item.id)}
            />
          ))}
        </div>

        <div className="ttv-no-scrollbar mt-3 max-h-[640px] overflow-y-auto pr-1">
          <div className="grid gap-2">
            {filteredMedia.map((item) => {
              const active = item.id === selectedMediaId;
              const summary = createChannelSummary({ item, channels });

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedMediaId(item.id)}
                  className="rounded-2xl border p-3 text-left transition hover:scale-[1.01]"
                  style={{
                    background: active ? "var(--primary)" : "var(--panel-alt-bg)",
                    borderColor: active ? "var(--primary)" : "var(--border)",
                    color: "var(--text)",
                  }}
                >
                  <div className="line-clamp-2 text-sm font-black">
                    {item.title}
                  </div>

                  <div
                    className="mt-1 text-[11px] uppercase tracking-[0.1em]"
                    style={{ color: active ? "inherit" : "var(--text-muted)" }}
                  >
                    {getMediaTypeLabel(item.type)} / {formatDurationClock(item.duration)}
                  </div>

                  <div
                    className="mt-1 text-[11px]"
                    style={{ color: active ? "inherit" : "var(--text-muted)" }}
                  >
                    {summary}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ttv-glass-panel rounded-2xl p-3 sm:p-4">
        {!selectedMedia ? (
          <div
            className="rounded-2xl border p-4 text-sm"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          >
            Select a media item to edit shows, commercial targets, runtimes,
            breakpoints, slots, and air days.
          </div>
        ) : (
          <div className="grid gap-4">
            <div
              className="rounded-2xl border p-3 text-sm leading-6"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
              }}
            >
              Editing:{" "}
              <span className="font-black" style={{ color: "var(--primary)" }}>
                {selectedMedia.title}
              </span>{" "}
              / Current target: {selectedChannelSummary}
            </div>

            <label className="grid gap-1">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Title
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                maxLength={140}
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <select
                value={type}
                onChange={(event) => handleTypeChange(event.target.value as MediaType)}
                className="rounded-xl border px-3 py-3 text-base sm:text-sm"
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

              <input
                value={durationInput}
                onChange={(event) =>
                  setDurationInput(event.target.value.replace(/[^\d:.]/g, ""))
                }
                className="rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                placeholder="Duration"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />

              {!selectedIsAd ? (
                <select
                  value={targetChannelId}
                  onChange={(event) => setTargetChannelId(event.target.value)}
                  className="rounded-xl border px-3 py-3 text-base sm:text-sm"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                >
                  {enabledChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {getChannelOptionLabel(channel)}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  className="rounded-xl border px-3 py-3 text-sm"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  Ad inventory
                </div>
              )}
            </div>

            {selectedIsAd ? (
              <section
                className="rounded-2xl border p-3"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: "var(--border)",
                }}
              >
                <div
                  className="text-xs font-black uppercase tracking-[0.18em]"
                  style={{ color: "var(--primary)" }}
                >
                  Commercial Channel Targets
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label
                    className="flex items-center gap-3 rounded-xl border p-3 text-sm"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <input
                      type="radio"
                      checked={adTargetMode === "channels"}
                      onChange={() => setAdTargetMode("channels")}
                      className="h-5 w-5"
                    />
                    <span>Selected channels</span>
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
                      checked={adTargetMode === "global"}
                      onChange={() => setAdTargetMode("global")}
                      className="h-5 w-5"
                    />
                    <span>Global ad</span>
                  </label>
                </div>

                {adTargetMode === "channels" ? (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={selectAllAdChannels}
                        className="ttv-action-button rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em]"
                      >
                        Select All
                      </button>

                      <button
                        type="button"
                        onClick={clearAdChannels}
                        className="ttv-action-button rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em]"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {enabledChannels.map((channel) => {
                        const active = adChannelIds.includes(channel.id);

                        return (
                          <button
                            key={channel.id}
                            type="button"
                            onClick={() => toggleAdChannel(channel.id)}
                            className="rounded-xl border p-3 text-left text-xs font-black uppercase tracking-[0.08em]"
                            style={{
                              background: active
                                ? "var(--primary)"
                                : "var(--button-bg)",
                              borderColor: active
                                ? "var(--primary)"
                                : "var(--border)",
                              color: "var(--text)",
                            }}
                          >
                            {getChannelLabel(channel)}
                            <div className="mt-1 line-clamp-1 text-[10px] opacity-80">
                              {getChannelName(channel)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div
                    className="mt-3 rounded-2xl border p-3 text-xs leading-5"
                    style={{
                      background: "rgba(34,197,94,0.08)",
                      borderColor: "rgba(34,197,94,0.28)",
                      color: "#86efac",
                    }}
                  >
                    This commercial can run only on channels that allow global
                    ads in their channel ad policy.
                  </div>
                )}

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
                    onChange={(event) => setCommercialCategory(event.target.value)}
                    className="rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                    placeholder="Category: general, kids, anime..."
                    style={{
                      background: "var(--panel-bg)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                  />
                </div>
              </section>
            ) : null}

            {selectedIsBroadcast ? (
              <section
                className="rounded-2xl border p-3"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: "var(--border)",
                }}
              >
                <div
                  className="text-xs font-black uppercase tracking-[0.18em]"
                  style={{ color: "var(--primary)" }}
                >
                  Broadcast Slot / Commercial Logic
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <input
                    value={slotLengthInput}
                    onChange={(event) =>
                      setSlotLengthInput(event.target.value.replace(/[^\d:]/g, ""))
                    }
                    className="rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                    placeholder="Slot 30:00"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                  />

                  <input
                    value={breakpointsInput}
                    onChange={(event) =>
                      setBreakpointsInput(event.target.value.replace(/[^\d:,\s]/g, ""))
                    }
                    className="rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                    placeholder="Breaks 15:00"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                  />

                  <input
                    value={breakDurationsInput}
                    onChange={(event) =>
                      setBreakDurationsInput(event.target.value.replace(/[^\d:,\s]/g, ""))
                    }
                    className="rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                    placeholder="Ads 2:00"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <PresetButton label="30m Cartoon" onClick={applyCartoonPreset} />
                  <PresetButton label="30m Sitcom" onClick={applySitcomPreset} />
                  <PresetButton label="60m Drama" onClick={applyDramaPreset} />
                  <PresetButton label="Clear Logic" onClick={clearBroadcastLogic} />
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
                      setCommercialStrategy(event.target.value as CommercialStrategy)
                    }
                    className="rounded-xl border px-3 py-3 text-base sm:text-sm"
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
              </section>
            ) : null}

            {selectedIsProgram ? (
              <input
                value={airStartTime}
                onChange={(event) =>
                  setAirStartTime(event.target.value.replace(/[^\d:]/g, ""))
                }
                className="rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                placeholder="Optional fixed air time 16:00"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor:
                    airStartTime && !isValidAirTime(airStartTime)
                      ? "#f87171"
                      : "var(--border)",
                  color: "var(--text)",
                }}
              />
            ) : null}

            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {selectedIsAd ? "Ad Days" : "Air Days"}
                </div>

                <button
                  type="button"
                  onClick={clearAirDays}
                  className="ttv-action-button rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em]"
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
                        background: active ? "var(--primary)" : "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <div
              className="rounded-2xl border p-3 text-xs leading-5"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              {selectedIsAd
                ? `Runtime: ${
                    parsedDuration > 0 ? formatDurationClock(parsedDuration) : "invalid"
                  } / Mode: ${
                    adTargetMode === "global"
                      ? "global ad inventory"
                      : `${adChannelIds.length} selected channel target(s)`
                  } / Playlist assignment: blocked`
                : broadcastSummary}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={saveChanges}
                className="ttv-touch-target rounded-xl px-5 py-4 text-sm font-black uppercase tracking-[0.14em] transition hover:scale-[1.01]"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))",
                  color: "var(--text)",
                }}
              >
                Save Changes
              </button>

              {!selectedIsAd ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedMedia) return;

                    channels.forEach((channel) => {
                      if (channel.mediaIds.includes(selectedMedia.id)) {
                        removeMediaFromChannel(channel.id, selectedMedia.id);
                      }
                    });

                    setMessage(`Removed "${selectedMedia.title}" from playlists.`);
                  }}
                  className="ttv-touch-target rounded-xl px-5 py-4 text-sm font-black uppercase tracking-[0.14em]"
                  style={{
                    background: "rgba(127,29,29,0.9)",
                    color: "white",
                  }}
                >
                  Remove From Playlists
                </button>
              ) : null}
            </div>

            {message ? (
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
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
