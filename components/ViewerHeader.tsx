"use client";

import { useEffect, useMemo, useState } from "react";
import { cleanDisplayText } from "@/lib/textClean";
import type { Channel } from "@/lib/types";

interface ViewerHeaderProps {
  channel: Channel | undefined;
}

const CLOCK_TICK_MS = 15_000;

function getChannelLabel(channel: Channel | undefined): string {
  if (!channel) {
    return "CH --";
  }

  return `CH ${channel.number ?? channel.id}`;
}

function getChannelTitle(channel: Channel | undefined): string {
  if (!channel) {
    return "TatesTv";
  }

  return cleanDisplayText(
    channel.branding?.logoText ||
      channel.branding?.displayName ||
      channel.name ||
      "TatesTv",
  );
}

function getChannelSubtitle(channel: Channel | undefined): string {
  if (!channel) {
    return "A curated live channel experience.";
  }

  return cleanDisplayText(
    channel.branding?.description ||
      "A curated live channel experience.",
  );
}

function getChannelCallsign(channel: Channel | undefined): string {
  if (!channel) {
    return "LIVE";
  }

  return cleanDisplayText(
    channel.branding?.callsign ||
      channel.name ||
      "LIVE",
  );
}

function getSafeAccent(channel: Channel | undefined): string {
  const accent = channel?.branding?.accentColor?.trim();

  if (accent && /^#[0-9a-f]{6}$/i.test(accent)) {
    return accent.toLowerCase();
  }

  return "var(--primary)";
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusPill({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
      style={{
        borderColor: "var(--border)",
        background: "var(--panel-alt-bg)",
        color: accent ? "var(--primary)" : "var(--text-muted)",
      }}
    >
      {children}
    </div>
  );
}

export default function ViewerHeader({ channel }: ViewerHeaderProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, CLOCK_TICK_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const title = useMemo(() => getChannelTitle(channel), [channel]);
  const subtitle = useMemo(() => getChannelSubtitle(channel), [channel]);
  const callsign = useMemo(() => getChannelCallsign(channel), [channel]);
  const accent = useMemo(() => getSafeAccent(channel), [channel]);

  return (
    <header
      className="ttv-glass-panel-strong relative overflow-hidden rounded-2xl px-4 py-4 shadow-2xl shadow-black/20 sm:px-5"
      style={{
        color: "var(--text)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full opacity-20 blur-3xl"
        style={{ background: accent }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="text-[11px] font-black uppercase tracking-[0.22em]"
              style={{ color: "var(--text-muted)" }}
            >
              TatesTv
            </div>

            <StatusPill accent>● Live</StatusPill>
            <StatusPill>{formatClock(now)}</StatusPill>
          </div>

          <h1 className="mt-4 truncate text-3xl font-black tracking-tight sm:text-5xl">
            {title}
          </h1>

          <p
            className="mt-3 line-clamp-2 max-w-5xl text-sm leading-6 sm:text-base"
            style={{ color: "var(--text-muted)" }}
          >
            {subtitle}
          </p>
        </div>

        <aside
          className="shrink-0 rounded-2xl border px-5 py-4 text-left shadow-2xl shadow-black/20 lg:min-w-[14rem] lg:text-right"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
          }}
          aria-label="Current channel"
        >
          <div
            className="text-[11px] font-black uppercase tracking-[0.22em]"
            style={{ color: "var(--text-muted)" }}
          >
            Channel
          </div>

          <div className="mt-2 text-2xl font-black">
            {getChannelLabel(channel)}
          </div>

          <div
            className="mt-1 max-w-[16rem] truncate text-xs font-black uppercase tracking-[0.16em]"
            style={{ color: "var(--text-muted)" }}
            title={callsign}
          >
            {callsign}
          </div>
        </aside>
      </div>
    </header>
  );
}