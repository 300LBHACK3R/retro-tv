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
import type { CommercialStrategy, MediaType, Weekday } from "@/lib/types";

type ImportPreset = "cartoon" | "sitcom" | "drama" | "commercial";

type ImportSummary = {
  totalLines: number;
  validUrls: number;
  invalidUrls: number;
  questionableUrls: number;
  duplicateLines: number;
};

const DEFAULT_BROADCAST_DURATION = "22:00";
const DEFAULT_BROADCAST_SLOT = "30:00";
const DEFAULT_CARTOON_BREAKPOINTS = "7:30, 15:00";
const DEFAULT_CARTOON_BREAK_DURATIONS = "2:00, 2:00";

function normalizeInputLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => normalizeUrl(line))
    .filter(Boolean);
}

function splitInputLines(value: string): string[] {
  return Array.from(new Set(normalizeInputLines(value)));
}

function countDuplicateLines(value: string): number {
  const lines = normalizeInputLines(value);
  return Math.max(0, lines.length - new Set(lines).size);
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

function getChannelOptionLabel(channel: {
  id: string;
  number?: number;
  name: string;
  branding?: { displayName?: string };
}): string {
  return `CH ${channel.number ?? channel.id} / ${
    channel.branding?.displayName ?? channel.name
  }`;
}

function getTypeLabel(type: MediaType): string {
  if (type === "show") return "Shows";
  if (type === "movie") return "Movies";
  if (type === "commercial") return "Commercials";
  return "Bumpers";
}

function createSummary(
  totalLines: number,
  validUrls: number,
  invalidUrls: number,
  questionableUrls: number,
  duplicateLines: number,
): ImportSummary {
  return {
    totalLines,
    validUrls,
    invalidUrls,
    questionableUrls,
    duplicateLines,
  };
}

function SummaryPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "good" | "warn" | "danger";
}) {
  const color =
    tone === "good"
      ? "#86efac"
      : tone === "warn"
        ? "#fde68a"
        : tone === "danger"
          ? "#fecaca"
          : "var(--text)";

  return (
    <div
      className="rounded-2xl border px-3 py-2"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
      }}
    >
      <div className="text-base font-black" style={{ color }}>
        {value}
      </div>
      <div
        className="text-[10px] font-black uppercase tracking-[0.14em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
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

