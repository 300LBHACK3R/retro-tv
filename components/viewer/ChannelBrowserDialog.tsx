"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useModalDialog } from "@/components/viewer/useModalDialog";
import {
  getChannelAccent,
  getChannelCallsign,
  getChannelDisplayName,
  getChannelLabel,
  getChannelNumber,
} from "@/lib/viewer";
import { useDeviceLibrary } from "@/lib/deviceLibrary";
import SaveButton from "./SaveButton";
import ChannelLogo from "./ChannelLogo";
import type { Channel } from "@/lib/types";

interface ChannelBrowserDialogProps {
  open: boolean;
  channels: readonly Channel[];
  currentChannelId: string;
  onClose: () => void;
  onSelectChannel: (channelId: string) => void;
}

function normalizeQuery(value: string): string {
  return value.trim().toLocaleLowerCase("en-CA");
}

function channelMatches(channel: Channel, query: string): boolean {
  if (!query) {
    return true;
  }

  const searchable = [
    getChannelNumber(channel),
    getChannelLabel(channel),
    getChannelDisplayName(channel),
    getChannelCallsign(channel),
  ]
    .join(" ")
    .toLocaleLowerCase("en-CA");

  return searchable.includes(query);
}

export default function ChannelBrowserDialog({
  open,
  channels,
  currentChannelId,
  onClose,
  onSelectChannel,
}: ChannelBrowserDialogProps) {
  const favourites = useDeviceLibrary((state) => state.favouriteChannels);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const mounted = useModalDialog({
    open,
    onClose,
    dialogRef,
    initialFocusRef: searchInputRef,
  });

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const filteredChannels = useMemo(() => {
    const normalizedQuery = normalizeQuery(query);

    return channels.filter(
      (channel) =>
        channelMatches(channel, normalizedQuery) &&
        (!favouritesOnly || favourites.includes(channel.id)),
    );
  }, [channels, query, favourites, favouritesOnly]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div
      className="ttv-premium-dialog-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        ref={dialogRef}
        className="ttv-channel-browser-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ttv-channel-browser-title"
        aria-describedby="ttv-channel-browser-description"
        tabIndex={-1}
      >
        <header className="ttv-premium-dialog-header">
          <div>
            <span className="ttv-section-kicker">Tate&apos;s TV</span>
            <h2 id="ttv-channel-browser-title">Channel directory</h2>
            <p id="ttv-channel-browser-description">
              Search, browse, and tune without leaving the live player.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ttv-premium-dialog-close"
            aria-label="Close channel directory"
          >
            <span aria-hidden="true">×</span>
            <span>Close</span>
          </button>
        </header>

        <div className="ttv-channel-browser-tools">
          <label htmlFor="ttv-channel-search">
            <span>Find a channel</span>
            <input
              ref={searchInputRef}
              id="ttv-channel-search"
              type="search"
              inputMode="search"
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 80))}
              placeholder="Channel number, name, or callsign"
              autoComplete="off"
            />
          </label>

          <div className="ttv-channel-browser-count" aria-live="polite">
            {filteredChannels.length} of {channels.length} channels
          </div>
        </div>

        <div className="ttv-directory-filter">
          <button
            type="button"
            className="ttv-section-action"
            aria-pressed={favouritesOnly}
            onClick={() => setFavouritesOnly(!favouritesOnly)}
          >
            Favourites only
          </button>
        </div>
        <div
          className="ttv-channel-browser-grid"
          aria-label="Available channels"
        >
          {filteredChannels.map((channel) => {
            const selected = channel.id === currentChannelId;
            const accent = getChannelAccent(channel);

            return (
              <div key={channel.id} className="ttv-directory-tile">
                <button
                  type="button"
                  className="ttv-channel-browser-card"
                  data-selected={selected ? "true" : "false"}
                  style={{ "--channel-accent": accent } as CSSProperties}
                  onClick={() => {
                    onSelectChannel(channel.id);
                    onClose();
                  }}
                  aria-pressed={selected}
                  aria-label={`${selected ? "Currently watching" : "Tune to"} ${getChannelLabel(channel)} ${getChannelDisplayName(channel)}`}
                >
                  <ChannelLogo
                    channel={channel}
                    className="ttv-channel-browser-logo"
                  />

                  <span className="ttv-channel-browser-copy">
                    <span className="ttv-channel-browser-number">
                      {getChannelLabel(channel)}
                    </span>
                    <strong>{getChannelDisplayName(channel)}</strong>
                    <small>{getChannelCallsign(channel)}</small>
                  </span>

                  <span className="ttv-channel-browser-action">
                    {selected ? "Watching" : "Tune"}
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

        {filteredChannels.length === 0 ? (
          <div className="ttv-premium-empty-state" role="status">
            <strong>No channels match that search.</strong>
            <span>Try another search, or turn off the favourites filter.</span>
          </div>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}
