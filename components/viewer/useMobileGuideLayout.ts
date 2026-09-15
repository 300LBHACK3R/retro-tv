"use client";

import { useEffect, useState } from "react";
import { MOBILE_GUIDE_MEDIA_QUERY, MOBILE_GUIDE_BREAKPOINT_PX, TOUCH_GUIDE_BREAKPOINT_PX, MOBILE_USER_AGENT_PATTERN } from "@/lib/guideTimeline";

function getSmallestViewportWidth(): number {
  if (typeof window === "undefined") {
    return Number.POSITIVE_INFINITY;
  }

  const candidateWidths = [
    window.innerWidth,
    document.documentElement.clientWidth,
    window.visualViewport?.width,
  ].filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value) && value > 0,
  );

  return candidateWidths.length > 0
    ? Math.min(...candidateWidths)
    : Number.POSITIVE_INFINITY;
}

function shouldUseMobileGuide(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const viewportWidth = getSmallestViewportWidth();
  const mediaQueryMatches = window.matchMedia(MOBILE_GUIDE_MEDIA_QUERY).matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const touchCapable = navigator.maxTouchPoints > 0;
  const mobileUserAgent = MOBILE_USER_AGENT_PATTERN.test(navigator.userAgent);
  const screenWidth = window.screen?.width ?? Number.POSITIVE_INFINITY;
  const screenHeight = window.screen?.height ?? Number.POSITIVE_INFINITY;
  const screenShortSide = Math.min(screenWidth, screenHeight);

  return (
    viewportWidth <= MOBILE_GUIDE_BREAKPOINT_PX ||
    mediaQueryMatches ||
    mobileUserAgent ||
    ((coarsePointer || touchCapable) &&
      screenShortSide <= TOUCH_GUIDE_BREAKPOINT_PX)
  );
}

/** One responsive decision shared by the player and both guide layouts. */
export function useMobileGuideLayout() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_GUIDE_MEDIA_QUERY);
    const visualViewport = window.visualViewport;
    let animationFrame: number | null = null;

    const updateMobileMode = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        setMobile(shouldUseMobileGuide());
      });
    };

    setMobile(shouldUseMobileGuide());
    mediaQuery.addEventListener?.("change", updateMobileMode);
    window.addEventListener("resize", updateMobileMode, { passive: true });
    window.addEventListener("orientationchange", updateMobileMode);
    visualViewport?.addEventListener("resize", updateMobileMode, {
      passive: true,
    });

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }

      mediaQuery.removeEventListener?.("change", updateMobileMode);
      window.removeEventListener("resize", updateMobileMode);
      window.removeEventListener("orientationchange", updateMobileMode);
      visualViewport?.removeEventListener("resize", updateMobileMode);
    };
  }, []);

  return mobile;
}
