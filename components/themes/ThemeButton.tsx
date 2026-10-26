"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { THEME_PREVIEWS } from "@/components/themes/themePreviews";
import { useDialogViewport } from "@/components/viewer/useDialogViewport";
import {
  canUseTheme,
  getAllThemes,
  getThemeAccessLabel,
  getThemeById,
  getThemeCategoryMeta,
  PREMIUM_THEMES_TEMPORARILY_UNLOCKED,
  THEME_CATEGORY_META,
  THEME_SEASON_META,
  type ThemeCategory,
  type ThemeDefinition,
  type ThemeSeason,
} from "@/lib/themes";
import { useStore } from "@/lib/store";
import { setProfileTheme, useProfiles } from "@/lib/deviceProfiles";

const DIALOG_ID = "ttv-theme-library";

type CategoryFilter = "all" | ThemeCategory;

type FilterOption<T extends string> = {
  id: T;
  label: string;
};

const CATEGORY_FILTERS: readonly FilterOption<CategoryFilter>[] = [
  { id: "all", label: "All styles" },
  ...THEME_CATEGORY_META.map((category) => ({
    id: category.id,
    label: category.label,
  })),
];

function themeMatchesQuery(theme: ThemeDefinition, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase("en-CA");

  if (!normalizedQuery) {
    return true;
  }

  return [
    theme.name,
    theme.shortName,
    theme.description,
    getThemeCategoryMeta(theme.category).label,
    theme.season ?? "",
    theme.layout,
    theme.recommendedFor.join(" "),
  ]
    .join(" ")
    .toLocaleLowerCase("en-CA")
    .includes(normalizedQuery);
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
      ].join(","),
    ),
  ).filter((element) => {
    return !element.hasAttribute("hidden") && element.offsetParent !== null;
  });
}

function getAccessCopy(
  theme: ThemeDefinition,
  ownedThemeIds: readonly ThemeDefinition["id"][],
): string {
  return getThemeAccessLabel(theme, ownedThemeIds, false);
}

