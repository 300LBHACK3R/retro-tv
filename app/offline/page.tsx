"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine);
    };

    updateStatus();

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card ttv-offline-card">
        <div
          className="ttv-ops-logo"
          aria-hidden="true"
        >
          TTV
        </div>

        <div>
          <p className="ttv-ops-kicker">
            Offline Mode
          </p>

          <h1>
            {isOnline
              ? "Connection Restored"
              : "You're Offline"}
          </h1>

          <p>
            {isOnline
              ? "Your internet connection has been restored. You can return to Tate's TV and continue watching."
              : "Tate's TV requires an internet connection for live programming, video playback, guide updates, uploads, synchronization, and administrative tools."}
          </p>
        </div>

        <div
          className="ttv-help-callout"
          data-status={
            isOnline
              ? "healthy"
              : "warning"
          }
        >
          <strong>
            {isOnline
              ? "Back Online"
              : "What Still Works?"}
          </strong>

          <p>
            {isOnline
              ? "Reload the application to reconnect to live channels and programming services."
              : "Some application shell pages may continue loading from cache, but live channels, guide updates, media synchronization, and administrative features require network access."}
          </p>
        </div>

        <div className="ttv-ops-actions">
          <Link href="/">
            Return to App
          </Link>

          <Link href="/help">
            Help
          </Link>

          <Link href="/compat">
            Compatibility
          </Link>

          <Link href="/install">
            Install
          </Link>

          <Link href="/backup">
            Backup
          </Link>

          <Link href="/recovery">
            Recovery
          </Link>
        </div>

        <div className="ttv-ops-list">
          <strong>
            Connection Status
          </strong>

          <ul>
            <li>
              Network:{" "}
              {isOnline
                ? "Online"
                : "Offline"}
            </li>

            <li>
              Live Channels:{" "}
              {isOnline
                ? "Available"
                : "Unavailable"}
            </li>

            <li>
              Guide Updates:{" "}
              {isOnline
                ? "Available"
                : "Unavailable"}
            </li>

            <li>
              Cached Pages: Available
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}