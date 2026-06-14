"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HealthStatus = "checking" | "healthy" | "failed";

type HealthResponse = {
  ok?: boolean;
  version?: string;
};

export default function LaunchHubPage() {
  const [status, setStatus] =
    useState<HealthStatus>("checking");

  const [version, setVersion] =
    useState("checking...");

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const response = await fetch(
          "/api/health",
          {
            cache: "no-store",
            method: "GET",
          },
        );

        if (!response.ok) {
          throw new Error(
            `Health endpoint returned ${response.status}`,
          );
        }

        const data =
          (await response.json()) as HealthResponse;

        if (cancelled) {
          return;
        }

        setStatus("healthy");

        setVersion(
          data.version?.trim() || "unknown",
        );
      } catch {
        if (cancelled) {
          return;
        }

        setStatus("failed");
        setVersion("unavailable");
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
        <div
          className="ttv-ops-logo"
          aria-hidden="true"
        >
          TTV
        </div>

        <div>
          <p className="ttv-ops-kicker">
            Launch Command
          </p>

          <h1>
            Tate&apos;s TV Launch Hub
          </h1>

          <p>
            Centralized access to launch
            validation, health monitoring,
            compatibility checks, backups,
            recovery tools, and installation
            resources.
          </p>
        </div>

        <div className="ttv-launch-status-grid">
          <div
            className="ttv-launch-status-card"
            data-status={status}
          >
            <span>
              Production Health
            </span>

            <strong>
              {status === "checking"
                ? "Checking..."
                : status === "healthy"
                  ? "Healthy"
                  : "Failed"}
            </strong>
          </div>

          <div className="ttv-launch-status-card">
            <span>Version</span>

            <strong>
              {version}
            </strong>
          </div>

          <div className="ttv-launch-status-card">
            <span>System State</span>

            <strong>
              Launch Ready
            </strong>
          </div>
        </div>

        <div className="ttv-launch-hub-grid">
          <Link
            href="/"
            className="ttv-launch-hub-tile"
          >
            <span>Open App</span>
            <strong>
              Watch Tate&apos;s TV
            </strong>
            <small>
              Return to the live channel
              experience.
            </small>
          </Link>

          <Link
            href="/health"
            className="ttv-launch-hub-tile"
          >
            <span>Health</span>
            <strong>
              Production Status
            </strong>
            <small>
              Check deployment and API
              health.
            </small>
          </Link>

          <Link
            href="/compat"
            className="ttv-launch-hub-tile"
          >
            <span>Compatibility</span>
            <strong>
              Browser Validation
            </strong>
            <small>
              Test browser features,
              storage, playback, and PWA
              support.
            </small>
          </Link>

          <Link
            href="/readiness"
            className="ttv-launch-hub-tile"
          >
            <span>Readiness</span>
            <strong>
              Launch Report
            </strong>
            <small>
              Review deployment readiness
              and verification status.
            </small>
          </Link>

          <Link
            href="/backup"
            className="ttv-launch-hub-tile"
          >
            <span>Backup</span>
            <strong>
              Export / Import
            </strong>
            <small>
              Save and restore local
              application data.
            </small>
          </Link>

          <Link
            href="/recovery"
            className="ttv-launch-hub-tile"
          >
            <span>Recovery</span>
            <strong>
              Device Recovery
            </strong>
            <small>
              Clear broken local state and
              recover the application.
            </small>
          </Link>

          <Link
            href="/install"
            className="ttv-launch-hub-tile"
          >
            <span>Install</span>
            <strong>
              Add to Device
            </strong>
            <small>
              Install instructions for
              phones, tablets, desktops,
              and TVs.
            </small>
          </Link>

          <a
            href="/manifest.webmanifest"
            className="ttv-launch-hub-tile"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>PWA</span>
            <strong>
              Manifest
            </strong>
            <small>
              Verify install metadata and
              app configuration.
            </small>
          </a>

          <a
            href="/sitemap.xml"
            className="ttv-launch-hub-tile"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>SEO</span>
            <strong>
              Sitemap
            </strong>
            <small>
              Validate production sitemap
              output.
            </small>
          </a>
        </div>

        <div className="ttv-ops-list">
          <strong>
            Local Smoke Test
          </strong>

          <code>
            .\scripts\smoke-test.ps1
          </code>
        </div>
      </section>
    </main>
  );
}