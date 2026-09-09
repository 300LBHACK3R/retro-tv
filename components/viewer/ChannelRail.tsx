"use client";

import { type CSSProperties } from "react";
import {
  getChannelAccent,
  getChannelDisplayName,
  getChannelLabel,
} from "@/lib/viewer";
import ChannelLogo from "./ChannelLogo";
import type { Channel } from "@/lib/types";

interface ChannelRailProps {
  channels: readonly Channel[];
  currentChannelId: string;
  onSelectChannel: (channelId: string) => void;
  onBrowseAll: () => void;
}

export default function ChannelRail({
  channels,
  currentChannelId,
  onSelectChannel,
  onBrowseAll,
}: ChannelRailProps) {
  return (
    <section className="ttv-channel-rail-section" aria-labelledby="ttv-channel-rail-title">
      <div className="ttv-section-heading">
        <div>
          <span className="ttv-section-kicker">Live channels</span>
          <h2 id="ttv-channel-rail-title">Find your channel</h2>
        </div>

        <button type="button" onClick={onBrowseAll} className="ttv-section-action">
          Browse all
        </button>
      </div>

      <div className="ttv-channel-rail">
        {channels.map((channel) => {
          const selected = channel.id === currentChannelId;
          const accent = getChannelAccent(channel);

          return (
            <button
              key={channel.id}
              type="button"
              className="ttv-channel-rail-card"
              data-selected={selected ? "true" : "false"}
              style={{ "--channel-accent": accent } as CSSProperties}
              onClick={() => onSelectChannel(channel.id)}
              aria-pressed={selected}
              aria-label={`Tune to ${getChannelLabel(channel)} ${getChannelDisplayName(channel)}`}
            >
              <ChannelLogo channel={channel} className="ttv-channel-rail-logo" />

              <span className="ttv-channel-rail-copy">
                <strong>{getChannelLabel(channel)}</strong>
                <small>{getChannelDisplayName(channel)}</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
