"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type {
  ProgrammingApiResponse,
  ProgrammingSnapshot,
} from "@/lib/programmingSnapshot";

interface GlobalProgrammingSyncProps {
  isAdminAuthorized: boolean;
}

type SyncStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "saving"
  | "saved"
  | "dirty"
  | "fallback"
  | "offline"
  | "error";

type SaveProgrammingResponse = {
  ok?: boolean;
  data?: {
    updatedAt?: string;
  };
  error?: string;
};

const AUTO_SAVE_DEBOUNCE_MS = 900;
const SAVED_MESSAGE_RESET_MS = 2500;
const REQUEST_TIMEOUT_MS = 15_000;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request timed out.";
  }

  return error instanceof Error ? error.message : fallback;
}

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: init.signal ?? controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function createStatusMessage(
  prefix: string,
  snapshot: ProgrammingSnapshot | null | undefined,
): string {
  if (!snapshot) {
    return prefix;
  }

  return `${prefix} / ${snapshot.media.length} media / ${snapshot.channels.length} channels`;
}

function createSnapshotSignature(snapshot: ProgrammingSnapshot): string {
  return JSON.stringify({
    ...snapshot,
    updatedAt: "",
  });
}

function getStatusTone(status: SyncStatus): {
  borderColor: string;
  color: string;
  dotColor: string;
} {
  if (status === "error") {
    return {
      borderColor: "rgba(248,113,113,0.5)",
      color: "#fca5a5",
      dotColor: "#f87171",
    };
  }

  if (status === "offline") {
    return {
      borderColor: "rgba(251,146,60,0.5)",
      color: "#fed7aa",
      dotColor: "#fb923c",
    };
  }

  if (status === "fallback" || status === "dirty" || status === "saving") {
    return {
      borderColor: "rgba(250,204,21,0.5)",
      color: "#fde68a",
      dotColor: "#facc15",
    };
  }

  if (status === "saved" || status === "loaded") {
    return {
      borderColor: "rgba(34,197,94,0.35)",
      color: "#bbf7d0",
      dotColor: "#22c55e",
    };
  }

  return {
    borderColor: "rgba(255,255,255,0.12)",
    color: "#d1d5db",
    dotColor: "#94a3b8",
  };
}

