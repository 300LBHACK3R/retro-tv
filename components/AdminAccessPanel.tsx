"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { AppMode } from "@/lib/types";

interface AdminAccessPanelProps {
  onAuthChange?: (authorized: boolean) => void;
}

type AdminSessionResponse = {
  ok?: boolean;
  isAdmin?: boolean;
  error?: string;
};

type AdminLoginResponse = {
  ok?: boolean;
  error?: string;
};

type AdminLogoutResponse = {
  ok?: boolean;
  error?: string;
};

type AccessStatus = "checking" | "locked" | "authorized" | "error";

const MAX_PASSWORD_LENGTH = 128;

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getStatusCopy(status: AccessStatus, isAdminAuthorized: boolean): string {
  if (status === "checking") return "Checking secure session...";
  if (status === "error") return "Session check failed.";
  if (isAdminAuthorized) {
    return "Secure controls are available for this browser session.";
  }

  return "Viewer mode is public. Admin tools unlock after password entry.";
}

function getBadgeCopy(status: AccessStatus, isAdminAuthorized: boolean): string {
  if (status === "checking") return "Checking";
  if (status === "error") return "Offline";
  if (isAdminAuthorized) return "Unlocked";
  return "Viewer Only";
}

function getBadgeStyles(status: AccessStatus, isAdminAuthorized: boolean) {
  if (status === "checking") {
    return {
      borderColor: "rgba(56, 189, 248, 0.35)",
      background: "rgba(56, 189, 248, 0.10)",
      color: "#bae6fd",
    };
  }

  if (status === "error") {
    return {
      borderColor: "rgba(248, 113, 113, 0.35)",
      background: "rgba(248, 113, 113, 0.10)",
      color: "#fecaca",
    };
  }

  if (isAdminAuthorized) {
    return {
      borderColor: "rgba(34, 197, 94, 0.35)",
      background: "rgba(34, 197, 94, 0.12)",
      color: "#86efac",
    };
  }

  return {
    borderColor: "var(--border)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--text-muted)",
  };
}

function isAuthorizedResponse(response: Response, data: AdminSessionResponse | null): boolean {
  return Boolean(response.ok && data?.isAdmin);
}

function StatusBadge({
  status,
  isAdminAuthorized,
}: {
  status: AccessStatus;
  isAdminAuthorized: boolean;
}) {
  return (
    <div
      className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
      style={getBadgeStyles(status, isAdminAuthorized)}
    >
      {getBadgeCopy(status, isAdminAuthorized)}
    </div>
  );
}

function AccessShell({
  children,
  status,
  isAdminAuthorized,
  label = "Admin Access",
}: {
  children: React.ReactNode;
  status: AccessStatus;
  isAdminAuthorized: boolean;
  label?: string;
}) {
  return (
    <section
      className="ttv-glass-panel-strong relative overflow-hidden rounded-2xl p-4 shadow-2xl shadow-black/30"
      aria-label={label}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--primary), transparent)",
        }}
      />

      <div className="pointer-events-none absolute -right-20 -top-24 h-48 w-48 rounded-full bg-[var(--primary)]/10 blur-3xl" />

      <div className="relative z-10">
        {children}
      </div>
    </section>
  );
}

function ModeButton({
  mode,
  currentMode,
  disabled,
  onClick,
}: {
  mode: AppMode;
  currentMode: AppMode;
  disabled?: boolean;
  onClick: () => void;
}) {
  const active = currentMode === mode;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="ttv-touch-target rounded-xl px-3 py-3 text-sm font-black uppercase tracking-[0.1em] transition hover:scale-[1.02] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-55"
      style={{
        background: active
          ? "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 56%, transparent))"
          : "var(--button-bg)",
        color: "var(--text)",
        boxShadow: active ? "0 0 22px color-mix(in srgb, var(--primary) 24%, transparent)" : "none",
      }}
      aria-pressed={active}
    >
      {mode === "admin" ? "Admin" : "Viewer"}
    </button>
  );
}

