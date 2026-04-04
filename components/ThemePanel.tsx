"use client";

import { useState } from "react";

const themes = [
  { id: "shaw-2006", name: "Shaw 2006", premium: false },
  { id: "retro-gold", name: "Retro Gold", premium: true },
  { id: "gaming-neon", name: "Gaming Neon", premium: true },
  { id: "true-standard", name: "The True Standard", premium: true },
];

interface ThemePanelProps {
  open: boolean;
  onClose: () => void;
}

export default function ThemePanel({ open, onClose }: ThemePanelProps) {
  const [selectedTheme, setSelectedTheme] = useState("shaw-2006");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 p-4 backdrop-blur-[2px]">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Themes
            </div>
            <div className="mt-1 text-xl font-semibold">Choose a Theme</div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setSelectedTheme(theme.id)}
              className={`rounded-xl border p-4 text-left transition ${
                selectedTheme === theme.id
                  ? "border-blue-500 bg-blue-600/10"
                  : "border-slate-800 bg-slate-900 hover:bg-slate-800"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{theme.name}</div>
                <div
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                    theme.premium
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-emerald-500/20 text-emerald-300"
                  }`}
                >
                  {theme.premium ? "Premium" : "Free"}
                </div>
              </div>

              <div className="mt-2 text-sm text-slate-400">
                {theme.premium
                  ? "Premium theme preview. Great for future sales."
                  : "Included starter theme."}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}