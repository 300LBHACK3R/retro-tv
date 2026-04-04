"use client";

import type { Channel } from "@/lib/types";

interface ViewerHeaderProps {
  channel: Channel | undefined;
}

export default function ViewerHeader({ channel }: ViewerHeaderProps) {
  const branding = channel?.branding;
  const title = branding?.logoText || branding?.displayName || channel?.name || "TATE'S TV";
  const subtitle =
    branding?.description || "A curated live channel experience";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Tate&apos;s TV
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-white">
            {title}
          </div>
          <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
        </div>

        {channel ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-right">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Channel
            </div>
            <div className="mt-1 text-lg font-semibold text-white">
              CH {channel.id}
            </div>
            <div className="text-xs text-slate-400">
              {branding?.callsign || channel.name}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}