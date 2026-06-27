"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePlayerControls } from "@/lib/playerControls";
import { useStore } from "@/lib/store";
import type { Channel, PlayerViewMode } from "@/lib/types";

const CHANNEL_ENTRY_AUTO_TUNE_MS = 1150;
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

function getChannelNumberText(channel: Channel | undefined): string {
  if (!channel) {
    return "--";
  }

  return String(channel.number ?? channel.id);
}

function normalizeChannelEntry(value: string): string {
  return value.replace(/\D/g, "").slice(0, MAX_TUNE_DIGITS);
}

function stripLeadingZeros(value: string): string {
  return value.replace(/^0+/, "") || "0";
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

function shouldIgnoreKeyboardShortcut(event: KeyboardEvent): boolean {
  return (
    event.defaultPrevented ||
    isTypingTarget(event.target) ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  );
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

function getViewModeLabel(mode: PlayerViewMode): string {
  if (mode === "mini") return "Mini";
  if (mode === "theater") return "Theater";

  return "Normal";
}

function getFitModeLabel(mode: string): string {
  return mode === "contain" ? "Fit" : "Fill";
}

function getNextFitModeLabel(mode: string): string {
  return mode === "contain" ? "Fill" : "Fit";
}

function getNextChannelIndex(currentIndex: number, channelCount: number): number {
  if (channelCount <= 0) {
    return -1;
  }

  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (safeIndex + 1) % channelCount;
}

function getPreviousChannelIndex(
  currentIndex: number,
  channelCount: number,
): number {
  if (channelCount <= 0) {
    return -1;
  }

  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (safeIndex - 1 + channelCount) % channelCount;
}

function channelMatchesEntry(channel: Channel, entry: string): boolean {
  const cleanEntry = stripLeadingZeros(entry);
  const paddedTwo = cleanEntry.padStart(2, "0");
  const paddedThree = cleanEntry.padStart(3, "0");

  const idText = String(channel.id).trim().toLowerCase();
  const numberText = String(channel.number ?? "").trim();
  const fallbackNumberText = String(Number(channel.id));

  const candidates = new Set<string>([
    idText,
    numberText,
    stripLeadingZeros(numberText),
    numberText.padStart(2, "0"),
    numberText.padStart(3, "0"),
    fallbackNumberText,
    `channel-${cleanEntry}`,
    `ch-${cleanEntry}`,
    `channel-${paddedTwo}`,
    `ch-${paddedTwo}`,
    `channel-${paddedThree}`,
    `ch-${paddedThree}`,
  ]);

  return candidates.has(cleanEntry) || candidates.has(entry.toLowerCase());
}

function findChannelByEntry(
  channels: Channel[],
  entry: string,
): Channel | undefined {
  const cleanEntry = normalizeChannelEntry(entry);

  if (!cleanEntry) {
    return undefined;
  }

  return channels.find((channel) => channelMatchesEntry(channel, cleanEntry));
}

function RemoteButton({
  children,
  onClick,
  disabled,
  active = false,
  danger = false,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="ttv-touch-target rounded-xl px-3 py-3 text-xs font-black uppercase tracking-[0.08em] transition hover:scale-[1.03] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        background: danger
          ? "rgba(127, 29, 29, 0.82)"
          : active
            ? "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))"
            : "var(--button-bg)",
        color: "var(--text)",
      }}
    >
      {children}
    </button>
  );
}

