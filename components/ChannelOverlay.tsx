"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import type { Channel } from "@/lib/types";

interface ChannelOverlayProps {
  compact?: boolean;
}

function getChannelLabel(channel: Channel): string {
  return `CH ${channel.number ?? channel.id}`;
}

export default function ChannelOverlay({ compact = false }: ChannelOverlayProps) {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === currentChannelId),
    [channels, currentChannelId],
  );

  if (!activeChannel) {
    return null;
  }

  const branding = activeChannel.branding;

  const label =
    branding?.logoText || branding?.displayName || activeChannel.name || "TATE'S TV";

  const callsign = branding?.callsign || activeChannel.name || "LIVE";
  const accent = branding?.accentColor || "#2563eb";
  const channelLabel = getChannelLabel(activeChannel);

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
      <div
        className={[
          "absolute left-3 top-3 max-w-[calc(100%-24px)] overflow-hidden rounded-xl border text-white shadow-2xl backdrop-blur-md sm:left-4 sm:top-4",
          compact ? "px-2.5 py-2" : "px-3.5 py-2.5",
        ].join(" ")}
        style={{
          background:
            "linear-gradient(135deg, rgba(0,0,0,0.76), rgba(0,0,0,0.48))",
          borderColor: accent,
          boxShadow: `0 0 22px ${accent}33, 0 18px 50px rgba(0,0,0,0.35)`,
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              background: accent,
              boxShadow: `0 0 14px ${accent}`,
            }}
          />

          <div className="min-w-0">
            <div
              className={[
                "truncate font-bold uppercase tracking-[0.12em]",
                compact ? "text-[11px]" : "text-xs sm:text-sm",
              ].join(" ")}
              title={label}
            >
              {label}
            </div>

            {!compact ? (
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-white/70">
                <span>{callsign}</span>
                <span className="text-white/35">•</span>
                <span>{channelLabel}</span>
                <span className="text-white/35">•</span>
                <span>Live</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}