"use client";

import { useStore } from "@/lib/store";
import type { AppMode } from "@/lib/types";

interface AppModeToggleProps {
  isAdminAuthorized: boolean;
}

const MODE_OPTIONS: Array<{
  value: AppMode;
  label: string;
  description: string;
}> = [
  {
    value: "viewer",
    label: "Viewer",
    description: "Public watching experience.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Programming, media, branding, and config tools.",
  },
];

export default function AppModeToggle({ isAdminAuthorized }: AppModeToggleProps) {
  const appMode = useStore((state) => state.appMode);
  const setAppMode = useStore((state) => state.setAppMode);

  const handleModeChange = (mode: AppMode) => {
    if (mode === "admin" && !isAdminAuthorized) {
      return;
    }

    setAppMode(mode);
  };

  return (
    <section
      className="rounded-2xl border p-4 shadow-2xl shadow-black/20"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      aria-label="Application mode selector"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div
            className="text-xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--text-muted)" }}
          >
            Current Mode
          </div>

          <div className="mt-1 text-sm font-semibold">
            {appMode === "viewer" ? "Viewer Mode" : "Admin Mode"}
          </div>

          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {isAdminAuthorized
              ? "Admin mode is available for this session."
              : "Admin tools remain locked until authorized."}
          </div>
        </div>

        <div
          className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{
            borderColor: isAdminAuthorized
              ? "rgba(34, 197, 94, 0.35)"
              : "var(--border)",
            background: isAdminAuthorized
              ? "rgba(34, 197, 94, 0.10)"
              : "var(--panel-alt-bg)",
            color: isAdminAuthorized ? "#86efac" : "var(--text-muted)",
          }}
        >
          {isAdminAuthorized ? "Authorized" : "Locked"}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {MODE_OPTIONS.map((option) => {
          const isActive = appMode === option.value;
          const isLocked = option.value === "admin" && !isAdminAuthorized;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleModeChange(option.value)}
              disabled={isLocked}
              className="rounded-xl border p-3 text-left transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55"
              style={{
                background: isActive ? "var(--primary)" : "var(--panel-alt-bg)",
                borderColor: isActive ? "var(--primary)" : "var(--border)",
                color: isActive ? "var(--text)" : "var(--text)",
              }}
              aria-pressed={isActive}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{option.label}</div>

                {isActive ? (
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
                    Active
                  </span>
                ) : isLocked ? (
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Locked
                  </span>
                ) : null}
              </div>

              <div
                className="mt-1 text-xs leading-relaxed"
                style={{ color: isActive ? "inherit" : "var(--text-muted)" }}
              >
                {option.description}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}