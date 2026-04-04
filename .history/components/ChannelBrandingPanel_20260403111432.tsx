"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";

export default function ChannelBrandingPanel() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const updateChannelBranding = useStore((state) => state.updateChannelBranding);

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === currentChannelId),
    [channels, currentChannelId]
  );

  if (!activeChannel) {
    return (
      <div className="rounded border border-blue-700 bg-[#0a2a4a] p-4 text-white">
        No active channel.
      </div>
    );
  }

  const branding = activeChannel.branding ?? {
    displayName: activeChannel.name,
    callsign: activeChannel.name,
    description: "",
    accentColor: "#2563eb",
    logoText: activeChannel.name,
  };

  return (
    <div className="rounded border border-blue-700 bg-[#0a2a4a] p-4 text-white">
      <div className="mb-3 text-sm font-semibold tracking-wide">
        Channel Branding
      </div>

      <div className="grid gap-3">
        <div>
          <label className="mb-1 block text-xs text-blue-200">Display Name</label>
          <input
            value={branding.displayName}
            onChange={(e) =>
              updateChannelBranding(activeChannel.id, {
                displayName: e.target.value,
              })
            }
            className="w-full rounded border border-blue-700 bg-[#11345a] px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-blue-200">Callsign</label>
          <input
            value={branding.callsign}
            onChange={(e) =>
              updateChannelBranding(activeChannel.id, {
                callsign: e.target.value,
              })
            }
            className="w-full rounded border border-blue-700 bg-[#11345a] px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-blue-200">Logo Text</label>
          <input
            value={branding.logoText}
            onChange={(e) =>
              updateChannelBranding(activeChannel.id, {
                logoText: e.target.value,
              })
            }
            className="w-full rounded border border-blue-700 bg-[#11345a] px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-blue-200">Description</label>
          <textarea
            value={branding.description}
            onChange={(e) =>
              updateChannelBranding(activeChannel.id, {
                description: e.target.value,
              })
            }
            rows={3}
            className="w-full rounded border border-blue-700 bg-[#11345a] px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-blue-200">Accent Color</label>
          <input
            type="color"
            value={branding.accentColor}
            onChange={(e) =>
              updateChannelBranding(activeChannel.id, {
                accentColor: e.target.value,
              })
            }
            className="h-10 w-full rounded border border-blue-700 bg-[#11345a]"
          />
        </div>
      </div>
    </div>
  );
}