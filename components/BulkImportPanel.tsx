"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  createMediaItemFromUrl,
  formatBreakpoints,
  formatDuration,
  isLikelyVideoUrl,
  normalizeUrl,
  parseBreakpoints,
  parseManualDuration,
  WEEKDAYS,
} from "@/lib/mediaAdmin";
import type { MediaType, Weekday } from "@/lib/types";

function splitInputLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => normalizeUrl(line))
    .filter(Boolean);
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
  const [breakpointsInput, setBreakpointsInput] = useState("");
  const [airStartTime, setAirStartTime] = useState("");
  const [airDays, setAirDays] = useState<Weekday[]>([]);
  const [message, setMessage] = useState(
    "Paste one Cloudflare/R2 public URL per line.",
  );

  const lines = useMemo(() => splitInputLines(urls), [urls]);
  const parsedDuration = useMemo(
    () => parseManualDuration(defaultDuration),
    [defaultDuration],
  );
  const parsedBreakpoints = useMemo(
    () => parseBreakpoints(breakpointsInput, parsedDuration),
    [breakpointsInput, parsedDuration],
  );

  const validUrls = useMemo(
    () => lines.filter((url) => url.startsWith("https://")),
    [lines],
  );

  const questionableUrls = useMemo(
    () => validUrls.filter((url) => !isLikelyVideoUrl(url)),
    [validUrls],
  );

  const enabledChannels = useMemo(
    () =>
      channels
        .filter((channel) => channel.isEnabled !== false)
        .sort((a, b) => Number(a.number ?? a.id) - Number(b.number ?? b.id)),
    [channels],
  );

  const toggleAirDay = (day: Weekday) => {
    setAirDays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  };

  const importAll = () => {
    if (validUrls.length === 0) {
      setMessage("Paste at least one valid https:// URL.");
      return;
    }

    if (parsedDuration <= 0) {
      setMessage("Set a default duration first. Example: 22:00.");
      return;
    }

    if (questionableUrls.length > 0) {
      const confirmed = window.confirm(
        `${questionableUrls.length} URL(s) do not clearly look like supported video files. Import anyway?`,
      );

      if (!confirmed) return;
    }

    const imported = validUrls.map((url) =>
      createMediaItemFromUrl({
        url,
        type,
        duration: parsedDuration,
        breakpoints: parsedBreakpoints,
        airDays,
        airStartTime,
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
          Bulk Importer
        </div>
        <h2 className="mt-1 text-sm font-semibold">Bulk R2 URL Import</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Add many videos quickly using one public URL per line.
        </p>
      </div>

      <div className="grid gap-3">
        <textarea
          value={urls}
          onChange={(event) => setUrls(event.target.value)}
          rows={8}
          placeholder={`https://pub-xxxx.r2.dev/Friends%20S01E01.mp4\nhttps://pub-xxxx.r2.dev/Friends%20S01E02.mp4`}
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
          spellCheck={false}
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />

        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={type}
            onChange={(event) => setType(event.target.value as MediaType)}
            className="rounded-lg border px-3 py-2 text-sm"
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
            className="rounded-lg border px-3 py-2 text-sm"
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

          <input
            value={defaultDuration}
            onChange={(event) =>
              setDefaultDuration(event.target.value.replace(/[^\d:.]/g, ""))
            }
            placeholder="Default duration, 22:00"
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />

          <input
            value={airStartTime}
            onChange={(event) =>
              setAirStartTime(event.target.value.replace(/[^\d:]/g, ""))
            }
            placeholder="Air time, 16:00"
            className="rounded-lg border px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        <input
          value={breakpointsInput}
          onChange={(event) =>
            setBreakpointsInput(event.target.value.replace(/[^\d:.,\s]/g, ""))
          }
          placeholder="Optional commercial breakpoints: 08:00, 16:00"
          className="rounded-lg border px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />

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
          className="rounded-xl border px-3 py-2 text-xs"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          URLs: {validUrls.length} • Questionable: {questionableUrls.length} •
          Duration: {parsedDuration > 0 ? formatDuration(parsedDuration) : "unset"}{" "}
          • Breaks: {formatBreakpoints(parsedBreakpoints) || "none"}
        </div>

        <button
          type="button"
          onClick={importAll}
          className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.01]"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))",
            color: "var(--text)",
          }}
        >
          Import All
        </button>

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