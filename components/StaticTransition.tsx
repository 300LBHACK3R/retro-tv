"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";

interface StaticTransitionProps {
  trigger: string;
  durationMs?: number;
}

const MIN_TRANSITION_MS = 80;
const DEFAULT_TRANSITION_MS = 180;

function getSafeDuration(durationMs: number): number {
  const duration = Math.floor(Number(durationMs));

  if (!Number.isFinite(duration)) {
    return DEFAULT_TRANSITION_MS;
  }

  return Math.max(MIN_TRANSITION_MS, duration);
}

export default function StaticTransition({
  trigger,
  durationMs = DEFAULT_TRANSITION_MS,
}: StaticTransitionProps) {
  const preferReducedMotion = useStore(
    (state) => state.viewerSettings.preferReducedMotion,
  );

  const [visible, setVisible] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const timerRef = useRef<number | null>(null);

  const safeDurationMs = useMemo(
    () => getSafeDuration(durationMs),
    [durationMs],
  );

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!trigger || preferReducedMotion) {
      setVisible(false);
      return;
    }

    setVisible(true);
    setPulseKey((current) => current + 1);

    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
    }, safeDurationMs);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [preferReducedMotion, safeDurationMs, trigger]);

  if (!visible) {
    return null;
  }

  return (
    <div
      key={pulseKey}
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-[inherit]"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 opacity-25"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)",
          animation: `ttv-signal-sweep ${safeDurationMs}ms ease-out forwards`,
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