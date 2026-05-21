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
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg px-4 py-2 text-sm font-medium transition"
        style={{
          background: "var(--button-bg)",
          color: "var(--text)",
        }}
      >
        Themes
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close theme menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm md:hidden"
          />

          <div
            className="
              fixed inset-x-3 top-16 z-[100] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border p-3 shadow-2xl
              md:absolute md:right-0 md:top-12 md:inset-x-auto md:max-h-[75vh] md:w-80
            "
            style={{
              background: "var(--panel-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div
                  className="text-xs font-semibold uppercase tracking-[0.16em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Theme Library
                </div>

                <div
                  className="mt-1 text-sm"
                  style={{ color: "var(--text-muted)" }}
                >
                  Current:{" "}
                  <span style={{ color: "var(--text)" }}>
                    {activeTheme.name}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-xs font-semibold md:hidden"
                style={{
                  background: "var(--button-bg)",
                  color: "var(--text)",
                }}
              >
                Close
              </button>
            </div>

            {isAdminMode ? (
              <div
                className="mb-3 rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--text-muted)",
                  background: "var(--panel-alt-bg)",
                }}
              >
                Admin mode: all premium themes unlocked for testing.
              </div>
            ) : null}

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
                        <div className="text-sm font-semibold">
                          {theme.name}
                        </div>
                        <div
                          className="mt-1 text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {theme.description}
                        </div>
                      </div>

                      <div
                        className="text-xs font-semibold"
                        style={{ color: "var(--primary)" }}
                      >
                        {theme.priceLabel}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!unlocked) return;
                          setTheme(theme.id);
                          setOpen(false);
                        }}
                        disabled={!unlocked}
                        className="rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                        style={{
                          background:
                            themeId === theme.id || unlocked
                              ? "var(--primary)"
                              : "var(--button-bg)",
                          color:
                            theme.id === "midas-gold"
                              ? "#f5d76e"
                              : "var(--text)",
                        }}
                      >
                        {themeId === theme.id
                          ? "Active"
                          : unlocked
                          ? "Apply"
                          : "Locked"}
                      </button>

                      {theme.isPremium ? (
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {isAdminMode ? "Admin preview" : "Premium"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}