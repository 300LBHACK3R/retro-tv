"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  if (!channel) return "CH --";
  return `CH ${channel.number ?? channel.id}`;
}

function getChannelName(channel: Channel | undefined): string {
  if (!channel) return "Unknown Channel";
  return channel.branding?.displayName ?? channel.name;
}

function getChannelOptionLabel(channel: Channel): string {
  return `${getChannelLabel(channel)} • ${getChannelName(channel)}`;
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
  if (!item) return [];

  return channels
    .filter((channel) => channel.mediaIds.includes(item.id))
    .map((channel) => channel.id);
}

function normalizeAdChannelIds(item: MediaItem | undefined): string[] {
  if (!item) return [];

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
  if (!item) return false;

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
  if (!item) return "No media selected";

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
        const channel = channels.find((channelItem) => channelItem.id === targetId);
        return channel ? getChannelLabel(channel) : `CH ${targetId}`;
      })
      .join(", ");
  }

  const assigned = getAssignedProgramChannelIds(item, channels);

  if (assigned.length === 0) return "Not assigned";

  return assigned
    .map((channelId) => {
      const channel = channels.find((channelItem) => channelItem.id === channelId);
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
    `Slot: ${parsedSlotLength > 0 ? formatDurationClock(parsedSlotLength) : "none"}`,
    `Runtime: ${parsedDuration > 0 ? formatDurationClock(parsedDuration) : "invalid"}`,
    `Breaks: ${
      parsedBreakpoints.length > 0 ? formatBreakpoints(parsedBreakpoints) : "none"
    }`,
    `Ad blocks: ${
      parsedBreakDurations.length > 0
        ? formatBreakpoints(parsedBreakDurations)
        : "none"
    }`,
    `Target: ${selectedChannelLabel}`,
  ].join(" • ");
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
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-3xl border p-4 sm:p-5"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--panel-alt-bg) 92%, transparent), var(--panel-bg))",
        borderColor: "var(--border)",
        boxShadow: "0 18px 45px rgba(0,0,0,0.16)",
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
          <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
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
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5">
      <span className="text-xs font-black">{label}</span>
      {children}
      {helper ? (
        <span className="text-[11px] leading-5" style={{ color: "var(--text-muted)" }}>
          {helper}
        </span>
      ) : null}
    </label>
  );
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
      className="ttv-touch-target shrink-0 rounded-xl border px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] transition"
      style={{
        background: active
          ? "color-mix(in srgb, var(--primary) 20%, var(--panel-bg))"
          : "var(--button-bg)",
        borderColor: active ? "var(--primary)" : "var(--border)",
        color: "var(--text)",
      }}
    >
      {label}
    </button>
  );
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ttv-action-button ttv-touch-target rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.1em]"
    >
      {label}
    </button>
  );
}

