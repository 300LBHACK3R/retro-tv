"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Channel } from "@/lib/types";

interface ChannelOverlayProps {
  compact?: boolean;
  autoHideMs?: number;
}

const DEFAULT_ACCENT = "#22d3ee";
const DEFAULT_AUTO_HIDE_MS = 3200;

function getChannelLabel(channel: Channel): string {
  return `CH ${channel.number ?? channel.id}`;
}

function getChannelName(channel: Channel): string {
  return channel.branding?.displayName ?? channel.name;
}

function getOverlayTitle(channel: Channel): string {
  return (
    channel.branding?.logoText?.trim() ||
    channel.branding?.displayName?.trim() ||
    channel.name?.trim() ||
    "TatesTv"
  );
}

function getOverlayCallsign(channel: Channel): string {
  return channel.branding?.callsign?.trim() || channel.name?.trim() || "LIVE";
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

function getSafeAccentColor(channel: Channel): string {
  const accent = channel.branding?.accentColor?.trim();

  if (accent && isValidHexColor(accent)) {
    return accent.toLowerCase();
  }

  return DEFAULT_ACCENT;
}

function createSubtitleParts(channel: Channel): string[] {
  return [getOverlayCallsign(channel), getChannelLabel(channel), "Live"];
}

function getInitials(value: string): string {
  const clean = value.trim();

  if (!clean) {
    return "TV";
  }

  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
  }

  return clean.slice(0, 3).toUpperCase();
}

export default function ChannelOverlay({
  compact = false,
  autoHideMs = DEFAULT_AUTO_HIDE_MS,
}: ChannelOverlayProps) {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const preferReducedMotion = useStore(
    (state) => state.viewerSettings.preferReducedMotion,
  );

  const [visible, setVisible] = useState(true);

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === currentChannelId),
    [channels, currentChannelId],
  );

  useEffect(() => {
    setVisible(true);

    if (autoHideMs <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setVisible(false);
    }, autoHideMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoHideMs, currentChannelId]);

  if (!activeChannel) {
    return null;
  }

  const title = getOverlayTitle(activeChannel);
  const channelName = getChannelName(activeChannel);
  const subtitleParts = createSubtitleParts(activeChannel);
  const accent = getSafeAccentColor(activeChannel);
  const initials = getInitials(title);

  return (
    <div
      className={[
        "pointer-events-none absolute inset-0 z-20 transition-opacity",
        preferReducedMotion ? "" : "duration-500",
        visible ? "opacity-100" : "opacity-0",
      ].join(" ")}
      aria-hidden="true"
    >
      <div
        className={[
          "absolute left-2.5 top-2.5 max-w-[calc(100%-20px)] overflow-hidden rounded-2xl border text-white shadow-2xl backdrop-blur-md",
          "sm:left-4 sm:top-4 sm:max-w-[min(32rem,calc(100%-32px))]",
          compact ? "px-2.5 py-2" : "px-3 py-3 sm:px-3.5",
        ].join(" ")}
        style={{
          background:
            "radial-gradient(circle at top left, rgba(255,255,255,0.16), transparent 34%), linear-gradient(135deg, rgba(0,0,0,0.84), rgba(0,0,0,0.54))",
          borderColor: accent,
          boxShadow: `0 0 24px ${accent}3d, 0 18px 55px rgba(0,0,0,0.42)`,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          }}
        />

        <div className="flex items-center gap-2.5">
          <div
            className={[
              "flex shrink-0 items-center justify-center rounded-xl font-black uppercase text-white shadow-2xl",
              compact ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-[11px]",
            ].join(" ")}
            style={{
              background:
                `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.32), transparent 34%), ${accent}`,
              boxShadow: `0 0 18px ${accent}80`,
            }}
          >
            {initials}
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={[
                  "truncate font-black uppercase tracking-[0.13em]",
                  compact ? "text-[11px]" : "text-xs sm:text-sm",
                ].join(" ")}
                title={title}
              >
                {title}
              </div>

              {!compact ? (
                <div
                  className="hidden shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-white/80 sm:block"
                  style={{
                    borderColor: `${accent}66`,
                    background: `${accent}1c`,
                  }}
                >
                  Live
                </div>
              ) : null}
            </div>

            {!compact ? (
              <>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/72">
                  {subtitleParts.map((part, index) => (
                    <span key={`${part}-${index}`} className="contents">
                      {index > 0 ? (
                        <span className="text-white/35">•</span>
                      ) : null}
                      <span>{part}</span>
                    </span>
                  ))}
                </div>

                {channelName !== title ? (
                  <div className="mt-0.5 max-w-[18rem] truncate text-[10px] font-medium text-white/50">
                    {channelName}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}