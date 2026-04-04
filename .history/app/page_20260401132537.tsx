"use client";

import { useMemo } from "react";
import ChannelOverlay from "@/components/ChannelOverlay";
import CRTOverlay from "@/components/CRTOverlay";
import MultiGuide from "@/components/MultiGuide";
import Player from "@/components/Player";
import Remote from "@/components/Remote";
import StaticTransition from "@/components/StaticTransition";
import { buildSchedule } from "@/lib/scheduler";
import { useStore } from "@/lib/store";

export default function Home() {
  const media = useStore((state) => state.media);
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);

  const activeChannel = channels.find(
    (channel) => channel.id === currentChannelId
  );

  const activeChannelMedia = useMemo(() => {
    if (!activeChannel) return [];
    return media.filter((item) => activeChannel.mediaIds.includes(item.id));
  }, [media, activeChannel]);

  const activeSchedule = useMemo(
    () => buildSchedule(activeChannelMedia),
    [activeChannelMedia]
  );

  const channelSchedules = useMemo(() => {
    return channels.map((channel) => {
      const channelMedia = media.filter((item) =>
        channel.mediaIds.includes(item.id)
      );

      return {
        channel,
        schedule: buildSchedule(channelMedia),
      };
    });
  }, [channels, media]);

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white">
      <div className="mx-auto max-w-7xl space-y-4">
        <Remote />
        <MultiGuide data={channelSchedules} />

        <div className="relative overflow-hidden rounded">
          <StaticTransition trigger={currentChannelId} />
          <ChannelOverlay />
          <Player schedule={activeSchedule} />
          <CRTOverlay />
        </div>
      </div>
    </main>
  );
}