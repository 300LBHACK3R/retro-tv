import { DEFAULT_THEME_ID } from "./themes";
import type { ThemeId } from "./types";

export const PROFILE_STORAGE_KEY = "ttv-profiles-v1";
export const PROFILE_SESSION_KEY = "ttv-profile-session-v1";

// November 1, 2026 at midnight in Calgary (America/Edmonton), before DST ends.
export const CHRISTMAS_ENTRANCE_START = Date.parse("2026-11-01T00:00:00-06:00");
export const CHRISTMAS_THEME_ID: ThemeId = "christmas-96-living-room";

/** The entrance follows the calendar; a profile's explicit choice never does. */
export function getEntranceThemeId(now = Date.now()): ThemeId {
  return now >= CHRISTMAS_ENTRANCE_START ? CHRISTMAS_THEME_ID : DEFAULT_THEME_ID;
}