function MediaBadge({ type }: { type: MediaType }) {
  return (
    <span
      className="rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em]"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text-muted)",
      }}
    >
      {getMediaTypeLabel(type)}
    </span>
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
    "Select a media item to edit its title, channel, schedule, and commercial behavior.",
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

  const clearAirDays = () => setAirDays([]);

  const toggleAdChannel = (channelId: string) => {
    setAdChannelIds((current) =>
      current.includes(channelId)
        ? current.filter((item) => item !== channelId)
        : [...current, channelId],
    );
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
    setMessage("Applied the 30-minute cartoon preset.");
  };

  const applySitcomPreset = () => {
    setSlotLengthInput("30:00");
    setBreakpointsInput("11:00");
    setBreakDurationsInput("2:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setMessage("Applied the 30-minute sitcom preset.");
  };

  const applyDramaPreset = () => {
    setSlotLengthInput("60:00");
    setBreakpointsInput("14:00, 30:00");
    setBreakDurationsInput("2:00, 2:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setMessage("Applied the 60-minute drama preset.");
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
    if (!selectedMedia) return "Select a media item first.";
    if (!title.trim()) return "Title cannot be blank.";
    if (parsedDuration <= 0) return "Duration must be valid. Example: 21:57.";
    if (!isValidAirTime(airStartTime)) {
      return "Air time must use HH:mm format, such as 16:00.";
    }

    if (
      selectedIsBroadcast &&
      fillSlotWithCommercials &&
      parsedSlotLength <= parsedDuration
    ) {
      return "Slot length must be longer than runtime. Example: 30:00.";
    }

    if (
      selectedIsBroadcast &&
      parsedBreakpoints.length !== parsedBreakDurations.length
    ) {
      return "Enter exactly one ad block length for each breakpoint.";
    }

    if (
      selectedIsBroadcast &&
      fillSlotWithCommercials &&
      parsedSlotLength <
        parsedDuration +
          parsedBreakDurations.reduce((sum, seconds) => sum + seconds, 0)
    ) {
      return "Broadcast slot must fit the runtime plus every saved ad block.";
    }

    if (
      selectedIsProgram &&
      targetChannelId &&
      !enabledChannels.some((channel) => channel.id === targetChannelId)
    ) {
      return "Select a valid enabled channel.";
    }

    if (
      selectedIsAd &&
      adTargetMode === "channels" &&
      adChannelIds.length === 0
    ) {
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
      if (
        channel.id !== targetChannelId &&
        channel.mediaIds.includes(selectedMedia.id)
      ) {
        removeMediaFromChannel(channel.id, selectedMedia.id);
      }
    });

    if (targetChannelId) {
      assignMediaToChannel(targetChannelId, selectedMedia.id);
    }

    setMessage(
      `Saved "${cleanTitle}" to ${
        selectedProgramChannel
          ? getChannelLabel(selectedProgramChannel)
          : "the selected channel"
      }.`,
    );
  };

  const removeFromPlaylists = () => {
    if (!selectedMedia) return;

    channels.forEach((channel) => {
      if (channel.mediaIds.includes(selectedMedia.id)) {
        removeMediaFromChannel(channel.id, selectedMedia.id);
      }
    });

    setMessage(`Removed "${selectedMedia.title}" from channel playlists.`);
  };

  const broadcastSummary = getBroadcastSummary({
    parsedSlotLength,
    parsedDuration,
    parsedBreakpoints,
    parsedBreakDurations,
    selectedChannelLabel: selectedChannelSummary,
  });

  const validationError = selectedMedia ? validate() : null;
  const messageLooksSuccessful = message.startsWith("Saved");

  return (
    <section
      className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.45fr)]"
      style={{ color: "var(--text)" }}
    >
      <aside className="min-w-0 2xl:sticky 2xl:top-4 2xl:self-start">
        <div
          className="rounded-3xl border p-3 sm:p-4"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--panel-alt-bg) 94%, transparent), var(--panel-bg))",
            borderColor: "var(--border)",
            boxShadow: "0 20px 55px rgba(0,0,0,0.2)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div
                className="text-[10px] font-black uppercase tracking-[0.2em]"
                style={{ color: "var(--primary)" }}
              >
                Quick Edit
              </div>
              <h2 className="mt-1 text-lg font-black tracking-tight">Media Library</h2>
            </div>
            <div
              className="rounded-full border px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.12em]"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              {filteredMedia.length} shown
            </div>
          </div>

          <div className="relative mt-4">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              ⌕
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-2xl border py-3 pl-9 pr-3 text-sm outline-none"
              placeholder="Search title, type, URL, category..."
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

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

          <div className="ttv-no-scrollbar mt-3 max-h-[34rem] overflow-y-auto pr-1 2xl:max-h-[calc(100dvh-15rem)]">
            <div className="grid gap-2">
              {filteredMedia.length === 0 ? (
                <div
                  className="rounded-2xl border p-4 text-center text-xs leading-5"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  No media matches this search and filter.
                </div>
              ) : null}

              {filteredMedia.map((item) => {
                const active = item.id === selectedMediaId;
                const summary = createChannelSummary({ item, channels });

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedMediaId(item.id)}
                    className="relative overflow-hidden rounded-2xl border p-3 text-left transition hover:translate-x-0.5"
                    style={{
                      background: active
                        ? "color-mix(in srgb, var(--primary) 16%, var(--panel-bg))"
                        : "var(--panel-alt-bg)",
                      borderColor: active ? "var(--primary)" : "var(--border)",
                      color: "var(--text)",
                    }}
                  >
                    {active ? (
                      <span
                        className="absolute inset-y-0 left-0 w-1"
                        style={{ background: "var(--primary)" }}
                        aria-hidden="true"
                      />
                    ) : null}

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-sm font-black leading-5">
                          {item.title}
                        </div>
                        <div
                          className="mt-1 text-[10px] leading-4"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {formatDurationClock(item.duration)} • {summary}
                        </div>
                      </div>
                      <MediaBadge type={item.type} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {!selectedMedia ? (
          <div
            className="flex min-h-[28rem] items-center justify-center rounded-3xl border p-6 text-center"
            style={{
              background:
                "radial-gradient(circle at top, color-mix(in srgb, var(--primary) 10%, transparent), var(--panel-bg) 60%)",
              borderColor: "var(--border)",
            }}
          >
            <div className="max-w-md">
              <div className="text-4xl" aria-hidden="true">✦</div>
              <h2 className="mt-4 text-xl font-black tracking-tight">Select a media item</h2>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                Choose an item from the library to edit its title, runtime,
                channel assignment, broadcast slot, commercial logic, and air schedule.
              </p>
            </div>
          </div>
        ) : (
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
                className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full opacity-20 blur-3xl"
                style={{ background: "var(--primary)" }}
                aria-hidden="true"
              />

              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div
                    className="text-[10px] font-black uppercase tracking-[0.2em]"
                    style={{ color: "var(--primary)" }}
                  >
                    Editing Media
                  </div>
                  <h2 className="mt-1 line-clamp-2 text-xl font-black tracking-tight sm:text-2xl">
                    {selectedMedia.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <MediaBadge type={selectedMedia.type} />
                    <span
                      className="rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em]"
                      style={{
                        background: "var(--panel-alt-bg)",
                        borderColor: "var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {formatDurationClock(selectedMedia.duration)}
                    </span>
                    <span
                      className="rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em]"
                      style={{
                        background: "var(--panel-alt-bg)",
                        borderColor: "var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {selectedChannelSummary}
                    </span>
                  </div>
                </div>

                <a
                  href={selectedMedia.file}
                  target="_blank"
                  rel="noreferrer"
                  className="ttv-action-button ttv-touch-target inline-flex w-fit items-center justify-center rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em]"
                >
                  Open Source
                </a>
              </div>
            </header>

            <SectionCard
              eyebrow="Basics"
              title="Identity and Assignment"
              description="Edit the public title, media type, actual runtime, and channel destination."
            >
              <div className="grid gap-4">
                <FieldLabel label="Display Title">
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="w-full rounded-2xl border px-4 py-3 text-base outline-none sm:text-sm"
                    maxLength={140}
                    style={{
                      background: "var(--panel-alt-bg)",
                      borderColor: title.trim() ? "var(--border)" : "#f87171",
                      color: "var(--text)",
                    }}
                  />
                </FieldLabel>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[0.8fr_0.9fr_1.3fr]">
                  <FieldLabel label="Media Type">
                    <select
                      value={type}
                      onChange={(event) =>
                        handleTypeChange(event.target.value as MediaType)
                      }
                      className="w-full rounded-2xl border px-4 py-3 text-base sm:text-sm"
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

                  <FieldLabel label="Actual Runtime" helper="Use MM:SS or HH:MM:SS.">
                    <input
                      value={durationInput}
                      onChange={(event) =>
                        setDurationInput(event.target.value.replace(/[^\d:.]/g, ""))
                      }
                      className="w-full rounded-2xl border px-4 py-3 text-base outline-none sm:text-sm"
                      placeholder="21:57"
                      style={{
                        background: "var(--panel-alt-bg)",
                        borderColor: parsedDuration > 0 ? "var(--border)" : "#f87171",
                        color: "var(--text)",
                      }}
                    />
                  </FieldLabel>

                  {!selectedIsAd ? (
                    <FieldLabel label="Channel Assignment">
                      <select
                        value={targetChannelId}
                        onChange={(event) => setTargetChannelId(event.target.value)}
                        className="w-full rounded-2xl border px-4 py-3 text-base sm:text-sm"
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
                    </FieldLabel>
                  ) : (
                    <div
                      className="flex items-center rounded-2xl border px-4 py-3 text-sm"
                      style={{
                        background: "var(--panel-alt-bg)",
                        borderColor: "var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      Ads remain outside normal channel playlists.
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            {selectedIsAd ? (
              <SectionCard
                eyebrow="Ad Inventory"
                title="Commercial Targeting"
                description="Choose whether this ad runs globally or only on selected channels."
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setAdTargetMode("channels")}
                    className="rounded-2xl border p-4 text-left transition"
                    style={{
                      background:
                        adTargetMode === "channels"
                          ? "color-mix(in srgb, var(--primary) 18%, var(--panel-bg))"
                          : "var(--panel-alt-bg)",
                      borderColor:
                        adTargetMode === "channels" ? "var(--primary)" : "var(--border)",
                    }}
                  >
                    <div className="text-sm font-black">Selected Channels</div>
                    <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
                      Target this commercial to specific channels only.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdTargetMode("global")}
                    className="rounded-2xl border p-4 text-left transition"
                    style={{
                      background:
                        adTargetMode === "global"
                          ? "color-mix(in srgb, var(--primary) 18%, var(--panel-bg))"
                          : "var(--panel-alt-bg)",
                      borderColor:
                        adTargetMode === "global" ? "var(--primary)" : "var(--border)",
                    }}
                  >
                    <div className="text-sm font-black">Global Ad</div>
                    <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
                      Allow this ad on every channel whose policy permits global ads.
                    </div>
                  </button>
                </div>

                {adTargetMode === "channels" ? (
                  <div className="mt-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs font-black" style={{ color: "var(--text-muted)" }}>
                        {adChannelIds.length} selected channel(s)
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={selectAllAdChannels}
                          className="ttv-action-button rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em]"
                        >
                          Select All
                        </button>
                        <button
                          type="button"
                          onClick={clearAdChannels}
                          className="ttv-action-button rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em]"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {enabledChannels.map((channel) => {
                        const active = adChannelIds.includes(channel.id);

                        return (
                          <button
                            key={channel.id}
                            type="button"
                            onClick={() => toggleAdChannel(channel.id)}
                            className="rounded-2xl border p-3 text-left transition"
                            style={{
                              background: active
                                ? "color-mix(in srgb, var(--primary) 18%, var(--panel-bg))"
                                : "var(--button-bg)",
                              borderColor: active ? "var(--primary)" : "var(--border)",
                              color: "var(--text)",
                            }}
                          >
                            <div className="text-xs font-black uppercase tracking-[0.08em]">
                              {getChannelLabel(channel)}
                            </div>
                            <div className="mt-1 line-clamp-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
                              {getChannelName(channel)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div
                    className="mt-4 rounded-2xl border p-4 text-xs leading-5"
                    style={{
                      background: "rgba(34,197,94,0.08)",
                      borderColor: "rgba(34,197,94,0.28)",
                      color: "#86efac",
                    }}
                  >
                    Global inventory is still limited by each channel&apos;s ad policy.
                  </div>
                )}

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
                      checked={allowCommercialSlicing}
                      onChange={(event) =>
                        setAllowCommercialSlicing(event.target.checked)
                      }
                      className="h-5 w-5"
                    />
                    <span>
                      <strong className="block">Allow Commercial Slicing</strong>
                      <span className="mt-1 block text-xs" style={{ color: "var(--text-muted)" }}>
                        Permit exact-length cuts when filling an ad block.
                      </span>
                    </span>
                  </label>

                  <FieldLabel label="Commercial Category" helper="Examples: general, kids, anime, gaming.">
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

            {selectedIsBroadcast ? (
              <SectionCard
                eyebrow="Broadcast"
                title="Slot and Commercial Logic"
                description="Keep actual runtime separate from the public broadcast slot. Presets fill common cable-TV timing quickly."
              >
                <div className="mb-4 flex flex-wrap gap-2">
                  <PresetButton label="30m Cartoon" onClick={applyCartoonPreset} />
                  <PresetButton label="30m Sitcom" onClick={applySitcomPreset} />
                  <PresetButton label="60m Drama" onClick={applyDramaPreset} />
                  <PresetButton label="Clear Logic" onClick={clearBroadcastLogic} />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <FieldLabel label="Broadcast Slot" helper="Example: 30:00 or 60:00.">
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

                  <FieldLabel label="Breakpoints" helper="Comma-separated positions, such as 15:00.">
                    <input
                      value={breakpointsInput}
                      onChange={(event) =>
                        setBreakpointsInput(event.target.value.replace(/[^\d:,\s]/g, ""))
                      }
                      className="w-full rounded-2xl border px-4 py-3 text-base outline-none sm:text-sm"
                      placeholder="15:00"
                      style={{
                        background: "var(--panel-alt-bg)",
                        borderColor: "var(--border)",
                        color: "var(--text)",
                      }}
                    />
                  </FieldLabel>

                  <FieldLabel label="Ad Block Lengths" helper="Comma-separated lengths, such as 2:00.">
                    <input
                      value={breakDurationsInput}
                      onChange={(event) =>
                        setBreakDurationsInput(event.target.value.replace(/[^\d:,\s]/g, ""))
                      }
                      className="w-full rounded-2xl border px-4 py-3 text-base outline-none sm:text-sm"
                      placeholder="2:00"
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
                        Use eligible commercials to complete the broadcast slot.
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

                <div
                  className="mt-4 rounded-2xl border p-4 text-xs leading-5"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  {broadcastSummary}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard
              eyebrow="Schedule"
              title={selectedIsAd ? "Campaign Schedule" : "Air Schedule"}
              description="No selected days means every day. Fixed air time is optional for normal rotation."
            >
              {selectedIsProgram ? (
                <div className="mb-4 max-w-sm">
                  <FieldLabel label="Optional Fixed Air Time" helper="Use HH:mm, such as 16:00.">
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
                          airStartTime && !isValidAirTime(airStartTime)
                            ? "#f87171"
                            : "var(--border)",
                        color: "var(--text)",
                      }}
                    />
                  </FieldLabel>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-black" style={{ color: "var(--text-muted)" }}>
                  {airDays.length === 0 ? "Every day" : `${airDays.length} selected day(s)`}
                </div>
                <button
                  type="button"
                  onClick={clearAirDays}
                  className="ttv-action-button rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em]"
                >
                  Every Day
                </button>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {WEEKDAYS.map((day) => {
                  const active = airDays.includes(day.id);

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
            </SectionCard>

            <div
              className="sticky bottom-2 z-20 rounded-3xl border p-3 shadow-2xl backdrop-blur-xl sm:p-4"
              style={{
                background: "color-mix(in srgb, var(--panel-bg) 94%, transparent)",
                borderColor: validationError
                  ? "rgba(248,113,113,0.42)"
                  : "color-mix(in srgb, var(--primary) 40%, var(--border))",
              }}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div
                    className="text-[10px] font-black uppercase tracking-[0.14em]"
                    style={{
                      color: validationError
                        ? "#fca5a5"
                        : messageLooksSuccessful
                          ? "#86efac"
                          : "var(--primary)",
                    }}
                  >
                    {validationError
                      ? "Action Required"
                      : messageLooksSuccessful
                        ? "Saved"
                        : "Ready to Save"}
                  </div>
                  <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
                    {validationError ?? message}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  {!selectedIsAd ? (
                    <button
                      type="button"
                      onClick={removeFromPlaylists}
                      className="ttv-touch-target rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em]"
                      style={{
                        background: "rgba(127,29,29,0.55)",
                        borderColor: "rgba(248,113,113,0.35)",
                        color: "#fecaca",
                      }}
                    >
                      Remove from Playlists
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={saveChanges}
                    className="ttv-touch-target rounded-2xl px-6 py-3 text-xs font-black uppercase tracking-[0.14em] transition hover:scale-[1.01]"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))",
                      color: "var(--text)",
                      boxShadow:
                        "0 14px 35px color-mix(in srgb, var(--primary) 24%, transparent)",
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
