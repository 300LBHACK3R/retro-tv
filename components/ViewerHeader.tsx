"use client";

import type { CSSProperties } from "react";
import {
  getChannelAccent,
  getChannelDescription,
  getChannelDisplayName,
  getChannelLabel,
} from "@/lib/viewer";
import ChannelLogo from "@/components/viewer/ChannelLogo";
import type { Channel } from "@/lib/types";

interface ViewerHeaderProps {
  channel: Channel | undefined;
}

export default function ViewerHeader({ channel }: ViewerHeaderProps) {
  const accent = getChannelAccent(channel);

  return (
    <section
      className="ttv-channel-hero"
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
        </div>

        <h1>{getChannelDisplayName(channel)}</h1>
        <p>{getChannelDescription(channel)}</p>
      </div>
    </section>
  );
}
