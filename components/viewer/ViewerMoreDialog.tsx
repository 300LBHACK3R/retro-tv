"use client";

import { useRef } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useModalDialog } from "@/components/viewer/useModalDialog";
import OpenAdminWindowButton from "@/components/OpenAdminWindowButton";
import { useStore } from "@/lib/store";
import { requestThemeLibraryOpen } from "@/lib/themeEvents";
import {
  getChannelDisplayName,
  getChannelLabel,
} from "@/lib/viewer";
import type { Channel, PlayerViewMode } from "@/lib/types";

interface ViewerMoreDialogProps {
  open: boolean;
  channel: Channel | undefined;
  tvMode: boolean;
  onClose: () => void;
}

const PLAYER_MODES: Array<{
  value: PlayerViewMode;
  label: string;
  description: string;
}> = [
  {
    value: "normal",
    label: "Normal",
    description: "Balanced page layout.",
  },
  {
    value: "theater",
    label: "Theater",
    description: "Larger cinematic player.",
  },
  {
    value: "mini",
    label: "Mini",
    description: "Floating player while browsing.",
  },
];

export default function ViewerMoreDialog({
  open,
  channel,
  tvMode,
  onClose,
}: ViewerMoreDialogProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const playerViewMode = useStore(
    (state) => state.viewerSettings.playerViewMode,
  );
  const guideDensity = useStore((state) => state.viewerSettings.guideDensity);
  const preferReducedMotion = useStore(
    (state) => state.viewerSettings.preferReducedMotion,
  );
  const setPlayerViewMode = useStore((state) => state.setPlayerViewMode);
  const setGuideDensity = useStore((state) => state.setGuideDensity);
  const setPreferReducedMotion = useStore(
    (state) => state.setPreferReducedMotion,
  );

  const mounted = useModalDialog({
    open,
    onClose,
    dialogRef,
    initialFocusRef: closeButtonRef,
  });

  if (!mounted || !open) {
    return null;
  }

  const tvModeUrl = channel ? `/tv?ch=${encodeURIComponent(channel.id)}` : "/tv";

  const openThemeLibrary = () => {
    onClose();

    window.requestAnimationFrame(() => {
      requestThemeLibraryOpen();
    });
  };

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
        className="ttv-viewer-more-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ttv-viewer-more-title"
        aria-describedby="ttv-viewer-more-description"
        tabIndex={-1}
      >
        <header className="ttv-premium-dialog-header">
          <div>
            <span className="ttv-section-kicker">Viewer controls</span>
            <h2 id="ttv-viewer-more-title">More from Tate&apos;s TV</h2>
            <p id="ttv-viewer-more-description">
              {getChannelLabel(channel)} · {getChannelDisplayName(channel)}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="ttv-premium-dialog-close"
            aria-label="Close viewer controls"
          >
            <span aria-hidden="true">×</span>
            <span>Close</span>
          </button>
        </header>

        <div className="ttv-viewer-more-scroll">
          {!tvMode ? (
            <section className="ttv-viewer-settings-section">
              <div className="ttv-viewer-settings-heading">
                <span>Player layout</span>
                <small>Choose how the live player sits on this device.</small>
              </div>

              <div className="ttv-view-mode-grid">
                {PLAYER_MODES.map((mode) => {
                  const active = playerViewMode === mode.value;

                  return (
                    <button
                      key={mode.value}
                      type="button"
                      className="ttv-view-mode-card"
                      data-selected={active ? "true" : "false"}
                      onClick={() => setPlayerViewMode(mode.value)}
                      aria-pressed={active}
                    >
                      <strong>{mode.label}</strong>
                      <span>{mode.description}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="ttv-viewer-settings-section">
            <div className="ttv-viewer-settings-heading">
              <span>Appearance & accessibility</span>
              <small>Themes keep the same layout and controls.</small>
            </div>

            <div className="ttv-viewer-preference-grid">
              {!tvMode ? (
                <button
                  type="button"
                  className="ttv-preference-toggle ttv-open-theme-button"
                  onClick={openThemeLibrary}
                >
                  <strong>Theme library</strong>
                  <span>Open</span>
                </button>
              ) : null}

              <button
                type="button"
                className="ttv-preference-toggle"
                data-selected={guideDensity === "compact" ? "true" : "false"}
                onClick={() =>
                  setGuideDensity(
                    guideDensity === "compact" ? "comfortable" : "compact",
                  )
                }
                aria-pressed={guideDensity === "compact"}
              >
                <strong>Compact guide</strong>
                <span>{guideDensity === "compact" ? "On" : "Off"}</span>
              </button>

              <button
                type="button"
                className="ttv-preference-toggle"
                data-selected={preferReducedMotion ? "true" : "false"}
                onClick={() => setPreferReducedMotion(!preferReducedMotion)}
                aria-pressed={preferReducedMotion}
              >
                <strong>Reduce motion</strong>
                <span>{preferReducedMotion ? "On" : "Off"}</span>
              </button>
            </div>
          </section>

          <section className="ttv-viewer-settings-section">
            <div className="ttv-viewer-settings-heading">
              <span>Open</span>
              <small>Explore more from Tate&apos;s TV.</small>
            </div>

            <div className="ttv-viewer-link-grid">
              <Link href={tvModeUrl} onClick={onClose}>
                <strong>TV Mode</strong>
                <span>A larger view for the living room.</span>
              </Link>

              {!tvMode ? <Link href="/submit" onClick={onClose}>
                <strong>Submit a clip</strong>
                <span>Send content for review.</span>
              </Link> : null}

              <Link href="/install" onClick={onClose}>
                <strong>Install Tate&apos;s TV</strong>
                <span>Keep your channels one tap away.</span>
              </Link>

              <Link href="/help" onClick={onClose}>
                <strong>Help</strong>
                <span>Playback and device guidance.</span>
              </Link>

              <Link href="/compat" onClick={onClose}>
                <strong>Compatibility</strong>
                <span>Browser and television support.</span>
              </Link>

              {!tvMode ? <div className="ttv-viewer-admin-link">
                <strong>Station admin</strong>
                <span>Protected programming controls.</span>
                <OpenAdminWindowButton />
              </div> : null}
            </div>
          </section>
        </div>
      </section>
    </div>,
    document.body,
  );
}
