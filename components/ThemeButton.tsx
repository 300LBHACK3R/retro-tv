"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getThemeById,
  getThemePriceLabel,
  THEMES,
  type ThemeDefinition,
} from "@/lib/themes";
import { useStore } from "@/lib/store";

type ThemeMiniFilter = "all" | "free" | "premium" | "unlocked";

const THEME_FILTERS: { id: ThemeMiniFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "free", label: "Free" },
  { id: "premium", label: "Premium" },
  { id: "unlocked", label: "Unlocked" },
];

/**
 * Premium themes intentionally stay unlocked until Tate's TV has proper
 * user accounts, checkout, payment verification, and entitlement syncing.
 */
const PREMIUM_THEMES_TEMPORARILY_UNLOCKED = true;

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

function themeMatchesQuery(theme: ThemeDefinition, query: string): boolean {
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) {
    return true;
  }

  return [
    theme.name,
    theme.id,
    theme.description,
    theme.category,
    theme.recommendedFor.join(" "),
  ]
    .join(" ")
    .toLowerCase()
    .includes(cleanQuery);
}

function themeMatchesFilter({
  theme,
  filter,
}: {
  theme: ThemeDefinition;
  filter: ThemeMiniFilter;
}): boolean {
  if (filter === "all") return true;
  if (filter === "free") return !theme.isPremium;
  if (filter === "premium") return theme.isPremium;

  return PREMIUM_THEMES_TEMPORARILY_UNLOCKED;
}

function getThemeAccessBadge(theme: ThemeDefinition): {
  label: string;
  background: string;
  color: string;
} {
  if (!theme.isPremium) {
    return {
      label: "Free",
      background: "rgba(34, 197, 94, 0.16)",
      color: "#86efac",
    };
  }

  if (PREMIUM_THEMES_TEMPORARILY_UNLOCKED) {
    return {
      label: "Unlocked",
      background: "rgba(245, 158, 11, 0.18)",
      color: "#fcd34d",
    };
  }

  return {
    label: "Premium",
    background: "rgba(245, 158, 11, 0.18)",
    color: "#fcd34d",
  };
}

export default function ThemeButton() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ThemeMiniFilter>("all");

  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const themeId = useStore((state) => state.themeId);
  const setTheme = useStore((state) => state.setTheme);

  const activeTheme = useMemo(() => getThemeById(themeId), [themeId]);

  const sortedThemes = useMemo(() => {
    return [...THEMES]
      .sort(sortThemes)
      .filter((theme) =>
        themeMatchesFilter({
          theme,
          filter,
        }),
      )
      .filter((theme) => themeMatchesQuery(theme, query));
  }, [filter, query]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    const focusTimer = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 50);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
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
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  const applyTheme = (theme: ThemeDefinition) => {
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
              md:absolute md:inset-x-auto md:right-0 md:top-14 md:max-h-[75vh] md:w-[28rem]
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
                background: "rgba(0,0,0,0.72)",
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

              <div className="mt-3">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search themes..."
                  spellCheck={false}
                  className="w-full rounded-xl border px-3 py-3 text-sm outline-none"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    borderColor: "var(--border)",
                    color: "var(--text)",
                  }}
                />
              </div>

              <div className="ttv-no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
                {THEME_FILTERS.map((item) => {
                  const active = item.id === filter;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilter(item.id)}
                      className="shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em]"
                      style={{
                        background: active ? "var(--primary)" : "var(--button-bg)",
                        borderColor: active ? "var(--primary)" : "var(--border)",
                        color: "var(--text)",
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {PREMIUM_THEMES_TEMPORARILY_UNLOCKED ? (
                <div
                  className="mt-3 rounded-xl border px-3 py-2 text-[11px] leading-5"
                  style={{
                    background: "rgba(34,197,94,0.08)",
                    borderColor: "rgba(34,197,94,0.24)",
                    color: "#bbf7d0",
                  }}
                >
                  Premium themes are currently unlocked while account and payment
                  infrastructure is not active.
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              {sortedThemes.length === 0 ? (
                <div
                  className="rounded-xl border p-4 text-sm"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  No themes match the current search/filter.
                </div>
              ) : (
                sortedThemes.map((theme) => {
                  const isActive = themeId === theme.id;
                  const accessBadge = getThemeAccessBadge(theme);
                  const priceLabel = getThemePriceLabel(theme);

                  return (
                    <article
                      key={theme.id}
                      className={`theme-card overflow-hidden rounded-xl border transition hover:-translate-y-0.5 ${
                        isActive ? "is-active" : ""
                      }`}
                      data-theme-card="true"
                      data-theme-id={theme.id}
                      data-theme-premium={theme.isPremium ? "true" : undefined}
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
                        disabled={isActive}
                        aria-pressed={isActive}
                        className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-80"
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
                                background: accessBadge.background,
                                color: accessBadge.color,
                              }}
                            >
                              {accessBadge.label}
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
                                  : "linear-gradient(135deg, var(--primary), rgba(34,211,238,0.72))",
                                color: "var(--text)",
                              }}
                            >
                              {isActive ? "Active" : "Apply"}
                            </span>
                          </div>
                        </div>
                      </button>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}