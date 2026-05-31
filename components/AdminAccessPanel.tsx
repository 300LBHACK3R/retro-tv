"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";

interface AdminAccessPanelProps {
  onAuthChange?: (authorized: boolean) => void;
}

type AdminSessionResponse = {
  isAdmin?: boolean;
  error?: string;
};

type AdminLoginResponse = {
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
  if (isAdminAuthorized) return "Secure controls are available for this browser session.";
  return "Viewer mode is public. Admin tools unlock after password entry.";
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
      });

      const data = await readJsonSafe<AdminSessionResponse>(response);
      const authorized = Boolean(response.ok && data?.isAdmin);

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
    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await checkSession();
    };

    void run();

    return () => {
      cancelled = true;
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
      setError(getErrorMessage(error, "Unable to log in. Check the connection and try again."));
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
      await fetch("/api/admin/logout", {
        method: "POST",
      });
    } catch {
      setError("Unable to contact logout endpoint. Local session was still cleared.");
    } finally {
      setPassword("");
      syncAuthorizedState(false);
      setMessage("Signed out. Viewer mode restored.");
      setIsSubmitting(false);
    }
  };

  const switchMode = (mode: "viewer" | "admin") => {
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
      <section
        className="relative overflow-hidden rounded-2xl border p-4 shadow-2xl shadow-black/30"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,0,0,0.88), rgba(18,18,18,0.72))",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
        aria-live="polite"
      >
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--primary), transparent)",
          }}
        />

        <div
          className="text-[11px] font-black uppercase tracking-[0.22em]"
          style={{ color: "var(--primary)" }}
        >
          Admin Access
        </div>

        <div className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          {getStatusCopy(status, isAdminAuthorized)}
        </div>
      </section>
    );
  }

  if (isAdminAuthorized) {
    return (
      <section
        className="relative overflow-hidden rounded-2xl border p-4 shadow-2xl shadow-black/30"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(212,175,55,0.14), transparent 34%), linear-gradient(135deg, rgba(0,0,0,0.9), rgba(18,18,18,0.76))",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
        aria-label="Authorized admin access panel"
      >
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--primary), transparent)",
          }}
        />

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

          <div
            className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
            style={{
              borderColor: "rgba(34, 197, 94, 0.35)",
              background: "rgba(34, 197, 94, 0.12)",
              color: "#86efac",
            }}
          >
            Unlocked
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => switchMode("viewer")}
            className="rounded-xl px-3 py-3 text-sm font-black uppercase tracking-[0.1em] transition hover:scale-[1.02] hover:opacity-95"
            style={{
              background:
                appMode === "viewer"
                  ? "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))"
                  : "var(--button-bg)",
              color: "var(--text)",
              boxShadow:
                appMode === "viewer"
                  ? "0 0 22px rgba(212,175,55,0.22)"
                  : "none",
            }}
            aria-pressed={appMode === "viewer"}
          >
            Viewer
          </button>

          <button
            type="button"
            onClick={() => switchMode("admin")}
            className="rounded-xl px-3 py-3 text-sm font-black uppercase tracking-[0.1em] transition hover:scale-[1.02] hover:opacity-95"
            style={{
              background:
                appMode === "admin"
                  ? "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))"
                  : "var(--button-bg)",
              color: "var(--text)",
              boxShadow:
                appMode === "admin"
                  ? "0 0 22px rgba(212,175,55,0.22)"
                  : "none",
            }}
            aria-pressed={appMode === "admin"}
          >
            Admin
          </button>

          <button
            type="button"
            onClick={logout}
            disabled={isSubmitting}
            className="rounded-xl px-3 py-3 text-sm font-black uppercase tracking-[0.1em] transition hover:scale-[1.02] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "var(--button-bg)",
              color: "var(--text)",
            }}
          >
            {isSubmitting ? "Signing Out" : "Sign Out"}
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200">
            {error}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-2xl border p-4 shadow-2xl shadow-black/30"
      style={{
        background:
          "radial-gradient(circle at top left, rgba(212,175,55,0.12), transparent 34%), linear-gradient(135deg, rgba(0,0,0,0.9), rgba(18,18,18,0.76))",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
      aria-label="Locked admin access panel"
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--primary), transparent)",
        }}
      />

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

        <div
          className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
          style={{
            borderColor: "var(--border)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--text-muted)",
          }}
        >
          Viewer Only
        </div>
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
            className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.1em] transition hover:scale-[1.02] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background:
                "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))",
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
    </section>
  );
}