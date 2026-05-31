"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Channel } from "@/lib/types";

interface ChannelOverlayProps {
  compact?: boolean;
  autoHideMs?: number;
}

function getChannelLabel(channel: Channel): string {
  return `CH ${channel.number ?? channel.id}`;
}

function getChannelName(channel: Channel): string {
  return channel.branding?.displayName ?? channel.name;
}

function getOverlayTitle(channel: Channel): string {
  return (
    channel.branding?.logoText ||
    channel.branding?.displayName ||
    channel.name ||
    "TATE'S TV"
  );
}

function getOverlaySubtitle(channel: Channel): string {
  const callsign = channel.branding?.callsign || channel.name || "LIVE";
  const channelLabel = getChannelLabel(channel);

  return `${callsign} • ${channelLabel} • Live`;
}

export default function ChannelOverlay({
  compact = false,
  autoHideMs = 3200,
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
  const subtitle = getOverlaySubtitle(activeChannel);
  const channelName = getChannelName(activeChannel);
  const accent = activeChannel.branding?.accentColor || "var(--primary)";

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
          "absolute left-3 top-3 max-w-[calc(100%-24px)] overflow-hidden rounded-2xl border text-white shadow-2xl backdrop-blur-md sm:left-4 sm:top-4",
          compact ? "px-2.5 py-2" : "px-3.5 py-3",
        ].join(" ")}
        style={{
          background:
            "radial-gradient(circle at top left, rgba(255,255,255,0.16), transparent 34%), linear-gradient(135deg, rgba(0,0,0,0.82), rgba(0,0,0,0.52))",
          borderColor: accent,
          boxShadow: `0 0 24px ${accent}38, 0 18px 55px rgba(0,0,0,0.42)`,
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
              "shrink-0 rounded-full",
              compact ? "h-2.5 w-2.5" : "h-3 w-3",
            ].join(" ")}
            style={{
              background: accent,
              boxShadow: `0 0 16px ${accent}`,
            }}
          />

          <div className="min-w-0">
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
              <>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/72">
                  <span>{subtitle}</span>
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