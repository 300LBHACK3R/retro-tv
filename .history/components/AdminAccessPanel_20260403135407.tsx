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
      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
        <div className="text-sm text-slate-300">Checking admin access...</div>
      </div>
    );
  }

  if (isAdminAuthorized) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Admin Access
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAppMode("viewer")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              appMode === "viewer"
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            Viewer
          </button>

          <button
            onClick={() => setAppMode("admin")}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              appMode === "admin"
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-200 hover:bg-slate-700"
            }`}
          >
            Admin
          </button>

          <button
            onClick={logout}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
          >
            Sign Out
          </button>
        </div>

        {error ? <div className="mt-2 text-xs text-red-300">{error}</div> : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        Admin Access
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter admin password"
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500"
        />

        <button
          onClick={login}
          disabled={!password.trim()}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          Unlock Admin
        </button>
      </div>

      {error ? (
        <div className="mt-2 text-xs text-red-300">{error}</div>
      ) : (
        <div className="mt-2 text-xs text-slate-400">
          Viewer mode is public. Admin tools unlock after password entry.
        </div>
      )}
    </div>
  );
}