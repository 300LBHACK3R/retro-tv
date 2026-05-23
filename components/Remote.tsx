"use client";

import { useEffect, useMemo } from "react";
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
    if (enabledChannels.length === 0) {
      return;
    }

    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      (safeCurrentIndex - 1 + enabledChannels.length) % enabledChannels.length;

    const nextChannel = enabledChannels[nextIndex];

    if (nextChannel) {
      setChannel(nextChannel.id);
    }
  };

  const goNext = () => {
    if (enabledChannels.length === 0) {
      return;
    }

    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeCurrentIndex + 1) % enabledChannels.length;

    const nextChannel = enabledChannels[nextIndex];

    if (nextChannel) {
      setChannel(nextChannel.id);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

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
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabledChannels, currentIndex, toggleGuide]);

  return (
    <section
      className="relative overflow-hidden rounded-2xl border p-4 shadow-2xl shadow-black/30"
      style={{
        background:
          "radial-gradient(circle at top right, rgba(212,175,55,0.12), transparent 34%), linear-gradient(135deg, rgba(0,0,0,0.9), rgba(18,18,18,0.78))",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      aria-label="TV remote controls"
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }}
      />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-[11px] font-black uppercase tracking-[0.22em]"
            style={{ color: "var(--primary)" }}
          >
            Remote
          </div>

          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <div className="text-base font-semibold tracking-tight">
              {getChannelLabel(currentChannel)}
            </div>

            <div
              className="max-w-[18rem] truncate text-xs"
              style={{ color: "var(--text-muted)" }}
              title={getChannelName(currentChannel)}
            >
              {getChannelName(currentChannel)}
            </div>
          </div>
        </div>

        <div
          className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
          style={{
            borderColor: "var(--border)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--text-muted)",
          }}
        >
          {enabledChannels.length} Channels
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={enabledChannels.length === 0}
          className="rounded-xl px-4 py-3 text-sm font-black tracking-wide transition hover:scale-[1.02] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "var(--button-bg)",
            color: "var(--text)",
          }}
          aria-label="Previous channel"
        >
          CH-
        </button>

        <button
          type="button"
          onClick={goNext}
          disabled={enabledChannels.length === 0}
          className="rounded-xl px-4 py-3 text-sm font-black tracking-wide transition hover:scale-[1.02] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "var(--button-bg)",
            color: "var(--text)",
          }}
          aria-label="Next channel"
        >
          CH+
        </button>

        <button
          type="button"
          onClick={toggleGuide}
          className="rounded-xl px-4 py-3 text-sm font-black tracking-wide transition hover:scale-[1.02] hover:opacity-95"
          style={{
            background: isGuideOpen
              ? "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))"
              : "var(--button-bg)",
            color: "var(--text)",
            boxShadow: isGuideOpen ? "0 0 22px rgba(212,175,55,0.22)" : "none",
          }}
          aria-pressed={isGuideOpen}
        >
          {isGuideOpen ? "Close" : "Guide"}
        </button>
      </div>

      <div className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
        Keyboard: ↑ / ↓ channel surf, G opens guide.
      </div>
    </section>
  );
}