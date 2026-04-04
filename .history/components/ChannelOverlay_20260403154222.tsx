"use client";

import { useStore } from "@/lib/store";

export default function ChannelOverlay() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);

  const activeChannel = channels.find(
    (channel) => channel.id === currentChannelId
  );

  if (!activeChannel) return null;

  const branding = activeChannel.branding;
  const label = branding?.logoText || branding?.displayName || activeChannel.name;
  const callsign = branding?.callsign || `CH ${activeChannel.id}`;
  const accent = branding?.accentColor || "#2563eb";

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className="absolute left-4 top-4 rounded-lg border px-3 py-2 text-sm text-white shadow-lg"
        style={{
          backgroundColor: "rgba(0,0,0,0.65)",
          borderColor: accent,
        }}
      >
        <div className="font-semibold">{label}</div>
        <div className="text-xs text-blue-100/80">
          {callsign} • CH {activeChannel.id}
        </div>
      </div>
    </div>
  );
}