function formatLastSaved(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function GlobalProgrammingSync({
  isAdminAuthorized,
}: GlobalProgrammingSyncProps) {
  const replaceProgramming = useStore((state) => state.replaceProgramming);
  const exportProgrammingSnapshot = useStore(
    (state) => state.exportProgrammingSnapshot,
  );

  const [status, setStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState("Starting sync");

  const hasHydratedRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const lastSavedAtRef = useRef<string | null>(null);
  const lastSavedSignatureRef = useRef<string | null>(null);
  const lastQueuedSignatureRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const clearSaveTimer = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const saveProgramming = useCallback(
    async (reason: "auto" | "manual" = "auto") => {
      if (!isAdminAuthorized) {
        return;
      }

      if (!window.navigator.onLine) {
        setStatus("offline");
        setMessage("Offline / save paused");
        pendingSaveRef.current = true;
        return;
      }

      const snapshot = exportProgrammingSnapshot();
      const signature = createSnapshotSignature(snapshot);

      if (reason === "auto" && signature === lastSavedSignatureRef.current) {
        setStatus("loaded");
        setMessage("Global sync active");
        return;
      }

      if (isSavingRef.current) {
        pendingSaveRef.current = true;
        lastQueuedSignatureRef.current = signature;
        return;
      }

      try {
        isSavingRef.current = true;
        pendingSaveRef.current = false;
        lastQueuedSignatureRef.current = signature;

        clearResetTimer();

        setStatus("saving");
        setMessage(
          reason === "manual" ? "Saving now" : "Saving global programming",
        );

        const response = await fetchWithTimeout("/api/admin/programming", {
          method: "PUT",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(snapshot),
        });

        const data = await readJsonSafe<SaveProgrammingResponse>(response);

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || `Save failed with ${response.status}`);
        }

        if (!mountedRef.current) {
          return;
        }

        const savedAt = data.data?.updatedAt ?? new Date().toISOString();

        lastSavedAtRef.current = savedAt;
        lastSavedSignatureRef.current = signature;

        setStatus("saved");
        setMessage(createStatusMessage("Global saved", snapshot));

        resetTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current) {
            setStatus("loaded");
            setMessage("Global sync active");
          }
        }, SAVED_MESSAGE_RESET_MS);
      } catch (error) {
        console.error("Failed to save global programming:", error);

        if (mountedRef.current) {
          setStatus("error");
          setMessage(getErrorMessage(error, "Global save failed"));
        }
      } finally {
        isSavingRef.current = false;

        if (pendingSaveRef.current && mountedRef.current) {
          pendingSaveRef.current = false;
          void saveProgramming("auto");
        }
      }
    },
    [clearResetTimer, exportProgrammingSnapshot, isAdminAuthorized],
  );

  useEffect(() => {
    mountedRef.current = true;

    const abortController = new AbortController();

    const loadProgramming = async () => {
      setStatus("loading");
      setMessage("Loading global programming");

      try {
        const response = await fetchWithTimeout("/api/programming", {
          cache: "no-store",
          credentials: "same-origin",
          signal: abortController.signal,
        });

        const data = await readJsonSafe<ProgrammingApiResponse>(response);

        if (abortController.signal.aborted) {
          return;
        }

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || `Load failed with ${response.status}`);
        }

        if (data.programming) {
          skipNextSaveRef.current = true;

          replaceProgramming(data.programming);

          const signature = createSnapshotSignature(data.programming);

          hasHydratedRef.current = true;
          lastSavedAtRef.current = data.programming.updatedAt;
          lastSavedSignatureRef.current = signature;
          lastQueuedSignatureRef.current = signature;

          setStatus("loaded");
          setMessage(createStatusMessage("Global loaded", data.programming));
          return;
        }

        const localSnapshot = exportProgrammingSnapshot();

        hasHydratedRef.current = true;
        lastSavedSignatureRef.current = createSnapshotSignature(localSnapshot);
        lastQueuedSignatureRef.current = lastSavedSignatureRef.current;

        setStatus("fallback");
        setMessage("Using local/default programming");
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        console.error("Failed to load global programming:", error);

        hasHydratedRef.current = true;
        setStatus(window.navigator.onLine ? "error" : "offline");
        setMessage(
          window.navigator.onLine
            ? getErrorMessage(error, "Global load failed")
            : "Offline / using local programming",
        );
      }
    };

    void loadProgramming();

    return () => {
      abortController.abort();
      mountedRef.current = false;
    };
  }, [exportProgrammingSnapshot, replaceProgramming]);

  useEffect(() => {
    if (!isAdminAuthorized || !hasHydratedRef.current) {
      return;
    }

    const unsubscribe = useStore.subscribe(() => {
      if (skipNextSaveRef.current) {
        skipNextSaveRef.current = false;
        return;
      }

      const snapshot = exportProgrammingSnapshot();
      const signature = createSnapshotSignature(snapshot);

      if (
        signature === lastSavedSignatureRef.current ||
        signature === lastQueuedSignatureRef.current
      ) {
        return;
      }

      lastQueuedSignatureRef.current = signature;

      clearSaveTimer();
      clearResetTimer();

      setStatus("dirty");
      setMessage("Unsaved programming changes");

      saveTimerRef.current = window.setTimeout(() => {
        void saveProgramming("auto");
      }, AUTO_SAVE_DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      clearSaveTimer();
      clearResetTimer();
    };
  }, [
    clearResetTimer,
    clearSaveTimer,
    exportProgrammingSnapshot,
    isAdminAuthorized,
    saveProgramming,
  ]);

  useEffect(() => {
    const handleOnline = () => {
      if (pendingSaveRef.current && isAdminAuthorized) {
        void saveProgramming("auto");
        return;
      }

      if (mountedRef.current && status === "offline") {
        setStatus("loaded");
        setMessage("Global sync active");
      }
    };

    const handleOffline = () => {
      if (mountedRef.current) {
        setStatus("offline");
        setMessage("Offline / sync paused");
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isAdminAuthorized, saveProgramming, status]);

  useEffect(() => {
    return () => {
      clearSaveTimer();
      clearResetTimer();
    };
  }, [clearResetTimer, clearSaveTimer]);

  const isSaving = status === "saving";
  const tone = getStatusTone(status);
  const lastSavedLabel = formatLastSaved(lastSavedAtRef.current);

  return (
    <div
      className="fixed bottom-[max(5.75rem,calc(5.75rem+env(safe-area-inset-bottom)))] left-3 z-[9999] flex max-w-[calc(100vw-24px)] items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] shadow-2xl backdrop-blur-md md:bottom-3"
      style={{
        background: "rgba(0,0,0,0.76)",
        borderColor: tone.borderColor,
        color: tone.color,
      }}
      title={`${message}${
        lastSavedAtRef.current ? ` / Last saved ${lastSavedAtRef.current}` : ""
      }`}
      aria-live="polite"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{
          background: tone.dotColor,
          boxShadow: `0 0 12px ${tone.dotColor}`,
        }}
      />

      <span className="truncate">
        {message}
        {lastSavedLabel && status !== "saving" && status !== "dirty"
          ? ` / ${lastSavedLabel}`
          : ""}
      </span>

      {isAdminAuthorized ? (
        <button
          type="button"
          onClick={() => {
            clearSaveTimer();
            void saveProgramming("manual");
          }}
          disabled={isSaving}
          className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving" : "Save"}
        </button>
      ) : null}
    </div>
  );
}