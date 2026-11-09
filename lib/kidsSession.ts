"use client";
import { create } from "zustand";
import { PROFILE_SESSION_KEY } from "./themePreferences";

// A restriction hint only. It contains no profile data and grants no access.
// Keep it across reloads/sign-in failures until a parent opens an adult profile.
export const KIDS_SESSION_KEY = "ttv-kids-session-v1";
export const useKidsSession = create(() => ({ parentRequired: false }));

export function rememberKidsSession(parentRequired: boolean) {
  useKidsSession.setState({ parentRequired });
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      if (parentRequired) window[name].setItem(KIDS_SESSION_KEY, "1");
      else window[name].removeItem(KIDS_SESSION_KEY);
    } catch { /* The current tab stays protected when storage is unavailable. */ }
  }
}

export function restoreKidsSession() {
  let parentRequired = useKidsSession.getState().parentRequired;
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try { parentRequired ||= window[name].getItem(KIDS_SESSION_KEY) === "1"; }
    catch { /* Preserve the current restriction. */ }
  }
  // Protect sessions created before this guard was introduced, including a
  // locked household whose account expires during the first upgraded launch.
  try {
    const session = JSON.parse(window.sessionStorage.getItem(PROFILE_SESSION_KEY) || "null");
    parentRequired ||= typeof session?.pinHash === "string" && session.pinHash.length === 64;
  } catch { /* Invalid storage never restores an authenticated profile. */ }
  // Persist migrated sessions before account refresh clears an expired session.
  if (parentRequired) rememberKidsSession(true);
}
