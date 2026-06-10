"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HealthStatus = "checking" | "healthy" | "failed";

export default function LaunchHubPage() {
  const [status, setStatus] = useState<HealthStatus>("checking");
  const [version, setVersion] = useState("checking...");

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const response = await fetch("/api/health", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Health endpoint failed");
        }

        const data = await response.json();

        if (!cancelled) {
          setStatus("healthy");
          setVersion(data.version ?? "unknown");
        }
      } catch {
        if (!cancelled) {
          setStatus("failed");
          setVersion("unavailable");
        }
      }
    }

    checkHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card ttv-launch-hub-card">
        <div className="ttv-ops-logo">TTV</div>

        <div>
          <p className="ttv-ops-kicker">Launch command</p>
          <h1>Tate&apos;s TV Launch Hub</h1>
          <p>
            Production tools, recovery, backups, app health, and launch checks in one place.
          </p>
        </div>

        <div className="ttv-launch-status-grid">
          <div className="ttv-launch-status-card" data-status={status}>
            <span>Production health</span>
            <strong>{status === "checking" ? "Checking..." : status}</strong>
          </div>

          <div className="ttv-launch-status-card">
            <span>Version</span>
            <strong>{version}</strong>
          </div>

          <div className="ttv-launch-status-card">
            <span>Mode</span>
            <strong>Launch-ready</strong>
          </div>
        </div>

        <div className="ttv-launch-hub-grid">
          <Link href="/" className="ttv-launch-hub-tile">
            <span>Open App</span>
            <strong>Watch Tate&apos;s TV</strong>
            <small>Return to the live TV experience.</small>
          </Link>

          <Link href="/health" className="ttv-launch-hub-tile">
            <span>Health</span>
            <strong>Production status</strong>
            <small>Check API and deploy health.</small>
          </Link>

          <Link href="/backup" className="ttv-launch-hub-tile">
            <span>Backup</span>
            <strong>Export / import</strong>
            <small>Save or restore local browser state.</small>
          </Link>

          <Link href="/recovery" className="ttv-launch-hub-tile">
            <span>Recovery</span>
            <strong>Fix this device</strong>
            <small>Clear broken cached app state.</small>
          </Link>

          <a href="/manifest.webmanifest" className="ttv-launch-hub-tile">
            <span>PWA</span>
            <strong>Manifest</strong>
            <small>Verify app install metadata.</small>
          </a>

          <a href="/sitemap.xml" className="ttv-launch-hub-tile">
            <span>SEO</span>
            <strong>Sitemap</strong>
            <small>Check production sitemap route.</small>
          </a>
        </div>

        <div className="ttv-ops-list">
          <strong>Local smoke test command:</strong>
          <code>.\scripts\smoke-test.ps1</code>
        </div>
      </section>
    </main>
  );
}
