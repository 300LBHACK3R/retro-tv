"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TestStatus = "checking" | "pass" | "warn" | "fail";

type CompatCheck = {
  label: string;
  status: TestStatus;
  detail: string;
};

type HealthResponse = {
  status?: string;
  version?: string;
};

function getStatusLabel(status: TestStatus): string {
  switch (status) {
    case "checking":
      return "Checking";
    case "pass":
      return "Pass";
    case "warn":
      return "Warning";
    case "fail":
      return "Fail";
  }
}

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

function getVideoSupport() {
  if (typeof document === "undefined") {
    return {
      mp4: "",
      webm: "",
      hls: "",
    };
  }

  const video = document.createElement("video");

  return {
    mp4: video.canPlayType(
      'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
    ),
    webm: video.canPlayType(
      'video/webm; codecs="vp8, vorbis"',
    ),
    hls: video.canPlayType(
      "application/vnd.apple.mpegurl",
    ),
  };
}

function canUseLocalStorage(): boolean {
  try {
    const key = "__ttv_storage_test__";

    localStorage.setItem(key, "1");
    localStorage.removeItem(key);

    return true;
  } catch {
    return false;
  }
}

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function hasServiceWorkerSupport(): boolean {
  return typeof navigator !== "undefined" &&
    "serviceWorker" in navigator;
}

export default function CompatibilityPage() {
  const [checks, setChecks] = useState<CompatCheck[]>([]);
  const [apiStatus, setApiStatus] =
    useState<CompatCheck>({
      label: "API health fetch",
      status: "checking",
      detail: "Checking /api/health...",
    });

  useEffect(() => {
    const buildChecks = () => {
      const videoSupport = getVideoSupport();

      const viewport =
        `${window.innerWidth} × ${window.innerHeight}`;

      const userAgent =
        window.navigator.userAgent.length > 140
          ? `${window.navigator.userAgent.slice(0, 140)}...`
          : window.navigator.userAgent;

      const nextChecks: CompatCheck[] = [
        {
          label: "Local browser storage",
          status: canUseLocalStorage()
            ? "pass"
            : "fail",
          detail: canUseLocalStorage()
            ? "localStorage available."
            : "localStorage unavailable.",
        },
        {
          label: "IndexedDB",
          status: canUseIndexedDb()
            ? "pass"
            : "fail",
          detail: canUseIndexedDb()
            ? "IndexedDB available."
            : "IndexedDB unavailable.",
        },
        {
          label: "Service Worker",
          status: hasServiceWorkerSupport()
            ? "pass"
            : "warn",
          detail: hasServiceWorkerSupport()
            ? "Service Worker supported."
            : "Service Worker unsupported.",
        },
        {
          label: "Video format support",
          status: videoSupport.mp4
            ? "pass"
            : "warn",
          detail:
            `MP4: ${videoSupport.mp4 || "no"} · ` +
            `WebM: ${videoSupport.webm || "no"} · ` +
            `HLS: ${videoSupport.hls || "no"}`,
        },
        {
          label: "Viewport",
          status: "pass",
          detail: viewport,
        },
        {
          label: "Network",
          status: navigator.onLine
            ? "pass"
            : "warn",
          detail: navigator.onLine
            ? "Browser online."
            : "Browser offline.",
        },
        {
          label: "Touch / mobile input",
          status: window.matchMedia(
            "(pointer: coarse)",
          ).matches
            ? "pass"
            : "warn",
          detail: window.matchMedia(
            "(pointer: coarse)",
          ).matches
            ? "Touch-capable device detected."
            : "Mouse/trackpad device detected.",
        },
        {
          label: "PWA standalone mode",
          status: getStandaloneMode()
            ? "pass"
            : "warn",
          detail: getStandaloneMode()
            ? "Running in installed mode."
            : "Running in browser mode.",
        },
        {
          label: "Browser user agent",
          status: "pass",
          detail: userAgent,
        },
      ];

      setChecks(nextChecks);
    };

    buildChecks();

    window.addEventListener(
      "resize",
      buildChecks,
    );

    return () => {
      window.removeEventListener(
        "resize",
        buildChecks,
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkApi() {
      try {
        const response = await fetch(
          "/api/health",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            `Returned ${response.status}`,
          );
        }

        const data =
          (await response.json()) as HealthResponse;

        if (!cancelled) {
          setApiStatus({
            label: "API health fetch",
            status: "pass",
            detail:
              `API responded: ${data.status ?? "healthy"} · ` +
              `version ${data.version ?? "unknown"}`,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setApiStatus({
            label: "API health fetch",
            status: "fail",
            detail:
              error instanceof Error
                ? error.message
                : "API request failed.",
          });
        }
      }
    }

    checkApi();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card ttv-compat-card">
        <div className="ttv-ops-logo">
          TTV
        </div>

        <div>
          <p className="ttv-ops-kicker">
            Compatibility diagnostics
          </p>

          <h1>Device + Browser Test</h1>

          <p>
            Verify browser compatibility,
            storage, media playback,
            PWA support, and API access.
          </p>
        </div>

        <div className="ttv-compat-grid">
          {[apiStatus, ...checks].map(
            (check) => (
              <article
                key={check.label}
                className="ttv-compat-check"
                data-status={check.status}
              >
                <div>
                  <span>{check.label}</span>
                  <strong>
                    {getStatusLabel(
                      check.status,
                    )}
                  </strong>
                </div>

                <p>{check.detail}</p>
              </article>
            ),
          )}
        </div>

        <div className="ttv-ops-list">
          <strong>
            Recommended launch test devices:
          </strong>

          <ul>
            <li>iPhone Safari</li>
            <li>Android Chrome</li>
            <li>Windows Chrome</li>
            <li>Microsoft Edge</li>
            <li>Firefox Desktop</li>
            <li>Tablet Browser</li>
            <li>Smart TV Browser</li>
          </ul>
        </div>

        <div className="ttv-ops-actions">
          <Link href="/">Back to App</Link>
          <Link href="/launch">Launch Hub</Link>
          <Link href="/health">Health</Link>
          <Link href="/backup">Backup</Link>
          <Link href="/recovery">Recovery</Link>
          <Link href="/readiness">Readiness</Link>
        </div>
      </section>
    </main>
  );
}