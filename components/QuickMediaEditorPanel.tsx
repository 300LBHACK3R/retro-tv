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

  if (!clean) {
    return 0;
  }

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

  return Math.floor(numeric);
}

function parseBreakpoints(value: string, duration: number): number[] {
  const safeDuration = Math.max(1, Math.floor(duration));

  return Array.from(
    new Set(
      value
        .split(",")
        .map((part) => parseDuration(part.trim()))
        .filter(
          (seconds) =>
            Number.isFinite(seconds) &&
            seconds > 0 &&
            seconds < safeDuration - 30,
        ),
    ),
  ).sort((a, b) => a - b);
}

function formatBreakpoints(points: number[] | undefined): string {
  if (!points || points.length === 0) {
    return "";
  }

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
  if (!value.trim()) {
    return true;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return false;
  }

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
    if (!selectedMedia) {
      return [];
    }

    return channels
      .filter((channel) => channel.mediaIds.includes(selectedMedia.id))
      .map((channel) => channel.id);
  }, [channels, selectedMedia]);

  const filteredMedia = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    const sorted = [...media].sort((a, b) => a.title.localeCompare(b.title));

    if (!cleanSearch) {
      return sorted;
    }

    return sorted.filter((item) =>
      getMediaSearchLabel(item).includes(cleanSearch),
    );
  }, [media, search]);

  const parsedDuration = useMemo(
    () => parseDuration(durationInput),
    [durationInput],
  );

  const parsedBreakpoints = useMemo(
    () => parseBreakpoints(breakpointsInput, parsedDuration),
    [breakpointsInput, parsedDuration],
  );

  useEffect(() => {
    if (!selectedMedia) {
      return;
    }

    setTitle(selectedMedia.title);
    setType(selectedMedia.type);
    setDurationInput(formatDuration(selectedMedia.duration));
    setBreakpointsInput(formatBreakpoints(selectedMedia.breakpoints));
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

  const clearAirDays = () => {
    setAirDays([]);
  };

  const generateOneBreak = () => {
    if (parsedDuration <= 0) {
      setMessage("Enter a valid duration first.");
      return;
    }

    const midpoint = Math.round(parsedDuration / 2 / 30) * 30;
    setBreakpointsInput(formatDuration(midpoint));
    setMessage("Generated one middle commercial break.");
  };

  const generateThirtyMinuteStyleBreak = () => {
    if (parsedDuration <= 0) {
      setMessage("Enter a valid duration first.");
      return;
    }

    if (parsedDuration >= 1200 && parsedDuration <= 1800) {
      const breakPoint = Math.round(parsedDuration / 2 / 30) * 30;
      setBreakpointsInput(formatDuration(breakPoint));
      setMessage("Generated one 20–30 minute show break.");
      return;
    }

    if (parsedDuration > 1800 && parsedDuration <= 3600) {
      const first = Math.round(parsedDuration / 3 / 30) * 30;
      const second = Math.round((parsedDuration * 2) / 3 / 30) * 30;
      setBreakpointsInput(`${formatDuration(first)}, ${formatDuration(second)}`);
      setMessage("Generated longer show breakpoints.");
      return;
    }

    const movieBreaks: number[] = [];
    for (let point = 20 * 60; point < parsedDuration - 10 * 60; point += 20 * 60) {
      movieBreaks.push(point);
    }

    setBreakpointsInput(formatBreakpoints(movieBreaks));
    setMessage("Generated movie-style breakpoints.");
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

    if (!targetChannelId) {
      setMessage("Choose a target channel.");
      return;
    }

    updateMedia(selectedMedia.id, {
      title: title.trim(),
      type,
      duration: parsedDuration,
      breakpoints: parsedBreakpoints,
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
          Quick Edit
        </div>

        <h2 className="mt-1 text-sm font-semibold">Edit Loaded Shows</h2>

        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Edit runtime, commercial breaks, air days, title, type, and channel
          without deleting or re-uploading.
        </p>
      </div>

      <div className="grid gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search loaded media..."
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />

        <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-h-[460px] space-y-2 overflow-auto pr-1">
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
                Select a media item from the left.
              </div>
            ) : (
              <div className="grid gap-3">
                <div>
                  <div
                    className="mb-1 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Title
                  </div>

                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <div
                      className="mb-1 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Type
                    </div>

                    <select
                      value={type}
                      onChange={(event) =>
                        setType(event.target.value as MediaType)
                      }
                      className="w-full rounded-lg border px-3 py-2 text-sm"
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
                  </div>

                  <div>
                    <div
                      className="mb-1 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Runtime
                    </div>

                    <input
                      value={durationInput}
                      onChange={(event) =>
                        setDurationInput(event.target.value.replace(/[^\d:.]/g, ""))
                      }
                      placeholder="21:57"
                      className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                      style={{
                        background: "var(--panel-bg)",
                        borderColor:
                          durationInput && parsedDuration <= 0
                            ? "#ef4444"
                            : "var(--border)",
                        color: "var(--text)",
                      }}
                    />
                  </div>

                  <div>
                    <div
                      className="mb-1 text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Move To
                    </div>

                    <select
                      value={targetChannelId}
                      onChange={(event) => setTargetChannelId(event.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
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
                </div>

                <div>
                  <div
                    className="mb-1 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Commercial Breakpoints
                  </div>

                  <input
                    value={breakpointsInput}
                    onChange={(event) =>
                      setBreakpointsInput(
                        event.target.value.replace(/[^\d:.,\s]/g, ""),
                      )
                    }
                    placeholder="Example: 11:00"
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor: "var(--border)",
                      color: "var(--text)",
                    }}
                  />

                  <div
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Parsed: {formatBreakpoints(parsedBreakpoints) || "none"} •
                    Current channel: {selectedChannelLabel}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={generateOneBreak}
                      className="rounded-lg px-3 py-2 text-xs font-semibold"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      One Middle Break
                    </button>

                    <button
                      type="button"
                      onClick={generateThirtyMinuteStyleBreak}
                      className="rounded-lg px-3 py-2 text-xs font-semibold"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      Auto Breaks
                    </button>

                    <button
                      type="button"
                      onClick={() => setBreakpointsInput("")}
                      className="rounded-lg px-3 py-2 text-xs font-semibold"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      Clear Breaks
                    </button>
                  </div>
                </div>

                <div>
                  <div
                    className="mb-1 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Optional Air Time / Order
                  </div>

                  <input
                    value={airStartTime}
                    onChange={(event) =>
                      setAirStartTime(event.target.value.replace(/[^\d:]/g, ""))
                    }
                    placeholder="16:00"
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{
                      background: "var(--panel-bg)",
                      borderColor:
                        airStartTime && !isValidAirTime(airStartTime)
                          ? "#ef4444"
                          : "var(--border)",
                      color: "var(--text)",
                    }}
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Air Days
                    </div>

                    <button
                      type="button"
                      onClick={clearAirDays}
                      className="rounded-lg px-2 py-1 text-[11px] font-semibold"
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
                          className="rounded-lg px-2 py-2 text-[11px] font-black uppercase tracking-[0.08em]"
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

                  <div
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No selected days means this media airs every day.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={saveChanges}
                  className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.01]"
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
