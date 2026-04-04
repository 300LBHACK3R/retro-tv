"use client";

import type { Channel } from "@/lib/types";

interface ViewerHeaderProps {
  channel: Channel | undefined;
}

export default function ViewerHeader({ channel }: ViewerHeaderProps) {
  const branding = channel?.branding;
  const title =
    branding?.logoText || branding?.displayName || channel?.name || "TATE'S TV";
  const subtitle =
    branding?.description || "A curated live channel experience";

  return (
    <div
      className="rounded-2xl border px-5 py-4"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "var(--text-muted)" }}
          >
            Tate&apos;s TV
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            {title}
          </div>
          <div className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </div>
        </div>

        {channel ? (
          <div
            className="rounded-xl border px-4 py-3 text-right"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ color: "var(--text-muted)" }}
            >
              Channel
            </div>
            <div className="mt-1 text-lg font-semibold">CH {channel.id}</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {branding?.callsign || channel.name}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}