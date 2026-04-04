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
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-[var(--panel-bg)] p-3">
      <button
        onClick={goPrev}
        className="rounded-lg px-4 py-2 text-sm font-medium transition"
        style={{
          background: "var(--button-bg)",
          color: "var(--text)",
        }}
      >
        CH-
      </button>

      <button
        onClick={goNext}
        className="rounded-lg px-4 py-2 text-sm font-medium transition"
        style={{
          background: "var(--button-bg)",
          color: "var(--text)",
        }}
      >
        CH+
      </button>

      <button
        onClick={toggleGuide}
        className="rounded-lg px-4 py-2 text-sm font-medium transition"
        style={{
          background: isGuideOpen ? "var(--primary)" : "var(--button-bg)",
          color: "var(--text)",
        }}
      >
        {isGuideOpen ? "Close Guide" : "Open Guide"}
      </button>
    </div>
  );
}