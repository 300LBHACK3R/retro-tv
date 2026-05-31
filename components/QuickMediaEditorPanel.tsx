"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatBreakpoints,
  formatDuration,
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
  CommercialStrategy,
  MediaItem,
  MediaType,
  Weekday,
} from "@/lib/types";

type MediaFilter = "all" | MediaType;

const MEDIA_FILTERS: { id: MediaFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "show", label: "Shows" },
  { id: "movie", label: "Movies" },
  { id: "commercial", label: "Ads" },
  { id: "bumper", label: "Bumpers" },
];

function getChannelNumber(
  channelId: string,
  channels: { id: string; number?: number }[],
): string | number {
  const channel = channels.find((item) => item.id === channelId);
  return channel?.number ?? channelId;
}

function getMediaSearchLabel(item: MediaItem): string {
  return `${item.title} ${item.type} ${item.file} ${item.commercialCategory ?? ""}`.toLowerCase();
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

function isBroadcastType(type: MediaType): boolean {
  return type === "show" || type === "movie";
}

function isCommercialType(type: MediaType): boolean {
  return type === "commercial" || type === "bumper";
}

function getMediaTypeLabel(type: MediaType): string {
  if (type === "commercial") return "Commercial";
  if (type === "bumper") return "Bumper";
  if (type === "movie") return "Movie";
  return "Show";
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

  const [message, setMessage] = useState(
    "Select any loaded media item to edit it quickly.",
  );

  const enabledChannels = useMemo(
    () =>
      channels
        .filter((channel) => channel.isEnabled !== false)
        .sort((a, b) => {
          const aNumber = Number(a.number ?? a.id);
          const bNumber = Number(b.number ?? b.id);

          if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
            return aNumber - bNumber;
          }

          return a.id.localeCompare(b.id);
        }),
    [channels],
  );

  const selectedMedia = useMemo(
    () => media.find((item) => item.id === selectedMediaId),
    [media, selectedMediaId],
  );

  const assignedChannelIds = useMemo(() => {
    if (!selectedMedia) return [];

    return channels
      .filter((channel) => channel.mediaIds.includes(selectedMedia.id))
      .map((channel) => channel.id);
  }, [channels, selectedMedia]);

  const filteredMedia = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    const sorted = [...media].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type);
      }

      return a.title.localeCompare(b.title);
    });

    return sorted.filter((item) => {
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
    setAllowCommercialSlicing(
      selectedMedia.allowCommercialSlicing ?? selectedMedia.type === "commercial",
    );
    setCommercialCategory(selectedMedia.commercialCategory ?? "");
    setAirStartTime(selectedMedia.airStartTime ?? "");
    setAirDays(selectedMedia.airDays ?? []);

    const firstAssignedChannelId = channels.find((channel) =>
      channel.mediaIds.includes(selectedMedia.id),
    )?.id;

    setTargetChannelId(firstAssignedChannelId ?? currentChannelId);
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

  const applyCartoonPreset = () => {
    setSlotLengthInput("30:00");
    setBreakpointsInput("7:30, 15:00");
    setBreakDurationsInput("2:00, 2:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setMessage("Applied 30-minute cartoon/anime slot preset.");
  };

  const applySitcomPreset = () => {
    setSlotLengthInput("30:00");
    setBreakpointsInput("11:00");
    setBreakDurationsInput("3:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setMessage("Applied 30-minute sitcom slot preset.");
  };

  const applyDramaPreset = () => {
    setSlotLengthInput("60:00");
    setBreakpointsInput("12:00, 24:00, 36:00");
    setBreakDurationsInput("3:00, 3:00, 3:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setMessage("Applied 60-minute drama slot preset.");
  };

  const handleTypeChange = (nextType: MediaType) => {
    setType(nextType);

    if (isCommercialType(nextType)) {
      setBreakpointsInput("");
      setBreakDurationsInput("");
      setSlotLengthInput("");
      setFillSlotWithCommercials(false);
      setAllowCommercialSlicing(true);
      return;
    }

    setAllowCommercialSlicing(false);
  };

  const saveChanges = () => {
    if (!selectedMedia) {
      setMessage("Select a media item first.");
      return;
    }

    const cleanTitle = title.trim();

    if (!cleanTitle) {
      setMessage("Title cannot be blank.");
      return;
    }

    if (parsedDuration <= 0) {
      setMessage("Duration must be valid. Example: 21:57.");
      return;
    }

    if (!isValidAirTime(airStartTime)) {
      setMessage("Air time must be HH:mm format, like 16:00.");
      return;
    }

    if (fillSlotWithCommercials && parsedSlotLength <= parsedDuration) {
      setMessage("Slot length must be longer than runtime. Example: 30:00.");
      return;
    }

    if (targetChannelId && !enabledChannels.some((channel) => channel.id === targetChannelId)) {
      setMessage("Select a valid enabled channel.");
      return;
    }

    const normalizedAirStartTime = normalizeAirStartTime(airStartTime.trim());

    updateMedia(selectedMedia.id, {
      title: cleanTitle,
      type,
      duration: parsedDuration,

      breakpoints: isBroadcastType(type) ? parsedBreakpoints : [],
      breakDurations: isBroadcastType(type) ? parsedBreakDurations : [],
      slotLengthSeconds:
        isBroadcastType(type) && parsedSlotLength > parsedDuration
          ? parsedSlotLength
          : undefined,
      fillSlotWithCommercials: isBroadcastType(type)
        ? fillSlotWithCommercials
        : false,
      commercialStrategy,

      allowCommercialSlicing: isCommercialType(type)
        ? allowCommercialSlicing
        : false,
      commercialCategory: isCommercialType(type)
        ? sanitizeCommercialCategory(commercialCategory)
        : undefined,

      airDays,
      airStartTime: normalizedAirStartTime,
      updatedAt: new Date().toISOString(),
    });

    assignedChannelIds.forEach((channelId) => {
      if (channelId !== targetChannelId) {
        removeMediaFromChannel(channelId, selectedMedia.id);
      }
    });

    if (targetChannelId && !assignedChannelIds.includes(targetChannelId)) {
      assignMediaToChannel(targetChannelId, selectedMedia.id);
    }

    setMessage(
      `Saved "${cleanTitle}" and moved it to CH ${getChannelNumber(
        targetChannelId,
        channels,
      )}.`,
    );
  };

  const selectedChannelLabel =
    assignedChannelIds.length > 0
      ? assignedChannelIds
          .map((channelId) => `CH ${getChannelNumber(channelId, channels)}`)
          .join(", ")
      : "Not assigned";

  return (
    <section
      className="rounded-2xl border p-3 sm:p-4"
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
          Quick Edit
        </div>

        <h2 className="mt-1 text-sm font-semibold">Edit Loaded Media</h2>

        <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
          Edit runtime, commercial blocks, slot length, air days, title, type,
          commercial pool settings, and channel without deleting/re-uploading.
        </p>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search loaded media..."
            className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />

          <div className="flex gap-2 overflow-x-auto">
            {MEDIA_FILTERS.map((item) => {
              const active = filter === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className="shrink-0 rounded-xl border px-3 py-3 text-xs font-black uppercase tracking-[0.1em]"
                  style={{
                    background: active ? "var(--primary)" : "var(--button-bg)",
                    borderColor: active ? "var(--primary)" : "var(--border)",
                    color: "var(--text)",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="max-h-[360px] space-y-2 overflow-auto pr-1 xl:max-h-[640px]">
            {filteredMedia.length === 0 ? (
              <div
                className="rounded-xl border px-3 py-6 text-center text-xs"
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
                const itemChannels = channels
                  .filter((channel) => channel.mediaIds.includes(item.id))
                  .map((channel) => `CH ${channel.number ?? channel.id}`)
                  .join(", ");

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedMediaId(item.id)}
                    className="w-full rounded-xl border p-3 text-left transition hover:opacity-95"
                    style={{
                      background: active
                        ? "rgba(255,255,255,0.08)"
                        : "var(--panel-alt-bg)",
                      borderColor: active ? "var(--primary)" : "var(--border)",
                      color: "var(--text)",
                    }}
                  >
                    <div className="truncate text-sm font-semibold">
                      {item.title}
                    </div>

                    <div
                      className="mt-1 truncate text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {getMediaTypeLabel(item.type).toUpperCase()} •{" "}
                      {formatDurationClock(item.duration)} •{" "}
                      {itemChannels || "No channel"}
                    </div>

                    {item.fillSlotWithCommercials || item.commercialCategory ? (
                      <div
                        className="mt-1 truncate text-[10px] uppercase tracking-[0.1em]"
                        style={{ color: "var(--primary)" }}
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
            className="rounded-xl border p-3"
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
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
                  style={{
                    background: "var(--panel-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />

                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    value={type}
                    onChange={(event) =>
                      handleTypeChange(event.target.value as MediaType)
                    }
                    className="w-full rounded-lg border px-3 py-3 text-base sm:text-sm"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                  >
                    <option value="show">Show</option>
                    <option value="movie">Movie</option>
                    <option value="commercial">Commercial</option>
                    <option value="bumper">Bumper</option>
                  </select>

                  <input
                    value={durationInput}
                    onChange={(event) =>
                      setDurationInput(event.target.value.replace(/[^\d:.]/g, ""))
                    }
                    placeholder="Runtime 21:57"
                    className="w-full rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
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
                    className="w-full rounded-lg border px-3 py-3 text-base sm:text-sm"
                    style={{
                      background: "var(--panel-bg)",
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

                {isBroadcastType(type) ? (
                  <div
                    className="rounded-xl border p-3"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <div
                      className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]"
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
                        placeholder="Slot 30:00"
                        className="w-full rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
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
                        placeholder="Breakpoints 7:30, 15:00"
                        className="w-full rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
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
                        placeholder="Ad blocks 2:00, 2:00"
                        className="w-full rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
                        style={{
                          background: "var(--panel-alt-bg)",
                          borderColor: "var(--border)",
                          color: "var(--text)",
                        }}
                      />
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={applyCartoonPreset}
                        className="rounded-lg px-3 py-3 text-xs font-semibold"
                        style={{
                          background: "var(--button-bg)",
                          color: "var(--text)",
                        }}
                      >
                        30m Cartoon
                      </button>

                      <button
                        type="button"
                        onClick={applySitcomPreset}
                        className="rounded-lg px-3 py-3 text-xs font-semibold"
                        style={{
                          background: "var(--button-bg)",
                          color: "var(--text)",
                        }}
                      >
                        30m Sitcom
                      </button>

                      <button
                        type="button"
                        onClick={applyDramaPreset}
                        className="rounded-lg px-3 py-3 text-xs font-semibold"
                        style={{
                          background: "var(--button-bg)",
                          color: "var(--text)",
                        }}
                      >
                        60m Drama
                      </button>
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

                {isCommercialType(type) ? (
                  <div
                    className="rounded-xl border p-3"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor: "var(--border)",
                    }}
                  >
                    <div
                      className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]"
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
                  </div>
                ) : null}

                <input
                  value={airStartTime}
                  onChange={(event) =>
                    setAirStartTime(event.target.value.replace(/[^\d:]/g, ""))
                  }
                  placeholder="Optional air time/order 16:00"
                  className="w-full rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
                  style={{
                    background: "var(--panel-bg)",
                    borderColor:
                      airStartTime && !isValidAirTime(airStartTime)
                        ? "#ef4444"
                        : "var(--border)",
                    color: "var(--text)",
                  }}
                />

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      Air Days
                    </div>

                    <button
                      type="button"
                      onClick={clearAirDays}
                      className="rounded-lg px-3 py-2 text-xs font-semibold"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
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
                          className="rounded-lg px-2 py-3 text-[11px] font-black uppercase tracking-[0.08em]"
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

                <div
                  className="rounded-xl border px-3 py-2 text-xs leading-5"
                  style={{
                    background: "var(--panel-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  Slot:{" "}
                  {parsedSlotLength > 0
                    ? formatDurationClock(parsedSlotLength)
                    : "none"}{" "}
                  • Runtime:{" "}
                  {parsedDuration > 0
                    ? formatDurationClock(parsedDuration)
                    : "invalid"}{" "}
                  • Breaks: {formatBreakpoints(parsedBreakpoints) || "none"} •
                  Ad blocks: {formatBreakpoints(parsedBreakDurations) || "auto"} •
                  Current channel: {selectedChannelLabel}
                </div>

                <button
                  type="button"
                  onClick={saveChanges}
                  className="rounded-xl px-4 py-4 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.01]"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))",
                    color: "var(--text)",
                  }}
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>

        <div
          className="rounded-xl border px-3 py-2 text-xs"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          {message}
        </div>
      </div>
    </section>
  );
}