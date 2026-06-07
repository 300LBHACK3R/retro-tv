"use client";

import { useMemo, useState } from "react";
import {
  createMediaItemFromUrl,
  formatBreakpoints,
  formatDuration,
  formatDurationClock,
  getDefaultSlotLengthForDuration,
  isLikelyVideoUrl,
  normalizeAirStartTime,
  normalizeUrl,
  parseBreakpoints,
  parseDurationList,
  parseManualDuration,
  sanitizeCommercialCategory,
  WEEKDAYS,
} from "@/lib/mediaUtils";
import { useStore } from "@/lib/store";
import type {
  CommercialStrategy,
  MediaType,
  Weekday,
} from "@/lib/types";

function splitInputLines(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/\r?\n/)
        .map((line) => normalizeUrl(line))
        .filter(Boolean),
    ),
  );
}

function isBroadcastType(type: MediaType): boolean {
  return type === "show" || type === "movie";
}

function isCommercialType(type: MediaType): boolean {
  return type === "commercial" || type === "bumper";
}

function isValidAirStartTime(value: string): boolean {
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

function sortChannels<T extends { id: string; number?: number }>(channels: T[]): T[] {
  return [...channels].sort((a, b) => {
    const aNumber = Number(a.number ?? a.id);
    const bNumber = Number(b.number ?? b.id);

    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
      return aNumber - bNumber;
    }

    return a.id.localeCompare(b.id);
  });
}