export default function BulkImporterPanel() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const addMedia = useStore((state) => state.addMedia);
  const assignMediaToChannel = useStore((state) => state.assignMediaToChannel);

  const [urls, setUrls] = useState("");
  const [type, setType] = useState<MediaType>("show");
  const [channelId, setChannelId] = useState(currentChannelId);

  const [defaultDuration, setDefaultDuration] = useState(DEFAULT_BROADCAST_DURATION);
  const [slotLengthInput, setSlotLengthInput] = useState(DEFAULT_BROADCAST_SLOT);
  const [breakpointsInput, setBreakpointsInput] = useState(
    DEFAULT_CARTOON_BREAKPOINTS,
  );
  const [breakDurationsInput, setBreakDurationsInput] = useState(
    DEFAULT_CARTOON_BREAK_DURATIONS,
  );
  const [fillSlotWithCommercials, setFillSlotWithCommercials] = useState(true);
  const [commercialStrategy, setCommercialStrategy] =
    useState<CommercialStrategy>("best-fit");

  const [allowCommercialSlicing, setAllowCommercialSlicing] = useState(true);
  const [commercialCategory, setCommercialCategory] = useState("");

  const [airStartTime, setAirStartTime] = useState("");
  const [airDays, setAirDays] = useState<Weekday[]>([]);
  const [message, setMessage] = useState(
    "Paste one Cloudflare/R2 public video URL per line.",
  );

  const rawLineCount = useMemo(() => normalizeInputLines(urls).length, [urls]);
  const duplicateLineCount = useMemo(() => countDuplicateLines(urls), [urls]);
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

  const importSummary = useMemo(
    () =>
      createSummary(
        rawLineCount,
        validUrls.length,
        invalidUrls.length,
        questionableUrls.length,
        duplicateLineCount,
      ),
    [
      duplicateLineCount,
      invalidUrls.length,
      questionableUrls.length,
      rawLineCount,
      validUrls.length,
    ],
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

  const clearForm = () => {
    setUrls("");
    setMessage("Cleared bulk URL list.");
  };

  const applyPreset = (preset: ImportPreset) => {
    if (preset === "cartoon") {
      setType("show");
      setDefaultDuration("22:00");
      setSlotLengthInput("30:00");
      setBreakpointsInput("7:30, 15:00");
      setBreakDurationsInput("2:00, 2:00");
      setFillSlotWithCommercials(true);
      setAllowCommercialSlicing(false);
      setCommercialStrategy("best-fit");
      setMessage("Applied 30-minute cartoon/anime bulk preset.");
      return;
    }

    if (preset === "sitcom") {
      setType("show");
      setDefaultDuration("22:00");
      setSlotLengthInput("30:00");
      setBreakpointsInput("11:00");
      setBreakDurationsInput("3:00");
      setFillSlotWithCommercials(true);
      setAllowCommercialSlicing(false);
      setCommercialStrategy("best-fit");
      setMessage("Applied 30-minute sitcom bulk preset.");
      return;
    }

    if (preset === "drama") {
      setType("show");
      setDefaultDuration("45:00");
      setSlotLengthInput("60:00");
      setBreakpointsInput("12:00, 24:00, 36:00");
      setBreakDurationsInput("3:00, 3:00, 3:00");
      setFillSlotWithCommercials(true);
      setAllowCommercialSlicing(false);
      setCommercialStrategy("best-fit");
      setMessage("Applied 60-minute drama bulk preset.");
      return;
    }

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
      setMessage(`${getTypeLabel(nextType)} mode selected.`);
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

    setMessage(`${getTypeLabel(nextType)} mode selected.`);
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
      setMessage("Air time must use HH:mm format, like 16:00.");
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
    const cleanCommercialCategory = sanitizeCommercialCategory(commercialCategory);

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
          ? cleanCommercialCategory
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
      `Imported ${imported.length} ${getTypeLabel(type).toLowerCase()} to CH ${channelId}. Runtime: ${formatDuration(
        parsedDuration,
      )}.`,
    );

    setUrls("");
  };

  return (
    <section
      className="ttv-glass-panel rounded-2xl p-3 sm:p-4"
      style={{
        color: "var(--text)",
      }}
    >
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div
            className="text-xs font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--primary)" }}
          >
            Bulk Importer
          </div>

          <h2 className="mt-1 text-base font-black tracking-tight">
            Bulk R2 URL Import
          </h2>

          <p
            className="mt-1 max-w-3xl text-xs leading-5"
            style={{ color: "var(--text-muted)" }}
          >
            Add many videos quickly using one public R2 URL per line. Best for
            loading full seasons, complete channels, commercial pools, and
            bumper packs.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <PresetButton label="30m Cartoon" onClick={() => applyPreset("cartoon")} />
          <PresetButton label="30m Sitcom" onClick={() => applyPreset("sitcom")} />
          <PresetButton label="60m Drama" onClick={() => applyPreset("drama")} />
          <PresetButton label="2m Ads" onClick={() => applyPreset("commercial")} />
        </div>
      </div>

      <div className="grid gap-3">
        <div
          className="grid gap-2 rounded-2xl border p-3 sm:grid-cols-5"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
          }}
        >
          <SummaryPill label="Lines" value={importSummary.totalLines} />
          <SummaryPill label="Valid" value={importSummary.validUrls} tone="good" />
          <SummaryPill
            label="Invalid"
            value={importSummary.invalidUrls}
            tone={importSummary.invalidUrls > 0 ? "danger" : "default"}
          />
          <SummaryPill
            label="Questionable"
            value={importSummary.questionableUrls}
            tone={importSummary.questionableUrls > 0 ? "warn" : "default"}
          />
          <SummaryPill
            label="Duplicates"
            value={importSummary.duplicateLines}
            tone={importSummary.duplicateLines > 0 ? "warn" : "default"}
          />
        </div>

        <textarea
          value={urls}
          onChange={(event) => setUrls(event.target.value)}
          rows={9}
          placeholder={`https://pub-xxxx.r2.dev/Friends%20S01E01.mp4\nhttps://pub-xxxx.r2.dev/Friends%20S01E02.mp4\nhttps://pub-xxxx.r2.dev/Friends%20S01E03.mp4`}
          className="w-full rounded-2xl border px-3 py-3 text-base outline-none sm:text-sm"
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
                {getChannelOptionLabel(channel)}
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
              Broadcast Slot Settings
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
                <span>Allow slicing for exact ad blocks</span>
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
          className="rounded-2xl border px-3 py-3 text-xs leading-5"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          <span style={{ color: "var(--text)" }}>Import Summary:</span>{" "}
          {validUrls.length} valid / {lines.length} unique URLs • Invalid:{" "}
          {invalidUrls.length} • Questionable: {questionableUrls.length} •
          Duplicates removed: {duplicateLineCount} • Duration:{" "}
          {parsedDuration > 0 ? formatDuration(parsedDuration) : "unset"} •
          Slot:{" "}
          {parsedSlotLength > 0 ? formatDurationClock(parsedSlotLength) : "none"}{" "}
          • Breaks: {formatBreakpoints(parsedBreakpoints) || "none"} • Ads:{" "}
          {formatBreakpoints(parsedBreakDurations) || "auto"}
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <button
            type="button"
            onClick={importAll}
            disabled={!canImport}
            className="ttv-touch-target rounded-xl px-4 py-4 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background:
                "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))",
              color: "var(--text)",
            }}
          >
            Import All
          </button>

          <button
            type="button"
            onClick={clearForm}
            disabled={!urls.trim()}
            className="ttv-action-button ttv-touch-target rounded-xl px-4 py-4 text-sm font-black uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Clear
          </button>
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