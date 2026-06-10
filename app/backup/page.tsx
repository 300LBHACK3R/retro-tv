"use client";

import Link from "next/link";
import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";

type BackupStatus = "idle" | "exported" | "imported" | "failed";

type BackupPayload = {
  app: "Tate's TV";
  version: 1;
  exportedAt: string;
  origin: string;
  localStorage: Record<string, string>;
};

function getAllStorage(): Record<string, string> {
  if (typeof window === "undefined") return {};

  const output: Record<string, string> = {};

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (!key) continue;

    const value = window.localStorage.getItem(key);

    if (value !== null) {
      output[key] = value;
    }
  }

  return output;
}

function isLikelyTatesTvKey(key: string): boolean {
  const normalized = key.toLowerCase();

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

function downloadJson(filename: string, data: BackupPayload) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export default function BackupPage() {
  const [status, setStatus] = useState<BackupStatus>("idle");
  const [message, setMessage] = useState("");

  const storage = useMemo(() => {
    if (typeof window === "undefined") return {};

    return getAllStorage();
  }, []);

  const allKeys = Object.keys(storage).sort();
  const likelyAppKeys = allKeys.filter(isLikelyTatesTvKey);

  function exportBackup() {
    try {
      const payload: BackupPayload = {
        app: "Tate's TV",
        version: 1,
        exportedAt: new Date().toISOString(),
        origin: window.location.origin,
        localStorage: getAllStorage(),
      };

      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`tates-tv-backup-${date}.json`, payload);

      setStatus("exported");
      setMessage(`${Object.keys(payload.localStorage).length} local storage key(s) exported.`);
    } catch (error) {
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : "Could not export backup.");
    }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<BackupPayload>;

      if (parsed.app !== "Tate's TV" || parsed.version !== 1 || !parsed.localStorage) {
        throw new Error("This does not look like a valid Tate's TV backup file.");
      }

      for (const [key, value] of Object.entries(parsed.localStorage)) {
        if (typeof value === "string") {
          window.localStorage.setItem(key, value);
        }
      }

      setStatus("imported");
      setMessage(`${Object.keys(parsed.localStorage).length} local storage key(s) imported. Reload the app now.`);
    } catch (error) {
      setStatus("failed");
      setMessage(error instanceof Error ? error.message : "Could not import backup.");
    } finally {
      event.target.value = "";
    }
  }

  function reloadApp() {
    window.location.href = "/";
  }

  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card">
        <div className="ttv-ops-logo">TTV</div>

        <div>
          <p className="ttv-ops-kicker">Backup toolkit</p>
          <h1>Backup or restore this device</h1>
          <p>
            Export local Tate&apos;s TV browser state before upgrades, or restore it later if a
            device gets weird after updates. This handles local browser state only.
          </p>
        </div>

        <div className="ttv-ops-actions">
          <button type="button" onClick={exportBackup}>
            Export backup
          </button>

          <label className="ttv-backup-upload">
            Import backup
            <input accept="application/json" type="file" onChange={importBackup} />
          </label>

          <button type="button" onClick={reloadApp}>
            Reload app
          </button>

          <Link href="/">Back to app</Link>
          <Link href="/health">Health</Link>
          <Link href="/recovery">Recovery</Link>
        </div>

        {status !== "idle" ? (
          <div
            className="ttv-ops-status"
            data-status={status === "failed" ? "failed" : "healthy"}
          >
            <strong>
              {status === "exported"
                ? "Backup exported"
                : status === "imported"
                  ? "Backup imported"
                  : "Backup failed"}
            </strong>
            <span>{message}</span>
          </div>
        ) : null}

        <div className="ttv-ops-list">
          <strong>Detected local storage keys:</strong>

          {allKeys.length > 0 ? (
            <>
              <p>
                {allKeys.length} total key(s), {likelyAppKeys.length} likely Tate&apos;s TV key(s).
              </p>

              <ul>
                {allKeys.slice(0, 18).map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>No local storage keys detected on this device.</p>
          )}
        </div>
      </section>
    </main>
  );
}
