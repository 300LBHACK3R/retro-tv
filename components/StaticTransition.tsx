"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";

interface StaticTransitionProps {
  trigger: string;
  durationMs?: number;
}

export default function StaticTransition({
  trigger,
  durationMs = 180,
}: StaticTransitionProps) {
  const preferReducedMotion = useStore(
    (state) => state.viewerSettings.preferReducedMotion,
  );

  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!trigger || preferReducedMotion) {
      return;
    }

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    setVisible(true);

    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
    }, Math.max(80, durationMs));

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [trigger, durationMs, preferReducedMotion]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-inherit"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 opacity-25"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)",
          animation: "ttv-signal-sweep 180ms ease-out forwards",
          mixBlendMode: "screen",
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.34) 0 1px, rgba(0,0,0,0.16) 1px 2px, transparent 2px 5px)",
          mixBlendMode: "screen",
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 40%, rgba(255,255,255,0.75), transparent 1px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.45), transparent 1px)",
          backgroundSize: "8px 8px, 13px 13px",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}