function ThemeCard({
  theme,
  isActive,
  accessLabel,
  isAvailable,
  onSelect,
}: {
  theme: ThemeDefinition;
  isActive: boolean;
  isAvailable: boolean;
  accessLabel: string;
  onSelect: (theme: ThemeDefinition) => void;
}) {
  const category = getThemeCategoryMeta(theme.category);
  const preview = THEME_PREVIEWS[theme.id];
  const previewStyle = {
    "--theme-preview": theme.previewGradient,
  } as CSSProperties;

  return (
    <button
      type="button"
      className="theme-card"
      data-theme-id={theme.id}
      aria-pressed={isActive}
      aria-label={`${isActive ? "Current theme" : isAvailable ? "Apply theme" : "Locked theme"}: ${theme.name}`}
      disabled={!isAvailable}
      onClick={() => onSelect(theme)}
    >
      <span
        className="theme-card__preview"
        style={previewStyle}
        aria-hidden="true"
      >
        <Image
          src={preview.image}
          alt=""
          fill
          sizes="(max-width: 359px) 90vw, (max-width: 767px) 46vw, 380px"
          placeholder="blur"
          className={`theme-card__preview-art${"className" in preview ? ` ${preview.className}` : ""}`}
        />
        {theme.id === "halloween-90s-night" ? (
          <span className="ttv-halloween90-preview-label">HALLOWEEN &apos;95</span>
        ) : null}
        <span className="theme-card__status">
          {isActive ? "Active" : accessLabel}
        </span>
      </span>

      <span className="theme-card__content">
        <span className="theme-card__topline">
          <span>
            <span className="theme-card__category">
              {theme.season
                ? `${category.label} · ${THEME_SEASON_META.find((season) => season.id === theme.season)?.label}`
                : category.label}
            </span>
            <span className="theme-card__name">{theme.name}</span>
          </span>

          <span
            aria-hidden="true"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 0.85rem)",
              gap: "0.25rem",
            }}
          >
            <span
              style={{
                width: "0.85rem",
                height: "0.85rem",
                borderRadius: "999px",
                background: theme.colors.primary,
                boxShadow: `0 0 12px ${theme.colors.primary}`,
              }}
            />
            <span
              style={{
                width: "0.85rem",
                height: "0.85rem",
                borderRadius: "999px",
                background: theme.colors.secondary,
                boxShadow: `0 0 12px ${theme.colors.secondary}`,
              }}
            />
          </span>
        </span>

        <span className="theme-card__copy">{theme.description}</span>

        <span className="theme-card__chips" aria-hidden="true">
          {theme.recommendedFor.slice(0, 4).map((label) => (
            <span key={label} className="theme-card__chip">
              {label}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}

export default function ThemeButton({ compact = false }: { compact?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [seasonFilter, setSeasonFilter] = useState<"all" | ThemeSeason>("all");
  const [portalReady, setPortalReady] = useState(false);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useDialogViewport(dialogRef, portalReady && isOpen);

  const themeId = useStore((state) => state.themeId);
  const ownedPremiumThemes = useStore((state) => state.ownedPremiumThemes);
  const storageAvailable = useProfiles((state) => state.storageAvailable);

  const activeTheme = useMemo(() => getThemeById(themeId), [themeId]);
  const themes = useMemo(() => getAllThemes(), []);
  const seasons = useMemo(() => THEME_SEASON_META.flatMap((season) => {
    const matching = themes.filter((theme) => theme.season === season.id);
    return matching.length ? [{ ...season, count: matching.length }] : [];
  }), [themes]);

  const visibleThemes = useMemo(() => {
    return themes.filter((theme) => {
      const categoryMatches =
        categoryFilter === "all" || theme.category === categoryFilter;

      return (
        categoryMatches &&
        (categoryFilter !== "seasonal" || seasonFilter === "all" || theme.season === seasonFilter) &&
        themeMatchesQuery(theme, query)
      );
    });
  }, [categoryFilter, seasonFilter, query, themes]);

  const collectionLabel = categoryFilter === "all"
    ? "All styles"
    : categoryFilter === "seasonal" && seasonFilter !== "all"
      ? THEME_SEASON_META.find((season) => season.id === seasonFilter)?.label
      : getThemeCategoryMeta(categoryFilter).label;

  const closeDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const applyTheme = useCallback(
    (theme: ThemeDefinition) => {
      if (!canUseTheme(theme.id, ownedPremiumThemes, false)) {
        return;
      }

      setProfileTheme(theme.id);
      setIsOpen(false);
    },
    [ownedPremiumThemes],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const body = document.body;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const fallbackTrigger = triggerRef.current;
    const previousOverflow = body.style.overflow;
    const previousOverscrollBehavior = body.style.overscrollBehavior;
    const previousOverlayState = body.dataset.ttvOverlayOpen;

    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.dataset.ttvOverlayOpen = "true";

    const focusTimer = window.setTimeout(() => {
      const touchLayout = window.matchMedia("(pointer: coarse), (max-width: 760px)").matches;
      (touchLayout ? closeRef.current : searchRef.current)?.focus({ preventScroll: true });
    }, 40);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (["Escape", "BrowserBack", "GoBack"].includes(event.key) || event.keyCode === 10009 || event.keyCode === 461) {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = getFocusableElements(dialogRef.current);

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!dialogRef.current.contains(activeElement)) {
        event.preventDefault();
        firstElement?.focus();
      } else if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      body.style.overflow = previousOverflow;
      body.style.overscrollBehavior = previousOverscrollBehavior;

      if (previousOverlayState) {
        body.dataset.ttvOverlayOpen = previousOverlayState;
      } else {
        delete body.dataset.ttvOverlayOpen;
      }

      window.removeEventListener("keydown", handleKeyDown);

      window.setTimeout(() => {
        const canUseFallback = Boolean(
          fallbackTrigger && fallbackTrigger.offsetParent !== null,
        );
        const visibleMoreTrigger = Array.from(
          document.querySelectorAll<HTMLElement>("[data-viewer-more-trigger]"),
        ).find((element) => element.offsetParent !== null);
        const canRestoreFocus =
          previouslyFocused?.isConnected &&
          previouslyFocused !== document.body &&
          previouslyFocused.offsetParent !== null;
        const focusTarget = canRestoreFocus
          ? previouslyFocused
          : canUseFallback
            ? fallbackTrigger
            : visibleMoreTrigger;

        focusTarget?.focus({ preventScroll: true });
      }, 0);
    };
  }, [closeDialog, isOpen]);

  const handleBackdropPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (event.target === event.currentTarget) {
      closeDialog();
    }
  };

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`theme-trigger ttv-touch-target${compact ? " theme-trigger--compact" : ""}`}
        onClick={() => {
          setQuery("");
          setCategoryFilter("all");
          setSeasonFilter("all");
          setIsOpen(true);
        }}
        aria-label="Open theme library"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={DIALOG_ID}
      >
        <span
          className="theme-trigger__swatch"
          aria-hidden="true"
          style={{
            background: activeTheme.previewGradient,
          }}
        />

        <span className="theme-trigger__copy">
          <span className="theme-trigger__label">Themes</span>
          <span className="theme-trigger__name">{activeTheme.shortName}</span>
        </span>

        <span className="theme-trigger__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {portalReady && isOpen
        ? createPortal(
            <div
              className="theme-dialog-backdrop"
              onPointerDown={handleBackdropPointerDown}
              role="presentation"
            >
              <div
                id={DIALOG_ID}
                ref={dialogRef}
                className="theme-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${DIALOG_ID}-title`}
                aria-describedby={`${DIALOG_ID}-description`}
                tabIndex={-1}
                onKeyDown={handleDialogKeyDown}
              >
                <header className="theme-dialog__header">
                  <div>
                    <div className="theme-dialog__eyebrow">Tate&apos;s TV</div>
                    <h2
                      id={`${DIALOG_ID}-title`}
                      className="theme-dialog__title"
                    >
                      Theme Library
                    </h2>
                    <p
                      id={`${DIALOG_ID}-description`}
                      className="theme-dialog__description"
                    >
                      {PREMIUM_THEMES_TEMPORARILY_UNLOCKED
                        ? "All themes are free. "
                        : ""}
                      {storageAvailable
                        ? "Your choice is saved for this profile on this device."
                        : "Browser storage is unavailable. Your choice lasts for this visit."}
                    </p>
                  </div>

                  <button
                    type="button"
                    ref={closeRef}
                    className="theme-dialog__close"
                    onClick={closeDialog}
                    aria-label="Close Theme Library"
                  >
                    <span aria-hidden="true">×</span>
                    <span>Close</span>
                  </button>
                </header>

                <div className="theme-dialog__scroll">
                  <div className="theme-dialog__toolbar">
                    <input
                      ref={searchRef}
                      className="theme-search"
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search themes…"
                      enterKeyHint="search"
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                      aria-label="Search Tate's TV themes"
                      autoComplete="off"
                      spellCheck={false}
                    />

                    <div
                      className="theme-filter-row"
                      role="group"
                      aria-label="Theme categories"
                    >
                      {CATEGORY_FILTERS.map((filter) => (
                        <button
                          key={filter.id}
                          type="button"
                          className="theme-filter"
                          aria-pressed={categoryFilter === filter.id}
                          onClick={() => {
                            setCategoryFilter(filter.id);
                            setSeasonFilter("all");
                          }}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="theme-dialog__body">
                    {categoryFilter === "seasonal" ? (
                      <section className="theme-season-browser" aria-labelledby={`${DIALOG_ID}-seasons`}>
                        <div className="theme-season-browser__heading">
                          <h3 id={`${DIALOG_ID}-seasons`}>Choose a holiday</h3>
                          <button
                            type="button"
                            className="theme-filter"
                            aria-pressed={seasonFilter === "all"}
                            onClick={() => setSeasonFilter("all")}
                          >
                            All holidays
                          </button>
                        </div>
                        <div className="theme-season-options" role="group" aria-label="Seasonal holidays">
                          {seasons.map((season) => (
                            <button
                              key={season.id}
                              type="button"
                              className={`theme-season-option theme-season-option--${season.id}`}
                              aria-label={season.label}
                              aria-pressed={seasonFilter === season.id}
                              onClick={() => setSeasonFilter(season.id)}
                            >
                              <span className="theme-season-option__icon" aria-hidden="true">{season.id === "christmas" ? "✦" : "☾"}</span>
                              <span>
                                <strong>{season.label}</strong>
                                <small>{season.description}</small>
                              </span>
                              <span className="theme-season-option__count" aria-hidden="true">{season.count}</span>
                            </button>
                          ))}
                        </div>
                      </section>
                    ) : null}
                    <div className="theme-results-heading" role="status" aria-live="polite" aria-atomic="true">
                      {visibleThemes.length ? <><h3>{collectionLabel}</h3><span>{visibleThemes.length} {visibleThemes.length === 1 ? "theme" : "themes"}</span></> : "No themes match. Try another holiday, style or search."}
                    </div>
                    {visibleThemes.length > 0 ? (
                      <div className={`theme-grid${visibleThemes.length === 1 ? " theme-grid--single" : ""}`}>
                        {visibleThemes.map((theme) => (
                          <ThemeCard
                            key={theme.id}
                            theme={theme}
                            isActive={theme.id === themeId}
                            isAvailable={canUseTheme(
                              theme.id,
                              ownedPremiumThemes,
                              false,
                            )}
                            accessLabel={getAccessCopy(theme, ownedPremiumThemes)}
                            onSelect={applyTheme}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="theme-empty-state">
                        <p>Clear your filters to see the full collection.</p>
                        <button
                          type="button"
                          className="theme-dialog__done"
                          onClick={() => {
                            setQuery("");
                            setCategoryFilter("all");
                            setSeasonFilter("all");
                            window.requestAnimationFrame(() => {
                              dialogRef.current?.querySelector<HTMLButtonElement>(".theme-card:not([disabled])")
                                ?.focus();
                            });
                          }}
                        >
                          Show all themes
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <footer className="theme-dialog__footer">
                  <div>
                    <span>Current theme</span> <strong>{activeTheme.name}</strong>
                  </div>
                  <button
                    type="button"
                    className="theme-dialog__done"
                    onClick={closeDialog}
                  >
                    Done
                  </button>
                </footer>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
