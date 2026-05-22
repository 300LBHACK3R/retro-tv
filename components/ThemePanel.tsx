"use client";

import { useMemo } from "react";
import { canUseTheme, THEMES } from "@/lib/themes";
import { useStore } from "@/lib/store";
import type { ThemeDefinition } from "@/lib/themes";

interface ThemePanelProps {
  open: boolean;
  onClose: () => void;
}

function getPreviewGradient(theme: ThemeDefinition): string {
  return `linear-gradient(135deg, ${theme.colors.appBg}, ${theme.colors.primary})`;
}

export default function ThemePanel({ open, onClose }: ThemePanelProps) {
  const appMode = useStore((state) => state.appMode);
  const themeId = useStore((state) => state.themeId);
  const ownedPremiumThemes = useStore((state) => state.ownedPremiumThemes);
  const setTheme = useStore((state) => state.setTheme);
  const unlockTheme = useStore((state) => state.unlockTheme);

  const isAdmin = appMode === "admin";

  const sortedThemes = useMemo(
    () =>
      [...THEMES].sort((a, b) => {
        if (a.isPremium === b.isPremium) return a.name.localeCompare(b.name);
        return a.isPremium ? 1 : -1;
      }),
    [],
  );

  if (!open) {
    return null;
  }

  const handleThemeSelect = (theme: ThemeDefinition) => {
    const isUnlocked = canUseTheme(theme.id, ownedPremiumThemes, isAdmin);

    if (!isUnlocked) {
      return;
    }

    setTheme(theme.id);
  };

  const handleUnlockPreview = (theme: ThemeDefinition) => {
    if (!isAdmin || !theme.isPremium) {
      return;
    }

    unlockTheme(theme.id);
    setTheme(theme.id);
  };

  return (
    <div
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Theme selection panel"
    >
      <div
        className="mx-auto my-6 max-w-3xl rounded-2xl border p-5 shadow-2xl"
        style={{
          background: "var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--text-muted)" }}
            >
              Themes
            </div>

            <h2 className="mt-1 text-xl font-semibold">Choose a Theme</h2>

            <p className="mt-1 max-w-xl text-sm" style={{ color: "var(--text-muted)" }}>
              Free themes are available to everyone. Premium themes are locked
              for viewers unless owned, while admin mode can preview and unlock
              them for testing.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
            style={{
              background: "var(--button-bg)",
              color: "var(--text)",
            }}
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {sortedThemes.map((theme) => {
            const isSelected = theme.id === themeId;
            const isUnlocked = canUseTheme(theme.id, ownedPremiumThemes, isAdmin);
            const isOwned = ownedPremiumThemes.includes(theme.id);

            return (
              <article
                key={theme.id}
                className="overflow-hidden rounded-xl border"
                style={{
                  borderColor: isSelected ? theme.colors.primary : "var(--border)",
                  background: "var(--panel-alt-bg)",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleThemeSelect(theme)}
                  disabled={!isUnlocked}
                  className="block w-full p-4 text-left transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div
                    className="mb-3 h-20 rounded-lg border"
                    style={{
                      background: getPreviewGradient(theme),
                      borderColor: "var(--border)",
                    }}
                  />

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{theme.name}</div>

                      <div
                        className="mt-1 text-sm leading-relaxed"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {theme.description}
                      </div>
                    </div>

                    <div
                      className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                      style={{
                        background: theme.isPremium
                          ? "rgba(245, 158, 11, 0.18)"
                          : "rgba(34, 197, 94, 0.16)",
                        color: theme.isPremium ? "#fcd34d" : "#86efac",
                      }}
                    >
                      {theme.isPremium ? theme.priceLabel : "Free"}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {isSelected ? (
                      <span
                        className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                        style={{
                          borderColor: theme.colors.primary,
                          color: theme.colors.primary,
                        }}
                      >
                        Active
                      </span>
                    ) : null}

                    {theme.isPremium && !isUnlocked ? (
                      <span
                        className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                        style={{
                          borderColor: "var(--border)",
                          color: "var(--text-muted)",
                        }}
                      >
                        Locked
                      </span>
                    ) : null}

                    {theme.isPremium && isOwned ? (
                      <span
                        className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                        style={{
                          borderColor: "rgba(34, 197, 94, 0.35)",
                          color: "#86efac",
                        }}
                      >
                        Owned
                      </span>
                    ) : null}

                    {theme.isPremium && isAdmin ? (
                      <span
                        className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                        style={{
                          borderColor: "rgba(96, 165, 250, 0.35)",
                          color: "#93c5fd",
                        }}
                      >
                        Admin Preview
                      </span>
                    ) : null}
                  </div>
                </button>

                {theme.isPremium && isAdmin && !isOwned ? (
                  <div
                    className="border-t px-4 py-3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <button
                      type="button"
                      onClick={() => handleUnlockPreview(theme)}
                      className="rounded-lg px-3 py-2 text-xs font-semibold transition hover:opacity-90"
                      style={{
                        background: "var(--button-bg)",
                        color: "var(--text)",
                      }}
                    >
                      Unlock Locally for Testing
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}