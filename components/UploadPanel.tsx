"use client";

import { useMemo, useState } from "react";
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
  titleCase,
  WEEKDAYS,
} from "@/lib/mediaUtils";
import { useStore } from "@/lib/store";
import type {
  CommercialStrategy,
  MediaType,
  Weekday,
} from "@/lib/types";

type DurationMode = "seconds" | "minutes";

function getDurationHelperText(value: string, mode: DurationMode): string {
  const seconds = parseManualDuration(value, mode);

  if (seconds <= 0) {
    return mode === "minutes"
      ? "Type minutes, like 22.5, or use 22:19."
      : "Type seconds, like 1339, or use 22:19.";
  }

  return `${formatDuration(seconds)} • ${formatDurationClock(seconds)}`;
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

export default function UploadPanel() {
  const channels = useStore((state) => state.channels);
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

  const [allowCommercialSlicing, setAllowCommercialSlicing] = useState(true);
  const [commercialCategory, setCommercialCategory] = useState("");

  const [selectedAirDays, setSelectedAirDays] = useState<Weekday[]>([]);
  const [channelId, setChannelId] = useState(currentChannelId);

  const [status, setStatus] = useState("");
  const [durationStatus, setDurationStatus] = useState(
    "Auto-detect will try first. Manual duration always works.",
  );
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

  const normalizedTitle = title.trim();

  const canAdd =
    normalizedTitle.length > 0 &&
    normalizedFile.length > 0 &&
    normalizedFile.startsWith("https://") &&
    parsedDurationSeconds > 0 &&
    channelId.trim().length > 0 &&
    (!fillSlotWithCommercials ||
      parsedSlotLengthSeconds > parsedDurationSeconds);

  const toggleAirDay = (day: Weekday) => {
    setSelectedAirDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  };

  const selectEveryDay = () => {
    setSelectedAirDays([]);
  };

  const applyCartoonPreset = () => {
    setSlotLengthInput("30:00");
    setBreakpointsInput("7:30, 15:00");
    setBreakDurationsInput("2:00, 2:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setStatus("Applied 30-minute cartoon/anime broadcast preset.");
  };

  const applySitcomPreset = () => {
    setSlotLengthInput("30:00");
    setBreakpointsInput("11:00");
    setBreakDurationsInput("3:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setStatus("Applied 30-minute sitcom broadcast preset.");
  };

  const applyDramaPreset = () => {
    setSlotLengthInput("60:00");
    setBreakpointsInput("12:00, 24:00, 36:00");
    setBreakDurationsInput("3:00, 3:00, 3:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setStatus("Applied 60-minute drama broadcast preset.");
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
        `Detected ${result.durationLabel} • ${formatDurationClock(
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
    setStatus("");

    if (!title.trim()) {
      const inferredTitle = inferNameFromUrl(nextUrl);

      if (inferredTitle) {
        setTitle(titleCase(inferredTitle));
      }
    }
  };

  const handleTypeChange = (nextType: MediaType) => {
    setType(nextType);

    if (nextType === "commercial" || nextType === "bumper") {
      setBreakpointsInput("");
      setBreakDurationsInput("");
      setSlotLengthInput("");
      setFillSlotWithCommercials(false);
      setAllowCommercialSlicing(true);
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
  };

  const addItem = () => {
    if (!canAdd) {
      if (!normalizedFile.startsWith("https://")) {
        setStatus("Use a full public https:// video URL.");
        return;
      }

      if (parsedDurationSeconds <= 0) {
        setStatus("Enter a valid duration manually or use Auto.");
        return;
      }

      if (
        fillSlotWithCommercials &&
        parsedSlotLengthSeconds <= parsedDurationSeconds
      ) {
        setStatus("Slot length must be longer than runtime. Example: 30:00.");
        return;
      }

      setStatus("Fill in title, URL, duration, and channel first.");
      return;
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
      breakpoints: parsedBreakpoints,
      breakDurations: parsedBreakDurations,
      slotLengthSeconds:
        parsedSlotLengthSeconds > parsedDurationSeconds
          ? parsedSlotLengthSeconds
          : undefined,
      fillSlotWithCommercials,
      commercialStrategy,
      allowCommercialSlicing: shouldShowCommercialFields(type)
        ? allowCommercialSlicing
        : false,
      commercialCategory: commercialCategory.trim() || undefined,
      airDays: selectedAirDays,
    });

    addMedia(item);
    assignMediaToChannel(channelId, item.id);

    setStatus(
      `Added "${item.title}" to CH ${channelId} • ${formatDuration(
        item.duration,
      )}.`,
    );

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
    setAllowCommercialSlicing(true);
    setCommercialCategory("");
    setSelectedAirDays([]);
    setDurationStatus("Auto-detect will try first. Manual duration always works.");
  };

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
          Add Media
        </div>

        <h2 className="mt-1 text-sm font-semibold">
          Cloudflare/R2 Video Entry
        </h2>

        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Add videos, commercials, runtime, broadcast slots, ad blocks, and
          optional air days.
        </p>
      </div>

      <div className="grid gap-3">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
          placeholder="Title"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
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
          className="w-full rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
          placeholder="https://pub-xxxx.r2.dev/video.mp4"
          spellCheck={false}
          style={{
            background: "var(--panel-alt-bg)",
            borderColor:
              normalizedFile && !normalizedFile.startsWith("https://")
                ? "#f87171"
                : "var(--border)",
            color: "var(--text)",
          }}
        />

        {compatibilityWarning ? (
          <div
            className="rounded-xl border px-3 py-2 text-xs"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          >
            {compatibilityWarning}
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[0.8fr_1.8fr_1fr]">
          <select
            value={type}
            onChange={(event) => handleTypeChange(event.target.value as MediaType)}
            className="w-full rounded-lg border px-3 py-3 text-base sm:text-sm"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            <option value="show">Show</option>
            <option value="movie">Movie</option>
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
                className="min-w-0 rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
                placeholder="Duration: 1339, 22.3, or 22:19"
                inputMode="decimal"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />

              <select
                value={durationMode}
                onChange={(event) =>
                  setDurationMode(event.target.value as DurationMode)
                }
                className="rounded-lg border px-2 py-3 text-sm outline-none"
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
                className="rounded-lg px-3 py-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: "var(--button-bg)",
                  color: "var(--text)",
                }}
              >
                {isDetectingDuration ? "..." : "Auto"}
              </button>
            </div>

            <div
              className="mt-1 text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              {durationStatus} • {getDurationHelperText(durationInput, durationMode)}
            </div>
          </div>

          <select
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
            className="w-full rounded-lg border px-3 py-3 text-base sm:text-sm"
            style={{
              background: "var(--panel-alt-bg)",
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

        {shouldShowBroadcastFields(type) ? (
          <div
            className="rounded-xl border p-3"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="mb-2 text-xs font-semibold uppercase tracking-[0.14em]"
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
                  className="w-full rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
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
                  className="mt-1 text-[11px]"
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
                  className="w-full rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
                  placeholder="7:30, 15:00"
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
                  {formatBreakpoints(parsedBreakpoints)}
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
                  className="w-full rounded-lg border px-3 py-3 text-base outline-none sm:text-sm"
                  placeholder="2:00, 2:00"
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
                  {formatBreakpoints(parsedBreakDurations) || "Auto 2:00 per break"}
                </div>
              </div>
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
            className="rounded-xl border p-3"
            style={{
              background: "var(--panel-alt-bg)",
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
              const active = selectedAirDays.includes(day.id);

              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => toggleAirDay(day.id)}
                  className="rounded-lg px-2 py-3 text-[11px] font-black uppercase tracking-[0.08em]"
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
            className="mt-1 text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            No days selected means this media can air every day.
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => window.open(normalizedFile, "_blank", "noopener")}
            disabled={!normalizedFile.startsWith("https://")}
            className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "var(--button-bg)",
              color: "var(--text)",
            }}
          >
            Test URL
          </button>

          <button
            type="button"
            onClick={addItem}
            disabled={!canAdd}
            className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background:
                "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))",
              color: "var(--text)",
            }}
          >
            Add Media
          </button>
        </div>

        {status ? (
          <div
            className="rounded-xl border px-3 py-2 text-xs"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          >
            {status}
          </div>
        ) : null}
      </div>
    </section>
  );
}