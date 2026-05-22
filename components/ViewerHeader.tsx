"use client";

import type { Channel } from "@/lib/types";

interface ViewerHeaderProps {
  channel: Channel | undefined;
}

function getChannelLabel(channel: Channel): string {
  return `CH ${channel.number ?? channel.id}`;
}

export default function ViewerHeader({ channel }: ViewerHeaderProps) {
  const branding = channel?.branding;

  const title =
    branding?.logoText || branding?.displayName || channel?.name || "TATE'S TV";

  const subtitle =
    branding?.description || "A curated live channel experience";

  const callsign = branding?.callsign || channel?.name || "LIVE";

  return (
    <header
      className="rounded-2xl border px-4 py-4 shadow-2xl shadow-black/20 sm:px-5"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--text-muted)" }}
            >
              Tate&apos;s TV
            </div>

            <div
              className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{
                borderColor: "var(--border)",
                background: "var(--panel-alt-bg)",
                color: "var(--primary)",
              }}
            >
              Live
            </div>
          </div>

          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>

          <p className="mt-1 line-clamp-2 text-sm" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        </div>

        {channel ? (
          <aside
            className="shrink-0 rounded-xl border px-4 py-3 text-left sm:text-right"
            style={{
              background: "var(--panel-alt-bg)",
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

            <div className="mt-1 text-lg font-semibold">
              {getChannelLabel(channel)}
            </div>

            <div
              className="max-w-[14rem] truncate text-xs font-medium uppercase tracking-[0.14em]"
              style={{ color: "var(--text-muted)" }}
              title={callsign}
            >
              {callsign}
            </div>
          </aside>
        ) : null}
      </div>
    </header>
  );
}