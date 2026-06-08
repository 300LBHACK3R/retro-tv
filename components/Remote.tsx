"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePlayerControls } from "@/lib/playerControls";
import { useStore } from "@/lib/store";
import { cleanDisplayText } from "@/lib/textClean";
import type { Channel, PlayerViewMode } from "@/lib/types";

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

function getViewModeLabel(mode: PlayerViewMode): string {
  if (mode === "mini") return "Mini";
  if (mode === "theater") return "Theater";
  return "Normal";
}

function getNextChannelIndex(
  currentIndex: number,
  channelCount: number,
  direction: "previous" | "next",
): number {
  if (channelCount <= 0) {
    return -1;
  }

  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  if (direction === "previous") {
    return (safeIndex - 1 + channelCount) % channelCount;
  }

  return (safeIndex + 1) % channelCount;
}

function RemoteButton({
  children,
  onClick,
  disabled,
  active = false,
  danger = false,
  ariaLabel,
}: {
  children: React.ReactNode;
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
          ? "rgba(127, 29, 29, 0.86)"
          : active
            ? "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))"
            : "var(--button-bg)",
        border: active ? "1px solid var(--primary)" : "1px solid transparent",
        color: "var(--text)",
        boxShadow: active
          ? "0 0 22px color-mix(in srgb, var(--primary) 22%, transparent)"
          : "none",
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

  const enabledChannels = useMemo(() => sortChannels(channels), [channels]);

  const currentIndex = enabledChannels.findIndex(
    (channel) => channel.id === currentChannelId,
  );

  const currentChannel =
    enabledChannels[currentIndex] ??
    enabledChannels.find((channel) => channel.id === currentChannelId) ??
    enabledChannels[0];

  const goPrev = useCallback(() => {
    const nextIndex = getNextChannelIndex(
      currentIndex,
      enabledChannels.length,
      "previous",
    );

    const nextChannel = enabledChannels[nextIndex];

    if (nextChannel) {
      setChannel(nextChannel.id);
    }
  }, [currentIndex, enabledChannels, setChannel]);

  const goNext = useCallback(() => {
    const nextIndex = getNextChannelIndex(
      currentIndex,
      enabledChannels.length,
      "next",
    );

    const nextChannel = enabledChannels[nextIndex];

    if (nextChannel) {
      setChannel(nextChannel.id);
    }
  }, [currentIndex, enabledChannels, setChannel]);

  const setNormalMode = useCallback(() => {
    setPlayerViewMode("normal");
  }, [setPlayerViewMode]);

  const toggleMiniMode = useCallback(() => {
    setPlayerViewMode(playerViewMode === "mini" ? "normal" : "mini");
  }, [playerViewMode, setPlayerViewMode]);

  const toggleTheaterMode = useCallback(() => {
    setPlayerViewMode(playerViewMode === "theater" ? "normal" : "theater");
  }, [playerViewMode, setPlayerViewMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();

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
        toggleGuide();
        return;
      }

      if (key === "m") {
        event.preventDefault();
        toggleMuted();
        return;
      }

      if (key === "f") {
        event.preventDefault();
        requestFullscreenToggle();
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
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    goNext,
    goPrev,
    requestFullscreenToggle,
    toggleGuide,
    toggleMiniMode,
    toggleMuted,
    toggleRemoteMinimized,
    toggleTheaterMode,
  ]);

  if (remoteMinimized) {
    return (
      <button
        type="button"
        onClick={() => setRemoteMinimized(false)}
        className="fixed bottom-[calc(5.75rem+var(--safe-bottom))] right-3 z-40 rounded-full border px-4 py-3 text-xs font-black uppercase tracking-[0.16em] shadow-2xl backdrop-blur-md transition hover:scale-[1.03] hover:opacity-95 sm:absolute sm:bottom-4 sm:right-4"
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
      className={[
        "fixed inset-x-3 bottom-[calc(5.75rem+var(--safe-bottom))] z-40 max-h-[46vh] overflow-y-auto rounded-2xl border p-3 shadow-2xl shadow-black/50 backdrop-blur-xl",
        "sm:absolute sm:inset-x-auto sm:bottom-4 sm:right-4 sm:max-h-[calc(100%-2rem)] sm:w-[min(430px,calc(100%-2rem))]",
      ].join(" ")}
      style={{
        background:
          "radial-gradient(circle at top right, color-mix(in srgb, var(--primary) 18%, transparent), transparent 34%), linear-gradient(135deg, rgba(0,0,0,0.91), rgba(15,23,42,0.86))",
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
        aria-hidden="true"
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
            className="mt-1 truncate text-[10px] uppercase tracking-[0.14em]"
            style={{ color: "var(--text-muted)" }}
            title={getChannelCallsign(currentChannel)}
          >
            {getChannelCallsign(currentChannel)} / View:{" "}
            {getViewModeLabel(playerViewMode)}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRemoteMinimized(true)}
          className="ttv-touch-target rounded-xl px-3 py-2 text-xs font-black transition hover:scale-[1.03] hover:opacity-95"
          style={{
            background: "var(--button-bg)",
            color: "var(--text)",
          }}
          aria-label="Minimize remote"
        >
          —
        </button>
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

        <RemoteButton onClick={toggleGuide} active={isGuideOpen}>
          {isGuideOpen ? "Close" : "Guide"}
        </RemoteButton>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <RemoteButton onClick={setNormalMode} active={playerViewMode === "normal"}>
          Normal
        </RemoteButton>

        <RemoteButton onClick={toggleMiniMode} active={playerViewMode === "mini"}>
          Mini
        </RemoteButton>

        <RemoteButton
          onClick={toggleTheaterMode}
          active={playerViewMode === "theater"}
        >
          Theater
        </RemoteButton>
      </div>

      <div className="mt-2 grid grid-cols-[auto_1fr_auto_auto] items-center gap-2">
        <RemoteButton onClick={toggleMuted} danger={muted}>
          {muted ? "Muted" : "Mute"}
        </RemoteButton>

        <input
          aria-label="Volume"
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(event) => setVolume(Number(event.target.value) / 100)}
          className="w-full accent-current"
        />

        <RemoteButton onClick={toggleFitMode}>
          {fitMode === "contain" ? "Fit" : "Fill"}
        </RemoteButton>

        <RemoteButton onClick={requestFullscreenToggle}>Full</RemoteButton>
      </div>

      <div
        className="mt-2 text-[10px] leading-4"
        style={{ color: "var(--text-muted)" }}
      >
        Keys: ↑/↓ channel / G guide / M mute / F fullscreen / R remote / P mini
        / T theater
      </div>
    </section>
  );
}