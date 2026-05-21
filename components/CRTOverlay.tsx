"use client";

export default function CRTOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 hidden overflow-hidden rounded-2xl md:block">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_50%,rgba(0,0,0,0.06)_50%)] bg-[length:100%_4px] opacity-25" />
      <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.65)]" />
    </div>
  );
}