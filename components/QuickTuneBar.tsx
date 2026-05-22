"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Channel } from "@/lib/types";

function getChannelLabel(channel: Channel | undefined): string {
  if (!channel) {
    return "CH --";
  }

  return `CH ${channel.number ?? channel.id}`;
}

function getChannelName(channel: Channel | undefined): string {
  if (!channel) {
    return "No Channel";
  }

  return channel.branding?.displayName ?? channel.name;
}

function normalizeTuneValue(value: string): string {
  return value.trim().replace(/\D/g, "");
}

function findChannelByTuneValue(
  channels: Channel[],
  tuneValue: string,
): Channel | undefined {
  const normalized = normalizeTuneValue(tuneValue);

  if (!normalized) {
    return undefined;
  }

  const asNumber = Number(normalized);

  return channels.find((channel) => {
    const channelNumber = channel.number ?? Number(channel.id);

    return (
      channel.id === normalized ||
      String(channelNumber) === normalized ||
      String(channelNumber).padStart(2, "0") === normalized ||
      String(channelNumber).padStart(3, "0") === normalized
    );
  });
}

export default function QuickTuneBar() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);

  const [value, setValue] = useState(currentChannelId);
  const [message, setMessage] = useState("");

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

  const currentChannel = useMemo(
    () => channels.find((channel) => channel.id === currentChannelId),
    [channels, currentChannelId],
  );

  useEffect(() => {
    const channel = channels.find((item) => item.id === currentChannelId);

    setValue(String(channel?.number ?? currentChannelId));
  }, [channels, currentChannelId]);

  const handleTune = () => {
    const trimmed = normalizeTuneValue(value);

    if (!trimmed) {
      setMessage("Enter a channel number.");
      return;
    }

    const matchingChannel = findChannelByTuneValue(enabledChannels, trimmed);

    if (!matchingChannel) {
      setMessage(`No enabled channel found for CH ${trimmed}.`);
      return;
    }

    setChannel(matchingChannel.id);
    setMessage(`Tuned to ${getChannelLabel(matchingChannel)}.`);
  };

  return (
    <section
      className="rounded-2xl border p-3 shadow-2xl shadow-black/20"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      aria-label="Quick tune controls"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            Quick Tune
          </div>

          <div
            className="mt-1 truncate text-xs"
            style={{ color: "var(--text-muted)" }}
            title={getChannelName(currentChannel)}
          >
            Current: {getChannelLabel(currentChannel)} •{" "}
            {getChannelName(currentChannel)}
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
          <input
            value={value}
            onChange={(event) => {
              setValue(event.target.value.replace(/\D/g, ""));
              setMessage("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleTune();
              }
            }}
            inputMode="numeric"
            className="w-24 rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
            placeholder="CH #"
            aria-label="Channel number"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />

          <button
            type="button"
            onClick={handleTune}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
            style={{
              background: "var(--button-bg)",
              color: "var(--text)",
            }}
          >
            Tune
          </button>
        </div>
      </div>

      <div className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
        {message || `Available channels: ${enabledChannels.length}`}
      </div>
    </section>
  );
}