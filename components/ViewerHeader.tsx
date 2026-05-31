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
        background:
          "radial-gradient(circle at top right, rgba(37,99,235,0.16), transparent 34%), var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="text-[11px] font-black uppercase tracking-[0.22em]"
              style={{ color: "var(--text-muted)" }}
            >
              Tate&apos;s Retro TV
            </div>

            <div
              className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
              style={{
                borderColor: "var(--border)",
                background: "var(--panel-alt-bg)",
                color: "var(--primary)",
              }}
            >
              ● Live
            </div>

            <div
              className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
              style={{
                borderColor: "var(--border)",
                background: "var(--panel-alt-bg)",
                color: "var(--text-muted)",
              }}
            >
              {new Date().toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          </div>

          <h1 className="mt-4 truncate text-4xl font-black tracking-tight sm:text-5xl">
            {title}
          </h1>

          <p
            className="mt-3 line-clamp-2 max-w-5xl text-sm leading-6 sm:text-base"
            style={{ color: "var(--text-muted)" }}
          >
            {subtitle}
          </p>
        </div>

        {channel ? (
          <aside
            className="shrink-0 rounded-2xl border px-5 py-4 text-left shadow-2xl shadow-black/20 sm:min-w-[14rem] sm:text-right"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
            }}
            aria-label="Current channel"
          >
            <div
              className="text-[11px] font-black uppercase tracking-[0.22em]"
              style={{ color: "var(--text-muted)" }}
            >
              Channel
            </div>

            <div className="mt-2 text-2xl font-black">
              {getChannelLabel(channel)}
            </div>

            <div
              className="mt-1 max-w-[14rem] truncate text-xs font-black uppercase tracking-[0.16em]"
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
