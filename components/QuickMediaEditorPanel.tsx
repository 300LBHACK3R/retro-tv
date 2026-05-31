"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { MediaItem, MediaType, Weekday } from "@/lib/types";

const WEEKDAYS: { id: Weekday; label: string }[] = [
  { id: "sunday", label: "Sun" },
  { id: "monday", label: "Mon" },
  { id: "tuesday", label: "Tue" },
  { id: "wednesday", label: "Wed" },
  { id: "thursday", label: "Thu" },
  { id: "friday", label: "Fri" },
  { id: "saturday", label: "Sat" },
];

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function parseDuration(value: string): number {
  const clean = value.trim();

  if (!clean) return 0;

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
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function parseDurationList(value: string): number[] {
  return value
    .split(",")
    .map((part) => parseDuration(part.trim()))
    .filter((seconds) => seconds > 0);
}

function parseBreakpoints(value: string, duration: number): number[] {
  const safeDuration = Math.max(1, Math.floor(duration));

  return Array.from(
    new Set(
      value
        .split(",")
        .map((part) => parseDuration(part.trim()))
        .filter((seconds) => seconds > 0 && seconds < safeDuration - 30),
    ),
  ).sort((a, b) => a - b);
}

function formatBreakpoints(points: number[] | undefined): string {
  if (!points || points.length === 0) return "";
  return points.map(formatDuration).join(", ");
}

function getChannelNumber(channelId: string, channels: { id: string; number?: number }[]) {
  const channel = channels.find((item) => item.id === channelId);
  return channel?.number ?? channelId;
}

function getMediaSearchLabel(item: MediaItem): string {
  return `${item.title} ${item.type} ${item.file}`.toLowerCase();
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

export default function QuickMediaEditorPanel() {
  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const updateMedia = useStore((state) => state.updateMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);
  const removeMediaFromChannel = useStore((state) => state.removeMediaFromChannel);

  const [search, setSearch] = useState("");
  const [selectedMediaId, setSelectedMediaId] = useState("");

  const [title, setTitle] = useState("");
  const [type, setType] = useState<MediaType>("show");
  const [durationInput, setDurationInput] = useState("");
  const [breakpointsInput, setBreakpointsInput] = useState("");
  const [breakDurationsInput, setBreakDurationsInput] = useState("");
  const [slotLengthInput, setSlotLengthInput] = useState("");
  const [fillSlotWithCommercials, setFillSlotWithCommercials] = useState(false);
  const [airStartTime, setAirStartTime] = useState("");
  const [airDays, setAirDays] = useState<Weekday[]>([]);
  const [targetChannelId, setTargetChannelId] = useState(currentChannelId);
  const [message, setMessage] = useState("Select any loaded media item to edit it quickly.");

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
    const sorted = [...media].sort((a, b) => a.title.localeCompare(b.title));

    if (!cleanSearch) return sorted;

    return sorted.filter((item) => getMediaSearchLabel(item).includes(cleanSearch));
  }, [media, search]);

  const parsedDuration = useMemo(() => parseDuration(durationInput), [durationInput]);
  const parsedBreakpoints = useMemo(
    () => parseBreakpoints(breakpointsInput, parsedDuration),
    [breakpointsInput, parsedDuration],
  );
  const parsedBreakDurations = useMemo(
    () => parseDurationList(breakDurationsInput),
    [breakDurationsInput],
  );
  const parsedSlotLength = useMemo(() => parseDuration(slotLengthInput), [slotLengthInput]);

  useEffect(() => {
    if (!selectedMedia) return;

    setTitle(selectedMedia.title);
    setType(selectedMedia.type);
    setDurationInput(formatDuration(selectedMedia.duration));
    setBreakpointsInput(formatBreakpoints(selectedMedia.breakpoints));
    setBreakDurationsInput(formatBreakpoints(selectedMedia.breakDurations));
    setSlotLengthInput(
      selectedMedia.slotLengthSeconds
        ? formatDuration(selectedMedia.slotLengthSeconds)
        : "",
    );
    setFillSlotWithCommercials(Boolean(selectedMedia.fillSlotWithCommercials));
    setAirStartTime(selectedMedia.airStartTime ?? "");
    setAirDays(selectedMedia.airDays ?? []);

    const firstAssignedChannelId = channels.find((channel) =>
      channel.mediaIds.includes(selectedMedia.id),
    )?.id;

    setTargetChannelId(firstAssignedChannelId ?? currentChannelId);
  }, [channels, currentChannelId, selectedMedia]);

  const toggleAirDay = (day: Weekday) => {
    setAirDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  };

  const clearAirDays = () => setAirDays([]);

  const applyMartinMysteryPreset = () => {
    setSlotLengthInput("30:00");
    setBreakpointsInput("7:30, 15:00");
    setBreakDurationsInput("2:00, 2:00");
    setFillSlotWithCommercials(true);
    setMessage("Applied 30-minute cartoon/anime slot preset.");
  };

  const applySitcomPreset = () => {
    setSlotLengthInput("30:00");
    setBreakpointsInput("11:00");
    setBreakDurationsInput("3:00");
    setFillSlotWithCommercials(true);
    setMessage("Applied 30-minute sitcom slot preset.");
  };

  const applyDramaPreset = () => {
    setSlotLengthInput("60:00");
    setBreakpointsInput("12:00, 24:00, 36:00");
    setBreakDurationsInput("3:00, 3:00, 3:00");
    setFillSlotWithCommercials(true);
    setMessage("Applied 60-minute drama slot preset.");
  };

  const saveChanges = () => {
    if (!selectedMedia) {
      setMessage("Select a media item first.");
      return;
    }

    if (!title.trim()) {
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
      setMessage("Slot length must be longer than the runtime. Example: 30:00.");
      return;
    }

    updateMedia(selectedMedia.id, {
      title: title.trim(),
      type,
      duration: parsedDuration,
      breakpoints: parsedBreakpoints,
      breakDurations: parsedBreakDurations,
      slotLengthSeconds: parsedSlotLength > 0 ? parsedSlotLength : undefined,
      fillSlotWithCommercials,
      airDays,
      airStartTime: airStartTime.trim() || undefined,
      updatedAt: new Date().toISOString(),
    });

    assignedChannelIds.forEach((channelId) => {
      if (channelId !== targetChannelId) {
        removeMediaFromChannel(channelId, selectedMedia.id);
      }
    });

    if (!assignedChannelIds.includes(targetChannelId)) {
      assignMediaToChannel(targetChannelId, selectedMedia.id);
    }

    setMessage(
      `Saved "${title.trim()}" and moved it to CH ${getChannelNumber(
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

        <h2 className="mt-1 text-sm font-semibold">Edit Loaded Shows</h2>

        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Edit runtime, commercial blocks, 30-minute slots, air days, title, type,
          and channel without deleting or re-uploading.
        </p>
      </div>

      <div className="grid gap-3">
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
                    <div className="truncate text-sm font-semibold">{item.title}</div>
                    <div
                      className="mt-1 truncate text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {item.type.toUpperCase()} • {formatDuration(item.duration)} •{" "}
                      {itemChannels || "No channel"}
                    </div>
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
                    onChange={(event) => setType(event.target.value as MediaType)}
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

                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    value={slotLengthInput}
                    onChange={(event) =>
                      setSlotLengthInput(event.target.value.replace(/[^\d:.]/g, ""))
                    }
                    placeholder="Slot 30:00"
                    className="w-full rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                  />

                  <input
                    value={breakpointsInput}
                    onChange={(event) =>
                      setBreakpointsInput(event.target.value.replace(/[^\d:.,\s]/g, ""))
                    }
                    placeholder="Breakpoints 7:30, 15:00"
                    className="w-full rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
                    style={{
                      background: "var(--panel-bg)",
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
                      background: "var(--panel-bg)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                  />
                </div>

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

                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={applyMartinMysteryPreset}
                    className="rounded-lg px-3 py-3 text-xs font-semibold"
                    style={{ background: "var(--button-bg)", color: "var(--text)" }}
                  >
                    30m Cartoon
                  </button>

                  <button
                    type="button"
                    onClick={applySitcomPreset}
                    className="rounded-lg px-3 py-3 text-xs font-semibold"
                    style={{ background: "var(--button-bg)", color: "var(--text)" }}
                  >
                    30m Sitcom
                  </button>

                  <button
                    type="button"
                    onClick={applyDramaPreset}
                    className="rounded-lg px-3 py-3 text-xs font-semibold"
                    style={{ background: "var(--button-bg)", color: "var(--text)" }}
                  >
                    60m Drama
                  </button>
                </div>

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
                  className="rounded-xl border px-3 py-2 text-xs"
                  style={{
                    background: "var(--panel-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  Slot: {parsedSlotLength > 0 ? formatDuration(parsedSlotLength) : "none"} •
                  Runtime: {parsedDuration > 0 ? formatDuration(parsedDuration) : "invalid"} •
                  Breaks: {formatBreakpoints(parsedBreakpoints) || "none"} •
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
