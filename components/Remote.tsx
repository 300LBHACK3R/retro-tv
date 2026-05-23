"use client";

import { useEffect, useMemo } from "react";
import { usePlayerControls } from "@/lib/playerControls";
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

export default function Remote() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);
  const isGuideOpen = useStore((state) => state.isGuideOpen);
  const toggleGuide = useStore((state) => state.toggleGuide);

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

  const currentIndex = enabledChannels.findIndex(
    (channel) => channel.id === currentChannelId,
  );

  const currentChannel =
    enabledChannels[currentIndex] ??
    enabledChannels.find((channel) => channel.id === currentChannelId) ??
    enabledChannels[0];

  const goPrev = () => {
    if (enabledChannels.length === 0) return;

    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex - 1 + enabledChannels.length) % enabledChannels.length;
    const nextChannel = enabledChannels[nextIndex];

    if (nextChannel) {
      setChannel(nextChannel.id);
    }
  };

  const goNext = () => {
    if (enabledChannels.length === 0) return;

    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + 1) % enabledChannels.length;
    const nextChannel = enabledChannels[nextIndex];

    if (nextChannel) {
      setChannel(nextChannel.id);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (event.key === "ArrowUp" || event.key === "PageUp") {
        event.preventDefault();
        goNext();
      }

      if (event.key === "ArrowDown" || event.key === "PageDown") {
        event.preventDefault();
        goPrev();
      }

      if (event.key.toLowerCase() === "g") {
        event.preventDefault();
        toggleGuide();
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleMuted();
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        requestFullscreenToggle();
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        setRemoteMinimized(!remoteMinimized);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    currentIndex,
    enabledChannels,
    remoteMinimized,
    requestFullscreenToggle,
    setRemoteMinimized,
    toggleGuide,
    toggleMuted,
  ]);

  if (remoteMinimized) {
    return (
      <button
        type="button"
        onClick={() => setRemoteMinimized(false)}
        className="absolute bottom-4 right-4 z-30 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.16em] shadow-2xl backdrop-blur-md transition hover:scale-[1.03] hover:opacity-95"
        style={{
          background: "rgba(0,0,0,0.76)",
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
      className="absolute bottom-4 right-4 z-30 w-[min(420px,calc(100%-2rem))] overflow-hidden rounded-2xl border p-3 shadow-2xl shadow-black/50 backdrop-blur-xl"
      style={{
        background:
          "radial-gradient(circle at top right, rgba(212,175,55,0.13), transparent 34%), linear-gradient(135deg, rgba(0,0,0,0.88), rgba(18,18,18,0.78))",
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
        </div>

        <div className="flex shrink-0 gap-2">
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

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={enabledChannels.length === 0}
          className="rounded-xl px-3 py-2 text-sm font-black transition hover:scale-[1.03] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "var(--button-bg)", color: "var(--text)" }}
        >
          CH-
        </button>

        <button
          type="button"
          onClick={goNext}
          disabled={enabledChannels.length === 0}
          className="rounded-xl px-3 py-2 text-sm font-black transition hover:scale-[1.03] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "var(--button-bg)", color: "var(--text)" }}
        >
          CH+
        </button>

        <button
          type="button"
          onClick={toggleGuide}
          className="rounded-xl px-3 py-2 text-sm font-black transition hover:scale-[1.03] hover:opacity-95"
          style={{
            background: isGuideOpen
              ? "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))"
              : "var(--button-bg)",
            color: "var(--text)",
          }}
        >
          {isGuideOpen ? "Close" : "Guide"}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-[auto_1fr_auto_auto] items-center gap-2">
        <button
          type="button"
          onClick={toggleMuted}
          className="rounded-xl px-3 py-2 text-xs font-black transition hover:scale-[1.03] hover:opacity-95"
          style={{
            background: muted
              ? "rgba(127, 29, 29, 0.82)"
              : "var(--button-bg)",
            color: "var(--text)",
          }}
        >
          {muted ? "Muted" : "Mute"}
        </button>

        <input
          aria-label="Volume"
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(event) => setVolume(Number(event.target.value) / 100)}
          className="w-full accent-current"
        />

        <button
          type="button"
          onClick={toggleFitMode}
          className="rounded-xl px-3 py-2 text-xs font-black uppercase transition hover:scale-[1.03] hover:opacity-95"
          style={{ background: "var(--button-bg)", color: "var(--text)" }}
        >
          {fitMode === "contain" ? "Fit" : "Fill"}
        </button>

        <button
          type="button"
          onClick={requestFullscreenToggle}
          className="rounded-xl px-3 py-2 text-xs font-black transition hover:scale-[1.03] hover:opacity-95"
          style={{ background: "var(--button-bg)", color: "var(--text)" }}
        >
          Full
        </button>
      </div>

      <div className="mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
        Keys: ↑/↓ channel • G guide • M mute • F fullscreen • R remote
      </div>
    </section>
  );
}