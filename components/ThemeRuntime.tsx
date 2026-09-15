"use client";

import { useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import {
  createThemeCssVars,
  getThemeById,
} from "@/lib/themes";

const MANAGED_THEME_META_SELECTOR = 'meta[name="theme-color"]';
const THEME_CHANGE_EVENT = "ttv:theme-change";

/**
 * Keeps the active Tate's TV theme synchronized across every route. The
 * pre-hydration bootstrap handles first paint; this runtime handles live theme
 * changes and metadata after React mounts. Theme choices stay in memory.
 */
export default function ThemeRuntime() {
  const themeId = useStore((state) => state.themeId);
  const preferReducedMotion = useStore(
    (state) => state.viewerSettings.preferReducedMotion,
  );
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
    const root = document.documentElement;

    if (preferReducedMotion) {
      root.dataset.ttvReducedMotion = "true";
    } else {
      delete root.dataset.ttvReducedMotion;
    }

    return () => {
      delete root.dataset.ttvReducedMotion;
    };
  }, [preferReducedMotion]);

  useEffect(() => {
    const update = () => {
      document.documentElement.dataset.ttvPageVisible =
        document.visibilityState === "visible" ? "true" : "false";
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      delete document.documentElement.dataset.ttvPageVisible;
    };
  }, []);

  return null;
}
