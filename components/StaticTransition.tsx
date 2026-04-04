"use client";

import { useEffect, useState } from "react";

export default function StaticTransition({ trigger }: { trigger: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 250);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 animate-pulse bg-white/20 mix-blend-screen" />
  );
}