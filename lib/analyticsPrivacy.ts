"use client";
import { useProfiles } from "./deviceProfiles";
import { analyticsPath } from "./analyticsEvents";

export const ANALYTICS_PREFERENCE = "ttv-analytics-disabled-v1";
let disabledInMemory = false;
export function analyticsOptedOut() {
  if (typeof navigator === "undefined") return true;
  if (
    disabledInMemory ||
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl
  )
    return true;
  try {
    return localStorage.getItem(ANALYTICS_PREFERENCE) === "1";
  } catch {
    return false;
  }
}
export function analyticsAllowed() {
  if (
    typeof window === "undefined" ||
    analyticsOptedOut() ||
    !analyticsPath(window.location.pathname)
  )
    return false;
  const { ready, activeId, profiles } = useProfiles.getState();
  return (
    ready &&
    !!activeId &&
    profiles.some((profile) => profile.id === activeId && !profile.kids)
  );
}
export function setAnalyticsDisabled(disabled: boolean) {
  disabledInMemory = disabled;
  try {
    localStorage.setItem(ANALYTICS_PREFERENCE, disabled ? "1" : "0");
  } catch {
    /* Keep the choice for this visit. */
  }
  window.dispatchEvent(new Event("ttv-analytics-preference"));
}
