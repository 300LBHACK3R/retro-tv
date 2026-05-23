"use client";

import { useEffect, useMemo, useState } from "react";
import { canUseTheme, getThemeById, THEMES } from "@/lib/themes";
import { useStore } from "@/lib/store";
import type { ThemeDefinition } from "@/lib/themes";

function getThemeStatusLabel(
  theme: ThemeDefinition,
  isAdminMode: boolean,
  isOwned: boolean,
): string {
  if (!theme.isPremium) {
    return "Free";
  }

  if (isAdminMode) {
    return "Preview";
  }

  if (isOwned) {
    return "Owned";
  }

  return "Premium";
}

function getPreviewGradient(theme: ThemeDefinition): string {
  return `linear-gradient(135deg, ${theme.colors.appBg}, ${theme.colors.primary})`;
}

export default function ThemeButton() {
  const [open, setOpen] = useState(false);

  const appMode = useStore((state) => state.appMode);
  const themeId = useStore((state) => state.themeId);
  const ownedPremiumThemes = useStore((state) => state.ownedPremiumThemes);
  const setTheme = useStore((state) => state.setTheme);

  const activeTheme = useMemo(() => getThemeById(themeId), [themeId]);
  const isAdminMode = appMode === "admin";

  const sortedThemes = useMemo(
    () =>
      [...THEMES].sort((a, b) => {
        if (a.isPremium === b.isPremium) {
          return a.name.localeCompare(b.name);
        }

        return a.isPremium ? 1 : -1;
      }),
    [],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const applyTheme = (theme: ThemeDefinition) => {
    const unlocked = canUseTheme(theme.id, ownedPremiumThemes, isAdminMode);

    if (!unlocked) {
      return;
    }

    setTheme(theme.id);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative overflow-hidden rounded-2xl border px-5 py-3 text-sm font-black uppercase tracking-[0.16em] shadow-2xl shadow-black/30 transition hover:scale-[1.02] hover:opacity-95"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,0,0,0.92), rgba(18,18,18,0.78))",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--primary), transparent)",
          }}
        />
        Themes
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close theme menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-sm md:hidden"
          />

          <div
            className="
              fixed inset-x-3 top-16 z-[100] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl border p-3 shadow-2xl
              md:absolute md:right-0 md:top-14 md:inset-x-auto md:max-h-[75vh] md:w-96
            "
            style={{
              background:
                "radial-gradient(circle at top right, rgba(212,175,55,0.12), transparent 34%), linear-gradient(135deg, rgba(0,0,0,0.95), rgba(18,18,18,0.9))",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            role="dialog"
            aria-label="Theme library"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div
                  className="text-[11px] font-black uppercase tracking-[0.2em]"
                  style={{ color: "var(--primary)" }}
                >
                  Theme Library
                </div>

                <div
                  className="mt-1 text-xs"
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
                className="rounded-xl px-3 py-2 text-xs font-semibold transition hover:opacity-90 md:hidden"
                style={{
                  background: "var(--button-bg)",
                  color: "var(--text)",
                }}
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              {sortedThemes.map((theme) => {
                const isActive = themeId === theme.id;
                const isOwned = ownedPremiumThemes.includes(theme.id);
                const unlocked = canUseTheme(
                  theme.id,
                  ownedPremiumThemes,
                  isAdminMode,
                );

                const statusLabel = getThemeStatusLabel(
                  theme,
                  isAdminMode,
                  isOwned,
                );

                return (
                  <article
                    key={theme.id}
                    className="overflow-hidden rounded-xl border"
                    style={{
                      background: "rgba(255,255,255,0.035)",
                      borderColor: isActive
                        ? theme.colors.primary
                        : "var(--border)",
                    }}
                  >
                    <div
                      className="h-2"
                      style={{
                        background: getPreviewGradient(theme),
                      }}
                    />

                    <div className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {theme.name}
                          </div>

                          <div
                            className="mt-1 text-xs leading-relaxed"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {theme.description}
                          </div>
                        </div>

                        <div
                          className="shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
                          style={{
                            background: theme.isPremium
                              ? "rgba(245, 158, 11, 0.18)"
                              : "rgba(34, 197, 94, 0.16)",
                            color: theme.isPremium ? "#fcd34d" : "#86efac",
                          }}
                        >
                          {statusLabel}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => applyTheme(theme)}
                          disabled={!unlocked || isActive}
                          className="rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition hover:scale-[1.02] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                          style={{
                            background: isActive
                              ? "var(--button-bg)"
                              : unlocked
                                ? "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))"
                                : "var(--button-bg)",
                            color: "var(--text)",
                          }}
                        >
                          {isActive ? "Active" : unlocked ? "Apply" : "Locked"}
                        </button>

                        <span
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {theme.priceLabel}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}