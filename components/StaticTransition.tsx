"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";

interface StaticTransitionProps {
  trigger: string;
  durationMs?: number;
}

const MIN_DURATION_MS = 90;
const MAX_DURATION_MS = 650;
const DEFAULT_DURATION_MS = 220;

function clampDuration(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_DURATION_MS;
  }

  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.floor(value)));
}

function createNoiseSeed(trigger: string): number {
  let hash = 0;

  for (let index = 0; index < trigger.length; index += 1) {
    hash = (hash * 31 + trigger.charCodeAt(index)) >>> 0;
  }

  return hash || 1;
}

export default function StaticTransition({
  trigger,
  durationMs = DEFAULT_DURATION_MS,
}: StaticTransitionProps) {
  const preferReducedMotion = useStore(
    (state) => state.viewerSettings.preferReducedMotion,
  );

  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);
  const lastTriggerRef = useRef("");

  const safeDuration = useMemo(() => clampDuration(durationMs), [durationMs]);
  const noiseSeed = useMemo(() => createNoiseSeed(trigger), [trigger]);

  useEffect(() => {
    if (!trigger || preferReducedMotion) {
      setVisible(false);
      return;
    }

    if (lastTriggerRef.current === trigger) {
      return;
    }

    lastTriggerRef.current = trigger;

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setVisible(true);

    timerRef.current = window.setTimeout(() => {
      setVisible(false);
      timerRef.current = null;
    }, safeDuration);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [trigger, preferReducedMotion, safeDuration]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-inherit"
      aria-hidden="true"
      style={{
        animation: `ttv-static-fade ${safeDuration}ms ease-out forwards`,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.34), transparent)",
          animation: `ttv-signal-sweep ${Math.max(
            150,
            safeDuration,
          )}ms ease-out forwards`,
          mixBlendMode: "screen",
          opacity: 0.38,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.36) 0 1px, rgba(0,0,0,0.26) 1px 2px, transparent 2px 5px)",
          mixBlendMode: "screen",
          opacity: 0.22,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle at 17% 23%, rgba(255,255,255,0.72) 0 1px, transparent 1px 5px), repeating-radial-gradient(circle at 71% 61%, rgba(255,255,255,0.44) 0 1px, transparent 1px 7px)",
          backgroundPosition: `${noiseSeed % 17}px ${
            noiseSeed % 23
          }px, ${noiseSeed % 29}px ${noiseSeed % 31}px`,
          backgroundSize: "9px 9px, 14px 14px",
          mixBlendMode: "screen",
          opacity: 0.18,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(239,68,68,0.22), transparent 34%, rgba(34,211,238,0.22))",
          filter: "blur(1px)",
          mixBlendMode: "screen",
          opacity: 0.18,
          transform: "translateX(1px)",
        }}
      />

      <div
        className="absolute inset-x-0 top-1/2 h-16 -translate-y-1/2"
        style={{
          background:
            "linear-gradient(180deg, transparent, rgba(255,255,255,0.32), transparent)",
          filter: "blur(10px)",
          mixBlendMode: "screen",
          opacity: 0.2,
        }}
      />
    </div>
  );
}