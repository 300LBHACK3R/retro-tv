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
    const nextIndex = (currentIndex - 1 + channels.length) % channels.length;
    setChannel(channels[nextIndex].id);
  };

  const goNext = () => {
    if (!channels.length) return;
    const nextIndex = (currentIndex + 1) % channels.length;
    setChannel(channels[nextIndex].id);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
      <button
        onClick={goPrev}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        CH-
      </button>

      <button
        onClick={goNext}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
      >
        CH+
      </button>

      <button
        onClick={toggleGuide}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
          isGuideOpen
            ? "bg-blue-600 text-white hover:bg-blue-500"
            : "bg-slate-800 text-white hover:bg-slate-700"
        }`}
      >
        {isGuideOpen ? "Close Guide" : "Open Guide"}
      </button>
    </div>
  );
}