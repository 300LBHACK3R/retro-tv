"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

interface AdminAccessPanelProps {
  onAuthChange?: (authorized: boolean) => void;
}

export default function AdminAccessPanel({
  onAuthChange,
}: AdminAccessPanelProps) {
  const appMode = useStore((state) => state.appMode);
  const setAppMode = useStore((state) => state.setAppMode);

  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch("/api/admin/session", { cache: "no-store" });
        const data = await res.json();

        if (data?.isAdmin) {
          setIsAdminAuthorized(true);
          onAuthChange?.(true);
        } else {
          setIsAdminAuthorized(false);
          onAuthChange?.(false);
          setAppMode("viewer");
        }
      } catch {
        setIsAdminAuthorized(false);
        onAuthChange?.(false);
        setAppMode("viewer");
      } finally {
        setIsLoading(false);
      }
    };

    void checkSession();
  }, [onAuthChange, setAppMode]);

  const login = async () => {
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Login failed.");
        setIsLoading(false);
        return;
      }

      setPassword("");
      setIsAdminAuthorized(true);
      setAppMode("admin");
      onAuthChange?.(true);
    } catch {
      setError("Unable to log in.");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setError("");

    try {
      await fetch("/api/admin/logout", {
        method: "POST",
      });

      setIsAdminAuthorized(false);
      setAppMode("viewer");
      onAuthChange?.(false);
    } catch {
      setError("Unable to log out.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div
        className="rounded-2xl border p-4"
        style={{
          background: "var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div
          className="text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Checking admin access...
        </div>
      </div>
    );
  }

  if (isAdminAuthorized) {
    return (
      <div
        className="rounded-2xl border p-4"
        style={{
          background: "var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div
          className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--text-muted)" }}
        >
          Admin Access
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAppMode("viewer")}
            className="rounded-lg px-3 py-2 text-sm font-semibold transition"
            style={{
              background:
                appMode === "viewer" ? "var(--primary)" : "var(--button-bg)",
              color: "var(--text)",
            }}
          >
            Viewer
          </button>

          <button
            onClick={() => setAppMode("admin")}
            className="rounded-lg px-3 py-2 text-sm font-semibold transition"
            style={{
              background:
                appMode === "admin" ? "var(--primary)" : "var(--button-bg)",
              color: "var(--text)",
            }}
          >
            Admin
          </button>

          <button
            onClick={logout}
            className="rounded-lg px-3 py-2 text-sm font-medium transition"
            style={{
              background: "var(--button-bg)",
              color: "var(--text)",
            }}
          >
            Sign Out
          </button>
        </div>

        {error ? (
          <div className="mt-2 text-xs text-red-300">{error}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div
        className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]"
        style={{ color: "var(--text-muted)" }}
      >
        Admin Access
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter admin password"
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            background: "var(--panel-alt-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        />

        <button
          onClick={login}
          disabled={!password.trim()}
          className="rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{
            background: "var(--primary)",
            color: "var(--text)",
          }}
        >
          Unlock Admin
        </button>
      </div>

      {error ? (
        <div className="mt-2 text-xs text-red-300">{error}</div>
      ) : (
        <div
          className="mt-2 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Viewer mode is public. Admin tools unlock after password entry.
        </div>
      )}
    </div>
  );
}