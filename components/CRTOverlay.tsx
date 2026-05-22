"use client";

interface CRTOverlayProps {
  intensity?: "subtle" | "medium" | "strong";
}

const intensityMap = {
  subtle: {
    scanlineOpacity: 0.16,
    vignetteOpacity: 0.5,
    glareOpacity: 0.08,
    noiseOpacity: 0.06,
  },
  medium: {
    scanlineOpacity: 0.24,
    vignetteOpacity: 0.62,
    glareOpacity: 0.12,
    noiseOpacity: 0.08,
  },
  strong: {
    scanlineOpacity: 0.34,
    vignetteOpacity: 0.72,
    glareOpacity: 0.16,
    noiseOpacity: 0.11,
  },
} as const;

export default function CRTOverlay({ intensity = "medium" }: CRTOverlayProps) {
  const settings = intensityMap[intensity];

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30 hidden overflow-hidden rounded-2xl md:block"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          opacity: settings.scanlineOpacity,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.12) 50%, rgba(0,0,0,0.18) 50%)",
          backgroundSize: "100% 4px",
          mixBlendMode: "soft-light",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          opacity: settings.noiseOpacity,
          backgroundImage:
            "repeating-radial-gradient(circle at 12% 18%, rgba(255,255,255,0.8) 0 1px, transparent 1px 3px), repeating-radial-gradient(circle at 78% 62%, rgba(0,0,0,0.8) 0 1px, transparent 1px 4px)",
          backgroundSize: "9px 9px, 13px 13px",
          mixBlendMode: "screen",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          opacity: settings.glareOpacity,
          background:
            "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.18) 28%, transparent 46%, transparent 100%)",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          boxShadow:
            "inset 0 0 28px rgba(255,255,255,0.05), inset 0 0 90px rgba(0,0,0,0.72)",
          opacity: settings.vignetteOpacity,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, transparent 52%, rgba(0,0,0,0.4) 100%)",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          boxShadow:
            "inset 1px 0 rgba(255,0,0,0.12), inset -1px 0 rgba(0,180,255,0.12)",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}