export default function AdminAccessPanel({
  onAuthChange,
}: AdminAccessPanelProps) {
  const appMode = useStore((state) => state.appMode);
  const setAppMode = useStore((state) => state.setAppMode);

  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<AccessStatus>("checking");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("Checking secure session...");
  const [error, setError] = useState("");

  const cleanPassword = useMemo(() => password.trim(), [password]);

  const syncAuthorizedState = useCallback(
    (authorized: boolean) => {
      setIsAdminAuthorized(authorized);
      onAuthChange?.(authorized);

      if (!authorized) {
        setAppMode("viewer");
      }

      setStatus(authorized ? "authorized" : "locked");
      setMessage(
        authorized
          ? "Authorized session active."
          : "Admin tools are locked.",
      );
    },
    [onAuthChange, setAppMode],
  );

  const checkSession = useCallback(async () => {
    setStatus("checking");
    setMessage("Checking secure session...");
    setError("");

    try {
      const response = await fetch("/api/admin/session", {
        cache: "no-store",
        credentials: "same-origin",
      });

      const data = await readJsonSafe<AdminSessionResponse>(response);
      const authorized = isAuthorizedResponse(response, data);

      syncAuthorizedState(authorized);

      if (!authorized && data?.error) {
        setMessage(data.error);
      }
    } catch (error) {
      syncAuthorizedState(false);
      setStatus("error");
      setError(getErrorMessage(error, "Unable to verify admin session."));
      setMessage("Unable to verify admin session.");
    }
  }, [syncAuthorizedState]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      await checkSession();

      if (!mounted) {
        return;
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [checkSession]);

  useEffect(() => {
    if (!isAdminAuthorized && appMode === "admin") {
      setAppMode("viewer");
    }
  }, [appMode, isAdminAuthorized, setAppMode]);

  const login = async () => {
    if (!cleanPassword || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setMessage("Unlocking admin session...");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: cleanPassword }),
      });

      const data = await readJsonSafe<AdminLoginResponse>(response);

      if (!response.ok || !data?.ok) {
        syncAuthorizedState(false);
        setError(data?.error ?? "Login failed. Check the admin password.");
        setMessage("Admin unlock failed.");
        return;
      }

      setPassword("");
      syncAuthorizedState(true);
      setAppMode("admin");
      setMessage("Admin unlocked.");
    } catch (error) {
      syncAuthorizedState(false);
      setError(
        getErrorMessage(
          error,
          "Unable to log in. Check the connection and try again.",
        ),
      );
      setMessage("Unable to unlock admin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setMessage("Signing out...");

    try {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
      });

      const data = await readJsonSafe<AdminLogoutResponse>(response);

      if (!response.ok || data?.ok === false) {
        setError(data?.error ?? "Logout endpoint returned an error.");
      }
    } catch {
      setError("Unable to contact logout endpoint. Local session was still cleared.");
    } finally {
      setPassword("");
      syncAuthorizedState(false);
      setMessage("Signed out. Viewer mode restored.");
      setIsSubmitting(false);
    }
  };

  const switchMode = (mode: AppMode) => {
    if (mode === "admin" && !isAdminAuthorized) {
      setMessage("Admin mode is locked.");
      return;
    }

    setAppMode(mode);
    setMessage(mode === "admin" ? "Admin mode active." : "Viewer mode active.");
  };

  const isCheckingSession = status === "checking";

  if (isCheckingSession) {
    return (
      <AccessShell status={status} isAdminAuthorized={isAdminAuthorized}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className="text-[11px] font-black uppercase tracking-[0.22em]"
              style={{ color: "var(--primary)" }}
            >
              Admin Access
            </div>

            <div className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              {getStatusCopy(status, isAdminAuthorized)}
            </div>
          </div>

          <StatusBadge status={status} isAdminAuthorized={isAdminAuthorized} />
        </div>
      </AccessShell>
    );
  }

  if (isAdminAuthorized) {
    return (
      <AccessShell
        status={status}
        isAdminAuthorized={isAdminAuthorized}
        label="Authorized admin access panel"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div
              className="text-[11px] font-black uppercase tracking-[0.22em]"
              style={{ color: "var(--primary)" }}
            >
              Admin Access
            </div>

            <div className="mt-1 text-base font-black tracking-tight">
              Authorized Session
            </div>

            <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
              {message || getStatusCopy(status, isAdminAuthorized)}
            </div>
          </div>

          <StatusBadge status={status} isAdminAuthorized={isAdminAuthorized} />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <ModeButton
            mode="viewer"
            currentMode={appMode}
            onClick={() => switchMode("viewer")}
          />

          <ModeButton
            mode="admin"
            currentMode={appMode}
            onClick={() => switchMode("admin")}
          />

          <button
            type="button"
            onClick={logout}
            disabled={isSubmitting}
            className="ttv-action-button ttv-touch-target rounded-xl px-3 py-3 text-sm font-black uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing Out" : "Sign Out"}
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200">
            {error}
          </div>
        ) : null}
      </AccessShell>
    );
  }

  return (
    <AccessShell
      status={status}
      isAdminAuthorized={isAdminAuthorized}
      label="Locked admin access panel"
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div
            className="text-[11px] font-black uppercase tracking-[0.22em]"
            style={{ color: "var(--primary)" }}
          >
            Admin Access
          </div>

          <div className="mt-1 text-base font-black tracking-tight">
            Locked
          </div>

          <div className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
            {message || getStatusCopy(status, isAdminAuthorized)}
          </div>
        </div>

        <StatusBadge status={status} isAdminAuthorized={isAdminAuthorized} />
      </div>

      <div className="grid gap-2">
        <label
          htmlFor="admin-password"
          className="text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Admin Password
        </label>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value.slice(0, MAX_PASSWORD_LENGTH));
              setError("");
              setMessage("Enter password to unlock admin tools.");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void login();
              }
            }}
            placeholder="Enter password"
            autoComplete="current-password"
            className="min-w-0 flex-1 rounded-xl border px-3 py-3 text-base outline-none transition focus:ring-2 sm:text-sm"
            style={{
              background: "rgba(255,255,255,0.045)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />

          <button
            type="button"
            onClick={login}
            disabled={!cleanPassword || isSubmitting}
            className="ttv-touch-target rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.1em] transition hover:scale-[1.02] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background:
                "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))",
              color: "var(--text)",
            }}
          >
            {isSubmitting ? "Unlocking" : "Unlock"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200">
          {error}
        </div>
      ) : null}
    </AccessShell>
  );
}