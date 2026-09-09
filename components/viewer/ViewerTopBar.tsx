"use client";

import Image from "next/image";
import Link from "next/link";
import ThemeButton from "@/components/ThemeButton";
import {
  getChannelDisplayName,
  getChannelLabel,
} from "@/lib/viewer";
import type { Channel } from "@/lib/types";

interface ViewerTopBarProps {
  channel: Channel | undefined;
  tvMode: boolean;
  onOpenGuide: () => void;
  onOpenChannels: () => void;
  onOpenMore: () => void;
  onScrollToLive: () => void;
}

function ActionIcon({ name }: { name: "live" | "guide" | "channels" | "more" }) {
  if (name === "guide") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.5h16v13H4zM8 5.5v13M4 10h16" />
      </svg>
    );
  }

  if (name === "channels") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6h14M5 12h14M5 18h14M8 4v4M12 10v4M16 16v4" />
      </svg>
    );
  }

  if (name === "more") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="1.5" />
        <circle cx="12" cy="12" r="1.5" />
        <circle cx="19" cy="12" r="1.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7h12v10H6zM10 4h4M9 20h6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export default function ViewerTopBar({
  channel,
  tvMode,
  onOpenGuide,
  onOpenChannels,
  onOpenMore,
  onScrollToLive,
}: ViewerTopBarProps) {
  const channelLabel = getChannelLabel(channel);
  const channelName = getChannelDisplayName(channel);

  return (
    <header className="ttv-premium-topbar" aria-label="Tate's TV navigation">
      <button
        type="button"
        className="ttv-premium-brand"
        onClick={onScrollToLive}
        aria-label="Return to the live player"
      >
        <Image
          src="/tatestv-logo.png"
          alt="Tate's TV"
          width={1536}
          height={1024}
          className="ttv-premium-brand-logo"
          priority
          draggable={false}
        />
        <span className="ttv-brand-wordmark">TATE’S TV<small>FREE TV. REAL CHANNELS.</small></span>
      </button>

      <div className="ttv-premium-live-chip" aria-label={`Live on ${channelLabel}`}>
        <span className="ttv-premium-live-dot" aria-hidden="true" />
        <span className="ttv-premium-live-copy">
          <strong>{channelLabel}</strong>
          <small>{channelName}</small>
        </span>
      </div>

      <nav className="ttv-premium-nav" aria-label="Primary">
        <button
          type="button"
          onClick={onScrollToLive}
          aria-label="Return to live player"
          title="Live"
          aria-current="page"
        >
          <ActionIcon name="live" />
          <span>Live</span>
        </button>

        <button
          type="button"
          onClick={onOpenGuide}
          aria-label="Open live guide"
          title="Guide"
        >
          <ActionIcon name="guide" />
          <span>Guide</span>
        </button>

        <button
          type="button"
          onClick={onOpenChannels}
          aria-label="Open channel directory"
          title="Channels"
        >
          <ActionIcon name="channels" />
          <span>Channels</span>
        </button>

        <Link
          href="/library"
          aria-label="Open on-demand Library"
          title="Library"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5h14v14H5zM9 5v14M13 9h4M13 13h4" />
          </svg>
          <span>Library</span>
        </Link>

        {!tvMode ? <ThemeButton /> : null}

        <button
          type="button"
          onClick={onOpenMore}
          data-viewer-more-trigger
          aria-label="Open viewer settings and more options"
          title="More"
        >
          <ActionIcon name="more" />
          <span>More</span>
        </button>
      </nav>
    </header>
  );
}
