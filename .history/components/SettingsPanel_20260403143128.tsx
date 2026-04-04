"use client";

import { useStore } from "@/lib/store";

export default function SettingsPanel() {
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const guideHeight = useStore((state) => state.guideHeight);

  const setSidebarWidth = useStore((state) => state.setSidebarWidth);
  const setGuideHeight = useStore((state) => state.setGuideHeight);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-white">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        Settings
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Sidebar Width
          </label>
          <input
            type="range"
            min={320}
            max={560}
            value={sidebarWidth}
            onChange={(event) => setSidebarWidth(Number(event.target.value))}
            className="w-full"
          />
          <div className="text-[11px] text-slate-500">{sidebarWidth}px</div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-slate-400">
            Guide Height
          </label>
          <input
            type="range"
            min={200}
            max={420}
            value={guideHeight}
            onChange={(event) => setGuideHeight(Number(event.target.value))}
            className="w-full"
          />
          <div className="text-[11px] text-slate-500">{guideHeight}px</div>
        </div>
      </div>
    </div>
  );
}