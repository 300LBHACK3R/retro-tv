"use client";

import { useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import {
  createThemeCssVars,
  getThemeById,
  isThemeId,
  THEME_STORAGE_KEY,
} from "@/lib/themes";

const MANAGED_THEME_META_SELECTOR = 'meta[name="theme-color"]';
const THEME_CHANGE_EVENT = "ttv:theme-change";

/**
 * Keeps the active Tate's TV theme synchronized across every route. The
 * pre-hydration bootstrap handles first paint; this runtime handles live theme
 * changes, metadata, and persisted state updates after React mounts.
 */
export default function ThemeRuntime() {
  const themeId = useStore((state) => state.themeId);
  const setTheme = useStore((state) => state.setTheme);
  const theme = useMemo(() => getThemeById(themeId), [themeId]);
  const cssVars = useMemo(() => createThemeCssVars(theme), [theme]);

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.ttvTheme = theme.id;
    root.dataset.ttvCategory = theme.category;
    root.dataset.ttvLayout = theme.layout;
    root.dataset.ttvAppearance = theme.appearance;
    root.style.colorScheme = theme.appearance;

    for (const [property, value] of Object.entries(cssVars)) {
      root.style.setProperty(property, value);
    }

    const themeColorMeta = document.querySelector<HTMLMetaElement>(
      MANAGED_THEME_META_SELECTOR,
    );

    themeColorMeta?.setAttribute("content", theme.colors.primary);

    window.dispatchEvent(
      new CustomEvent(THEME_CHANGE_EVENT, {
        detail: {
          id: theme.id,
          layout: theme.layout,
          appearance: theme.appearance,
        },
      }),
    );
  }, [cssVars, theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        const storedState = JSON.parse(event.newValue) as {
          state?: { themeId?: unknown };
        };
        const nextThemeId = storedState.state?.themeId;

        if (isThemeId(nextThemeId) && nextThemeId !== themeId) {
          setTheme(nextThemeId);
        }
      } catch {
        // Ignore malformed external storage events and keep the current theme.
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [setTheme, themeId]);

  return null;
}
