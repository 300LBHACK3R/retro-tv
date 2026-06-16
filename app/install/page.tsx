"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type InstallStatus = {
  standalone: boolean;
  userAgent: string;
  platform: string;
  browser: string;
  installSupported: boolean;
  serviceWorkerSupported: boolean;
};

function getStandaloneMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(
      (
        window.navigator as Navigator & {
          standalone?: boolean;
        }
      ).standalone,
    )
  );
}

function getUserAgent(): string {
  if (typeof navigator === "undefined") {
    return "";
  }

  return navigator.userAgent;
}

function getPlatform(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) {
    return "iPhone / iPad";
  }

  if (/android/.test(ua)) {
    return "Android";
  }

  if (/windows/.test(ua)) {
    return "Windows";
  }

  if (/macintosh|mac os/.test(ua)) {
    return "macOS";
  }

  if (/linux/.test(ua)) {
    return "Linux";
  }

  return "Unknown";
}

function getBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (/samsungbrowser/.test(ua)) {
    return "Samsung Internet";
  }

  if (/edg|edgios|edga/.test(ua)) {
    return "Microsoft Edge";
  }

  if (/crios|chrome/.test(ua)) {
    return "Google Chrome";
  }

  if (/fxios|firefox/.test(ua)) {
    return "Firefox";
  }

  if (/safari/.test(ua)) {
    return "Safari";
  }

  return "Unknown Browser";
}

function getInstallRecommendation(status: InstallStatus): {
  title: string;
  detail: string;
} {
  const platform = status.platform.toLowerCase();
  const browser = status.browser.toLowerCase();

  if (status.standalone) {
    return {
      title: "Already installed",
      detail:
        "Tate’s TV is currently running in standalone app mode on this device.",
    };
  }

  if (platform.includes("iphone") || platform.includes("ipad")) {
    return {
      title: "Use Safari ? Share ? Add to Home Screen",
      detail:
        "On iPhone and iPad, open Tate’s TV in Safari, tap the Share button, choose Add to Home Screen, then tap Add.",
    };
  }

  if (platform.includes("android")) {
    if (browser.includes("chrome") || browser.includes("samsung")) {
      return {
        title: "Use Install app or Add to Home screen",
        detail:
          "Open the browser menu and choose Install app or Add to Home screen. Some Android browsers also show an automatic install prompt.",
      };
    }

    return {
      title: "Use your browser menu",
      detail:
        "Open the browser menu and look for Install, Add to Home screen, or Bookmark.",
    };
  }

  if (
    browser.includes("chrome") ||
    browser.includes("edge") ||
    platform.includes("windows")
  ) {
    return {
      title: "Use the address bar install button",
      detail:
        "In Chrome or Edge, look for the install icon in the address bar, or open the browser menu and choose Install Tate’s TV.",
    };
  }

  if (browser.includes("safari") || browser.includes("firefox")) {
    return {
      title: "Use bookmark or fullscreen mode",
      detail:
        "This browser may not show a full install button. Bookmark Tate’s TV and use fullscreen mode when available.",
    };
  }

  return {
    title: "Use the browser install or bookmark option",
    detail:
      "Open your browser menu and look for Install, Add to Home screen, Bookmark, or Fullscreen.",
  };
}

