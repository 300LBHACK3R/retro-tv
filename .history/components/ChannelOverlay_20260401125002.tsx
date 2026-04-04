"use client";

import { useStore } from "@/lib/store";

export default function ChannelOverlay() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);

  const activeChannel = channels.find(
    (channel) => channel.id === currentChannelId
  );

  if (!activeChannel) return null;

  return (
    <div className="absolute left-4 top-4 z-10 rounded bg-black/60 px-3 py-1 text-sm text-white">
      {activeChannel.name} • CH {activeChannel.id}
    </div>
  );
}