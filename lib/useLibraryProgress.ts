"use client";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "./accountStore";
import { profileProgressKey } from "./deviceProfiles";
import { sanitizeProgress, type ProgressMap, type ProgressEntry } from "./libraryCatalog";

function readProgress(key: string): ProgressMap {
  try { return sanitizeProgress(JSON.parse(localStorage.getItem(key) || "{}")); }
  catch { return {}; }
}

/** ProfileGate remounts on account/profile changes. Both shelves share progress. */
export function useLibraryProgress() {
  const signedIn = !!useAccount(state => state.user);
  const [progressKey] = useState(profileProgressKey);
  const [progress, setProgress] = useState<ProgressMap>({});
  useEffect(() => { setProgress(signedIn ? readProgress(progressKey) : {}); }, [progressKey, signedIn]);
  const updateProgress = useCallback((id: string, entry: ProgressEntry | null) => {
    setProgress(previous => {
      const next = { ...previous, ...(signedIn ? readProgress(progressKey) : {}) };
      if (entry) next[id] = entry;
      else delete next[id];
      const safe = sanitizeProgress(next);
      try { if (signedIn) localStorage.setItem(progressKey, JSON.stringify(safe)); } catch {}
      return safe;
    });
  }, [progressKey, signedIn]);
  return { progress, updateProgress };
}
