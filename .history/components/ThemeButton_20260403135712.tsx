"use client";

import { useState } from "react";

const themes = [
  { name: "Default", locked: false },
  { name: "Retro Gold", locked: true },
  { name: "Neon Broadcast", locked: true },
];

export default function ThemeButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        Themes
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-56 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl">
          <div className="mb-2 text-xs uppercase text-slate-400">
            Themes
          </div>

          {themes.map((t) => (
            <div
              key={t.name}
              className="flex items-center justify-between rounded px-2 py-2 text-sm text-white hover:bg-slate-800"
            >
              {t.name}
              {t.locked && (
                <span className="text-xs text-yellow-400">Premium</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}