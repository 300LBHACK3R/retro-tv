"use client";

import { useStore } from "@/lib/store";

interface AppModeToggleProps {
  isAdminAuthorized: boolean;
}

export default function AppModeToggle({ isAdminAuthorized }: AppModeToggleProps) {
  const appMode = useStore((state) => state.appMode);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        Current Mode
      </div>
      <div className="mt-1 text-sm font-medium text-white">
        {appMode === "viewer" ? "Viewer Mode" : "Admin Mode"}
      </div>
      <div className="mt-1 text-xs text-slate-400">
        {isAdminAuthorized
          ? "Admin mode is available on this session."
          : "Admin tools remain locked until authorized."}
      </div>
    </div>
  );
}