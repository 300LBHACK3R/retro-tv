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
      className="rounded-2xl border p-3 shadow-2xl shadow-black/20"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      aria-label="TV remote controls"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            Remote
          </div>

          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <div className="text-sm font-semibold">
              {getChannelLabel(currentChannel)}
            </div>

            <div
              className="max-w-[16rem] truncate text-xs"
              style={{ color: "var(--text-muted)" }}
              title={getChannelName(currentChannel)}
            >
              {getChannelName(currentChannel)}
            </div>
          </div>
        </div>

        <div
          className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{
            borderColor: "var(--border)",
            background: "var(--panel-alt-bg)",
            color: "var(--text-muted)",
          }}
        >
          {enabledChannels.length} Channels
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={enabledChannels.length === 0}
          className="rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
          style={{
            background: isGuideOpen ? "var(--primary)" : "var(--button-bg)",
            color: "var(--text)",
          }}
          aria-pressed={isGuideOpen}
        >
          {isGuideOpen ? "Close Guide" : "Open Guide"}
        </button>
      </div>

      <div className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
        Keyboard: Arrow Up/Page Up for CH+, Arrow Down/Page Down for CH-, G for
        guide.
      </div>
    </section>
  );
}