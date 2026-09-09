"use client";

import Link from "next/link";

interface MobileViewerNavigationProps {
  hidden: boolean;
  onLive: () => void;
  onGuide: () => void;
  onChannels: () => void;
  onMore: () => void;
}

type MobileNavIconName =
  | "live"
  | "guide"
  | "channels"
  | "library"
  | "more";

function NavIcon({ name }: { name: MobileNavIconName }) {
  if (name === "guide") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v14H4zM4 10h16M9 5v14" />
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

  if (name === "library") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5h14v14H5zM9 5v14M13 9h4M13 13h4" />
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

export default function MobileViewerNavigation({
  hidden,
  onLive,
  onGuide,
  onChannels,
  onMore,
}: MobileViewerNavigationProps) {
  return (
    <nav hidden={hidden} className="ttv-mobile-viewer-nav" aria-label="Mobile viewer navigation">
      <button type="button" onClick={onLive}>
        <NavIcon name="live" />
        <span>Live</span>
      </button>

      <button type="button" onClick={onGuide}>
        <NavIcon name="guide" />
        <span>Guide</span>
      </button>

      <button type="button" onClick={onChannels}>
        <NavIcon name="channels" />
        <span>Channels</span>
      </button>

      <Link href="/library">
        <NavIcon name="library" />
        <span>Library</span>
      </Link>

      <button type="button" data-viewer-more-trigger onClick={onMore}>
        <NavIcon name="more" />
        <span>More</span>
      </button>
    </nav>
  );
}
