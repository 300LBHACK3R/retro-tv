"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Channel } from "@/lib/types";

const QUICK_TUNE_CLEAR_MS = 2200;
const MAX_TUNE_DIGITS = 3;

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
  return value.trim().replace(/\D/g, "").slice(0, MAX_TUNE_DIGITS);
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

      return a.id.localeCompare(b.id);
    });
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
      String(channelNumber).padStart(3, "0") === normalized ||
      (Number.isFinite(asNumber) && Number(channelNumber) === asNumber)
    );
  });
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

function getAvailableChannelSummary(channels: Channel[]): string {
  if (channels.length === 0) {
    return "No enabled channels available.";
  }

  const first = channels[0];
  const last = channels[channels.length - 1];

  return `Available: ${getChannelLabel(first)}–${getChannelLabel(last)} • ${channels.length} channels`;
}

export default function QuickTuneBar() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);

  const [value, setValue] = useState(currentChannelId);
  const [message, setMessage] = useState("");
  const [flashValue, setFlashValue] = useState("");

  const clearTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const enabledChannels = useMemo(() => sortChannels(channels), [channels]);

  const currentChannel = useMemo(
    () => channels.find((channel) => channel.id === currentChannelId),
    [channels, currentChannelId],
  );

  const matchingPreview = useMemo(
    () => findChannelByTuneValue(enabledChannels, value),
    [enabledChannels, value],
  );

  const clearFlashLater = useCallback(() => {
    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current);
    }

    clearTimerRef.current = window.setTimeout(() => {
      setFlashValue("");
      clearTimerRef.current = null;
    }, QUICK_TUNE_CLEAR_MS);
  }, []);

  const handleTune = useCallback(
    (inputValue = value) => {
      const trimmed = normalizeTuneValue(inputValue);

      if (!trimmed) {
        setMessage("Enter a channel number.");
        return;
      }

      const matchingChannel = findChannelByTuneValue(enabledChannels, trimmed);

      if (!matchingChannel) {
        setMessage(`No enabled channel found for CH ${trimmed}.`);
        setFlashValue(trimmed);
        clearFlashLater();
        return;
      }

      setChannel(matchingChannel.id);
      setValue(String(matchingChannel.number ?? matchingChannel.id));
      setMessage(
        `Tuned to ${getChannelLabel(matchingChannel)} • ${getChannelName(
          matchingChannel,
        )}.`,
      );
      setFlashValue(String(matchingChannel.number ?? matchingChannel.id));
      clearFlashLater();
    },
    [clearFlashLater, enabledChannels, setChannel, value],
  );

  useEffect(() => {
    const channel = channels.find((item) => item.id === currentChannelId);

    setValue(String(channel?.number ?? currentChannelId));
  }, [channels, currentChannelId]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        window.clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (/^\d$/.test(event.key)) {
        event.preventDefault();

        setValue((current) => {
          const nextValue = normalizeTuneValue(`${current}${event.key}`);

          setFlashValue(nextValue);
          clearFlashLater();

          return nextValue;
        });

        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();

        setValue((current) => {
          const nextValue = normalizeTuneValue(current.slice(0, -1));
          setFlashValue(nextValue);
          clearFlashLater();
          return nextValue;
        });

        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        handleTune();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [clearFlashLater, handleTune]);

  const availableSummary = getAvailableChannelSummary(enabledChannels);

  return (
    <section
      className="relative overflow-hidden rounded-2xl border p-3 shadow-2xl shadow-black/20 sm:p-4"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.035), transparent 44%), var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      aria-label="Quick tune controls"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--primary)" }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div
            className="text-[11px] font-black uppercase tracking-[0.2em]"
            style={{ color: "var(--primary)" }}
          >
            Quick Tune
          </div>

          <div
            className="mt-1 truncate text-xs"
            style={{ color: "var(--text-muted)" }}
            title={getChannelName(currentChannel)}
          >
            Current:{" "}
            <span style={{ color: "var(--text)" }}>
              {getChannelLabel(currentChannel)}
            </span>{" "}
            • {getChannelName(currentChannel)}
          </div>

          <div
            className="mt-1 text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            {message || availableSummary}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          <div
            className="flex min-w-0 items-center gap-2 rounded-xl border p-2"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-[0.16em]"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              CH
            </div>

            <input
              ref={inputRef}
              value={value}
              onChange={(event) => {
                setValue(normalizeTuneValue(event.target.value));
                setMessage("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleTune();
                }
              }}
              inputMode="numeric"
              className="w-full min-w-0 rounded-lg border px-3 py-3 text-center text-lg font-black outline-none transition focus:ring-2 sm:w-28"
              placeholder="###"
              aria-label="Channel number"
              style={{
                background: "var(--panel-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => handleTune()}
            disabled={enabledChannels.length === 0}
            className="rounded-xl px-5 py-4 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.02] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background:
                "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))",
              color: "var(--text)",
            }}
          >
            Tune
          </button>
        </div>
      </div>

      {matchingPreview ? (
        <div
          className="relative mt-3 rounded-xl border px-3 py-2 text-xs"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          Preview:{" "}
          <span style={{ color: "var(--text)" }}>
            {getChannelLabel(matchingPreview)} • {getChannelName(matchingPreview)}
          </span>
        </div>
      ) : null}

      {flashValue ? (
        <div
          className="pointer-events-none fixed left-1/2 top-20 z-[80] -translate-x-1/2 rounded-2xl border px-6 py-4 text-3xl font-black shadow-2xl backdrop-blur-md"
          style={{
            background: "rgba(0,0,0,0.78)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
          aria-hidden="true"
        >
          CH {flashValue}
        </div>
      ) : null}
    </section>
  );
}