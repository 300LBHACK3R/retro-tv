"use client";

import { useStore } from "@/lib/store";

export default function SettingsPanel() {
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const guideHeight = useStore((state) => state.guideHeight);
  const guideZoom = useStore((state) => state.guideZoom);

  const setSidebarWidth = useStore((state) => state.setSidebarWidth);
  const setGuideHeight = useStore((state) => state.setGuideHeight);
  const setGuideZoom = useStore((state) => state.setGuideZoom);
  const resetLayoutSettings = useStore((state) => state.resetLayoutSettings);

  return (
    <div className="rounded border border-blue-700 bg-[#0a2a4a] p-4 text-white">
      <div className="mb-3 text-sm font-semibold tracking-wide">
        Layout Settings
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-blue-200">
            Sidebar Width
          </label>
          <input
            type="range"
            min={320}
            max={560}
            value={sidebarWidth}
            onChange={(e) => setSidebarWidth(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-[11px] text-blue-100/80">{sidebarWidth}px</div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-blue-200">
            Guide Height
          </label>
          <input
            type="range"
            min={200}
            max={420}
            value={guideHeight}
            onChange={(e) => setGuideHeight(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-[11px] text-blue-100/80">{guideHeight}px</div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-blue-200">
            Guide Zoom
          </label>
          <input
            type="range"
            min={4}
            max={10}
            value={guideZoom}
            onChange={(e) => setGuideZoom(Number(e.target.value))}
            className="w-full"
          />
          <div className="text-[11px] text-blue-100/80">{guideZoom}px / min</div>
        </div>

        <button
          onClick={resetLayoutSettings}
          className="rounded border border-blue-700 bg-[#11345a] px-4 py-2 text-white transition hover:bg-[#174675]"
        >
          Reset Layout
        </button>
      </div>
    </div>
  );
}