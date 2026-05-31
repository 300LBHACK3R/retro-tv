"use client";

import { useEffect, useState } from "react";
import type { Channel } from "@/lib/types";
import { useStore } from "@/lib/store";

interface ViewerHeaderProps {
  channel: Channel | undefined;
}

function getChannelLabel(channel: Channel): string {
  return `CH ${channel.number ?? channel.id}`;
}

function formatViewerTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function ViewerHeader({ channel }: ViewerHeaderProps) {
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const branding = channel?.branding;

  const title =
    branding?.logoText || branding?.displayName || channel?.name || "TATE'S TV";

  const subtitle =
    branding?.description || "A curated live channel experience";

  const callsign = branding?.callsign || channel?.name || "LIVE";
  const accentColor = branding?.accentColor || "var(--primary)";

  return (
    <header
      className="relative overflow-hidden rounded-2xl border px-4 py-4 shadow-2xl shadow-black/20 sm:px-5 lg:px-6"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.035), transparent 42%), var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-48 w-48 rounded-full opacity-20 blur-3xl"
        style={{ background: accentColor }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: "var(--text-muted)" }}
            >
              Tate&apos;s Retro TV
            </div>

            <div
              className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
              style={{
                borderColor: "var(--border)",
                background: "var(--panel-alt-bg)",
                color: "var(--primary)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: "var(--primary)",
                  boxShadow: "0 0 14px var(--primary)",
                }}
                aria-hidden="true"
              />
              Live
            </div>

            <div
              className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{
                borderColor: "var(--border)",
                background: "var(--panel-alt-bg)",
                color: "var(--text-muted)",
              }}
            >
              {formatViewerTime(now)}
            </div>
          </div>

          <h1 className="mt-2 max-w-[58rem] truncate text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
            {title}
          </h1>

          <p
            className="mt-1 line-clamp-2 max-w-3xl text-sm leading-6 sm:text-[15px]"
            style={{ color: "var(--text-muted)" }}
          >
            {subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch lg:justify-end">
          {channel ? (
            <aside
              className="min-w-[11rem] shrink-0 rounded-xl border px-4 py-3 text-left sm:text-right"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.04), transparent 48%), var(--panel-alt-bg)",
                borderColor: "var(--border)",
              }}
              aria-label="Current channel"
            >
              <div
                className="text-[11px] uppercase tracking-[0.18em]"
                style={{ color: "var(--text-muted)" }}
              >
                Channel
              </div>

              <div className="mt-1 text-xl font-black">
                {getChannelLabel(channel)}
              </div>

              <div
                className="max-w-[14rem] truncate text-xs font-bold uppercase tracking-[0.14em]"
                style={{ color: "var(--text-muted)" }}
                title={callsign}
              >
                {callsign}
              </div>
            </aside>
          ) : null}

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-xl border px-4 py-3 text-left text-xs font-black uppercase tracking-[0.16em] transition hover:scale-[1.01] sm:min-w-[9rem] sm:text-center"
            style={{
              background: "var(--button-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            aria-label="Open viewer settings"
          >
            Settings
          </button>
        </div>
      </div>
    </header>
  );
}