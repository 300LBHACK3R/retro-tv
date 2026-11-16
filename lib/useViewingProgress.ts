"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "./accountStore";
import { useProfiles } from "./deviceProfiles";
import { sanitizeProgress, type ProgressEntry, type ProgressMap } from "./libraryCatalog";

/** Each mounted profile owns its queue. A late response cannot cross accounts. */
export function useViewingProgress(titleOpen = false) {
  const ownerId = useAccount(s => s.user?.id);
  const profileId = useProfiles(s => s.activeId);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [ready, setReady] = useState(!ownerId);
  const [error, setError] = useState("");
  const titleOpenRef = useRef(titleOpen);
  useEffect(() => { titleOpenRef.current = titleOpen; }, [titleOpen]);
  const actions = useRef<{ update: (id: string, entry: ProgressEntry | null) => void; reload: () => void; flush: () => void } | null>(null);
  useEffect(() => {
    let live = true, loaded = !ownerId, busy = false, blocked = false;
    let values: ProgressMap = {};
    const revisions: Record<string, number> = {};
    const sequences: Record<string, number> = {};
    const playbackId = crypto.randomUUID();
    const pending = new Map<string, ProgressEntry>();
    const current = () => live && useAccount.getState().user?.id === ownerId && useProfiles.getState().activeId === profileId;
    setProgress({}); setReady(!ownerId); setError("");
    async function flush() {
      if (!current() || !ownerId || !loaded || busy || blocked || !pending.size) return;
      busy = true;
      try {
        for (const [mediaId, entry] of pending) {
          if (!current()) break;
          const sequence = sequences[mediaId] ?? 0;
          const response = await fetch("/api/account/viewing", { method: "POST", credentials: "same-origin", keepalive: true,
            headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(12_000),
            body: JSON.stringify({ action: "progress", ownerId, profileId, mediaId, ...entry, revision: revisions[mediaId] ?? 0, playbackId, sequence }) });
          const data = await response.json();
          if (!current()) break;
          if (!response.ok) {
            if ([401, 403, 409].includes(response.status)) blocked = true;
            throw new Error(data.error || "Viewing progress could not be saved.");
          }
          revisions[mediaId] = data.revision;
          if (pending.get(mediaId) === entry) pending.delete(mediaId);
          setError("");
        }
      } catch (e) { if (current()) setError(e instanceof Error ? e.message : "Viewing sync is temporarily unavailable."); }
      finally { busy = false; }
    }
    async function load() {
      // Keep a playing/paused title's observed revision. A background read must
      // not silently grant its old player position permission to replace a
      // newer position saved on another screen.
      if (!ownerId || !profileId || !current() || busy || pending.size || blocked || (loaded && titleOpenRef.current)) return;
      busy = true;
      try {
        const response = await fetch(`/api/account/viewing?profile=${encodeURIComponent(profileId)}`, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Saved viewing is temporarily unavailable.");
        if (!current()) return;
        // Do not overwrite progress produced while this read was in flight.
        for (const [id, entry] of Object.entries(data.progress ?? {}) as [string, ProgressEntry & { revision: number }][]) {
          revisions[id] = entry.revision;
        }
        values = { ...sanitizeProgress(data.progress), ...Object.fromEntries(pending) };
        setProgress(values); loaded = true; setReady(true); setError("");
      } catch (e) { if (current()) setError(e instanceof Error ? e.message : "Saved viewing is temporarily unavailable."); }
      finally { busy = false; }
    }
    actions.current = { flush: () => { void flush(); }, update(id, entry) {
      if (!current() || !loaded || blocked) return;
      const next = entry ?? (values[id] ? { ...values[id], position: 0, updatedAt: Date.now() } : null);
      if (!next) return;
      values = sanitizeProgress({ ...values, [id]: next }); setProgress(values);
      if (ownerId) { sequences[id] = (sequences[id] ?? 0) + 1; pending.set(id, next); }
    }, reload() { if (!busy) { blocked = false; pending.clear(); void load(); } } };
    void load();
    const timer = setInterval(() => { if (pending.size) void flush(); else if (document.visibilityState === "visible") void load(); }, 15_000);
    const visibility = () => { if (pending.size) void flush(); else if (document.visibilityState === "visible") void load(); };
    // TitleDetails saves on pause/pagehide; run after that listener has queued it.
    const finish = () => { queueMicrotask(() => void flush()); };
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pause", finish, true);
    window.addEventListener("pagehide", finish);
    return () => { void flush(); live = false; clearInterval(timer); document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pause", finish, true); window.removeEventListener("pagehide", finish); actions.current = null; };
  }, [ownerId, profileId]);
  const updateProgress = useCallback((id: string, entry: ProgressEntry | null) => actions.current?.update(id, entry), []);
  const reload = useCallback(() => actions.current?.reload(), []);
  const flush = useCallback(() => actions.current?.flush(), []);
  return { progress, updateProgress, ready, error, reload, flush };
}
