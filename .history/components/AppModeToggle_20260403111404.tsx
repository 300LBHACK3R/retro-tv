"use client";

import { useStore } from "@/lib/store";

export default function AppModeToggle() {
  const appMode = useStore((state) => state.appMode);
  const setAppMode = useStore((state) => state.setAppMode);

  return (
    <div className="flex items-center gap-2 rounded border border-blue-700 bg-[#0a2a4a] p-2">
      <button
        onClick={() => setAppMode("viewer")}
        className={`rounded px-4 py-2 text-sm ${
          appMode === "viewer"
            ? "bg-blue-600 text-white"
            : "bg-[#11345a] text-blue-100 hover:bg-[#174675]"
        }`}
      >
        Viewer Mode
      </button>

      <button
        onClick={() => setAppMode("admin")}
        className={`rounded px-4 py-2 text-sm ${
          appMode === "admin"
            ? "bg-blue-600 text-white"
            : "bg-[#11345a] text-blue-100 hover:bg-[#174675]"
        }`}
      >
        Admin Mode
      </button>
    </div>
  );
}