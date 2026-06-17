"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

type RequestResult<T> = {
  response: Response;
  data: T | null;
};

const MAX_PASSWORD_LENGTH = 128;
const REQUEST_TIMEOUT_MS = 12_000;
const SESSION_RECHECK_MS = 60_000;

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<RequestResult<T>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });

    const data = await readJsonSafe<T>(response);

    return { response, data };
  } finally {
    window.clearTimeout(timeout);
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request timed out. Check the connection and try again.";
  }

  return error instanceof Error ? error.message : fallback;
}

function isAuthorizedResponse(
  response: Response,
  data: AdminSessionResponse | null,
): boolean {
  return Boolean(response.ok && data?.isAdmin);
}

function getStatusCopy(status: AccessStatus, isAdminAuthorized: boolean): string {
  if (status === "checking") return "Checking secure session...";
  if (status === "error") return "Session check failed.";
  if (isAdminAuthorized) return "Secure controls are available for this browser session.";

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
  children: ReactNode;
  status: AccessStatus;
  isAdminAuthorized: boolean;
  label?: string;
}) {
  return (
    <section
      className="ttv-glass-panel-strong relative overflow-hidden rounded-2xl p-4 shadow-2xl shadow-black/30"
      aria-label={label}
      data-admin-status={status}
      data-admin-authorized={isAdminAuthorized ? "true" : "false"}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--primary), transparent)",
        }}
      />

      <div className="pointer-events-none absolute -right-20 -top-24 h-48 w-48 rounded-full bg-[var(--primary)]/10 blur-3xl" />

      <div className="relative z-10">{children}</div>
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
        boxShadow: active
          ? "0 0 22px color-mix(in srgb, var(--primary) 24%, transparent)"
          : "none",
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
  const passwordInputId = useId();
  const statusId = useId();

  const mountedRef = useRef(false);
  const sessionCheckInFlightRef = useRef(false);

  const appMode = useStore((state) => state.appMode);
  const setAppMode = useStore((state) => state.setAppMode);

  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<AccessStatus>("checking");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("Checking secure session...");
  const [error, setError] = useState("");

  const cleanPassword = useMemo(() => password.trim(), [password]);
  const isCheckingSession = status === "checking";

  const syncAuthorizedState = useCallback(
    (authorized: boolean, nextMessage?: string) => {
      if (!mountedRef.current) {
        return;
      }

      setIsAdminAuthorized(authorized);
      onAuthChange?.(authorized);

      if (!authorized) {
        setAppMode("viewer");
      }

      setStatus(authorized ? "authorized" : "locked");
      setMessage(
        nextMessage ??
          (authorized ? "Authorized session active." : "Admin tools are locked."),
      );
    },
    [onAuthChange, setAppMode],
  );

  const checkSession = useCallback(
    async (quiet = false) => {
      if (sessionCheckInFlightRef.current) {
        return;
      }

      sessionCheckInFlightRef.current = true;

      if (!quiet) {
        setStatus("checking");
        setMessage("Checking secure session...");
        setError("");
      }

      try {
        const { response, data } = await requestJson<AdminSessionResponse>(
          "/api/admin/session",
        );

        const authorized = isAuthorizedResponse(response, data);

        syncAuthorizedState(
          authorized,
          authorized
            ? "Authorized session active."
            : data?.error || "Admin tools are locked.",
        );

        if (!authorized && data?.error) {
          setMessage(data.error);
        }
      } catch (error) {
        syncAuthorizedState(false);
        setStatus("error");
        setError(getErrorMessage(error, "Unable to verify admin session."));
        setMessage("Unable to verify admin session.");
      } finally {
        sessionCheckInFlightRef.current = false;
      }
    },
    [syncAuthorizedState],
  );

  useEffect(() => {
    mountedRef.current = true;
    void checkSession();

    return () => {
      mountedRef.current = false;
    };
  }, [checkSession]);

  useEffect(() => {
    const handleFocus = () => {
      void checkSession(true);
    };

    const handleOnline = () => {
      void checkSession(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkSession(true);
      }
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = window.setInterval(() => {
      void checkSession(true);
    }, SESSION_RECHECK_MS);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(interval);
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
      const { response, data } = await requestJson<AdminLoginResponse>(
        "/api/admin/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: cleanPassword }),
        },
      );

      if (!response.ok || !data?.ok) {
        syncAuthorizedState(false, "Admin unlock failed.");
        setError(data?.error ?? "Login failed. Check the admin password.");
        return;
      }

      setPassword("");
      syncAuthorizedState(true, "Admin unlocked.");
      setAppMode("admin");
    } catch (error) {
      syncAuthorizedState(false, "Unable to unlock admin.");
      setError(
        getErrorMessage(
          error,
          "Unable to log in. Check the connection and try again.",
        ),
      );
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
      const { response, data } = await requestJson<AdminLogoutResponse>(
        "/api/admin/logout",
        {
          method: "POST",
        },
      );

      if (!response.ok || data?.ok === false) {
        setError(data?.error ?? "Logout endpoint returned an error.");
      }
    } catch {
      setError("Unable to contact logout endpoint. Local session was still cleared.");
    } finally {
      setPassword("");
      syncAuthorizedState(false, "Signed out. Viewer mode restored.");
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

            <div
              id={statusId}
              className="mt-2 text-sm"
              style={{ color: "var(--text-muted)" }}
              aria-live="polite"
            >
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

            <div
              id={statusId}
              className="mt-1 text-xs leading-5"
              style={{ color: "var(--text-muted)" }}
              aria-live="polite"
            >
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
          <div
            className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200"
            role="alert"
          >
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

          <div className="mt-1 text-base font-black tracking-tight">Locked</div>

          <div
            id={statusId}
            className="mt-1 text-xs leading-5"
            style={{ color: "var(--text-muted)" }}
            aria-live="polite"
          >
            {message || getStatusCopy(status, isAdminAuthorized)}
          </div>
        </div>

        <StatusBadge status={status} isAdminAuthorized={isAdminAuthorized} />
      </div>

      <div className="grid gap-2">
        <label
          htmlFor={passwordInputId}
          className="text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Admin Password
        </label>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={passwordInputId}
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
            aria-describedby={statusId}
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
        <div
          className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}
    </AccessShell>
  );
}