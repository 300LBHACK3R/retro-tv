"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { ProgrammingApiResponse } from "@/lib/programmingSnapshot";

interface GlobalProgrammingSyncProps {
  isAdminAuthorized: boolean;
}

type SyncStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "saving"
  | "saved"
  | "fallback"
  | "error";

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

  const saveProgramming = async () => {
    try {
      setStatus("saving");
      setMessage("Saving global programming");

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

      setStatus("saved");
      setMessage(`Global saved • ${snapshot.media.length} media`);
    } catch (error) {
      console.error("Failed to save global programming:", error);
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Global save failed");
    }
  };

  useEffect(() => {
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
          skipNextSaveRef.current = true;
          replaceProgramming(data.programming);
          hasHydratedRef.current = true;
          setStatus("loaded");
          setMessage(`Global loaded • ${data.programming.media.length} media`);
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
          setMessage(
            error instanceof Error ? error.message : "Global load failed",
          );
        }
      }
    };

    void loadProgramming();

    return () => {
      cancelled = true;
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

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = window.setTimeout(() => {
        void saveProgramming();
      }, 350);
    });

    return () => {
      unsubscribe();

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [exportProgrammingSnapshot, isAdminAuthorized]);

  const isError = status === "error";
  const isSaving = status === "saving";
  const isFallback = status === "fallback";

  return (
    <div
      className="fixed bottom-3 left-3 z-[9999] flex max-w-[calc(100vw-24px)] items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] shadow-2xl backdrop-blur-md"
      style={{
        background: "rgba(0,0,0,0.72)",
        borderColor: isError
          ? "rgba(248,113,113,0.45)"
          : isFallback
            ? "rgba(250,204,21,0.45)"
            : "rgba(255,255,255,0.12)",
        color: isError
          ? "#fca5a5"
          : isSaving
            ? "#fde68a"
            : isFallback
              ? "#fde68a"
              : "#d1d5db",
      }}
      title={message}
      aria-live="polite"
    >
      <span>{message}</span>

      {isAdminAuthorized ? (
        <button
          type="button"
          onClick={() => void saveProgramming()}
          className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] transition hover:bg-white/10"
        >
          Save Now
        </button>
      ) : null}
    </div>
  );
}