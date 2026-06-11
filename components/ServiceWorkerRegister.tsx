"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let cancelled = false;

    async function registerServiceWorker() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        if (cancelled) return;

        registration.update().catch(() => {
          // Silent update check failure is fine.
        });
      } catch {
        // Service worker registration should never break the app.
      }
    }

    registerServiceWorker();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
