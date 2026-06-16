"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

type InstallPromptMode =
  | "hidden"
  | "native"
  | "ios"
  | "android"
  | "desktop"
  | "fallback";

type BrowserProfile = {
  isIos: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  isSamsungInternet: boolean;
};

const DISMISSED_KEY = "ttv-install-prompt-dismissed-v2";
const DISMISS_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function getBrowserProfile(): BrowserProfile {
  if (typeof window === "undefined") {
    return {
      isIos: false,
      isAndroid: false,
      isDesktop: false,
      isSamsungInternet: false,
    };
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform.toLowerCase();

  const isIos =
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform === "macintel" && window.navigator.maxTouchPoints > 1);

  const isAndroid = /android/.test(userAgent);
  const isSamsungInternet = /samsungbrowser/.test(userAgent);

  const isDesktop =
    !isIos &&
    !isAndroid &&
    window.matchMedia("(min-width: 900px)").matches;

  return {
    isIos,
    isAndroid,
    isDesktop,
    isSamsungInternet,
  };
}

function wasDismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);

    if (!raw) return false;

    const dismissedAt = Number(raw);

    if (!Number.isFinite(dismissedAt)) return false;

    return Date.now() - dismissedAt < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function saveDismissed() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Ignore localStorage failures.
  }
}

function getFallbackMode(profile: BrowserProfile): InstallPromptMode {
  if (profile.isIos) {
    return "ios";
  }

  if (profile.isAndroid || profile.isSamsungInternet) {
    return "android";
  }

  if (profile.isDesktop) {
    return "desktop";
  }

  return "fallback";
}

export default function InstallPromptBanner() {
  const [mode, setMode] = useState<InstallPromptMode>("hidden");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const title = useMemo(() => {
    if (mode === "native") return "Install Tate’s TV";
    if (mode === "ios") return "Add Tate’s TV to your Home Screen";
    if (mode === "android") return "Add Tate’s TV to your phone";
    if (mode === "desktop") return "Use Tate’s TV like an app";
    if (mode === "fallback") return "Save Tate’s TV for quick access";
    return "";
  }, [mode]);

  const message = useMemo(() => {
    if (mode === "native") {
      return "Get the cleaner app-style experience from your browser.";
    }

    if (mode === "ios") {
      return "On iPhone or iPad, open Safari, tap Share, then choose Add to Home Screen.";
    }

    if (mode === "android") {
      return "Use Chrome, Samsung Internet, or your browser menu, then choose Install app or Add to Home screen.";
    }

    if (mode === "desktop") {
      return "Chrome and Edge can install Tate’s TV from the address bar or browser menu.";
    }

    if (mode === "fallback") {
      return "Open install instructions for your device, browser, or TV.";
    }

    return "";
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isStandaloneMode() || wasDismissedRecently()) {
      setMode("hidden");
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setMode("native");
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setMode("hidden");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    const fallbackTimer = window.setTimeout(() => {
      if (isStandaloneMode() || wasDismissedRecently()) {
        setMode("hidden");
        return;
      }

      setMode((current) => {
        if (current === "native") {
          return current;
        }

        return getFallbackMode(getBrowserProfile());
      });
    }, 900);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) {
      return;
    }

    try {
      await deferredPrompt.prompt();

      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setMode("hidden");
      }

      setDeferredPrompt(null);
    } catch {
      setDeferredPrompt(null);
      setMode(getFallbackMode(getBrowserProfile()));
    }
  }

  function dismiss() {
    saveDismissed();
    setDismissed(true);
    setMode("hidden");
  }

  if (dismissed || mode === "hidden") {
    return null;
  }

  return (
    <aside className="ttv-install-prompt" role="region" aria-label="Install Tate's TV">
      <div className="ttv-install-prompt__icon">TTV</div>

      <div className="ttv-install-prompt__copy">
        <strong>{title}</strong>
        <span>{message}</span>
      </div>

      <div className="ttv-install-prompt__actions">
        {mode === "native" ? (
          <button type="button" onClick={handleInstallClick}>
            Install
          </button>
        ) : (
          <Link href="/install">How to install</Link>
        )}

        <button type="button" onClick={dismiss} aria-label="Dismiss install prompt">
          Later
        </button>
      </div>
    </aside>
  );
}