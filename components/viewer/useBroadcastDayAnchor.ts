"use client";

import { useEffect, useMemo, useState } from "react";
import { createBroadcastDayAnchor } from "@/lib/viewer";

const DAY_CHECK_INTERVAL_MS = 60_000;

function getBroadcastDayAnchorMs(): number {
  return createBroadcastDayAnchor().getTime();
}

/**
 * Keeps the public player schedule anchored to the current local broadcast day.
 *
 * The previous viewer calculated midnight only once when the page mounted. A
 * browser left open across midnight could therefore continue using yesterday's
 * air-day rules while the guide had already moved to the new day. This hook
 * refreshes the shared anchor after midnight, when the tab becomes visible,
 * and when the device clock or time zone changes enough to produce a new local
 * day anchor.
 */
export function useBroadcastDayAnchor(): Date {
  const [anchorMs, setAnchorMs] = useState(getBroadcastDayAnchorMs);

  useEffect(() => {
    const refreshAnchor = () => {
      const nextAnchorMs = getBroadcastDayAnchorMs();

      setAnchorMs((currentAnchorMs) =>
        currentAnchorMs === nextAnchorMs ? currentAnchorMs : nextAnchorMs,
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshAnchor();
      }
    };

    const intervalId = window.setInterval(
      refreshAnchor,
      DAY_CHECK_INTERVAL_MS,
    );

    window.addEventListener("focus", refreshAnchor);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshAnchor);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, []);

  return useMemo(() => new Date(anchorMs), [anchorMs]);
}
