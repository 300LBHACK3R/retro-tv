"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  getChannelAccent,
  getChannelCallsign,
  getChannelDescription,
  getChannelDisplayName,
  getChannelLabel,
} from "@/lib/viewer";
import ChannelLogo from "@/components/viewer/ChannelLogo";
import type { Channel } from "@/lib/types";

export type ViewerHeaderVariant = "hero" | "compact";

interface ViewerHeaderProps {
  channel: Channel | undefined;
  variant?: ViewerHeaderVariant;
}

const CLOCK_TICK_MS = 15_000;

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ViewerHeader({
  channel,
  variant = "hero",
}: ViewerHeaderProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());

    const interval = window.setInterval(() => {
      setNow(new Date());
    }, CLOCK_TICK_MS);

    return () => window.clearInterval(interval);
  }, []);

  const accent = getChannelAccent(channel);

  return (
    <section
      className="ttv-channel-hero"
      data-variant={variant}
      style={{ "--channel-accent": accent } as CSSProperties}
      aria-label="Current Tate's TV channel"
    >
      <ChannelLogo channel={channel} className="ttv-channel-hero-logo" eager />

      <div className="ttv-channel-hero-copy">
        <div className="ttv-channel-hero-meta">
          <span className="ttv-live-label">
            <span aria-hidden="true" /> Live
          </span>
          <span>{getChannelLabel(channel)}</span>
          <span>{now ? formatTime(now) : "--:--"}</span>
        </div>

        <h1>{getChannelDisplayName(channel)}</h1>
        <p>{getChannelDescription(channel)}</p>
      </div>

      <aside className="ttv-channel-hero-badge" aria-label="Channel identity">
        <small>Channel</small>
        <strong>{getChannelLabel(channel)}</strong>
        <span>{getChannelCallsign(channel)}</span>
      </aside>
    </section>
  );
}
