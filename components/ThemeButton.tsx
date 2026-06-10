"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  canUseTheme,
  getThemeAccessLabel,
  getThemeById,
  getThemePriceLabel,
  THEMES,
} from "@/lib/themes";
import { useStore } from "@/lib/store";
import type { ThemeDefinition } from "@/lib/themes";

function getPreviewGradient(theme: ThemeDefinition): string {
  return (
    theme.previewGradient ||
    `linear-gradient(135deg, ${theme.colors.appBg}, ${theme.colors.primary})`
  );
}

function sortThemes(a: ThemeDefinition, b: ThemeDefinition): number {
  if (a.isPremium !== b.isPremium) {
    return a.isPremium ? 1 : -1;
  }

  if (a.category !== b.category) {
    return a.category.localeCompare(b.category);
  }

  return a.name.localeCompare(b.name);
}

function formatCategory(value: string): string {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ThemeButton() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const appMode = useStore((state) => state.appMode);
  const themeId = useStore((state) => state.themeId);
  const ownedPremiumThemes = useStore((state) => state.ownedPremiumThemes);
  const setTheme = useStore((state) => state.setTheme);

  const activeTheme = useMemo(() => getThemeById(themeId), [themeId]);
  const isAdminMode = appMode === "admin";

  const sortedThemes = useMemo(() => [...THEMES].sort(sortThemes), []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
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
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="group relative overflow-hidden rounded-2xl border px-4 py-3 text-left shadow-2xl shadow-black/30 transition hover:scale-[1.02] hover:opacity-95 sm:min-w-[11rem]"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.04), transparent 44%), var(--button-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Open theme switcher"
      >
        <span
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--primary), transparent)",
          }}
        />

        <span className="block text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
          Theme
        </span>

        <span className="mt-0.5 block max-w-[9rem] truncate text-sm font-black uppercase tracking-[0.08em]">
          {activeTheme.name}
        </span>
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
              theme-panel fixed inset-x-3 top-16 z-[100] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border p-3 shadow-2xl
              md:absolute md:right-0 md:top-14 md:inset-x-auto md:max-h-[75vh] md:w-[28rem]
            "
            style={{
              background:
                "radial-gradient(circle at top right, rgba(34,211,238,0.14), transparent 34%), linear-gradient(135deg, rgba(0,0,0,0.95), rgba(18,18,18,0.9))",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            role="dialog"
            aria-label="Theme library"
          >
            <div
              className="sticky top-0 z-10 mb-3 rounded-xl border p-3 backdrop-blur-xl"
              style={{
                background: "rgba(0,0,0,0.42)",
                borderColor: "var(--border)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div
                    className="text-[11px] font-black uppercase tracking-[0.2em]"
                    style={{ color: "var(--primary)" }}
                  >
                    Theme Library
                  </div>

                  <div
                    className="mt-1 truncate text-xs"
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
            </div>

            <div className="space-y-2">
              {sortedThemes.map((theme) => {
                const isActive = themeId === theme.id;
                const unlocked = canUseTheme(
                  theme.id,
                  ownedPremiumThemes,
                  isAdminMode,
                );

                const accessLabel = getThemeAccessLabel(
                  theme,
                  ownedPremiumThemes,
                  isAdminMode,
                );

                const priceLabel = getThemePriceLabel(theme);

                return (
                  <article
                    key={theme.id}
                    className={`theme-card overflow-hidden rounded-xl border transition hover:-translate-y-0.5 ${isActive ? "is-active" : ""} ${!unlocked ? "is-locked" : ""}`}
                    data-theme-card="true"
                    data-theme-id={theme.id}
                    data-theme-locked={!unlocked ? "true" : undefined}
                    aria-pressed={isActive}
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(255,255,255,0.04), transparent 46%), rgba(255,255,255,0.035)",
                      borderColor: isActive
                        ? theme.colors.primary
                        : "var(--border)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => applyTheme(theme)}
                      disabled={!unlocked || isActive}
                      className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-65"
                    >
                      <div
                        className="theme-preview h-4"
                        data-theme-preview="true"
                        style={{
                          background: getPreviewGradient(theme),
                        }}
                      />

                      <div className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black">
                              {theme.name}
                            </div>

                            <div
                              className="mt-1 line-clamp-2 text-xs leading-relaxed"
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
                            {accessLabel}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
                            style={{
                              borderColor: "var(--border)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {formatCategory(theme.category)}
                          </span>

                          <span
                            className="rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
                            style={{
                              borderColor: "var(--border)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {priceLabel}
                          </span>

                          <span
                            className="ml-auto rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em]"
                            style={{
                              background: isActive
                                ? "var(--button-bg)"
                                : unlocked
                                  ? "linear-gradient(135deg, var(--primary), rgba(34,211,238,0.72))"
                                  : "var(--button-bg)",
                              color: "var(--text)",
                            }}
                          >
                            {isActive ? "Active" : unlocked ? "Apply" : "Locked"}
                          </span>
                        </div>
                      </div>
                    </button>
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
