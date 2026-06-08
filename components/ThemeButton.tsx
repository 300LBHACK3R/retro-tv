"use client";


import type { ThemeId } from "@/lib/types";
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

type ThemeFilter = "all" | "free" | "premium" | "owned" | "locked";

const THEME_FILTERS: Array<{
  id: ThemeFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "free", label: "Free" },
  { id: "premium", label: "Premium" },
  { id: "owned", label: "Owned" },
  { id: "locked", label: "Locked" },
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

function formatCategory(value: string): string {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getThemeSearchText(theme: ThemeDefinition): string {
  return [
    theme.name,
    theme.description,
    theme.category,
    theme.priceLabel,
    theme.id,
    ...theme.recommendedFor,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isThemeOwned(
  theme: ThemeDefinition,
  ownedPremiumThemes: ThemeId[],
  isAdminMode: boolean,
): boolean {
  if (!theme.isPremium) {
    return true;
  }

  return isAdminMode || ownedPremiumThemes.includes(theme.id);
}

function matchesFilter({
  theme,
  filter,
  ownedPremiumThemes,
  isAdminMode,
}: {
  theme: ThemeDefinition;
  filter: ThemeFilter;
  ownedPremiumThemes: ThemeId[];
  isAdminMode: boolean;
}): boolean {
  const unlocked = canUseTheme(theme.id, ownedPremiumThemes as ThemeId[], isAdminMode);
  const owned = isThemeOwned(theme, ownedPremiumThemes as ThemeId[], isAdminMode);

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

export default function ThemeButton() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ThemeFilter>("all");

  const panelRef = useRef<HTMLDivElement | null>(null);

  const appMode = useStore((state) => state.appMode);
  const themeId = useStore((state) => state.themeId);
  const ownedPremiumThemes = useStore((state) => state.ownedPremiumThemes);
  const setTheme = useStore((state) => state.setTheme);

  const activeTheme = useMemo(() => getThemeById(themeId), [themeId]);
  const isAdminMode = appMode === "admin";

  const sortedThemes = useMemo(() => [...THEMES].sort(sortThemes), []);

  const visibleThemes = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return sortedThemes.filter((theme) => {
      const queryMatches =
        !cleanQuery || getThemeSearchText(theme).includes(cleanQuery);

      const filterMatches = matchesFilter({
        theme,
        filter,
        ownedPremiumThemes,
        isAdminMode,
      });

      return queryMatches && filterMatches;
    });
  }, [filter, isAdminMode, ownedPremiumThemes, query, sortedThemes]);

  const stats = useMemo(() => {
    const freeCount = THEMES.filter((theme) => !theme.isPremium).length;
    const premiumCount = THEMES.filter((theme) => theme.isPremium).length;
    const unlockedCount = THEMES.filter((theme) =>
      canUseTheme(theme.id, ownedPremiumThemes as ThemeId[], isAdminMode),
    ).length;

    return {
      freeCount,
      premiumCount,
      unlockedCount,
      totalCount: THEMES.length,
    };
  }, [isAdminMode, ownedPremiumThemes]);

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
    const unlocked = canUseTheme(theme.id, ownedPremiumThemes as ThemeId[], isAdminMode);

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
        className="ttv-action-button ttv-touch-target group relative overflow-hidden rounded-2xl border px-4 py-3 text-left shadow-2xl shadow-black/30 sm:min-w-[11rem]"
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
          aria-hidden="true"
        />

        <span
          className="block text-[10px] font-black uppercase tracking-[0.2em]"
          style={{ color: "var(--text-muted)" }}
        >
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
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm md:hidden"
          />

          <div
            className={[
              "fixed inset-x-3 top-16 z-[100] max-h-[calc(100dvh-5rem)] overflow-hidden rounded-2xl border shadow-2xl",
              "md:absolute md:inset-x-auto md:right-0 md:top-14 md:max-h-[78vh] md:w-[31rem]",
            ].join(" ")}
            style={{
              background:
                "radial-gradient(circle at top right, color-mix(in srgb, var(--primary) 14%, transparent), transparent 34%), linear-gradient(135deg, rgba(0,0,0,0.96), rgba(15,23,42,0.92))",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
            role="dialog"
            aria-label="Theme library"
          >
            <div
              className="sticky top-0 z-10 border-b p-3 backdrop-blur-xl"
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
                  className="ttv-action-button ttv-touch-target rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.1em]"
                >
                  Close
                </button>
              </div>

              <div
                className="mt-3 grid gap-2 rounded-2xl border p-2 text-[10px] font-black uppercase tracking-[0.1em] sm:grid-cols-4"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                <div>
                  <span style={{ color: "var(--text)" }}>
                    {stats.totalCount}
                  </span>{" "}
                  Total
                </div>
                <div>
                  <span style={{ color: "var(--text)" }}>{stats.freeCount}</span>{" "}
                  Free
                </div>
                <div>
                  <span style={{ color: "var(--text)" }}>
                    {stats.premiumCount}
                  </span>{" "}
                  Premium
                </div>
                <div>
                  <span style={{ color: "var(--text)" }}>
                    {stats.unlockedCount}
                  </span>{" "}
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

              <div className="ttv-no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                {THEME_FILTERS.map((item) => (
                  <ThemePill
                    key={item.id}
                    active={filter === item.id}
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

            <div className="max-h-[calc(100dvh-18rem)] space-y-2 overflow-y-auto p-3 md:max-h-[48vh]">
              {visibleThemes.length > 0 ? (
                visibleThemes.map((theme) => {
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
                      className="overflow-hidden rounded-2xl border transition hover:-translate-y-0.5"
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
                          className="relative h-14"
                          style={{
                            background: getPreviewGradient(theme),
                          }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-transparent to-black/35" />

                          <div className="absolute bottom-2 left-3 rounded-full bg-black/45 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white backdrop-blur-md">
                            {getLayoutLabel(theme)}
                          </div>
                        </div>

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
                            <ThemePill>{formatCategory(theme.category)}</ThemePill>
                            <ThemePill>{priceLabel}</ThemePill>
                            <ThemePill>{getLayoutLabel(theme)}</ThemePill>

                            <span
                              className="ml-auto rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em]"
                              style={{
                                background: isActive
                                  ? "var(--button-bg)"
                                  : unlocked
                                    ? "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))"
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
                })
              ) : (
                <div
                  className="rounded-2xl border px-3 py-8 text-center text-sm"
                  style={{
                    background: "var(--panel-alt-bg)",
                    borderColor: "var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  No themes match your search/filter.
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}