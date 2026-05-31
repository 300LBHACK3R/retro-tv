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
  | "error";

const AUTO_SAVE_DEBOUNCE_MS = 900;
const SAVED_MESSAGE_RESET_MS = 2500;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function createStatusMessage(
  prefix: string,
  snapshot: ProgrammingSnapshot | null | undefined,
): string {
  if (!snapshot) {
    return prefix;
  }

  return `${prefix} • ${snapshot.media.length} media • ${snapshot.channels.length} channels`;
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

      if (isSavingRef.current) {
        pendingSaveRef.current = true;
        return;
      }

      try {
        isSavingRef.current = true;
        pendingSaveRef.current = false;

        clearResetTimer();

        setStatus("saving");
        setMessage(reason === "manual" ? "Saving now" : "Saving global programming");

        const snapshot = exportProgrammingSnapshot();

        const response = await fetch("/api/admin/programming", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(snapshot),
        });

        const data = (await response.json().catch(() => null)) as
          | { ok?: boolean; error?: string }
          | null;

        if (!response.ok || !data?.ok) {
          throw new Error(data?.error || `Save failed with ${response.status}`);
        }

        if (!mountedRef.current) {
          return;
        }

        lastSavedAtRef.current = new Date().toISOString();
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
    let cancelled = false;

    const loadProgramming = async () => {
      setStatus("loading");
      setMessage("Loading global programming");

      try {
        const response = await fetch("/api/programming", {
          cache: "no-store",
        });

        const data = (await response.json()) as ProgrammingApiResponse;

        if (cancelled) return;

        if (!response.ok || !data.ok) {
          throw new Error(data.error || `Load failed with ${response.status}`);
        }

        if (data.programming) {
          /**
           * This flag prevents the local replaceProgramming() hydration event
           * from immediately saving the same data back to Supabase.
           */
          skipNextSaveRef.current = true;
          replaceProgramming(data.programming);
          hasHydratedRef.current = true;
          lastSavedAtRef.current = data.programming.updatedAt;

          setStatus("loaded");
          setMessage(createStatusMessage("Global loaded", data.programming));
          return;
        }

        hasHydratedRef.current = true;
        setStatus("fallback");
        setMessage("Using local/default programming");
      } catch (error) {
        console.error("Failed to load global programming:", error);

        if (!cancelled) {
          hasHydratedRef.current = true;
          setStatus("error");
          setMessage(getErrorMessage(error, "Global load failed"));
        }
      }
    };

    void loadProgramming();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [replaceProgramming]);

  useEffect(() => {
    if (!isAdminAuthorized || !hasHydratedRef.current) {
      return;
    }

    const unsubscribe = useStore.subscribe(() => {
      if (skipNextSaveRef.current) {
        skipNextSaveRef.current = false;
        return;
      }

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
    isAdminAuthorized,
    saveProgramming,
  ]);

  useEffect(() => {
    return () => {
      clearSaveTimer();
      clearResetTimer();
    };
  }, [clearResetTimer, clearSaveTimer]);

  const isError = status === "error";
  const isSaving = status === "saving";
  const isDirty = status === "dirty";
  const isFallback = status === "fallback";

  return (
    <div
      className="fixed bottom-3 left-3 z-[9999] flex max-w-[calc(100vw-24px)] items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] shadow-2xl backdrop-blur-md"
      style={{
        background: "rgba(0,0,0,0.76)",
        borderColor: isError
          ? "rgba(248,113,113,0.5)"
          : isFallback || isDirty || isSaving
            ? "rgba(250,204,21,0.5)"
            : "rgba(255,255,255,0.12)",
        color: isError
          ? "#fca5a5"
          : isFallback || isDirty || isSaving
            ? "#fde68a"
            : "#d1d5db",
      }}
      title={`${message}${
        lastSavedAtRef.current ? ` • Last saved ${lastSavedAtRef.current}` : ""
      }`}
      aria-live="polite"
    >
      <span className="truncate">{message}</span>

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
          {isSaving ? "Saving" : "Save Now"}
        </button>
      ) : null}
    </div>
  );
}