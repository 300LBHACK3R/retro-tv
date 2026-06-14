"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RecoveryAction =
  | "idle"
  | "cleared"
  | "failed";

function getStorageKeys(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const keys: string[] = [];

  for (
    let index = 0;
    index < window.localStorage.length;
    index += 1
  ) {
    const key =
      window.localStorage.key(index);

    if (key) {
      keys.push(key);
    }
  }

  return keys.sort();
}

function isTatesTvKey(
  key: string,
): boolean {
  const normalized =
    key.toLowerCase();

  return (
    normalized.includes("tv") ||
    normalized.includes("ttv") ||
    normalized.includes("retro") ||
    normalized.includes("channel") ||
    normalized.includes("programming") ||
    normalized.includes("theme") ||
    normalized.includes("zustand")
  );
}

export default function RecoveryPage() {
  const [status, setStatus] =
    useState<RecoveryAction>("idle");

  const [clearedKeys, setClearedKeys] =
    useState<string[]>([]);

  const [storageKeys, setStorageKeys] =
    useState<string[]>([]);

  useEffect(() => {
    setStorageKeys(getStorageKeys());
  }, []);

  const likelyAppKeys =
    storageKeys.filter(isTatesTvKey);

  async function clearLikelyAppStorage() {
    const confirmed =
      window.confirm(
        "This will clear local Tate's TV settings and cached browser state on this device. Continue?",
      );

    if (!confirmed) {
      return;
    }

    try {
      const keysToClear =
        getStorageKeys().filter(
          isTatesTvKey,
        );

      for (const key of keysToClear) {
        window.localStorage.removeItem(
          key,
        );
      }

      try {
        window.sessionStorage.clear();
      } catch {}

      try {
        if (
          "caches" in window
        ) {
          const cacheNames =
            await caches.keys();

          await Promise.all(
            cacheNames.map((name) =>
              caches.delete(name),
            ),
          );
        }
      } catch {}

      setClearedKeys(keysToClear);
      setStorageKeys(
        getStorageKeys(),
      );
      setStatus("cleared");
    } catch {
      setStatus("failed");
    }
  }

  function hardReload() {
    window.location.assign("/");
  }

  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card">
        <div
          className="ttv-ops-logo"
          aria-hidden="true"
        >
          TTV
        </div>

        <div>
          <p className="ttv-ops-kicker">
            Device Recovery
          </p>

          <h1>
            Repair Tate&apos;s TV
          </h1>

          <p>
            Use this tool if old
            layouts appear, playback
            behaves incorrectly,
            themes become stuck,
            cached data causes
            issues, or the app acts
            unexpectedly after an
            update.
          </p>
        </div>

        <div className="ttv-ops-actions">
          <button
            type="button"
            onClick={
              clearLikelyAppStorage
            }
          >
            Clear Local App State
          </button>

          <button
            type="button"
            onClick={hardReload}
          >
            Reload App
          </button>

          <Link href="/">
            Back to App
          </Link>

          <Link href="/health">
            Health Check
          </Link>

          <Link href="/backup">
            Backup
          </Link>
        </div>

        {status === "cleared" && (
          <div
            className="ttv-ops-status"
            data-status="healthy"
          >
            <strong>
              Recovery Complete
            </strong>

            <span>
              {clearedKeys.length >
              0
                ? `${clearedKeys.length} key(s) removed. Browser cache and session state were also refreshed when supported.`
                : "No matching Tate's TV storage keys were found."}
            </span>
          </div>
        )}

        {status === "failed" && (
          <div
            className="ttv-ops-status"
            data-status="failed"
          >
            <strong>
              Recovery Failed
            </strong>

            <span>
              Browser storage could
              not be cleared. Try
              clearing site data
              manually from browser
              settings.
            </span>
          </div>
        )}

        <div className="ttv-ops-list">
          <strong>
            Detected App Keys
          </strong>

          {likelyAppKeys.length >
          0 ? (
            <>
              <p>
                {
                  likelyAppKeys.length
                }{" "}
                Tate&apos;s TV key(s)
                detected.
              </p>

              <ul>
                {likelyAppKeys
                  .slice(0, 20)
                  .map((key) => (
                    <li key={key}>
                      {key}
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p>
              No obvious Tate&apos;s
              TV browser storage
              keys detected.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}