"use client";


import type { ThemeId } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";
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

type ThemeFilter =
  | "all"
  | "free"
  | "premium"
  | "owned"
  | "locked"
  | ThemeCategory;

const THEME_FILTERS: { id: ThemeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "free", label: "Free" },
  { id: "premium", label: "Premium" },
  { id: "owned", label: "Owned" },
  { id: "locked", label: "Locked" },
  { id: "classic", label: "Classic" },
  { id: "console", label: "Console" },
  { id: "arcade", label: "Arcade" },
  { id: "cartoon", label: "Cartoon" },
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

  return a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function formatCategory(category: string): string {
  return category
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getThemeSearchText(theme: ThemeDefinition): string {
  return [
    theme.id,
    theme.name,
    theme.description,
    theme.category,
    theme.priceLabel,
    ...theme.recommendedFor,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isThemeOwned(
  theme: ThemeDefinition,
  ownedPremiumThemes: ThemeId[],
  isAdmin: boolean,
): boolean {
  if (!theme.isPremium) {
    return true;
  }

  return isAdmin || ownedPremiumThemes.includes(theme.id);
}

function isCategoryFilter(value: ThemeFilter): value is ThemeCategory {
  return ["classic", "console", "arcade", "cartoon", "premium"].includes(value);
}

function matchesFilter({
  theme,
  filter,
  ownedPremiumThemes,
  isAdmin,
}: {
  theme: ThemeDefinition;
  filter: ThemeFilter;
  ownedPremiumThemes: ThemeId[];
  isAdmin: boolean;
}): boolean {
  const unlocked = canUseTheme(theme.id, ownedPremiumThemes, isAdmin);
  const owned = isThemeOwned(theme, ownedPremiumThemes, isAdmin);

  if (filter === "all") {
    return true;
  }

  if (filter === "free") {
    return !theme.isPremium;
  }

  if (filter === "premium") {
    return theme.isPremium;
  }

  if (filter === "owned") {
    return owned;
  }

  if (filter === "locked") {
    return !unlocked;
  }

  if (isCategoryFilter(filter)) {
    return theme.category === filter;
  }

  return true;
}

function getLayoutLabel(theme: ThemeDefinition): string {
  if (theme.id === "electric-blue-live") {
    return "Custom Layout";
  }

  if (
    theme.id === "shaw-2006" ||
    theme.id === "telus-2008-inspired" ||
    theme.id === "saturday-morning-max"
  ) {
    return "Classic Layout";
  }

  return "Theme Skin";
}

function getThemeCountLabel(count: number): string {
  return `${count} theme${count === 1 ? "" : "s"}`;
}

function ThemePill({
  children,
  active = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="ttv-touch-target shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition hover:opacity-90"
        style={{
          background: active ? "var(--primary)" : "var(--button-bg)",
          borderColor: active ? "var(--primary)" : "var(--border)",
          color: "var(--text)",
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <span
      className="rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em]"
      style={{
        borderColor: "var(--border)",
        color: "var(--text-muted)",
      }}
    >
      {children}
    </span>
  );
}

function EmptyThemeState() {
  return (
    <div
      className="rounded-2xl border px-3 py-10 text-center text-sm"
      style={{
        background: "var(--panel-alt-bg)",
        borderColor: "var(--border)",
        color: "var(--text-muted)",
      }}
    >
      No themes match your search/filter.
    </div>
  );
}

export default function ThemePanel({ open, onClose }: ThemePanelProps) {
  const appMode = useStore((state) => state.appMode);
  const themeId = useStore((state) => state.themeId);
  const ownedPremiumThemes = useStore((state) => state.ownedPremiumThemes);
  const setTheme = useStore((state) => state.setTheme);
  const unlockTheme = useStore((state) => state.unlockTheme);

  const [filter, setFilter] = useState<ThemeFilter>("all");
  const [query, setQuery] = useState("");

  const isAdmin = appMode === "admin";

  const visibleThemes = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return [...THEMES]
      .sort(sortThemes)
      .filter((theme) => {
        const matchesQuery =
          !cleanQuery || getThemeSearchText(theme).includes(cleanQuery);

        const filterMatches = matchesFilter({
          theme,
          filter,
          ownedPremiumThemes,
          isAdmin,
        });

        return matchesQuery && filterMatches;
      });
  }, [filter, isAdmin, ownedPremiumThemes, query]);

  const stats = useMemo(() => {
    const freeCount = THEMES.filter((theme) => !theme.isPremium).length;
    const premiumCount = THEMES.filter((theme) => theme.isPremium).length;
    const unlockedCount = THEMES.filter((theme) =>
      canUseTheme(theme.id, ownedPremiumThemes, isAdmin),
    ).length;

    return {
      totalCount: THEMES.length,
      freeCount,
      premiumCount,
      unlockedCount,
    };
  }, [isAdmin, ownedPremiumThemes]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

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
        className="mx-auto my-3 max-w-6xl overflow-hidden rounded-2xl border shadow-2xl sm:my-5"
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
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div
                className="text-xs font-black uppercase tracking-[0.18em]"
                style={{ color: "var(--primary)" }}
              >
                Theme Store
              </div>

              <h2 className="mt-1 text-2xl font-black tracking-tight">
                Choose Your TV Interface
              </h2>

              <p
                className="mt-1 max-w-3xl text-sm leading-6"
                style={{ color: "var(--text-muted)" }}
              >
                Switch between classic cable, console, arcade, cartoon, premium
                skins, and layout-changing interfaces.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="ttv-action-button ttv-touch-target rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] lg:min-w-[8rem]"
            >
              Close
            </button>
          </div>

          <div
            className="mt-4 grid gap-2 rounded-2xl border p-3 text-[10px] font-black uppercase tracking-[0.1em] sm:grid-cols-4"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          >
            <div>
              <span style={{ color: "var(--text)" }}>{stats.totalCount}</span>{" "}
              Total
            </div>

            <div>
              <span style={{ color: "var(--text)" }}>{stats.freeCount}</span>{" "}
              Free
            </div>

            <div>
              <span style={{ color: "var(--text)" }}>{stats.premiumCount}</span>{" "}
              Premium
            </div>

            <div>
              <span style={{ color: "var(--text)" }}>{stats.unlockedCount}</span>{" "}
              Unlocked
            </div>
          </div>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search themes..."
            className="mt-3 w-full rounded-xl border px-3 py-3 text-base outline-none sm:text-sm"
            spellCheck={false}
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />

          <div className="ttv-no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {THEME_FILTERS.map((item) => (
              <ThemePill
                key={item.id}
                active={item.id === filter}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </ThemePill>
            ))}
          </div>

          <div
            className="mt-2 text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            Showing {getThemeCountLabel(visibleThemes.length)}
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleThemes.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyThemeState />
            </div>
          ) : (
            visibleThemes.map((theme) => {
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
                  className="group overflow-hidden rounded-2xl border transition hover:-translate-y-0.5 hover:shadow-2xl"
                  style={{
                    borderColor: isSelected
                      ? theme.colors.primary
                      : "var(--border)",
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
                      className="relative mb-4 h-32 overflow-hidden rounded-xl border"
                      style={{
                        background: getPreviewGradient(theme),
                        borderColor: isSelected
                          ? theme.colors.primary
                          : "var(--border)",
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-transparent to-black/35" />

                      <div className="absolute left-3 top-3 rounded-full bg-black/45 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white backdrop-blur-md">
                        {getLayoutLabel(theme)}
                      </div>

                      <div className="absolute inset-x-3 bottom-3 rounded-lg border border-white/20 bg-black/35 px-3 py-2 backdrop-blur-sm">
                        <div className="truncate text-xs font-black uppercase tracking-[0.18em] text-white">
                          {theme.name}
                        </div>

                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">
                          {formatCategory(theme.category)}
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
                        {theme.recommendedFor.slice(0, 4).map((tag) => (
                          <ThemePill key={tag}>{tag}</ThemePill>
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

                      <span
                        className="rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em]"
                        style={{
                          borderColor: "var(--border)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {getLayoutLabel(theme)}
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
                        className="ttv-action-button ttv-touch-target w-full rounded-xl px-3 py-3 text-xs font-black uppercase tracking-[0.12em]"
                      >
                        Unlock Locally
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
