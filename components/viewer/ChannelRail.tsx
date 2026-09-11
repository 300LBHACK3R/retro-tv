"use client";

import { useState, type CSSProperties } from "react";
import {
  getChannelAccent,
  getChannelDisplayName,
  getChannelLabel,
} from "@/lib/viewer";
import { useDeviceLibrary } from "@/lib/deviceLibrary";
import SaveButton from "./SaveButton";
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
  const favourites = useDeviceLibrary((state) => state.favouriteChannels);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const visible = favouritesOnly
    ? channels.filter((channel) => favourites.includes(channel.id))
    : channels;
  return (
    <section
      className="ttv-channel-rail-section"
      aria-labelledby="ttv-channel-rail-title"
    >
      <div className="ttv-section-heading">
        <div>
          <span className="ttv-section-kicker">Live channels</span>
          <h2 id="ttv-channel-rail-title">Find your channel</h2>
        </div>

        <div className="ttv-section-actions">
          <button
            type="button"
            className="ttv-section-action"
            aria-pressed={favouritesOnly}
            onClick={() => setFavouritesOnly(!favouritesOnly)}
          >
            Favourites
          </button>
          <button
            type="button"
            onClick={onBrowseAll}
            className="ttv-section-action"
          >
            Browse all
          </button>
        </div>
      </div>

      <div className="ttv-channel-rail">
        {visible.map((channel) => {
          const selected = channel.id === currentChannelId;
          const accent = getChannelAccent(channel);

          return (
            <div key={channel.id} className="ttv-channel-tile">
              <button
                type="button"
                className="ttv-channel-rail-card"
                data-selected={selected ? "true" : "false"}
                style={{ "--channel-accent": accent } as CSSProperties}
                onClick={() => onSelectChannel(channel.id)}
                aria-pressed={selected}
                aria-label={`Tune to ${getChannelLabel(channel)} ${getChannelDisplayName(channel)}`}
              >
                <ChannelLogo
                  channel={channel}
                  className="ttv-channel-rail-logo"
                />

                <span className="ttv-channel-rail-copy">
                  <strong>{getChannelLabel(channel)}</strong>
                  <small>{getChannelDisplayName(channel)}</small>
                </span>
              </button>
              <SaveButton
                kind="channel"
                id={channel.id}
                title={getChannelDisplayName(channel)}
                compact
              />
            </div>
          );
        })}
      </div>
      {!visible.length && (
        <p className="ttv-discovery-empty">
          Star a channel to keep it here. Your favourites stay on this device.
        </p>
      )}
    </section>
  );
}
