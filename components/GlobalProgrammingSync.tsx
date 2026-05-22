"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { ProgrammingApiResponse } from "@/lib/programmingSnapshot";

interface GlobalProgrammingSyncProps {
  isAdminAuthorized: boolean;
}

export default function GlobalProgrammingSync({
  isAdminAuthorized,
}: GlobalProgrammingSyncProps) {
  const replaceProgramming = useStore((state) => state.replaceProgramming);
  const exportProgrammingSnapshot = useStore(
    (state) => state.exportProgrammingSnapshot,
  );

  const [status, setStatus] = useState<
    "idle" | "loading" | "synced" | "saving" | "error"
  >("idle");

  const hasHydratedRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProgramming = async () => {
      setStatus("loading");

      try {
        const response = await fetch("/api/programming", {
          cache: "no-store",
        });

        const data = (await response.json()) as ProgrammingApiResponse;

        if (cancelled) return;

        if (response.ok && data.programming) {
          skipNextSaveRef.current = true;
          replaceProgramming(data.programming);
        }

        hasHydratedRef.current = true;
        setStatus("synced");
      } catch (error) {
        console.error("Failed to load global programming:", error);

        if (!cancelled) {
          hasHydratedRef.current = true;
          setStatus("error");
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

      saveTimerRef.current = window.setTimeout(async () => {
        try {
          setStatus("saving");

          const snapshot = exportProgrammingSnapshot();

          const response = await fetch("/api/admin/programming", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(snapshot),
          });

          if (!response.ok) {
            throw new Error("Failed to save programming.");
          }

          setStatus("synced");
        } catch (error) {
          console.error("Failed to save global programming:", error);
          setStatus("error");
        }
      }, 900);
    });

    return () => {
      unsubscribe();

      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [exportProgrammingSnapshot, isAdminAuthorized]);

  return (
    <div
      className="fixed bottom-3 left-3 z-[9999] rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] shadow-2xl backdrop-blur-md"
      style={{
        background: "rgba(0,0,0,0.68)",
        borderColor:
          status === "error"
            ? "rgba(248,113,113,0.45)"
            : "rgba(255,255,255,0.12)",
        color:
          status === "error"
            ? "#fca5a5"
            : status === "saving"
              ? "#fde68a"
              : "#d1d5db",
      }}
      aria-live="polite"
    >
      {status === "loading"
        ? "Loading Global"
        : status === "saving"
          ? "Saving Global"
          : status === "error"
            ? "Sync Error"
            : "Global Synced"}
    </div>
  );
}