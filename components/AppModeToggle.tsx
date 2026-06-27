"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useStore } from "@/lib/store";
import type { AppMode } from "@/lib/types";

interface AppModeToggleProps {
  isAdminAuthorized: boolean;
}

type ModeOption = {
  value: AppMode;
  label: string;
  badge: string;
  description: string;
};

type BadgeTone = "authorized" | "locked";

const MODE_OPTIONS: ModeOption[] = [
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

function getAuthorizationCopy(isAdminAuthorized: boolean): string {
  if (isAdminAuthorized) {
    return "Admin mode is unlocked for this session. Viewer mode remains the public-facing default.";
  }

  return "Admin tools are locked. Authenticate first before switching into station management.";
}

function getBadgeStyles(tone: BadgeTone): CSSProperties {
  if (tone === "authorized") {
    return {
      borderColor: "rgba(34, 197, 94, 0.42)",
      background: "rgba(34, 197, 94, 0.12)",
      color: "#86efac",
    };
  }

  return {
    borderColor: "var(--border)",
    background: "var(--panel-alt-bg)",
    color: "var(--text-muted)",
  };
}

function getModeCardStyles({
  isActive,
}: {
  isActive: boolean;
}): CSSProperties {
  return {
    background: isActive
      ? "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))"
      : "var(--panel-alt-bg)",
    borderColor: isActive ? "var(--primary)" : "var(--border)",
    color: "var(--text)",
    boxShadow: isActive
      ? "0 0 28px color-mix(in srgb, var(--primary) 22%, transparent)"
      : "none",
  };
}

function getModePillStyles({
  isActive,
}: {
  isActive: boolean;
}): CSSProperties {
  return {
    borderColor: isActive ? "rgba(255,255,255,0.28)" : "var(--border)",
    background: isActive ? "rgba(255,255,255,0.10)" : "transparent",
    color: isActive ? "var(--text)" : "var(--text-muted)",
  };
}

function ModeCard({
  option,
  isActive,
  isLocked,
  onSelect,
}: {
  option: ModeOption;
  isActive: boolean;
  isLocked: boolean;
  onSelect: () => void;
}) {
  const stateLabel = isActive ? "Active" : isLocked ? "Locked" : option.badge;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isLocked}
      className={[
        "ttv-touch-target group relative overflow-hidden rounded-2xl border p-3 text-left transition",
        "hover:scale-[1.01] hover:opacity-95",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        "disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100",
      ].join(" ")}
      style={getModeCardStyles({ isActive })}
      aria-pressed={isActive}
      aria-label={`${option.label} mode${isLocked ? " locked" : ""}`}
      title={isLocked ? "Authenticate first to unlock admin mode." : option.description}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-12 h-24 w-24 rounded-full opacity-0 blur-2xl transition group-hover:opacity-20"
        style={{ background: "var(--primary)" }}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-black tracking-tight">
            {option.label}
          </div>

          <div
            className="mt-1 text-xs leading-5"
            style={{ color: isActive ? "inherit" : "var(--text-muted)" }}
          >
            {option.description}
          </div>
        </div>

        <div
          className="shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]"
          style={getModePillStyles({ isActive })}
        >
          {stateLabel}
        </div>
      </div>
    </button>
  );
}

export default function AppModeToggle({ isAdminAuthorized }: AppModeToggleProps) {
  const appMode = useStore((state) => state.appMode);
  const setAppMode = useStore((state) => state.setAppMode);

  const [mounted, setMounted] = useState(false);

  const safeAppMode: AppMode =
    mounted && isAdminAuthorized && appMode === "admin" ? "admin" : "viewer";

  const activeModeLabel = useMemo(
    () => getModeLabel(safeAppMode),
    [safeAppMode],
  );

  const authorizationCopy = useMemo(
    () => getAuthorizationCopy(isAdminAuthorized),
    [isAdminAuthorized],
  );

  const badgeTone: BadgeTone = isAdminAuthorized ? "authorized" : "locked";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (!isAdminAuthorized && appMode === "admin") {
      setAppMode("viewer");
    }
  }, [appMode, isAdminAuthorized, mounted, setAppMode]);

  const handleModeChange = useCallback(
    (mode: AppMode) => {
      if (mode === safeAppMode) {
        return;
      }

      if (mode === "admin" && !isAdminAuthorized) {
        return;
      }

      setAppMode(mode);
    },
    [isAdminAuthorized, safeAppMode, setAppMode],
  );

  if (!mounted) {
    return null;
  }

  return (
    <section
      className="ttv-glass-panel-strong relative overflow-hidden rounded-2xl p-3 shadow-2xl shadow-black/20 sm:p-4"
      style={{ color: "var(--text)" }}
      aria-label="Application mode selector"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full opacity-20 blur-3xl"
        style={{ background: isAdminAuthorized ? "#22c55e" : "var(--primary)" }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--primary), transparent)",
        }}
        aria-hidden="true"
      />

      <div className="relative mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div
            className="text-xs font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--primary)" }}
          >
            Current Mode
          </div>

          <div className="mt-1 text-base font-black tracking-tight">
            {activeModeLabel}
          </div>

          <div
            className="mt-1 max-w-2xl text-xs leading-5"
            style={{ color: "var(--text-muted)" }}
          >
            {authorizationCopy}
          </div>
        </div>

        <div
          className="w-fit rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
          style={getBadgeStyles(badgeTone)}
        >
          {isAdminAuthorized ? "Authorized" : "Locked"}
        </div>
      </div>

      <div className="relative grid gap-2 sm:grid-cols-2">
        {MODE_OPTIONS.map((option) => {
          const isActive = safeAppMode === option.value;
          const isLocked = option.value === "admin" && !isAdminAuthorized;

          return (
            <ModeCard
              key={option.value}
              option={option}
              isActive={isActive}
              isLocked={isLocked}
              onSelect={() => handleModeChange(option.value)}
            />
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
          Admin access stays behind the protected authentication flow. Public
          viewers remain locked to the polished watching experience.
        </div>
      ) : null}
    </section>
  );
}