"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  isSafari: boolean;
  isChrome: boolean;
  isEdge: boolean;
  isSamsungInternet: boolean;
};

const DISMISSED_KEY = "ttv-install-prompt-dismissed-v3";
const DISMISS_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
const FALLBACK_DELAY_MS = 900;

function canUseBrowserApis(): boolean {
  return typeof window !== "undefined" && typeof window.navigator !== "undefined";
}

function isStandaloneMode(): boolean {
  if (!canUseBrowserApis()) {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(navigatorWithStandalone.standalone)
  );
}

function getBrowserProfile(): BrowserProfile {
  if (!canUseBrowserApis()) {
    return {
      isIos: false,
      isAndroid: false,
      isDesktop: false,
      isSafari: false,
      isChrome: false,
      isEdge: false,
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
  const isEdge = /edg\//.test(userAgent);
  const isChrome =
    /chrome|crios|chromium/.test(userAgent) &&
    !isSamsungInternet &&
    !isEdge;
  const isSafari =
    /safari/.test(userAgent) &&
    !/chrome|crios|chromium|android|edg\//.test(userAgent);

  const isDesktop =
    !isIos &&
    !isAndroid &&
    window.matchMedia("(min-width: 900px)").matches;

  return {
    isIos,
    isAndroid,
    isDesktop,
    isSafari,
    isChrome,
    isEdge,
    isSamsungInternet,
  };
}

function readDismissedAt(): number | null {
  if (!canUseBrowserApis()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);

    if (!raw) {
      return null;
    }

    const dismissedAt = Number(raw);

    return Number.isFinite(dismissedAt) && dismissedAt > 0
      ? dismissedAt
      : null;
  } catch {
    return null;
  }
}

function wasDismissedRecently(): boolean {
  const dismissedAt = readDismissedAt();

  if (!dismissedAt) {
    return false;
  }

  return Date.now() - dismissedAt < DISMISS_DURATION_MS;
}

function saveDismissed(): void {
  if (!canUseBrowserApis()) {
    return;
  }

  try {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Non-critical UI preference only.
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

function getPromptTitle(mode: InstallPromptMode): string {
  if (mode === "native") return "Install Tate's TV";
  if (mode === "ios") return "Add Tate's TV to your Home Screen";
  if (mode === "android") return "Add Tate's TV to your phone";
  if (mode === "desktop") return "Use Tate's TV like an app";
  if (mode === "fallback") return "Save Tate's TV for quick access";

  return "";
}

function getPromptMessage(mode: InstallPromptMode, profile: BrowserProfile): string {
  if (mode === "native") {
    return "Get the cleaner app-style experience directly from your browser.";
  }

  if (mode === "ios") {
    if (profile.isSafari) {
      return "Tap Share, then choose Add to Home Screen.";
    }

    return "For the best iPhone/iPad install experience, open Tate's TV in Safari, tap Share, then choose Add to Home Screen.";
  }

  if (mode === "android") {
    if (profile.isSamsungInternet) {
      return "Open the browser menu, then choose Add page to or Add to Home screen.";
    }

    return "Use Chrome or your browser menu, then choose Install app or Add to Home screen.";
  }

  if (mode === "desktop") {
    if (profile.isEdge) {
      return "Microsoft Edge can install Tate's TV from the address bar or browser menu.";
    }

    if (profile.isChrome) {
      return "Chrome can install Tate's TV from the address bar or browser menu.";
    }

    return "Supported desktop browsers can install Tate's TV from the address bar or browser menu.";
  }

  if (mode === "fallback") {
    return "Open install instructions for your device, browser, or TV.";
  }

  return "";
}

function shouldSuppressPrompt(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  return pathname === "/install" || pathname.startsWith("/install/");
}

export default function InstallPromptBanner() {
  const pathname = usePathname();

  const [mode, setMode] = useState<InstallPromptMode>("hidden");
  const [profile, setProfile] = useState<BrowserProfile>(() =>
    getBrowserProfile(),
  );
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  const title = useMemo(() => getPromptTitle(mode), [mode]);

  const message = useMemo(
    () => getPromptMessage(mode, profile),
    [mode, profile],
  );

  const hidePrompt = useCallback(() => {
    setDeferredPrompt(null);
    setMode("hidden");
  }, []);

  const dismiss = useCallback(() => {
    saveDismissed();
    setDismissed(true);
    hidePrompt();
  }, [hidePrompt]);

  const showFallbackIfNeeded = useCallback(() => {
    if (isStandaloneMode() || wasDismissedRecently()) {
      hidePrompt();
      return;
    }

    const nextProfile = getBrowserProfile();

    setProfile(nextProfile);
    setMode((currentMode) => {
      if (currentMode === "native") {
        return currentMode;
      }

      return getFallbackMode(nextProfile);
    });
  }, [hidePrompt]);

  useEffect(() => {
    if (!canUseBrowserApis()) {
      return;
    }

    setReady(true);
    setProfile(getBrowserProfile());

    if (
      shouldSuppressPrompt(pathname) ||
      isStandaloneMode() ||
      wasDismissedRecently()
    ) {
      hidePrompt();
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setMode("native");
    };

    const handleAppInstalled = () => {
      setDismissed(false);
      hidePrompt();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isStandaloneMode()) {
        hidePrompt();
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const fallbackTimer = window.setTimeout(
      showFallbackIfNeeded,
      FALLBACK_DELAY_MS,
    );

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearTimeout(fallbackTimer);
    };
  }, [hidePrompt, pathname, showFallbackIfNeeded]);

  useEffect(() => {
    if (shouldSuppressPrompt(pathname)) {
      hidePrompt();
    }
  }, [hidePrompt, pathname]);

  async function handleInstallClick() {
    if (!deferredPrompt) {
      showFallbackIfNeeded();
      return;
    }

    try {
      await deferredPrompt.prompt();

      const choice = await deferredPrompt.userChoice;

      setDeferredPrompt(null);

      if (choice.outcome === "accepted") {
        hidePrompt();
        return;
      }

      showFallbackIfNeeded();
    } catch {
      setDeferredPrompt(null);
      showFallbackIfNeeded();
    }
  }

  if (!ready || dismissed || mode === "hidden" || shouldSuppressPrompt(pathname)) {
    return null;
  }

  return (
    <aside
      className="ttv-install-prompt"
      role="region"
      aria-label="Install Tate's TV"
    >
      <div className="ttv-install-prompt__icon" aria-hidden="true">
        TTV
      </div>

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