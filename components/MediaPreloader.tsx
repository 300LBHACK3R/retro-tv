"use client";

import { useEffect } from "react";
import type { BroadcastItem } from "@/lib/types";

/** Warm a few media origins without downloading video or competing with playback. */
export default function MediaPreloader({
  activeSchedule,
}: {
  activeSchedule: readonly BroadcastItem[];
}) {
  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    const warmOrigins = () => {
      const mobile = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
      const urls = new Set<string>();
      const origins = new Set<string>();

      for (const item of activeSchedule) {
        if (!item.file.trim()) continue;
        try {
          const url = new URL(item.file.trim(), window.location.href);
          if (url.protocol !== "http:" && url.protocol !== "https:") continue;
          urls.add(url.href);
          if (origins.size < (mobile ? 2 : 4)) origins.add(url.origin);
          if (urls.size >= (mobile ? 3 : 6)) break;
        } catch {
          // Invalid media URLs are handled by the player, not resource hints.
        }
      }

      for (const origin of origins) {
        for (const rel of ["preconnect", "dns-prefetch"]) {
          const link = document.createElement("link");
          link.rel = rel;
          link.href = `${origin}/`;
          link.dataset.ttvPreload = "true";
          if (rel === "preconnect" && origin !== window.location.origin) {
            link.crossOrigin = "anonymous";
          }
          document.head.appendChild(link);
          links.push(link);
        }
      }
    };

    const idleSupported = typeof window.requestIdleCallback === "function" &&
      typeof window.cancelIdleCallback === "function";
    const handle = idleSupported
      ? window.requestIdleCallback(warmOrigins, { timeout: 2_000 })
      : window.setTimeout(warmOrigins, 250);

    return () => {
      if (idleSupported) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      links.forEach((link) => link.remove());
    };
  }, [activeSchedule]);

  return null;
}
