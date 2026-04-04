"use client";

import { useStore } from "@/lib/store";

export default function Remote() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const setChannel = useStore((state) => state.setChannel);
  const isGuideOpen = useStore((state) => state.isGuideOpen);
  const toggleGuide = useStore((state) => state.toggleGuide);

  const currentIndex = channels.findIndex(
    (channel) => channel.id === currentChannelId
  );

  const goPrev = () => {
    if (!channels.length) return;
    const nextIndex =
      (currentIndex - 1 + channels.length) % channels.length;
    setChannel(channels[nextIndex].id);
  };

  const goNext = () => {
    if (!channels.length) return;
    const nextIndex = (currentIndex + 1) % channels.length;
    setChannel(channels[nextIndex].id);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={goPrev}
        className="rounded border border-blue-700 bg-[#11345a] px-4 py-2 text-white hover:bg-[#174675]"
      >
        CH-
      </button>

      <button
        onClick={goNext}
        className="rounded border border-blue-700 bg-[#11345a] px-4 py-2 text-white hover:bg-[#174675]"
      >
        CH+
      </button>

      <button
        onClick={toggleGuide}
        className="rounded border border-blue-700 bg-[#11345a] px-4 py-2 text-white hover:bg-[#174675]"
      >
        {isGuideOpen ? "Close Guide" : "Open Guide"}
      </button>
    </div>
  );
}