"use client";

import { useEffect, useState } from "react";

export default function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let mounted = true;
    let waitingWorker: ServiceWorker | null = null;

    function listenForControllerChange() {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    }

    async function registerServiceWorker() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        listenForControllerChange();

        if (registration.waiting && mounted) {
          waitingWorker = registration.waiting;
          setUpdateReady(true);
        }

        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;

          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller &&
              mounted
            ) {
              waitingWorker = installingWorker;
              setUpdateReady(true);
            }
          });
        });

        registration.update().catch(() => undefined);
      } catch {
        // Never let service worker failure break the app.
      }
    }

    registerServiceWorker();

    return () => {
      mounted = false;
      waitingWorker = null;
    };
  }, []);

  function applyUpdate() {
    if (!("serviceWorker" in navigator)) {
      window.location.reload();
      return;
    }

    navigator.serviceWorker.getRegistration().then((registration) => {
      const worker = registration?.waiting;

      if (worker) {
        worker.postMessage({ type: "SKIP_WAITING" });
      } else {
        window.location.reload();
      }
    });
  }

  if (!updateReady) {
    return null;
  }

  return (
    <div className="ttv-update-toast" role="status" aria-live="polite">
      <div>
        <strong>Update ready</strong>
        <span>A newer version of Tate&apos;s TV is available.</span>
      </div>

      <button type="button" onClick={applyUpdate}>
        Update
      </button>
    </div>
  );
}
