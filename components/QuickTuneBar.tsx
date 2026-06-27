"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Channel } from "@/lib/types";

const QUICK_TUNE_CLEAR_MS = 2200;
const QUICK_TUNE_BUFFER_MS = 1800;
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

      return String(a.id).localeCompare(String(b.id), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

function getChannelNumberValue(channel: Channel): number | null {
  const value = Number(channel.number ?? channel.id);

  return Number.isFinite(value) ? value : null;
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
    const channelNumber = getChannelNumberValue(channel);
    const channelNumberText =
      channelNumber === null ? String(channel.number ?? channel.id) : String(channelNumber);

    return (
      String(channel.id) === normalized ||
      channelNumberText === normalized ||
      channelNumberText.padStart(2, "0") === normalized ||
      channelNumberText.padStart(3, "0") === normalized ||
      (Number.isFinite(asNumber) &&
        channelNumber !== null &&
        channelNumber === asNumber)
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

function getCurrentChannelInputValue(
  channels: Channel[],
  currentChannelId: string,
): string {
  const channel = channels.find((item) => item.id === currentChannelId);

  return String(channel?.number ?? currentChannelId);
}

export default function QuickTuneBar() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);

  const [value, setValue] = useState(() =>
    getCurrentChannelInputValue(channels, currentChannelId),
  );
  const [message, setMessage] = useState("");
  const [flashValue, setFlashValue] = useState("");

  const clearFlashTimerRef = useRef<number | null>(null);
  const bufferTimerRef = useRef<number | null>(null);
  const keyboardBufferRef = useRef("");
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

  const clearFlashTimer = useCallback(() => {
    if (clearFlashTimerRef.current) {
      window.clearTimeout(clearFlashTimerRef.current);
      clearFlashTimerRef.current = null;
    }
  }, []);

  const clearBufferTimer = useCallback(() => {
    if (bufferTimerRef.current) {
      window.clearTimeout(bufferTimerRef.current);
      bufferTimerRef.current = null;
    }
  }, []);

  const clearFlashLater = useCallback(() => {
    clearFlashTimer();

    clearFlashTimerRef.current = window.setTimeout(() => {
      setFlashValue("");
      clearFlashTimerRef.current = null;
    }, QUICK_TUNE_CLEAR_MS);
  }, [clearFlashTimer]);

  const resetKeyboardBufferLater = useCallback(() => {
    clearBufferTimer();

    bufferTimerRef.current = window.setTimeout(() => {
      keyboardBufferRef.current = "";
      bufferTimerRef.current = null;
    }, QUICK_TUNE_BUFFER_MS);
  }, [clearBufferTimer]);

  const clearTuneEntry = useCallback(() => {
    keyboardBufferRef.current = "";
    clearBufferTimer();
    setValue(getCurrentChannelInputValue(channels, currentChannelId));
    setFlashValue("");
    setMessage("");
  }, [channels, clearBufferTimer, currentChannelId]);

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

      const nextValue = String(matchingChannel.number ?? matchingChannel.id);

      keyboardBufferRef.current = "";
      clearBufferTimer();

      setChannel(matchingChannel.id);
      setValue(nextValue);
      setMessage(
        `Tuned to ${getChannelLabel(matchingChannel)} • ${getChannelName(
          matchingChannel,
        )}.`,
      );
      setFlashValue(nextValue);
      clearFlashLater();
    },
    [
      clearBufferTimer,
      clearFlashLater,
      enabledChannels,
      setChannel,
      value,
    ],
  );

  useEffect(() => {
    if (keyboardBufferRef.current) {
      return;
    }

    setValue(getCurrentChannelInputValue(channels, currentChannelId));
  }, [channels, currentChannelId]);

  useEffect(() => {
    return () => {
      clearFlashTimer();
      clearBufferTimer();
    };
  }, [clearBufferTimer, clearFlashTimer]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (/^\d$/.test(event.key)) {
        event.preventDefault();

        const nextValue = normalizeTuneValue(
          `${keyboardBufferRef.current}${event.key}`,
        );

        keyboardBufferRef.current = nextValue;

        setValue(nextValue);
        setMessage("");
        setFlashValue(nextValue);
        clearFlashLater();
        resetKeyboardBufferLater();

        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();

        const nextValue = normalizeTuneValue(
          keyboardBufferRef.current
            ? keyboardBufferRef.current.slice(0, -1)
            : value.slice(0, -1),
        );

        keyboardBufferRef.current = nextValue;

        setValue(nextValue);
        setMessage("");
        setFlashValue(nextValue);
        clearFlashLater();
        resetKeyboardBufferLater();

        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        handleTune(keyboardBufferRef.current || value);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        clearTuneEntry();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    clearFlashLater,
    clearTuneEntry,
    handleTune,
    resetKeyboardBufferLater,
    value,
  ]);

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
                const nextValue = normalizeTuneValue(event.target.value);

                keyboardBufferRef.current = "";
                clearBufferTimer();
                setValue(nextValue);
                setMessage("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleTune(value);
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  clearTuneEntry();
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
            onClick={() => handleTune(value)}
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
      ) : value ? (
        <div
          className="relative mt-3 rounded-xl border px-3 py-2 text-xs"
          style={{
            background: "rgba(248,113,113,0.08)",
            borderColor: "rgba(248,113,113,0.32)",
            color: "#fecaca",
          }}
        >
          No enabled channel matches CH {value}.
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