"use client";

import { useEffect, useState } from "react";

interface StaticTransitionProps {
  trigger: string;
  durationMs?: number;
}

export default function StaticTransition({
  trigger,
  durationMs = 260,
}: StaticTransitionProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger) {
      return;
    }

    setVisible(true);

    const timer = window.setTimeout(() => {
      setVisible(false);
    }, durationMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [trigger, durationMs]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-inherit"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-white/20 mix-blend-screen motion-safe:animate-pulse" />

      <div
        className="absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            "repeating-radial-gradient(circle at 20% 30%, rgba(255,255,255,0.95) 0 1px, transparent 1px 3px), repeating-radial-gradient(circle at 80% 70%, rgba(0,0,0,0.75) 0 1px, transparent 1px 4px)",
          backgroundSize: "7px 7px, 11px 11px",
          mixBlendMode: "screen",
        }}
      />

      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.35) 0 1px, rgba(0,0,0,0.15) 1px 3px, transparent 3px 5px)",
        }}
      />

      <div
        className="absolute inset-0 opacity-35"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
          transform: "translateX(-20%)",
        }}
      />
    </div>
  );
}