export default function BulkImporterPanel() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const addMedia = useStore((state) => state.addMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);

  const [urls, setUrls] = useState("");
  const [type, setType] = useState<MediaType>("show");
  const [channelId, setChannelId] = useState(currentChannelId);

  const [defaultDuration, setDefaultDuration] = useState("22:00");
  const [slotLengthInput, setSlotLengthInput] = useState("30:00");
  const [breakpointsInput, setBreakpointsInput] = useState("7:30, 15:00");
  const [breakDurationsInput, setBreakDurationsInput] = useState("2:00, 2:00");
  const [fillSlotWithCommercials, setFillSlotWithCommercials] = useState(true);
  const [commercialStrategy, setCommercialStrategy] =
    useState<CommercialStrategy>("best-fit");

  const [allowCommercialSlicing, setAllowCommercialSlicing] = useState(true);
  const [commercialCategory, setCommercialCategory] = useState("");

  const [airStartTime, setAirStartTime] = useState("");
  const [airDays, setAirDays] = useState<Weekday[]>([]);
  const [message, setMessage] = useState(
    "Paste one Cloudflare/R2 public URL per line.",
  );

  const lines = useMemo(() => splitInputLines(urls), [urls]);

  const parsedDuration = useMemo(
    () => parseManualDuration(defaultDuration, "seconds"),
    [defaultDuration],
  );

  const parsedSlotLength = useMemo(
    () => parseManualDuration(slotLengthInput, "seconds"),
    [slotLengthInput],
  );

  const parsedBreakpoints = useMemo(
    () => parseBreakpoints(breakpointsInput, parsedDuration),
    [breakpointsInput, parsedDuration],
  );

  const parsedBreakDurations = useMemo(
    () => parseDurationList(breakDurationsInput),
    [breakDurationsInput],
  );

  const validUrls = useMemo(
    () => lines.filter((url) => url.startsWith("https://")),
    [lines],
  );

  const invalidUrls = useMemo(
    () => lines.filter((url) => !url.startsWith("https://")),
    [lines],
  );

  const questionableUrls = useMemo(
    () => validUrls.filter((url) => !isLikelyVideoUrl(url)),
    [validUrls],
  );

  const enabledChannels = useMemo(
    () => sortChannels(channels.filter((channel) => channel.isEnabled !== false)),
    [channels],
  );

  const selectedChannelExists = enabledChannels.some(
    (channel) => channel.id === channelId,
  );

  const defaultSlotLength = useMemo(
    () => getDefaultSlotLengthForDuration(parsedDuration, type),
    [parsedDuration, type],
  );

  const canImport =
    validUrls.length > 0 &&
    parsedDuration > 0 &&
    selectedChannelExists &&
    isValidAirStartTime(airStartTime) &&
    (!fillSlotWithCommercials ||
      !isBroadcastType(type) ||
      parsedSlotLength > parsedDuration);

  const toggleAirDay = (day: Weekday) => {
    setAirDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  };

  const selectEveryDay = () => {
    setAirDays([]);
  };

  const applyCartoonPreset = () => {
    setDefaultDuration("22:00");
    setSlotLengthInput("30:00");
    setBreakpointsInput("7:30, 15:00");
    setBreakDurationsInput("2:00, 2:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setMessage("Applied 30-minute cartoon/anime bulk preset.");
  };

  const applySitcomPreset = () => {
    setDefaultDuration("22:00");
    setSlotLengthInput("30:00");
    setBreakpointsInput("11:00");
    setBreakDurationsInput("3:00");
    setFillSlotWithCommercials(true);
    setCommercialStrategy("best-fit");
    setMessage("Applied 30-minute sitcom bulk preset.");
  };

  const applyCommercialPreset = () => {
    setType("commercial");
    setDefaultDuration("2:00");
    setSlotLengthInput("");
    setBreakpointsInput("");
    setBreakDurationsInput("");
    setFillSlotWithCommercials(false);
    setAllowCommercialSlicing(true);
    setCommercialStrategy("best-fit");
    setMessage("Applied 2-minute commercial bulk preset.");
  };

  const handleTypeChange = (nextType: MediaType) => {
    setType(nextType);

    if (isCommercialType(nextType)) {
      setSlotLengthInput("");
      setBreakpointsInput("");
      setBreakDurationsInput("");
      setFillSlotWithCommercials(false);
      setAllowCommercialSlicing(true);
      return;
    }

    setAllowCommercialSlicing(false);

    if (parsedDuration > 0 && !slotLengthInput.trim()) {
      const nextDefaultSlot = getDefaultSlotLengthForDuration(
        parsedDuration,
        nextType,
      );

      if (nextDefaultSlot) {
        setSlotLengthInput(formatDurationClock(nextDefaultSlot));
      }
    }
  };

  const importAll = () => {
    if (validUrls.length === 0) {
      setMessage("Paste at least one valid https:// URL.");
      return;
    }

    if (!selectedChannelExists) {
      setMessage("Select a valid enabled channel first.");
      return;
    }

    if (parsedDuration <= 0) {
      setMessage("Set a default duration first. Example: 22:00.");
      return;
    }

    if (!isValidAirStartTime(airStartTime)) {
      setMessage("Air time must be HH:mm format, like 16:00.");
      return;
    }

    if (
      isBroadcastType(type) &&
      fillSlotWithCommercials &&
      parsedSlotLength <= parsedDuration
    ) {
      setMessage("Slot length must be longer than runtime. Example: 30:00.");
      return;
    }

    if (invalidUrls.length > 0) {
      const confirmed = window.confirm(
        `${invalidUrls.length} line(s) are not valid https:// URLs and will be skipped. Continue?`,
      );

      if (!confirmed) return;
    }

    if (questionableUrls.length > 0) {
      const confirmed = window.confirm(
        `${questionableUrls.length} URL(s) do not clearly look like supported video files. Import anyway?`,
      );

      if (!confirmed) return;
    }

    const normalizedAirStartTime = normalizeAirStartTime(airStartTime);

    const imported = validUrls.map((url) =>
      createMediaItemFromUrl({
        url,
        type,
        duration: parsedDuration,

        breakpoints: isBroadcastType(type) ? parsedBreakpoints : [],
        breakDurations: isBroadcastType(type) ? parsedBreakDurations : [],
        slotLengthSeconds:
          isBroadcastType(type) && parsedSlotLength > parsedDuration
            ? parsedSlotLength
            : defaultSlotLength,
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
      }),
    );

    imported.forEach((item) => {
      addMedia(item);
      assignMediaToChannel(channelId, item.id);
    });

    setMessage(
      `Imported ${imported.length} item(s) to CH ${channelId}. Default duration: ${formatDuration(
        parsedDuration,
      )}.`,
    );

    setUrls("");
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
          Bulk Importer
        </div>

        <h2 className="mt-1 text-sm font-semibold">Bulk R2 URL Import</h2>

        <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
          Add many videos quickly using one public R2 URL per line. Best for
          loading whole channels, seasons, commercial pools, and bumper packs.
        </p>
      </div>

      <div className="grid gap-3">
        <textarea
          value={urls}
          onChange={(event) => setUrls(event.target.value)}
          rows={8}
          placeholder={`https://pub-xxxx.r2.dev/Friends%20S01E01.mp4\nhttps://pub-xxxx.r2.dev/Friends%20S01E02.mp4`}
          className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
          spellCheck={false}
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />

        <div className="grid gap-3 xl:grid-cols-4">
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
            <option value="commercial">Commercial</option>
            <option value="bumper">Bumper</option>
          </select>

          <select
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
            className="rounded-xl border px-3 py-3 text-base sm:text-sm"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: selectedChannelExists ? "var(--border)" : "#f87171",
              color: "var(--text)",
            }}
          >
            {enabledChannels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                CH {channel.number ?? channel.id} â€¢{" "}
                {channel.branding?.displayName ?? channel.name}
              </option>
            ))}
          </select>

          <input
            value={defaultDuration}
            onChange={(event) =>
              setDefaultDuration(event.target.value.replace(/[^\d:.]/g, ""))
            }
            placeholder="Default runtime, 22:00"
            className="rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: parsedDuration > 0 ? "var(--border)" : "#f87171",
              color: "var(--text)",
            }}
          />

          <input
            value={airStartTime}
            onChange={(event) =>
              setAirStartTime(event.target.value.replace(/[^\d:]/g, ""))
            }
            placeholder="Air time/order, 16:00"
            className="rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: isValidAirStartTime(airStartTime)
                ? "var(--border)"
                : "#f87171",
              color: "var(--text)",
            }}
          />
        </div>

        {isBroadcastType(type) ? (
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
              Bulk Broadcast Slot Settings
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <input
                value={slotLengthInput}
                onChange={(event) =>
                  setSlotLengthInput(event.target.value.replace(/[^\d:.]/g, ""))
                }
                placeholder="Slot length, 30:00"
                className="rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                style={{
                  background: "var(--panel-bg)",
                  borderColor:
                    fillSlotWithCommercials && parsedSlotLength <= parsedDuration
                      ? "#f87171"
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
                placeholder="Breakpoints: 7:30, 15:00"
                className="rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
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
                placeholder="Ad blocks: 2:00, 2:00"
                className="rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={applyCartoonPreset}
                className="rounded-lg px-3 py-3 text-xs font-black uppercase tracking-[0.1em]"
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
                className="rounded-lg px-3 py-3 text-xs font-black uppercase tracking-[0.1em]"
                style={{
                  background: "var(--button-bg)",
                  color: "var(--text)",
                }}
              >
                30m Sitcom
              </button>

              <button
                type="button"
                onClick={() => {
                  setSlotLengthInput("60:00");
                  setBreakpointsInput("12:00, 24:00, 36:00");
                  setBreakDurationsInput("3:00, 3:00, 3:00");
                  setFillSlotWithCommercials(true);
                  setCommercialStrategy("best-fit");
                  setMessage("Applied 60-minute drama bulk preset.");
                }}
                className="rounded-lg px-3 py-3 text-xs font-black uppercase tracking-[0.1em]"
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
                  setCommercialStrategy(event.target.value as CommercialStrategy)
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

        {isCommercialType(type) ? (
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
              Bulk Commercial Pool Settings
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
                <span>Allow commercials to be sliced for exact ad blocks</span>
              </label>

              <input
                value={commercialCategory}
                onChange={(event) => setCommercialCategory(event.target.value)}
                placeholder="Category: general, kids, anime..."
                className="w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
                style={{
                  background: "var(--panel-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />
            </div>

            <div className="mt-2">
              <button
                type="button"
                onClick={applyCommercialPreset}
                className="rounded-lg px-3 py-3 text-xs font-black uppercase tracking-[0.1em]"
                style={{
                  background: "var(--button-bg)",
                  color: "var(--text)",
                }}
              >
                2m Commercial Preset
              </button>
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
              className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.1em]"
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
                    background: active ? "var(--primary)" : "var(--button-bg)",
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
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          URLs: {validUrls.length} valid / {lines.length} total â€¢ Invalid:{" "}
          {invalidUrls.length} â€¢ Questionable: {questionableUrls.length} â€¢
          Duration: {parsedDuration > 0 ? formatDuration(parsedDuration) : "unset"}{" "}
          â€¢ Slot:{" "}
          {parsedSlotLength > 0 ? formatDurationClock(parsedSlotLength) : "none"}{" "}
          â€¢ Breaks: {formatBreakpoints(parsedBreakpoints) || "none"} â€¢ Ads:{" "}
          {formatBreakpoints(parsedBreakDurations) || "auto"}
        </div>

        <button
          type="button"
          onClick={importAll}
          disabled={!canImport}
          className="rounded-xl px-4 py-4 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))",
            color: "var(--text)",
          }}
        >
          Import All
        </button>

        <div
          className="rounded-xl border px-3 py-2 text-xs leading-5"
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

