"use client";

import { useMemo, useState } from "react";
import {
  canUseTheme,
  getThemeAccessLabel,
  getThemePriceLabel,
  THEMES,
} from "@/lib/themes";
import { useStore } from "@/lib/store";
import type { ThemeCategory, ThemeDefinition } from "@/lib/themes";

interface ThemePanelProps {
  open: boolean;
  onClose: () => void;
}

type ThemeFilter = "all" | ThemeCategory;

const THEME_FILTERS: { id: ThemeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "classic", label: "Classic" },
  { id: "console", label: "Console" },
  { id: "arcade", label: "Arcade" },
  { id: "cartoon", label: "Cartoon" },
  { id: "premium", label: "Premium" },
];

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

function formatCategory(category: string): string {
  return category.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getThemePitch(theme: ThemeDefinition): string {
  if (theme.id === "electric-blue-live") {
    return "Modern command-center interface with electric neon panels and app-style polish.";
  }

  if (theme.category === "premium") {
    return "Premium visual package designed to make Tate's TV feel more collectible.";
  }

  if (theme.category === "cartoon") {
    return "Bright, fun, playful interface styling for animated and kids-style channels.";
  }

  if (theme.category === "arcade") {
    return "High-energy retro arcade look for gaming, anime, and action channels.";
  }

  if (theme.category === "console") {
    return "Console-era interface styling inspired by old dashboards and game systems.";
  }

  return "Classic cable-inspired look for nostalgic live-TV browsing.";
}

export default function ThemePanel({ open, onClose }: ThemePanelProps) {
  const appMode = useStore((state) => state.appMode);
  const themeId = useStore((state) => state.themeId);
  const ownedPremiumThemes = useStore((state) => state.ownedPremiumThemes);
  const setTheme = useStore((state) => state.setTheme);
  const unlockTheme = useStore((state) => state.unlockTheme);

  const [filter, setFilter] = useState<ThemeFilter>("all");

  const isAdmin = appMode === "admin";

  const sortedThemes = useMemo(() => {
    const themes = [...THEMES].sort(sortThemes);

    if (filter === "all") {
      return themes;
    }

    return themes.filter((theme) => theme.category === filter);
  }, [filter]);

  const premiumCount = THEMES.filter((theme) => theme.isPremium).length;
  const freeCount = THEMES.length - premiumCount;

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
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/75 p-3 backdrop-blur-[3px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Theme selection panel"
    >
      <div
        className="ttv-theme-marketplace theme-panel mx-auto my-4 max-w-6xl overflow-hidden rounded-2xl border shadow-2xl sm:my-6"
        style={{
          background: "var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div
          className="sticky top-0 z-10 border-b p-4 backdrop-blur-xl sm:p-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.04), transparent 45%), var(--panel-bg)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div
                className="text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--text-muted)" }}
              >
                Theme Store
              </div>

              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                Premium TV Interfaces
              </h2>

              <p
                className="mt-2 max-w-3xl text-sm leading-6"
                style={{ color: "var(--text-muted)" }}
              >
                Themes change the personality of the app: classic cable, console,
                arcade, cartoon, gold premium, and Electric Blue command-center
                styling. This is the foundation for paid visual packs.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className="rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]"
                  style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                >
                  {THEMES.length} total
                </span>

                <span
                  className="rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]"
                  style={{ borderColor: "rgba(34,197,94,0.35)", color: "#86efac" }}
                >
                  {freeCount} free
                </span>

                <span className="ttv-premium-badge" data-premium-badge="true">
                  {premiumCount} premium
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition hover:scale-[1.01] lg:min-w-[8rem]"
              style={{
                background: "var(--button-bg)",
                color: "var(--text)",
              }}
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 ttv-no-scrollbar">
            {THEME_FILTERS.map((item) => {
              const active = item.id === filter;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className="shrink-0 rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition hover:opacity-90"
                  style={{
                    background: active ? "var(--primary)" : "var(--button-bg)",
                    borderColor: active ? "var(--primary)" : "var(--border)",
                    color: active ? "var(--text)" : "var(--text-muted)",
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
          {sortedThemes.map((theme) => {
            const isSelected = theme.id === themeId;
            const isUnlocked = canUseTheme(theme.id, ownedPremiumThemes, isAdmin);
            const isOwned = ownedPremiumThemes.includes(theme.id);
            const accessLabel = getThemeAccessLabel(
              theme,
              ownedPremiumThemes,
              isAdmin,
            );
            const priceLabel = getThemePriceLabel(theme);

            return (
              <article
                key={theme.id}
                className={`ttv-theme-card theme-card group overflow-hidden rounded-2xl border transition hover:-translate-y-0.5 hover:shadow-2xl ${isSelected ? "is-active" : ""} ${!isUnlocked ? "is-locked" : ""}`}
                data-theme-card="true"
                data-theme-id={theme.id}
                data-theme-locked={!isUnlocked ? "true" : undefined}
                aria-pressed={isSelected}
                style={{
                  borderColor: isSelected ? theme.colors.primary : "var(--border)",
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.035), transparent 46%), var(--panel-alt-bg)",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleThemeSelect(theme)}
                  disabled={!isUnlocked}
                  className="block w-full p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div
                    className="ttv-theme-preview theme-preview relative mb-4 h-32 overflow-hidden rounded-xl border"
                    data-theme-preview="true"
                    style={{
                      background: getPreviewGradient(theme),
                      borderColor: isSelected ? theme.colors.primary : "var(--border)",
                    }}
                  >
                    <div className="absolute left-3 top-3 flex gap-2">
                      <span
                        className="rounded-full border border-white/20 bg-black/35 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white backdrop-blur-sm"
                      >
                        {formatCategory(theme.category)}
                      </span>

                      {theme.isPremium ? (
                        <span className="rounded-full border border-yellow-300/30 bg-black/35 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-yellow-200 backdrop-blur-sm">
                          Premium
                        </span>
                      ) : null}
                    </div>

                    <div className="absolute inset-x-3 bottom-3 rounded-lg border border-white/20 bg-black/35 px-3 py-2 backdrop-blur-sm">
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-white">
                        {theme.name}
                      </div>
                      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">
                        {isSelected ? "Currently active" : getThemePitch(theme)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-black">
                        {theme.name}
                      </div>

                      <div
                        className="mt-1 line-clamp-3 text-sm leading-relaxed"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {theme.description}
                      </div>
                    </div>

                    <div
                      className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]"
                      style={{
                        background: theme.isPremium
                          ? "rgba(245, 158, 11, 0.18)"
                          : "rgba(34, 197, 94, 0.16)",
                        color: theme.isPremium ? "#fcd34d" : "#86efac",
                      }}
                    >
                      {theme.isPremium ? priceLabel : "Free"}
                    </div>
                  </div>

                  {theme.recommendedFor.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {theme.recommendedFor.slice(0, 5).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                          style={{
                            borderColor: "var(--border)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {isSelected ? (
                      <span
                        className="rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em]"
                        style={{
                          borderColor: theme.colors.primary,
                          color: theme.colors.primary,
                        }}
                      >
                        Active
                      </span>
                    ) : null}

                    <span
                      className="rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em]"
                      style={{
                        borderColor: "var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {accessLabel}
                    </span>

                    {theme.isPremium && isOwned ? (
                      <span
                        className="rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em]"
                        style={{
                          borderColor: "rgba(34, 197, 94, 0.35)",
                          color: "#86efac",
                        }}
                      >
                        Owned
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
                      className="theme-unlock-button w-full rounded-xl px-3 py-3 text-xs font-black uppercase tracking-[0.12em] transition hover:scale-[1.01]"
                      data-unlock-theme="true"
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
