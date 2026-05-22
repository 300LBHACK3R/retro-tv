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
        className="rounded-2xl border p-4"
        style={{
          background: "var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div
          className="text-xs font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--text-muted)" }}
        >
          Admin Access
        </div>

        <div className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Checking admin session...
        </div>
      </section>
    );
  }

  if (isAdminAuthorized) {
    return (
      <section
        className="rounded-2xl border p-4"
        style={{
          background: "var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-[0.16em]"
              style={{ color: "var(--text-muted)" }}
            >
              Admin Access
            </div>

            <div className="mt-1 text-sm font-semibold">Authorized Session</div>

            <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Switch between public viewer mode and admin tools.
            </div>
          </div>

          <div
            className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{
              borderColor: "rgba(34, 197, 94, 0.35)",
              background: "rgba(34, 197, 94, 0.10)",
              color: "#86efac",
            }}
          >
            Unlocked
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAppMode("viewer")}
            className="rounded-lg px-3 py-2 text-sm font-semibold transition hover:opacity-90"
            style={{
              background:
                appMode === "viewer" ? "var(--primary)" : "var(--button-bg)",
              color: "var(--text)",
            }}
            aria-pressed={appMode === "viewer"}
          >
            Viewer
          </button>

          <button
            type="button"
            onClick={() => setAppMode("admin")}
            className="rounded-lg px-3 py-2 text-sm font-semibold transition hover:opacity-90"
            style={{
              background:
                appMode === "admin" ? "var(--primary)" : "var(--button-bg)",
              color: "var(--text)",
            }}
            aria-pressed={appMode === "admin"}
          >
            Admin
          </button>

          <button
            type="button"
            onClick={logout}
            disabled={isSubmitting}
            className="rounded-lg px-3 py-2 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "var(--button-bg)",
              color: "var(--text)",
            }}
          >
            {isSubmitting ? "Signing Out..." : "Sign Out"}
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div
            className="text-xs font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--text-muted)" }}
          >
            Admin Access
          </div>

          <div className="mt-1 text-sm font-semibold">Locked</div>

          <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Viewer mode is public. Admin tools unlock after password entry.
          </div>
        </div>

        <div
          className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{
            borderColor: "var(--border)",
            background: "var(--panel-alt-bg)",
            color: "var(--text-muted)",
          }}
        >
          Viewer Only
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="admin-password"
          className="text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Admin Password
        </label>

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
          placeholder="Enter admin password"
          autoComplete="current-password"
          className="rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />

        <button
          type="button"
          onClick={login}
          disabled={!password.trim() || isSubmitting}
          className="rounded-lg px-3 py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: "var(--primary)",
            color: "var(--text)",
          }}
        >
          {isSubmitting ? "Unlocking..." : "Unlock Admin"}
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      ) : null}
    </section>
  );
}