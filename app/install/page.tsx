"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type InstallStatus = {
  standalone: boolean;
  userAgent: string;
  platform: string;
  installSupported: boolean;
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

function getPlatform(): string {
  if (typeof navigator === "undefined") {
    return "Unknown";
  }

  const ua = navigator.userAgent;

  if (/iphone|ipad|ipod/i.test(ua)) {
    return "iPhone / iPad";
  }

  if (/android/i.test(ua)) {
    return "Android";
  }

  if (/windows/i.test(ua)) {
    return "Windows";
  }

  if (/macintosh|mac os/i.test(ua)) {
    return "macOS";
  }

  if (/linux/i.test(ua)) {
    return "Linux";
  }

  return "Unknown";
}

export default function InstallPage() {
  const [status, setStatus] = useState<InstallStatus>({
    standalone: false,
    userAgent: "Checking...",
    platform: "Checking...",
    installSupported: false,
  });

  useEffect(() => {
    const updateStatus = () => {
      const ua = navigator.userAgent;

      setStatus({
        standalone: getStandaloneMode(),
        userAgent:
          ua.length > 140
            ? `${ua.slice(0, 140)}...`
            : ua,
        platform: getPlatform(),
        installSupported:
          "serviceWorker" in navigator,
      });
    };

    updateStatus();

    const mediaQuery =
      window.matchMedia(
        "(display-mode: standalone)",
      );

    mediaQuery.addEventListener(
      "change",
      updateStatus,
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        updateStatus,
      );
    };
  }, []);

  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card ttv-install-card">
        <div className="ttv-ops-logo">
          TTV
        </div>

        <div>
          <p className="ttv-ops-kicker">
            Install Tate&apos;s TV
          </p>

          <h1>
            Add Tate&apos;s TV to Your Device
          </h1>

          <p>
            Install Tate&apos;s TV like a native
            application on phones, tablets,
            desktops, and supported TV browsers
            for the best full-screen experience.
          </p>
        </div>

        <div
          className="ttv-install-status"
          data-installed={
            status.standalone
              ? "true"
              : "false"
          }
        >
          <strong>
            {status.standalone
              ? "Installed Mode Detected"
              : "Browser Mode Detected"}
          </strong>

          <span>
            {status.standalone
              ? "Tate's TV is running in standalone app mode."
              : "Tate's TV is currently running inside a browser tab."}
          </span>
        </div>

        <div className="ttv-install-grid">
          <article className="ttv-install-card-step">
            <span>
              iPhone / iPad
            </span>

            <h2>Safari Install</h2>

            <ol>
              <li>
                Open Tate&apos;s TV in Safari.
              </li>
              <li>
                Tap the Share button.
              </li>
              <li>
                Choose Add to Home Screen.
              </li>
              <li>
                Tap Add.
              </li>
            </ol>
          </article>

          <article className="ttv-install-card-step">
            <span>Android</span>

            <h2>Chrome Install</h2>

            <ol>
              <li>
                Open Tate&apos;s TV in Chrome.
              </li>
              <li>
                Open the Chrome menu.
              </li>
              <li>
                Select Install App or Add to
                Home Screen.
              </li>
              <li>
                Confirm installation.
              </li>
            </ol>
          </article>

          <article className="ttv-install-card-step">
            <span>Desktop</span>

            <h2>Chrome / Edge</h2>

            <ol>
              <li>
                Open Tate&apos;s TV.
              </li>
              <li>
                Look for the install icon in
                the address bar.
              </li>
              <li>
                Click Install.
              </li>
              <li>
                Launch from Start Menu or
                Desktop.
              </li>
            </ol>
          </article>

          <article className="ttv-install-card-step">
            <span>TV Browser</span>

            <h2>Smart TV Usage</h2>

            <ol>
              <li>
                Open the TV browser.
              </li>
              <li>
                Navigate to tatestv.ca.
              </li>
              <li>
                Bookmark the page.
              </li>
              <li>
                Use fullscreen mode whenever
                available.
              </li>
            </ol>
          </article>
        </div>

        <div className="ttv-ops-list">
          <strong>
            Device Information
          </strong>

          <ul>
            <li>
              Platform: {status.platform}
            </li>

            <li>
              Mode:{" "}
              {status.standalone
                ? "Standalone App"
                : "Browser Tab"}
            </li>

            <li>
              Service Worker:{" "}
              {status.installSupported
                ? "Supported"
                : "Unsupported"}
            </li>

            <li>
              User Agent: {status.userAgent}
            </li>
          </ul>
        </div>

        <div className="ttv-ops-actions">
          <Link href="/">
            Back to App
          </Link>

          <Link href="/launch">
            Launch Hub
          </Link>

          <Link href="/compat">
            Compatibility
          </Link>

          <Link href="/health">
            Health
          </Link>

          <Link href="/readiness">
            Readiness
          </Link>
        </div>
      </section>
    </main>
  );
}