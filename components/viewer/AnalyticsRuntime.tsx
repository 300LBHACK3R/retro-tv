"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { useProfiles } from "@/lib/deviceProfiles";
import { useStore } from "@/lib/store";
import { analyticsAllowed } from "@/lib/analyticsPrivacy";
import { analyticsPath } from "@/lib/analyticsEvents";
import {
  trackAnalytics,
  flushAnalytics,
  clearAnalyticsQueue,
} from "@/lib/analyticsClient";

export function filterAnalytics(
  event: BeforeSendEvent,
): BeforeSendEvent | null {
  if (!analyticsAllowed()) return null;
  try {
    const url = new URL(event.url);
    if (url.origin !== location.origin || !analyticsPath(url.pathname))
      return null;
    url.search = "";
    url.hash = "";
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}
export default function AnalyticsRuntime() {
  const pathname = usePathname();
  const activeId = useProfiles((state) => state.activeId);
  const profiles = useProfiles((state) => state.profiles);
  const [enabled, setEnabled] = useState(false);
  const measuredLoad = useRef(false);
  const lastPage = useRef("");
  const lastProfile = useRef<string | null>(null);
  useEffect(() => {
    setEnabled(analyticsAllowed());
    if (!analyticsAllowed()) {
      clearAnalyticsQueue();
      lastPage.current = "";
      lastProfile.current = null;
      return;
    }
    if (lastProfile.current !== activeId) {
      clearAnalyticsQueue();
      lastProfile.current = activeId;
      trackAnalytics("profile_start");
    }
    const page = `${activeId}:${pathname}`;
    if (lastPage.current !== page) {
      lastPage.current = page;
      trackAnalytics("page_view");
    }
  }, [pathname, activeId, profiles]);
  useEffect(() => {
    let errorCount = 0;
    const unsubscribe = useStore.subscribe((next, previous) => {
      if (next.isGuideOpen && !previous.isGuideOpen)
        trackAnalytics("guide_open");
      if (next.themeId !== previous.themeId && activeId)
        trackAnalytics("theme_change", next.themeId);
    });
    const visibility = () => {
      if (document.visibilityState === "hidden") void flushAnalytics();
    };
    const flush = () => {
      void flushAnalytics();
    };
    const privacy = () => {
      setEnabled(analyticsAllowed());
      if (!analyticsAllowed()) clearAnalyticsQueue();
    };
    const error = (event: Event) => {
      if (errorCount >= 3 || !analyticsAllowed()) return;
      errorCount += 1;
      trackAnalytics(
        "client_error",
        event instanceof ErrorEvent ? "javascript" : "resource",
      );
    };
    const navigation = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (
      !measuredLoad.current &&
      navigation?.loadEventEnd &&
      analyticsAllowed()
    ) {
      measuredLoad.current = true;
      trackAnalytics("page_load", "", navigation.loadEventEnd);
    }
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", flush);
    window.addEventListener("ttv-analytics-preference", privacy);
    window.addEventListener("storage", privacy);
    window.addEventListener("error", error, true);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("ttv-analytics-preference", privacy);
      window.removeEventListener("storage", privacy);
      window.removeEventListener("error", error, true);
    };
  }, [activeId]);
  return enabled ? <Analytics beforeSend={filterAnalytics} /> : null;
}