export default function InstallPage() {
  const [status, setStatus] = useState<InstallStatus>({
    standalone: false,
    userAgent: "Checking...",
    platform: "Checking...",
    browser: "Checking...",
    installSupported: false,
    serviceWorkerSupported: false,
  });

  useEffect(() => {
    const updateStatus = () => {
      const ua = getUserAgent();

      setStatus({
        standalone: getStandaloneMode(),
        userAgent: ua.length > 180 ? `${ua.slice(0, 180)}...` : ua,
        platform: getPlatform(ua),
        browser: getBrowser(ua),
        installSupported:
          "serviceWorker" in navigator ||
          window.matchMedia("(display-mode: standalone)").matches,
        serviceWorkerSupported: "serviceWorker" in navigator,
      });
    };

    updateStatus();

    const mediaQuery = window.matchMedia("(display-mode: standalone)");

    mediaQuery.addEventListener("change", updateStatus);
    window.addEventListener("appinstalled", updateStatus);

    return () => {
      mediaQuery.removeEventListener("change", updateStatus);
      window.removeEventListener("appinstalled", updateStatus);
    };
  }, []);

  const recommendation = useMemo(() => getInstallRecommendation(status), [status]);

  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card ttv-install-card">
        <div className="ttv-ops-logo">TTV</div>

        <div>
          <p className="ttv-ops-kicker">Install Tate&apos;s TV</p>

          <h1>Add Tate&apos;s TV to Your Device</h1>

          <p>
            Tate&apos;s TV can run like an app on supported phones, tablets,
            desktops, and browsers. Different devices install web apps in
            different ways, so use the instructions below for your device.
          </p>
        </div>

        <div
          className="ttv-install-status"
          data-installed={status.standalone ? "true" : "false"}
        >
          <strong>
            {status.standalone
              ? "Installed Mode Detected"
              : "Browser Mode Detected"}
          </strong>

          <span>
            {status.standalone
              ? "Tate's TV is running in standalone app mode."
              : recommendation.detail}
          </span>
        </div>

        <div className="ttv-ops-list">
          <strong>{recommendation.title}</strong>

          <ul>
            <li>Detected platform: {status.platform}</li>
            <li>Detected browser: {status.browser}</li>
            <li>
              Mode: {status.standalone ? "Standalone App" : "Browser Tab"}
            </li>
          </ul>
        </div>

        <div className="ttv-install-grid">
          <article className="ttv-install-card-step">
            <span>iPhone / iPad</span>

            <h2>Safari Install</h2>

            <ol>
              <li>Open Safari on the iPhone or iPad.</li>
              <li>Go to tatestv.ca.</li>
              <li>Tap the Share button.</li>
              <li>Choose Add to Home Screen.</li>
              <li>Turn on Open as Web App if shown.</li>
              <li>Tap Add.</li>
            </ol>
          </article>

          <article className="ttv-install-card-step">
            <span>Android</span>

            <h2>Chrome / Samsung Internet</h2>

            <ol>
              <li>Open Tate&apos;s TV in Chrome or Samsung Internet.</li>
              <li>Use the automatic Install prompt if it appears.</li>
              <li>Otherwise open the browser menu.</li>
              <li>Choose Install app or Add to Home screen.</li>
              <li>Confirm installation.</li>
            </ol>
          </article>

          <article className="ttv-install-card-step">
            <span>Desktop</span>

            <h2>Chrome / Edge</h2>

            <ol>
              <li>Open Tate&apos;s TV on desktop.</li>
              <li>Look for the install icon in the address bar.</li>
              <li>Or open the browser menu.</li>
              <li>Choose Install Tate&apos;s TV.</li>
              <li>Launch it from the Start Menu, Dock, or desktop.</li>
            </ol>
          </article>

          <article className="ttv-install-card-step">
            <span>Safari / Firefox / TV</span>

            <h2>Bookmark / Fullscreen</h2>

            <ol>
              <li>Open tatestv.ca in the browser.</li>
              <li>Bookmark the page or add it to favorites.</li>
              <li>Use fullscreen mode when available.</li>
              <li>On Smart TVs, keep Tate&apos;s TV saved in the browser.</li>
            </ol>
          </article>
        </div>

        <div className="ttv-ops-list">
          <strong>Device Information</strong>

          <ul>
            <li>Platform: {status.platform}</li>
            <li>Browser: {status.browser}</li>
            <li>
              Mode: {status.standalone ? "Standalone App" : "Browser Tab"}
            </li>
            <li>
              Service Worker:{" "}
              {status.serviceWorkerSupported ? "Supported" : "Unsupported"}
            </li>
            <li>
              Install Support:{" "}
              {status.installSupported ? "Detected" : "Limited / Manual"}
            </li>
            <li>User Agent: {status.userAgent}</li>
          </ul>
        </div>

        <div className="ttv-ops-actions">
          <Link href="/">Back to App</Link>
          <Link href="/launch">Launch Hub</Link>
          <Link href="/compat">Compatibility</Link>
          <Link href="/health">Health</Link>
          <Link href="/readiness">Readiness</Link>
        </div>
      </section>
    </main>
  );
}