export default function Remote() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);
  const isGuideOpen = useStore((state) => state.isGuideOpen);
  const toggleGuide = useStore((state) => state.toggleGuide);
  const playerViewMode = useStore(
    (state) => state.viewerSettings.playerViewMode,
  );
  const setPlayerViewMode = useStore((state) => state.setPlayerViewMode);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);

  const volume = usePlayerControls((state) => state.volume);
  const muted = usePlayerControls((state) => state.muted);
  const fitMode = usePlayerControls((state) => state.fitMode);
  const remoteMinimized = usePlayerControls((state) => state.remoteMinimized);
  const setVolume = usePlayerControls((state) => state.setVolume);
  const toggleMuted = usePlayerControls((state) => state.toggleMuted);
  const toggleFitMode = usePlayerControls((state) => state.toggleFitMode);
  const requestFullscreenToggle = usePlayerControls(
    (state) => state.requestFullscreenToggle,
  );
  const setRemoteMinimized = usePlayerControls(
    (state) => state.setRemoteMinimized,
  );
  const toggleRemoteMinimized = usePlayerControls(
    (state) => state.toggleRemoteMinimized,
  );

  const [channelEntry, setChannelEntry] = useState("");
  const [statusMessage, setStatusMessage] = useState("Remote ready.");

  const enabledChannels = useMemo(() => sortChannels(channels), [channels]);

  const currentIndex = enabledChannels.findIndex(
    (channel) => channel.id === currentChannelId,
  );

  const currentChannel =
    enabledChannels[currentIndex] ??
    enabledChannels.find((channel) => channel.id === currentChannelId) ??
    enabledChannels[0];

  const tuneChannelEntry = useCallback(
    (entry: string) => {
      const cleanEntry = normalizeChannelEntry(entry);

      if (!cleanEntry) {
        setStatusMessage("Enter a channel number.");
        setChannelEntry("");
        return;
      }

      const targetChannel = findChannelByEntry(enabledChannels, cleanEntry);

      if (!targetChannel) {
        setStatusMessage(`No channel found for CH ${cleanEntry}.`);
        setChannelEntry("");
        return;
      }

      setChannel(targetChannel.id);
      setStatusMessage(`${getChannelLabel(targetChannel)} tuned.`);
      setChannelEntry("");
    },
    [enabledChannels, setChannel],
  );

  const appendChannelDigit = useCallback((digit: string) => {
    setChannelEntry((current) => {
      const next = normalizeChannelEntry(`${current}${digit}`);

      setStatusMessage(`Tune CH ${next}`);

      return next;
    });
  }, []);

  const clearChannelEntry = useCallback(() => {
    setChannelEntry("");
    setStatusMessage("Channel entry cleared.");
  }, []);

  const goPrev = useCallback(() => {
    const nextIndex = getPreviousChannelIndex(
      currentIndex,
      enabledChannels.length,
    );

    const nextChannel = enabledChannels[nextIndex];

    if (nextChannel) {
      setChannel(nextChannel.id);
      setStatusMessage(`${getChannelLabel(nextChannel)} tuned.`);
      setChannelEntry("");
    }
  }, [currentIndex, enabledChannels, setChannel]);

  const goNext = useCallback(() => {
    const nextIndex = getNextChannelIndex(currentIndex, enabledChannels.length);
    const nextChannel = enabledChannels[nextIndex];

    if (nextChannel) {
      setChannel(nextChannel.id);
      setStatusMessage(`${getChannelLabel(nextChannel)} tuned.`);
      setChannelEntry("");
    }
  }, [currentIndex, enabledChannels, setChannel]);

  const setNormalMode = useCallback(() => {
    setPlayerViewMode("normal");
    setStatusMessage("Normal view active.");
  }, [setPlayerViewMode]);

  const toggleMiniMode = useCallback(() => {
    const nextMode = playerViewMode === "mini" ? "normal" : "mini";

    setPlayerViewMode(nextMode);
    setStatusMessage(`${getViewModeLabel(nextMode)} view active.`);
  }, [playerViewMode, setPlayerViewMode]);

  const toggleTheaterMode = useCallback(() => {
    const nextMode = playerViewMode === "theater" ? "normal" : "theater";

    setPlayerViewMode(nextMode);
    setStatusMessage(`${getViewModeLabel(nextMode)} view active.`);
  }, [playerViewMode, setPlayerViewMode]);

  const toggleGuideMode = useCallback(() => {
    toggleGuide();
    setStatusMessage(isGuideOpen ? "Guide closed." : "Guide opened.");
  }, [isGuideOpen, toggleGuide]);

  const toggleMuteMode = useCallback(() => {
    toggleMuted();
    setStatusMessage(muted ? "Audio unmuted." : "Audio muted.");
  }, [muted, toggleMuted]);

  const toggleFitModeWithStatus = useCallback(() => {
    const nextLabel = getNextFitModeLabel(fitMode);

    toggleFitMode();
    setStatusMessage(`Video ${nextLabel} mode active.`);
  }, [fitMode, toggleFitMode]);

  const toggleFullscreenWithStatus = useCallback(() => {
    requestFullscreenToggle();
    setStatusMessage("Fullscreen toggled.");
  }, [requestFullscreenToggle]);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
    setStatusMessage("Settings opened.");
  }, [setSettingsOpen]);

  useEffect(() => {
    if (!channelEntry) {
      return;
    }

    const timer = window.setTimeout(() => {
      tuneChannelEntry(channelEntry);
    }, CHANNEL_ENTRY_AUTO_TUNE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [channelEntry, tuneChannelEntry]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyboardShortcut(event)) return;

      const key = event.key.toLowerCase();

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        appendChannelDigit(event.key);
        return;
      }

      if (event.key === "Enter" && channelEntry) {
        event.preventDefault();
        tuneChannelEntry(channelEntry);
        return;
      }

      if (event.key === "Escape" && channelEntry) {
        event.preventDefault();
        clearChannelEntry();
        return;
      }

      if (event.key === "Backspace" && channelEntry) {
        event.preventDefault();

        setChannelEntry((current) => {
          const next = normalizeChannelEntry(current.slice(0, -1));

          setStatusMessage(next ? `Tune CH ${next}` : "Channel entry cleared.");

          return next;
        });

        return;
      }

      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        goNext();
        return;
      }

      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        goPrev();
        return;
      }

      if (key === "g") {
        event.preventDefault();
        toggleGuideMode();
        return;
      }

      if (key === "m") {
        event.preventDefault();
        toggleMuteMode();
        return;
      }

      if (key === "f") {
        event.preventDefault();
        toggleFullscreenWithStatus();
        return;
      }

      if (key === "r") {
        event.preventDefault();
        toggleRemoteMinimized();
        return;
      }

      if (key === "p") {
        event.preventDefault();
        toggleMiniMode();
        return;
      }

      if (key === "t") {
        event.preventDefault();
        toggleTheaterMode();
        return;
      }

      if (key === "s") {
        event.preventDefault();
        openSettings();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    appendChannelDigit,
    channelEntry,
    clearChannelEntry,
    goNext,
    goPrev,
    openSettings,
    toggleFullscreenWithStatus,
    toggleGuideMode,
    toggleMiniMode,
    toggleMuteMode,
    toggleRemoteMinimized,
    toggleTheaterMode,
    tuneChannelEntry,
  ]);

  if (remoteMinimized) {
    return (
      <button
        type="button"
        onClick={() => setRemoteMinimized(false)}
        className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-[max(0.75rem,env(safe-area-inset-right))] z-40 rounded-full border px-4 py-3 text-xs font-black uppercase tracking-[0.16em] shadow-2xl backdrop-blur-md transition hover:scale-[1.03] hover:opacity-95 sm:absolute sm:bottom-4 sm:right-4"
        style={{
          background: "rgba(0,0,0,0.78)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        Remote
      </button>
    );
  }

  return (
    <section
      className="
        fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 max-h-[64vh] overflow-y-auto rounded-2xl border p-3 shadow-2xl shadow-black/50 backdrop-blur-xl
        sm:absolute sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-h-[calc(100%-2rem)] sm:w-[min(440px,calc(100%-2rem))]
      "
      style={{
        background:
          "radial-gradient(circle at top right, rgba(212,175,55,0.13), transparent 34%), linear-gradient(135deg, rgba(0,0,0,0.92), rgba(18,18,18,0.84))",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      aria-label="On-screen remote"
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--primary), transparent)",
        }}
      />

      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-[10px] font-black uppercase tracking-[0.22em]"
            style={{ color: "var(--primary)" }}
          >
            Remote
          </div>

          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <div className="text-sm font-black tracking-tight">
              {getChannelLabel(currentChannel)}
            </div>

            <div
              className="max-w-[14rem] truncate text-xs"
              style={{ color: "var(--text-muted)" }}
              title={getChannelName(currentChannel)}
            >
              {getChannelName(currentChannel)}
            </div>
          </div>

          <div
            className="mt-1 text-[10px] uppercase tracking-[0.14em]"
            style={{ color: "var(--text-muted)" }}
          >
            View: {getViewModeLabel(playerViewMode)}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={openSettings}
            className="rounded-xl px-3 py-2 text-xs font-black transition hover:scale-[1.03] hover:opacity-95"
            style={{
              background: "var(--button-bg)",
              color: "var(--text)",
            }}
            aria-label="Open settings"
          >
            ⚙
          </button>

          <button
            type="button"
            onClick={() => setRemoteMinimized(true)}
            className="rounded-xl px-3 py-2 text-xs font-black transition hover:scale-[1.03] hover:opacity-95"
            style={{
              background: "var(--button-bg)",
              color: "var(--text)",
            }}
            aria-label="Minimize remote"
          >
            —
          </button>
        </div>
      </div>

      <div
        className="mb-2 rounded-2xl border px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.045)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div
              className="text-[10px] font-black uppercase tracking-[0.16em]"
              style={{ color: "var(--text-muted)" }}
            >
              Channel Entry
            </div>

            <div className="mt-1 text-lg font-black tabular-nums tracking-[0.12em]">
              {channelEntry || getChannelNumberText(currentChannel)}
            </div>
          </div>

          <div
            className="max-w-[12rem] truncate text-right text-[11px]"
            style={{ color: "var(--text-muted)" }}
            aria-live="polite"
          >
            {statusMessage}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <RemoteButton
          onClick={goPrev}
          disabled={enabledChannels.length === 0}
          ariaLabel="Previous channel"
        >
          CH-
        </RemoteButton>

        <RemoteButton
          onClick={goNext}
          disabled={enabledChannels.length === 0}
          ariaLabel="Next channel"
        >
          CH+
        </RemoteButton>

        <RemoteButton
          onClick={toggleGuideMode}
          active={isGuideOpen}
          ariaLabel={isGuideOpen ? "Close guide" : "Open guide"}
        >
          {isGuideOpen ? "Close" : "Guide"}
        </RemoteButton>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <RemoteButton
          onClick={setNormalMode}
          active={playerViewMode === "normal"}
        >
          Normal
        </RemoteButton>

        <RemoteButton
          onClick={toggleMiniMode}
          active={playerViewMode === "mini"}
        >
          Mini
        </RemoteButton>

        <RemoteButton
          onClick={toggleTheaterMode}
          active={playerViewMode === "theater"}
        >
          Theater
        </RemoteButton>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <RemoteButton
            key={digit}
            onClick={() => appendChannelDigit(digit)}
            ariaLabel={`Enter channel digit ${digit}`}
          >
            {digit}
          </RemoteButton>
        ))}

        <RemoteButton onClick={clearChannelEntry}>Clear</RemoteButton>

        <RemoteButton
          onClick={() => appendChannelDigit("0")}
          ariaLabel="Enter channel digit 0"
        >
          0
        </RemoteButton>

        <RemoteButton
          onClick={() => {
            if (channelEntry) {
              tuneChannelEntry(channelEntry);
            }
          }}
          disabled={!channelEntry}
        >
          Enter
        </RemoteButton>
      </div>

      <div className="mt-2 grid grid-cols-[auto_1fr_auto_auto] items-center gap-2">
        <RemoteButton onClick={toggleMuteMode} danger={muted}>
          {muted ? "Muted" : "Mute"}
        </RemoteButton>

        <input
          aria-label="Volume"
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(event) => {
            const nextVolume = Number(event.target.value) / 100;

            setVolume(nextVolume);
            setStatusMessage(`Volume ${Math.round(nextVolume * 100)}%.`);
          }}
          className="w-full accent-current"
        />

        <RemoteButton onClick={toggleFitModeWithStatus}>
          {getFitModeLabel(fitMode)}
        </RemoteButton>

        <RemoteButton onClick={toggleFullscreenWithStatus}>Full</RemoteButton>
      </div>

      <div
        className="mt-2 text-[10px] leading-4"
        style={{ color: "var(--text-muted)" }}
      >
        Keys: 0–9 direct tune • Enter tune • Esc clear • ↑/↓ channel • G guide • M mute • F fullscreen • R remote • P mini • T theater • S settings
      </div>
    </section>
  );
}