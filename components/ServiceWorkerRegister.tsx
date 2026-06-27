"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ServiceWorkerMessage = {
  type: "SKIP_WAITING";
};

const SERVICE_WORKER_PATH = "/sw.js";
const SERVICE_WORKER_SCOPE = "/";
const UPDATE_CHECK_DELAY_MS = 1500;

function canUseServiceWorker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator
  );
}

function isProductionBuild(): boolean {
  return process.env.NODE_ENV === "production";
}

function postSkipWaiting(worker: ServiceWorker): void {
  const message: ServiceWorkerMessage = {
    type: "SKIP_WAITING",
  };

  worker.postMessage(message);
}

export default function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);

  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const userAcceptedUpdateRef = useRef(false);
  const hasReloadedRef = useRef(false);
  const updateCheckTimerRef = useRef<number | null>(null);

  const clearUpdateCheckTimer = useCallback(() => {
    if (updateCheckTimerRef.current) {
      window.clearTimeout(updateCheckTimerRef.current);
      updateCheckTimerRef.current = null;
    }
  }, []);

  const markUpdateReady = useCallback((worker: ServiceWorker | null) => {
    if (!worker) {
      return;
    }

    waitingWorkerRef.current = worker;
    setUpdateReady(true);
  }, []);

  const checkForUpdates = useCallback(() => {
    const registration = registrationRef.current;

    if (!registration) {
      return;
    }

    if (document.visibilityState !== "visible") {
      return;
    }

    void registration.update().catch(() => {
      // Service worker update checks are non-critical.
    });
  }, []);

  useEffect(() => {
    if (!canUseServiceWorker()) {
      return;
    }

    if (!isProductionBuild()) {
      return;
    }

    let mounted = true;

    const handleControllerChange = () => {
      if (!userAcceptedUpdateRef.current || hasReloadedRef.current) {
        return;
      }

      hasReloadedRef.current = true;
      window.location.reload();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      clearUpdateCheckTimer();

      updateCheckTimerRef.current = window.setTimeout(() => {
        checkForUpdates();
      }, UPDATE_CHECK_DELAY_MS);
    };

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          SERVICE_WORKER_PATH,
          {
            scope: SERVICE_WORKER_SCOPE,
          },
        );

        if (!mounted) {
          return;
        }

        registrationRef.current = registration;

        if (registration.waiting) {
          markUpdateReady(registration.waiting);
        }

        const handleUpdateFound = () => {
          const installingWorker = registration.installing;

          if (!installingWorker) {
            return;
          }

          const handleStateChange = () => {
            if (!mounted) {
              return;
            }

            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              markUpdateReady(installingWorker);
            }
          };

          installingWorker.addEventListener("statechange", handleStateChange);
        };

        registration.addEventListener("updatefound", handleUpdateFound);
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          handleControllerChange,
        );
        document.addEventListener("visibilitychange", handleVisibilityChange);

        void registration.update().catch(() => {
          // Never let service worker update checks break the app.
        });

        return () => {
          registration.removeEventListener("updatefound", handleUpdateFound);
          navigator.serviceWorker.removeEventListener(
            "controllerchange",
            handleControllerChange,
          );
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
      } catch {
        // Never let service worker registration failure break the app.
        return undefined;
      }
    };

    let cleanupRegistrationListeners: (() => void) | undefined;

    void registerServiceWorker().then((cleanup) => {
      cleanupRegistrationListeners = cleanup;
    });

    return () => {
      mounted = false;
      clearUpdateCheckTimer();
      cleanupRegistrationListeners?.();
      waitingWorkerRef.current = null;
      registrationRef.current = null;
    };
  }, [checkForUpdates, clearUpdateCheckTimer, markUpdateReady]);

  const applyUpdate = useCallback(() => {
    if (!canUseServiceWorker()) {
      window.location.reload();
      return;
    }

    const waitingWorker =
      waitingWorkerRef.current ?? registrationRef.current?.waiting ?? null;

    userAcceptedUpdateRef.current = true;

    if (waitingWorker) {
      postSkipWaiting(waitingWorker);
      return;
    }

    void navigator.serviceWorker.getRegistration().then((registration) => {
      const worker = registration?.waiting;

      if (worker) {
        postSkipWaiting(worker);
        return;
      }

      window.location.reload();
    });
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateReady(false);
  }, []);

  if (!updateReady) {
    return null;
  }

  return (
    <div className="ttv-update-toast" role="status" aria-live="polite">
      <div>
        <strong>Update ready</strong>
        <span>A newer version of Tate&apos;s TV is available.</span>
      </div>

      <div className="ttv-update-toast__actions">
        <button type="button" onClick={applyUpdate}>
          Update
        </button>

        <button type="button" onClick={dismissUpdate} aria-label="Dismiss update">
          Later
        </button>
      </div>
    </div>
  );
}