"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TestStatus = "checking" | "pass" | "warn" | "fail";

type CompatCheck = {
  label: string;
  status: TestStatus;
  detail: string;
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
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS legacy standalone flag.
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function getVideoSupport(): {
  mp4: string;
  webm: string;
  hls: string;
} {
  if (typeof document === "undefined") {
    return {
      mp4: "",
      webm: "",
      hls: "",
    };
  }

  const video = document.createElement("video");

  return {
    mp4: video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"'),
    webm: video.canPlayType('video/webm; codecs="vp8, vorbis"'),
    hls: video.canPlayType("application/vnd.apple.mpegurl"),
  };
}

function canUseLocalStorage(): boolean {
  try {
    const key = "__ttv_compat_test__";

    window.localStorage.setItem(key, "ok");
    window.localStorage.removeItem(key);

    return true;
  } catch {
    return false;
  }
}

export default function CompatibilityPage() {
  const [apiStatus, setApiStatus] = useState<CompatCheck>({
    label: "API health fetch",
    status: "checking",
    detail: "Checking /api/health...",
  });

  const clientChecks = useMemo<CompatCheck[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const videoSupport = getVideoSupport();
    const localStorageWorks = canUseLocalStorage();
    const hasTouch = window.matchMedia("(pointer: coarse)").matches;
    const isStandalone = getStandaloneMode();
    const viewport = `${window.innerWidth} × ${window.innerHeight}`;
    const userAgent = window.navigator.userAgent;

    const videoDetail = [
      `MP4: ${videoSupport.mp4 || "no"}`,
      `WebM: ${videoSupport.webm || "no"}`,
      `HLS: ${videoSupport.hls || "no"}`,
    ].join(" · ");

    return [
      {
        label: "Local browser storage",
        status: localStorageWorks ? "pass" : "fail",
        detail: localStorageWorks
          ? "localStorage is available for settings, themes, and local state."
          : "localStorage is blocked. Backup/recovery and some local settings may not work.",
      },
      {
        label: "Video format support",
        status: videoSupport.mp4 ? "pass" : "warn",
        detail: videoDetail,
      },
      {
        label: "Viewport",
        status: "pass",
        detail: viewport,
      },
      {
        label: "Touch / mobile input",
        status: hasTouch ? "pass" : "warn",
        detail: hasTouch
          ? "Coarse pointer detected. Mobile/touch controls should be active."
          : "Mouse/trackpad style pointer detected.",
      },
      {
        label: "PWA standalone mode",
        status: isStandalone ? "pass" : "warn",
        detail: isStandalone
          ? "Running in standalone/install mode."
          : "Running in normal browser tab mode.",
      },
      {
        label: "Browser user agent",
        status: "pass",
        detail: userAgent,
      },
    ];
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkApi() {
      try {
        const response = await fetch("/api/health", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Returned ${response.status}`);
        }

        const data = await response.json();

        if (!cancelled) {
          setApiStatus({
            label: "API health fetch",
            status: "pass",
            detail: `API responded: ${data.status ?? "healthy"} · version ${data.version ?? "unknown"}`,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setApiStatus({
            label: "API health fetch",
            status: "fail",
            detail: error instanceof Error ? error.message : "API request failed.",
          });
        }
      }
    }

    checkApi();

    return () => {
      cancelled = true;
    };
  }, []);

  const checks = [apiStatus, ...clientChecks];

  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card ttv-compat-card">
        <div className="ttv-ops-logo">TTV</div>

        <div>
          <p className="ttv-ops-kicker">Compatibility diagnostics</p>
          <h1>Device + browser test</h1>
          <p>
            Use this page on phones, tablets, desktop browsers, and TV browsers to check whether
            Tate&apos;s TV has the core browser features needed for a stable experience.
          </p>
        </div>

        <div className="ttv-compat-grid">
          {checks.map((check) => (
            <article
              key={check.label}
              className="ttv-compat-check"
              data-status={check.status}
            >
              <div>
                <span>{check.label}</span>
                <strong>{getStatusLabel(check.status)}</strong>
              </div>

              <p>{check.detail}</p>
            </article>
          ))}
        </div>

        <div className="ttv-ops-list">
          <strong>Recommended launch test devices:</strong>
          <ul>
            <li>iPhone Safari</li>
            <li>Android Chrome</li>
            <li>Windows Chrome / Edge</li>
            <li>Firefox desktop</li>
            <li>Tablet browser</li>
            <li>Smart TV browser if available</li>
          </ul>
        </div>

        <div className="ttv-ops-actions">
          <Link href="/">Back to app</Link>
          <Link href="/launch">Launch hub</Link>
          <Link href="/health">Health</Link>
          <Link href="/backup">Backup</Link>
          <Link href="/recovery">Recovery</Link>
        </div>
      </section>
    </main>
  );
}
