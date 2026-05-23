"use client";

import { useCallback, useEffect, useState } from "react";
import { useStore } from "@/lib/store";

interface AdminAccessPanelProps {
  onAuthChange?: (authorized: boolean) => void;
}

type AdminSessionResponse = {
  isAdmin?: boolean;
};

type AdminLoginResponse = {
  ok?: boolean;
  error?: string;
};

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default function AdminAccessPanel({
  onAuthChange,
}: AdminAccessPanelProps) {
  const appMode = useStore((state) => state.appMode);
  const setAppMode = useStore((state) => state.setAppMode);

  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const syncAuthorizedState = useCallback(
    (authorized: boolean) => {
      setIsAdminAuthorized(authorized);
      onAuthChange?.(authorized);

      if (!authorized) {
        setAppMode("viewer");
      }
    },
    [onAuthChange, setAppMode],
  );

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      setIsCheckingSession(true);
      setError("");

      try {
        const response = await fetch("/api/admin/session", {
          cache: "no-store",
        });

        const data = await readJsonSafe<AdminSessionResponse>(response);

        if (cancelled) {
          return;
        }

        syncAuthorizedState(Boolean(response.ok && data?.isAdmin));
      } catch {
        if (!cancelled) {
          syncAuthorizedState(false);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      }
    };

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [syncAuthorizedState]);

  const login = async () => {
    const cleanPassword = password.trim();

    if (!cleanPassword || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

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
        setError(data?.error ?? "Login failed. Check the admin password.");
        return;
      }

      setPassword("");
      syncAuthorizedState(true);
      setAppMode("admin");
    } catch {
      setError("Unable to log in. Check the connection and try again.");
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

    try {
      await fetch("/api/admin/logout", {
        method: "POST",
      });
    } catch {
      setError("Unable to contact logout endpoint. Local session was still cleared.");
    } finally {
      syncAuthorizedState(false);
      setIsSubmitting(false);
    }
  };

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
      >
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }}
        />

        <div
          className="text-[11px] font-black uppercase tracking-[0.22em]"
          style={{ color: "var(--primary)" }}
        >
          Admin Access
        </div>

        <div className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Checking secure session...
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
      >
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }}
        />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className="text-[11px] font-black uppercase tracking-[0.22em]"
              style={{ color: "var(--primary)" }}
            >
              Admin Access
            </div>

            <div className="mt-1 text-base font-semibold tracking-tight">
              Authorized Session
            </div>

            <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Secure controls are available for this browser session.
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

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setAppMode("viewer")}
            className="rounded-xl px-3 py-2 text-sm font-semibold transition hover:scale-[1.02] hover:opacity-95"
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
            onClick={() => setAppMode("admin")}
            className="rounded-xl px-3 py-2 text-sm font-semibold transition hover:scale-[1.02] hover:opacity-95"
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
            className="rounded-xl px-3 py-2 text-sm font-semibold transition hover:scale-[1.02] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "var(--button-bg)",
              color: "var(--text)",
            }}
          >
            {isSubmitting ? "..." : "Sign Out"}
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
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
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--primary), transparent)" }}
      />

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div
            className="text-[11px] font-black uppercase tracking-[0.22em]"
            style={{ color: "var(--primary)" }}
          >
            Admin Access
          </div>

          <div className="mt-1 text-base font-semibold tracking-tight">
            Locked
          </div>

          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Viewer mode is public. Admin tools unlock after password entry.
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

        <div className="flex gap-2">
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void login();
              }
            }}
            placeholder="Enter password"
            autoComplete="current-password"
            className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm outline-none transition focus:ring-2"
            style={{
              background: "rgba(255,255,255,0.045)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />

          <button
            type="button"
            onClick={login}
            disabled={!password.trim() || isSubmitting}
            className="rounded-xl px-4 py-2 text-sm font-semibold transition hover:scale-[1.02] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))",
              color: "var(--text)",
            }}
          >
            {isSubmitting ? "..." : "Unlock"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      ) : null}
    </section>
  );
}