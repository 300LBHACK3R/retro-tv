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

type InstallPromptMode = "hidden" | "native" | "ios" | "desktop";

const DISMISSED_KEY = "ttv-install-prompt-dismissed-v1";

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform.toLowerCase();

  return (
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform === "macintel" && window.navigator.maxTouchPoints > 1)
  );
}

function isLikelyDesktop(): boolean {
  if (typeof window === "undefined") return false;

  return window.matchMedia("(min-width: 900px)").matches;
}

function wasDismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);

    if (!raw) return false;

    const dismissedAt = Number(raw);

    if (!Number.isFinite(dismissedAt)) return false;

    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    return Date.now() - dismissedAt < sevenDays;
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

export default function InstallPromptBanner() {
  const [mode, setMode] = useState<InstallPromptMode>("hidden");
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const title = useMemo(() => {
    if (mode === "native") return "Install Tate’s TV";
    if (mode === "ios") return "Add Tate’s TV to your Home Screen";
    if (mode === "desktop") return "Want the app version?";
    return "";
  }, [mode]);

  const message = useMemo(() => {
    if (mode === "native") {
      return "Get the cleaner app-style experience from your device.";
    }

    if (mode === "ios") {
      return "Open in Safari, tap Share, then choose Add to Home Screen.";
    }

    if (mode === "desktop") {
      return "Install from Chrome or Edge, or view install instructions.";
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

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const fallbackTimer = window.setTimeout(() => {
      if (isStandaloneMode() || wasDismissedRecently()) {
        setMode("hidden");
        return;
      }

      if (isIosDevice()) {
        setMode("ios");
        return;
      }

      if (isLikelyDesktop()) {
        setMode("desktop");
      }
    }, 1800);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setMode("hidden");
    }

    setDeferredPrompt(null);
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
