"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

interface AdminAccessPanelProps {
  open: boolean;
  isAdminAuthorized: boolean;
  onClose: () => void;
  onAuthChange: (authorized: boolean) => void;
}

export default function AdminAccessPanel({
  open,
  isAdminAuthorized,
  onClose,
  onAuthChange,
}: AdminAccessPanelProps) {
  const setAppMode = useStore((state) => state.setAppMode);

  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const login = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data?.error ?? "Login failed.");
        setIsLoading(false);
        return;
      }

      setPassword("");
      onAuthChange(true);
      setAppMode("admin");
      onClose();
    } catch {
      setError("Unable to reach admin login.");
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

      onAuthChange(false);
      setAppMode("viewer");
      onClose();
    } catch {
      setError("Unable to log out.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/70 p-4 backdrop-blur-[2px]">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Admin Access
            </div>
            <div className="mt-1 text-xl font-semibold">
              {isAdminAuthorized ? "Admin Unlocked" : "Unlock Admin"}
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm hover:bg-slate-700"
          >
            Close
          </button>
        </div>

        {isAdminAuthorized ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
              Admin tools are available in this session.
            </div>

            <button
              onClick={logout}
              disabled={isLoading}
              className="w-full rounded-lg bg-slate-800 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              {isLoading ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />

            <button
              onClick={login}
              disabled={isLoading || !password.trim()}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Unlock Admin"}
            </button>

            <div className="text-xs text-slate-400">
              Viewer mode stays public. Admin tools unlock after password auth.
            </div>
          </div>
        )}

        {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}
      </div>
    </div>
  );
}