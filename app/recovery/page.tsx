"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type RecoveryAction = "idle" | "cleared" | "failed";

function getStorageKeys(): string[] {
  if (typeof window === "undefined") return [];

  const keys: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (key) keys.push(key);
  }

  return keys.sort();
}

function isTatesTvKey(key: string): boolean {
  const normalized = key.toLowerCase();

  return (
    normalized.includes("tv") ||
    normalized.includes("ttv") ||
    normalized.includes("retro") ||
    normalized.includes("channel") ||
    normalized.includes("programming") ||
    normalized.includes("zustand")
  );
}

export default function RecoveryPage() {
  const [status, setStatus] = useState<RecoveryAction>("idle");
  const [clearedKeys, setClearedKeys] = useState<string[]>([]);

  const storageKeys = useMemo(() => {
    if (typeof window === "undefined") return [];

    return getStorageKeys();
  }, []);

  const likelyAppKeys = storageKeys.filter(isTatesTvKey);

  function clearLikelyAppStorage() {
    try {
      const keysToClear = getStorageKeys().filter(isTatesTvKey);

      for (const key of keysToClear) {
        window.localStorage.removeItem(key);
      }

      setClearedKeys(keysToClear);
      setStatus("cleared");
    } catch {
      setStatus("failed");
    }
  }

  function hardReload() {
    window.location.href = "/";
  }

  return (
    <main className="ttv-recovery-screen">
      <section className="ttv-recovery-card">
        <div className="ttv-recovery-logo">TTV</div>

        <div>
          <p className="ttv-recovery-kicker">Launch recovery</p>
          <h1>Repair Tate&apos;s TV on this device</h1>
          <p>
            Use this if the site loads strangely, mobile scrolling breaks, old layouts appear,
            or the player acts wrong after an update. This only clears local browser app state
            on this device.
          </p>
        </div>

        <div className="ttv-recovery-actions">
          <button type="button" onClick={clearLikelyAppStorage}>
            Clear local app state
          </button>

          <button type="button" onClick={hardReload}>
            Reload Tate&apos;s TV
          </button>

          <Link href="/">Back to app</Link>
        </div>

        {status === "cleared" ? (
          <div className="ttv-recovery-result">
            <strong>Cleared local app state.</strong>
            <span>
              {clearedKeys.length > 0
                ? `${clearedKeys.length} saved key(s) removed. Reload the app now.`
                : "No matching saved app keys were found."}
            </span>
          </div>
        ) : null}

        {status === "failed" ? (
          <div className="ttv-recovery-result is-error">
            <strong>Could not clear storage.</strong>
            <span>Try clearing site data manually in your browser settings.</span>
          </div>
        ) : null}

        <div className="ttv-recovery-keys">
          <strong>Detected possible app keys:</strong>
          {likelyAppKeys.length > 0 ? (
            <ul>
              {likelyAppKeys.slice(0, 12).map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          ) : (
            <p>No obvious Tate&apos;s TV local keys detected.</p>
          )}
        </div>
      </section>
    </main>
  );
}
