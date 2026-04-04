"use client";

export default function CRTOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <div className="absolute inset-0 opacity-[0.08] [background:repeating-linear-gradient(to_bottom,rgba(255,255,255,0.14)_0px,rgba(255,255,255,0.14)_1px,transparent_2px,transparent_4px)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_55%,rgba(0,0,0,0.2)_100%)]" />
    </div>
  );
}