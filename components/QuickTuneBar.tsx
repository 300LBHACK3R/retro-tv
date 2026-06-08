"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { cleanDisplayText } from "@/lib/textClean";
import type { Channel } from "@/lib/types";

const QUICK_TUNE_CLEAR_MS = 2200;
const KEYSTROKE_COMMIT_MS = 900;
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

  return cleanDisplayText(channel.branding?.displayName ?? channel.name);
}

function getChannelCallsign(channel: Channel | undefined): string {
  if (!channel) {
    return "LIVE";
  }

  return cleanDisplayText(channel.branding?.callsign || channel.name || "LIVE");
}

function normalizeTuneValue(value: string): string {
  return value.trim().replace(/\D/g, "").slice(0, MAX_TUNE_DIGITS);
}

function getChannelNumberString(channel: Channel | undefined): string {
  if (!channel) {
    return "";
  }

  return String(channel.number ?? channel.id);
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
    const channelNumberString = String(channelNumber);

    return (
      channel.id === normalized ||
      channelNumberString === normalized ||
      channelNumberString.padStart(2, "0") === normalized ||
      channelNumberString.padStart(3, "0") === normalized ||
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

  return `Available: ${getChannelLabel(first)} to ${getChannelLabel(last)} / ${
    channels.length
  } channels`;
}

function getTunePreviewLabel(channel: Channel | undefined): string {
  if (!channel) {
    return "No matching channel";
  }

  return `${getChannelLabel(channel)} / ${getChannelName(channel)}`;
}

function clearTimer(timerRef: React.MutableRefObject<number | null>): void {
  if (timerRef.current) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

export default function QuickTuneBar() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);

  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [flashValue, setFlashValue] = useState("");
  const [isManualEditing, setIsManualEditing] = useState(false);

  const clearTimerRef = useRef<number | null>(null);
  const commitTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const enabledChannels = useMemo(() => sortChannels(channels), [channels]);

  const currentChannel = useMemo(
    () => channels.find((channel) => channel.id === currentChannelId),
    [channels, currentChannelId],
  );

  const displayValue = value || getChannelNumberString(currentChannel);

  const matchingPreview = useMemo(
    () => findChannelByTuneValue(enabledChannels, displayValue),
    [displayValue, enabledChannels],
  );

  const clearFlashLater = useCallback(() => {
    clearTimer(clearTimerRef);

    clearTimerRef.current = window.setTimeout(() => {
      setFlashValue("");
      clearTimerRef.current = null;
    }, QUICK_TUNE_CLEAR_MS);
  }, []);

  const resetToCurrentChannel = useCallback(() => {
    setValue("");
    setIsManualEditing(false);
    setMessage("");
  }, []);

  const handleTune = useCallback(
    (inputValue = displayValue) => {
      const trimmed = normalizeTuneValue(inputValue);

      clearTimer(commitTimerRef);

      if (!trimmed) {
        setMessage("Enter a channel number.");
        return;
      }

      const matchingChannel = findChannelByTuneValue(enabledChannels, trimmed);

      if (!matchingChannel) {
        setMessage(`No enabled channel found for CH ${trimmed}.`);
        setFlashValue(trimmed);
        setIsManualEditing(false);
        clearFlashLater();
        return;
      }

      setChannel(matchingChannel.id);
      setValue("");
      setIsManualEditing(false);
      setMessage(
        `Tuned to ${getChannelLabel(matchingChannel)} / ${getChannelName(
          matchingChannel,
        )}.`,
      );
      setFlashValue(getChannelNumberString(matchingChannel));
      clearFlashLater();
    },
    [clearFlashLater, displayValue, enabledChannels, setChannel],
  );

  const queueKeyboardCommit = useCallback(
    (nextValue: string) => {
      clearTimer(commitTimerRef);

      commitTimerRef.current = window.setTimeout(() => {
        handleTune(nextValue);
      }, KEYSTROKE_COMMIT_MS);
    },
    [handleTune],
  );

  const appendTuneDigit = useCallback(
    (digit: string) => {
      setValue((current) => {
        const baseValue = isManualEditing ? current : "";
        const nextValue = normalizeTuneValue(`${baseValue}${digit}`);

        setIsManualEditing(true);
        setFlashValue(nextValue);
        setMessage("");
        clearFlashLater();

        if (nextValue.length >= MAX_TUNE_DIGITS) {
          window.setTimeout(() => handleTune(nextValue), 0);
        } else {
          queueKeyboardCommit(nextValue);
        }

        return nextValue;
      });
    },
    [clearFlashLater, handleTune, isManualEditing, queueKeyboardCommit],
  );

  useEffect(() => {
    if (!isManualEditing) {
      setValue("");
    }
  }, [currentChannelId, isManualEditing]);

  useEffect(() => {
    return () => {
      clearTimer(clearTimerRef);
      clearTimer(commitTimerRef);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        appendTuneDigit(event.key);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();

        setValue((current) => {
          const nextValue = normalizeTuneValue(current.slice(0, -1));

          setIsManualEditing(Boolean(nextValue));
          setFlashValue(nextValue);
          setMessage("");
          clearFlashLater();

          if (nextValue) {
            queueKeyboardCommit(nextValue);
          } else {
            clearTimer(commitTimerRef);
          }

          return nextValue;
        });

        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        clearTimer(commitTimerRef);
        resetToCurrentChannel();
        setFlashValue("");
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
  }, [
    appendTuneDigit,
    clearFlashLater,
    handleTune,
    queueKeyboardCommit,
    resetToCurrentChannel,
  ]);

  const availableSummary = getAvailableChannelSummary(enabledChannels);
  const hasEnabledChannels = enabledChannels.length > 0;

  return (
    <section
      className="ttv-glass-panel-strong relative overflow-hidden rounded-2xl p-3 shadow-2xl shadow-black/20 sm:p-4"
      style={{
        color: "var(--text)",
      }}
      aria-label="Quick tune controls"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--primary)" }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--primary), transparent)",
        }}
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
            / {getChannelName(currentChannel)}
          </div>

          <div
            className="mt-1 truncate text-[11px]"
            style={{ color: "var(--text-muted)" }}
            title={message || availableSummary}
          >
            {message || availableSummary}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          <div
            className="flex min-w-0 items-center gap-2 rounded-2xl border p-2"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.16em]"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
              }}
            >
              CH
            </div>

            <input
              ref={inputRef}
              value={displayValue}
              onFocus={() => {
                setIsManualEditing(true);
                setValue("");
              }}
              onBlur={() => {
                if (!value) {
                  setIsManualEditing(false);
                }
              }}
              onChange={(event) => {
                const nextValue = normalizeTuneValue(event.target.value);

                setValue(nextValue);
                setIsManualEditing(true);
                setMessage("");
                setFlashValue(nextValue);
                clearFlashLater();

                if (nextValue.length >= MAX_TUNE_DIGITS) {
                  handleTune(nextValue);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleTune();
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  resetToCurrentChannel();
                  inputRef.current?.blur();
                }
              }}
              inputMode="numeric"
              className="w-full min-w-0 rounded-xl border px-3 py-3 text-center text-lg font-black outline-none transition focus:ring-2 sm:w-28"
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
            disabled={!hasEnabledChannels}
            className="ttv-touch-target rounded-xl px-5 py-4 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.02] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background:
                "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))",
              color: "var(--text)",
            }}
          >
            Tune
          </button>
        </div>
      </div>

      {matchingPreview && isManualEditing ? (
        <div
          className="relative mt-3 rounded-2xl border px-3 py-2 text-xs"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          Preview:{" "}
          <span style={{ color: "var(--text)" }}>
            {getTunePreviewLabel(matchingPreview)}
          </span>{" "}
          <span style={{ color: "var(--text-muted)" }}>
            / {getChannelCallsign(matchingPreview)}
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