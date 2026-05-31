"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import type { AppMode } from "@/lib/types";

interface AppModeToggleProps {
  isAdminAuthorized: boolean;
}

const MODE_OPTIONS: Array<{
  value: AppMode;
  label: string;
  badge: string;
  description: string;
}> = [
  {
    value: "viewer",
    label: "Viewer",
    badge: "Public",
    description: "Clean watching experience for regular visitors.",
  },
  {
    value: "admin",
    label: "Admin",
    badge: "Protected",
    description: "Programming, media, branding, sync, and station tools.",
  },
];

function getModeLabel(mode: AppMode): string {
  return mode === "admin" ? "Admin Mode" : "Viewer Mode";
}

export default function AppModeToggle({ isAdminAuthorized }: AppModeToggleProps) {
  const appMode = useStore((state) => state.appMode);
  const setAppMode = useStore((state) => state.setAppMode);

  useEffect(() => {
    if (appMode === "admin" && !isAdminAuthorized) {
      setAppMode("viewer");
    }
  }, [appMode, isAdminAuthorized, setAppMode]);

  const handleModeChange = (mode: AppMode) => {
    if (mode === "admin" && !isAdminAuthorized) {
      return;
    }

    setAppMode(mode);
  };

  return (
    <section
      className="relative overflow-hidden rounded-2xl border p-3 shadow-2xl shadow-black/20 sm:p-4"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.035), transparent 44%), var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      aria-label="Application mode selector"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full opacity-20 blur-3xl"
        style={{ background: isAdminAuthorized ? "#22c55e" : "var(--primary)" }}
        aria-hidden="true"
      />

      <div className="relative mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div
            className="text-xs font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--primary)" }}
          >
            Current Mode
          </div>

          <div className="mt-1 text-base font-black tracking-tight">
            {getModeLabel(appMode)}
          </div>

          <div className="mt-1 max-w-2xl text-xs leading-5" style={{ color: "var(--text-muted)" }}>
            {isAdminAuthorized
              ? "Admin mode is unlocked for this session. Viewer mode remains the public-facing default."
              : "Admin tools are locked. Authenticate first before switching into station management."}
          </div>
        </div>

        <div
          className="rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
          style={{
            borderColor: isAdminAuthorized
              ? "rgba(34, 197, 94, 0.42)"
              : "var(--border)",
            background: isAdminAuthorized
              ? "rgba(34, 197, 94, 0.12)"
              : "var(--panel-alt-bg)",
            color: isAdminAuthorized ? "#86efac" : "var(--text-muted)",
          }}
        >
          {isAdminAuthorized ? "Authorized" : "Locked"}
        </div>
      </div>

      <div className="relative grid gap-2 sm:grid-cols-2">
        {MODE_OPTIONS.map((option) => {
          const isActive = appMode === option.value;
          const isLocked = option.value === "admin" && !isAdminAuthorized;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleModeChange(option.value)}
              disabled={isLocked}
              className="rounded-2xl border p-3 text-left transition hover:scale-[1.01] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
              style={{
                background: isActive
                  ? "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))"
                  : "var(--panel-alt-bg)",
                borderColor: isActive ? "var(--primary)" : "var(--border)",
                color: "var(--text)",
              }}
              aria-pressed={isActive}
              aria-disabled={isLocked}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black">{option.label}</div>

                  <div
                    className="mt-1 text-xs leading-5"
                    style={{ color: isActive ? "inherit" : "var(--text-muted)" }}
                  >
                    {option.description}
                  </div>
                </div>

                <div
                  className="shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]"
                  style={{
                    borderColor: isActive
                      ? "rgba(255,255,255,0.28)"
                      : "var(--border)",
                    color: isActive ? "var(--text)" : "var(--text-muted)",
                  }}
                >
                  {isActive ? "Active" : isLocked ? "Locked" : option.badge}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {!isAdminAuthorized ? (
        <div
          className="relative mt-3 rounded-xl border px-3 py-2 text-xs leading-5"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text-muted)",
          }}
        >
          Admin access should stay behind your hidden/settings authentication flow.
          Do not expose admin tools directly on the public viewer page.
        </div>
      ) : null}
    </section>
  );
}