"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type InstallStatus = {
  standalone: boolean;
  userAgent: string;
  platform: string;
};

function getStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export default function InstallPage() {
  const [status, setStatus] = useState<InstallStatus>({
    standalone: false,
    userAgent: "Checking...",
    platform: "Checking...",
  });

  useEffect(() => {
    setStatus({
      standalone: getStandaloneMode(),
      userAgent: window.navigator.userAgent,
      platform: window.navigator.platform || "Unknown platform",
    });
  }, []);

  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card ttv-install-card">
        <div className="ttv-ops-logo">TTV</div>

        <div>
          <p className="ttv-ops-kicker">Install Tate&apos;s TV</p>
          <h1>Add Tate&apos;s TV to your device</h1>
          <p>
            Install Tate&apos;s TV like an app on your phone, tablet, desktop, or TV browser for a
            cleaner full-screen experience.
          </p>
        </div>

        <div className="ttv-install-status" data-installed={status.standalone ? "true" : "false"}>
          <strong>{status.standalone ? "Installed mode detected" : "Browser tab mode detected"}</strong>
          <span>
            {status.standalone
              ? "You are already running Tate's TV in standalone app mode."
              : "You are currently using Tate's TV inside a regular browser tab."}
          </span>
        </div>

        <div className="ttv-install-grid">
          <article className="ttv-install-card-step">
            <span>iPhone / iPad</span>
            <h2>Safari install</h2>
            <ol>
              <li>Open Tate&apos;s TV in Safari.</li>
              <li>Tap the Share button.</li>
              <li>Choose Add to Home Screen.</li>
              <li>Tap Add.</li>
            </ol>
          </article>

          <article className="ttv-install-card-step">
            <span>Android</span>
            <h2>Chrome install</h2>
            <ol>
              <li>Open Tate&apos;s TV in Chrome.</li>
              <li>Tap the menu button.</li>
              <li>Choose Add to Home screen or Install app.</li>
              <li>Confirm install.</li>
            </ol>
          </article>

          <article className="ttv-install-card-step">
            <span>Desktop</span>
            <h2>Chrome / Edge</h2>
            <ol>
              <li>Open Tate&apos;s TV in the browser.</li>
              <li>Look for the install icon in the address bar.</li>
              <li>Choose Install.</li>
              <li>Launch from your desktop or Start menu.</li>
            </ol>
          </article>

          <article className="ttv-install-card-step">
            <span>TV browser</span>
            <h2>Smart TV usage</h2>
            <ol>
              <li>Open the TV browser.</li>
              <li>Go to tatestv.ca.</li>
              <li>Bookmark the page.</li>
              <li>Use full-screen mode when available.</li>
            </ol>
          </article>
        </div>

        <div className="ttv-ops-list">
          <strong>Device info:</strong>
          <ul>
            <li>Platform: {status.platform}</li>
            <li>Mode: {status.standalone ? "Standalone app" : "Browser tab"}</li>
            <li>User agent: {status.userAgent}</li>
          </ul>
        </div>

        <div className="ttv-ops-actions">
          <Link href="/">Back to app</Link>
          <Link href="/launch">Launch hub</Link>
          <Link href="/compat">Compatibility</Link>
          <Link href="/health">Health</Link>
        </div>
      </section>
    </main>
  );
}
