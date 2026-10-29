import { DEFAULT_THEME_ID, isThemeId } from "./themes";
import type { ThemeId } from "./types";

export const PROFILE_STORAGE_KEY = "ttv-profiles-v1";
export const PROFILE_SESSION_KEY = "ttv-profile-session-v1";
export const LOGIN_THEME_STORAGE_KEY = "ttv-login-theme-v1";

/** Cosmetic returning-visitor hint only: no identity, session or access grants. */
export function readLoginThemeId(): ThemeId | null {
  try {
    const theme = localStorage.getItem(LOGIN_THEME_STORAGE_KEY);
    return isThemeId(theme) ? theme : null;
  } catch {
    return null;
  }
}

export function rememberLoginTheme(theme: ThemeId | null) {
  try {
    if (theme) localStorage.setItem(LOGIN_THEME_STORAGE_KEY, theme);
    else localStorage.removeItem(LOGIN_THEME_STORAGE_KEY);
  } catch {
    // Account preferences still sync when browser storage is unavailable.
  }
}

// November 1, 2026 at midnight in Calgary (America/Edmonton), before DST ends.
export const CHRISTMAS_ENTRANCE_START = Date.parse("2026-11-01T00:00:00-06:00");
export const CHRISTMAS_THEME_ID: ThemeId = "christmas-96-living-room";

/** The entrance follows the calendar; a profile's explicit choice never does. */
export function getEntranceThemeId(now = Date.now()): ThemeId {
  return now >= CHRISTMAS_ENTRANCE_START ? CHRISTMAS_THEME_ID : DEFAULT_THEME_ID;
}
