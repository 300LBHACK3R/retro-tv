"use client";

import { useMemo, useState } from "react";
import { getThemeById, THEMES } from "@/lib/themes";
import { useStore } from "@/lib/store";

export default function ThemeButton() {
  const [open, setOpen] = useState(false);

  const appMode = useStore((state) => state.appMode);
  const themeId = useStore((state) => state.themeId);
  const ownedPremiumThemes = useStore((state) => state.ownedPremiumThemes);
  const setTheme = useStore((state) => state.setTheme);

  const activeTheme = useMemo(() => getThemeById(themeId), [themeId]);
  const isAdminMode = appMode === "admin";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg px-4 py-2 text-sm font-medium transition"
        style={{
          background: "var(--button-bg)",
          color: "var(--text)",
        }}
      >
        Themes
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 z-[100] w-80 rounded-2xl border p-3 shadow-2xl"
          style={{
            background: "var(--panel-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        >
          <div
            className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--text-muted)" }}
          >
            Theme Library
          </div>

          <div className="mb-3 text-sm" style={{ color: "var(--text-muted)" }}>
            Current:{" "}
            <span style={{ color: "var(--text)" }}>{activeTheme.name}</span>
          </div>

          {isAdminMode && (
            <div
              className="mb-3 rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-muted)",
                background: "var(--panel-alt-bg)",
              }}
            >
              Admin mode: all themes unlocked for testing.
            </div>
          )}

          <div className="space-y-2">
            {THEMES.map((theme) => {
              const unlocked =
                isAdminMode ||
                !theme.isPremium ||
                ownedPremiumThemes.includes(theme.id);

              return (
                <div
                  key={theme.id}
                  className="rounded-xl border p-3"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{theme.name}</div>
                      <div
                        className="mt-1 text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {theme.description}
                      </div>
                    </div>

                    <div
                      className="text-xs font-medium"
                      style={{ color: "var(--primary)" }}
                    >
                      {theme.priceLabel}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (unlocked) {
                          setTheme(theme.id);
                          setOpen(false);
                        }
                      }}
                      disabled={!unlocked}
                      className="rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        background:
                          themeId === theme.id || unlocked
                            ? "var(--primary)"
                            : "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      {themeId === theme.id
                        ? "Active"
                        : unlocked
                        ? "Apply"
                        : "Locked"}
                    </button>

                    {!unlocked && (
                      <div
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Premium theme
                      </div>
                    )}

                    {isAdminMode && theme.isPremium && (
                      <div
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Admin preview
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}