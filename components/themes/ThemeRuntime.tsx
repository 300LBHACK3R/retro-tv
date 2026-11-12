"use client";

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import Christmas96Scene from "@/components/themes/Christmas96Scene";
import { useStore } from "@/lib/store";
import { useAccount } from "@/lib/accountStore";
import { useProfiles } from "@/lib/deviceProfiles";
import { CHRISTMAS_ENTRANCE_START, getEntranceThemeId, readLoginThemeId } from "@/lib/themePreferences";
import {
  canUseTheme,
  createThemeCssVars,
  getThemeById,
} from "@/lib/themes";

const HauntedArcadeScene = dynamic(() => import("@/components/themes/HauntedArcadeScene"), { ssr: false });
const HalloweenAfterDark = dynamic(() => import("@/components/themes/HalloweenAfterDark"), { ssr: false });
const Halloween90sScene = dynamic(() => import("@/components/themes/Halloween90sScene"), { ssr: false });
const NeonNoelScene = dynamic(() => import("@/components/themes/NeonNoelScene"), { ssr: false });

const MANAGED_THEME_META_SELECTOR = 'meta[name="theme-color"]';
const THEME_CHANGE_EVENT = "ttv:theme-change";

/**
 * Keeps the active Tate's TV theme synchronized across every route. The
 * pre-hydration bootstrap handles first paint; this runtime handles live theme
 * changes and metadata after profiles restore their saved theme.
 */
export default function ThemeRuntime() {
  const pathname = usePathname();
  const userId = useAccount((state) => state.user?.id);
  const themeId = useStore((state) => state.themeId);
  const profilesReady = useProfiles((state) => state.ready);
  const activeId = useProfiles((state) => state.activeId);
  const entranceTheme = useProfiles((state) => state.entranceTheme);
  const preferReducedMotion = useStore(
    (state) => state.viewerSettings.preferReducedMotion,
  );
  const owned = useAccount((state) => state.ownedThemeIds);
  const theme = useMemo(() => {
    // A remembered sign-in appearance never grants a profile session or a paid viewer theme.
    const loginTheme = profilesReady && !activeId && ["/account", "/auth/confirm"].includes(pathname)
      ? userId ? entranceTheme : readLoginThemeId() : null;
    const profilePicker = userId && !activeId && ["/", "/library"].includes(pathname);
    const preferred = profilePicker ? getEntranceThemeId() : loginTheme ?? themeId;
    return getThemeById(loginTheme && !userId ? loginTheme : (canUseTheme(preferred, owned, false) ? preferred : getEntranceThemeId()));
  }, [themeId, owned, profilesReady, activeId, entranceTheme, userId, pathname]);
  const cssVars = useMemo(() => createThemeCssVars(theme), [theme]);

  useEffect(() => {
    // Keep the bootstrap's saved choice intact until profiles finish loading.
    if (!profilesReady) return;
    if (themeId !== theme.id) useStore.getState().setTheme(theme.id);
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
  }, [cssVars, theme, profilesReady, themeId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const updateEntrance = () => {
      clearTimeout(timer);
      const profiles = useProfiles.getState();
      if (profiles.ready && !profiles.activeId && !["/account", "/auth/confirm"].includes(pathname))
        useStore.getState().setTheme(getEntranceThemeId());
      const remaining = CHRISTMAS_ENTRANCE_START - Date.now();
      if (remaining > 0) timer = setTimeout(updateEntrance, Math.min(remaining, 2_147_483_647));
    };
    updateEntrance();
    document.addEventListener("visibilitychange", updateEntrance);
    window.addEventListener("pageshow", updateEntrance);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", updateEntrance);
      window.removeEventListener("pageshow", updateEntrance);
    };
  }, [pathname]);

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

  if (theme.id === "christmas-neon-noel") return <NeonNoelScene />;
  if (theme.id === "christmas-96-living-room") return <Christmas96Scene />;
  if (theme.id === "halloween-night") return <HalloweenAfterDark />;
  if (theme.id === "halloween-haunted-arcade") return <HauntedArcadeScene />;
  if (theme.id === "halloween-90s-night") return <Halloween90sScene />;
  return null;
}
