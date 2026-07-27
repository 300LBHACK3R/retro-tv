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
import {
  canUseTheme,
  getAllThemes,
  getThemeAccessLabel,
  getThemeById,
  getThemeCategoryMeta,
  PREMIUM_THEMES_TEMPORARILY_UNLOCKED,
  THEME_CATEGORY_META,
  type ThemeCategory,
  type ThemeDefinition,
} from "@/lib/themes";
import { useStore } from "@/lib/store";

const DIALOG_ID = "ttv-theme-library";

type CategoryFilter = "all" | ThemeCategory;
type AccessFilter = "all" | "free" | "premium";

type FilterOption<T extends string> = {
  id: T;
  label: string;
};

const ACCESS_FILTERS: readonly FilterOption<AccessFilter>[] = [
  { id: "all", label: "All access" },
  { id: "free", label: "Free" },
  { id: "premium", label: "Premium" },
];

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
    theme.category,
    theme.layout,
    theme.recommendedFor.join(" "),
  ]
    .join(" ")
    .toLocaleLowerCase("en-CA")
    .includes(normalizedQuery);
}

function themeMatchesAccess(
  theme: ThemeDefinition,
  filter: AccessFilter,
): boolean {
  if (filter === "free") return !theme.isPremium;
  if (filter === "premium") return theme.isPremium;
  return true;
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
  const previewStyle = {
    "--theme-preview": theme.previewGradient,
  } as CSSProperties;

  return (
    <button
      type="button"
      className="theme-card"
      aria-pressed={isActive}
      aria-label={`${isActive ? "Current theme" : isAvailable ? "Apply theme" : "Locked theme"}: ${theme.name}`}
      disabled={!isAvailable}
      onClick={() => onSelect(theme)}
    >
      <span className="theme-card__preview" style={previewStyle} aria-hidden="true">
        <span className="theme-card__preview-ui">
          <span />
          <span />
          <span />
        </span>
        <span className="theme-card__status">
          {isActive ? "Active" : accessLabel}
        </span>
      </span>

      <span className="theme-card__content">
        <span className="theme-card__topline">
          <span>
            <span className="theme-card__category">{category.label}</span>
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

export default function ThemeButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilter>("all");
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all");

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const themeId = useStore((state) => state.themeId);
  const ownedPremiumThemes = useStore((state) => state.ownedPremiumThemes);
  const setTheme = useStore((state) => state.setTheme);

  const activeTheme = useMemo(() => getThemeById(themeId), [themeId]);
  const themes = useMemo(() => getAllThemes(), []);

  const visibleThemes = useMemo(() => {
    return themes.filter((theme) => {
      const categoryMatches =
        categoryFilter === "all" || theme.category === categoryFilter;

      return (
        categoryMatches &&
        themeMatchesAccess(theme, accessFilter) &&
        themeMatchesQuery(theme, query)
      );
    });
  }, [accessFilter, categoryFilter, query, themes]);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  const applyTheme = useCallback(
    (theme: ThemeDefinition) => {
      if (!canUseTheme(theme.id, ownedPremiumThemes, false)) {
        return;
      }

      setTheme(theme.id);
      setIsOpen(false);
    },
    [ownedPremiumThemes, setTheme],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousOverscrollBehavior = body.style.overscrollBehavior;

    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    const focusTimer = window.setTimeout(() => {
      searchRef.current?.focus();
    }, 40);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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

      if (event.shiftKey && activeElement === firstElement) {
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
      window.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus({ preventScroll: true });
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
        className="theme-trigger ttv-touch-target"
        onClick={() => setIsOpen(true)}
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
          <span className="theme-trigger__label">Theme</span>
          <span className="theme-trigger__name">{activeTheme.shortName}</span>
        </span>

        <span className="theme-trigger__chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen ? (
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
                <h2 id={`${DIALOG_ID}-title`} className="theme-dialog__title">
                  Theme Library
                </h2>
                <p
                  id={`${DIALOG_ID}-description`}
                  className="theme-dialog__description"
                >
                  Every theme now shares one responsive design system while
                  keeping its own cable, cinema, console, arcade, cartoon, or
                  Neon CRT personality.
                  {PREMIUM_THEMES_TEMPORARILY_UNLOCKED
                    ? " Premium themes are unlocked during launch."
                    : ""}
                </p>
              </div>

              <button
                type="button"
                className="theme-dialog__close"
                onClick={closeDialog}
              >
                Close
              </button>
            </header>

            <div className="theme-dialog__toolbar">
              <input
                ref={searchRef}
                className="theme-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search themes, moods, or uses..."
                aria-label="Search Tate's TV themes"
                autoComplete="off"
                spellCheck={false}
              />

              <div className="grid gap-2">
                <div className="theme-filter-row" role="group" aria-label="Theme categories">
                  {CATEGORY_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      className="theme-filter"
                      aria-pressed={categoryFilter === filter.id}
                      onClick={() => setCategoryFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className="theme-filter-row" role="group" aria-label="Theme access filters">
                  {ACCESS_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      className="theme-filter"
                      aria-pressed={accessFilter === filter.id}
                      onClick={() => setAccessFilter(filter.id)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="theme-dialog__body">
              {visibleThemes.length > 0 ? (
                <div className="theme-grid">
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
                  No themes match those filters. Clear the search or choose a
                  different category.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
