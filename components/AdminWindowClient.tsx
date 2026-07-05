"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import AdminDashboard from "@/components/AdminDashboard";
import GlobalProgrammingSync from "@/components/GlobalProgrammingSync";
import TextEncodingCleaner from "@/components/TextEncodingCleaner";
import { useStore } from "@/lib/store";
import { getThemeById } from "@/lib/themes";

type AccessStatus = "checking" | "locked" | "authorized" | "error";

type SessionResponse = {
  isAdmin?: boolean;
  error?: string;
};

type LoginResponse = {
  ok?: boolean;
  error?: string;
};

function createThemeVars(
  theme: ReturnType<typeof getThemeById>,
): CSSProperties {
  return {
    "--app-bg": theme.colors.appBg,
    "--panel-bg": theme.colors.panelBg,
    "--panel-alt-bg": theme.colors.panelAltBg,
    "--border": theme.colors.border,
    "--text": theme.colors.text,
    "--text-muted": theme.colors.textMuted,
    "--button-bg": theme.colors.buttonBg,
    "--button-hover": theme.colors.buttonHover,
    "--primary": theme.colors.primary,
    "--guide-header-bg": theme.colors.guideHeaderBg,
    "--guide-row-bg": theme.colors.guideRowBg,
    "--guide-row-alt-bg": theme.colors.guideRowAltBg,
    "--guide-active-bg": theme.colors.guideActiveBg,
    "--guide-current-bg": theme.colors.guideCurrentBg,
  } as CSSProperties;
}

async function readJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export default function AdminWindowClient() {
  const themeId = useStore((state) => state.themeId);

  const theme = useMemo(() => getThemeById(themeId), [themeId]);
  const themeVars = useMemo(() => createThemeVars(theme), [theme]);

  const [status, setStatus] = useState<AccessStatus>("checking");
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Checking secure admin session...");
  const [submitting, setSubmitting] = useState(false);

  const checkSession = useCallback(async () => {
    setStatus("checking");
    setMessage("Checking secure admin session...");

    try {
      const response = await fetch("/api/admin/session", {
        cache: "no-store",
        credentials: "same-origin",
      });

      const data = await readJsonSafe<SessionResponse>(response);
      const allowed = Boolean(response.ok && data?.isAdmin);

      setAuthorized(allowed);
      setStatus(allowed ? "authorized" : "locked");
      setMessage(
        allowed
          ? "Authorized admin session active."
          : data?.error || "Enter the admin password to continue.",
      );
    } catch {
      setAuthorized(false);
      setStatus("error");
      setMessage("Unable to verify the admin session.");
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanPassword = password.trim();

    if (!cleanPassword || submitting) {
      return;
    }

    setSubmitting(true);
    setMessage("Unlocking admin controls...");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: cleanPassword,
        }),
      });

      const data = await readJsonSafe<LoginResponse>(response);

      if (!response.ok || !data?.ok) {
        setAuthorized(false);
        setStatus("locked");
        setMessage(data?.error || "Incorrect admin password.");
        return;
      }

      setPassword("");
      setAuthorized(true);
      setStatus("authorized");
      setMessage("Admin controls unlocked.");
    } catch {
      setAuthorized(false);
      setStatus("error");
      setMessage("Unable to contact the login endpoint.");
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);

    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      setAuthorized(false);
      setStatus("locked");
      setMessage("Admin session ended.");
      setSubmitting(false);
    }
  };

  const returnToTv = () => {
    window.location.assign("/");
  };

  const closeAdmin = () => {
    window.close();

    window.setTimeout(() => {
      if (!window.closed) {
        window.location.assign("/");
      }
    }, 150);
  };

  return (
    <main
      className="min-h-screen overflow-x-hidden"
      style={{
        ...themeVars,
        background:
          "radial-gradient(circle at top right, rgba(255,255,255,0.06), transparent 34%), var(--app-bg)",
        color: "var(--text)",
      }}
    >
      <TextEncodingCleaner />

      <GlobalProgrammingSync isAdminAuthorized={authorized} />

      <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 p-3 sm:p-5">
        <header
          className="flex flex-col gap-4 rounded-2xl border p-4 shadow-2xl shadow-black/30 sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: "var(--panel-bg)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex min-w-0 items-center gap-4">
            <Image
              src="/tatestv-logo.png"
              alt="Tate's TV"
              width={220}
              height={76}
              className="h-auto w-full max-w-[180px]"
              priority
              draggable={false}
            />

            <div className="min-w-0 border-l pl-4" style={{ borderColor: "var(--border)" }}>
              <div
                className="text-[11px] font-black uppercase tracking-[0.22em]"
                style={{ color: "var(--primary)" }}
              >
                Protected Station Tools
              </div>

              <h1 className="mt-1 truncate text-xl font-black tracking-tight sm:text-2xl">
                Admin Control Centre
              </h1>

              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                Uploads, programming, commercials, branding and station settings.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={returnToTv}
              className="ttv-touch-target rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em]"
              style={{
                background: "var(--button-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            >
              Return to TV
            </button>

            {authorized ? (
              <button
                type="button"
                onClick={logout}
                disabled={submitting}
                className="ttv-touch-target rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em] disabled:opacity-50"
                style={{
                  background: "var(--button-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              >
                {submitting ? "Signing Out" : "Sign Out"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={closeAdmin}
              className="ttv-action-button ttv-touch-target rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em]"
            >
              Close Admin
            </button>
          </div>
        </header>

        {status === "checking" ? (
          <section
            className="rounded-2xl border p-6 text-sm"
            style={{
              background: "var(--panel-bg)",
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          >
            Checking secure admin session...
          </section>
        ) : null}

        {!authorized && status !== "checking" ? (
          <section
            className="mx-auto w-full max-w-xl rounded-2xl border p-5 shadow-2xl shadow-black/30"
            style={{
              background: "var(--panel-bg)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="text-xs font-black uppercase tracking-[0.2em]"
              style={{ color: "var(--primary)" }}
            >
              Admin Login
            </div>

            <h2 className="mt-2 text-xl font-black">
              Unlock the control centre
            </h2>

            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              {message}
            </p>

            <form onSubmit={login} className="mt-5 grid gap-3">
              <label
                htmlFor="admin-window-password"
                className="text-xs font-black uppercase tracking-[0.12em]"
                style={{ color: "var(--text-muted)" }}
              >
                Admin Password
              </label>

              <input
                id="admin-window-password"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value.slice(0, 128));
                  setMessage("Enter the admin password to continue.");
                }}
                autoComplete="current-password"
                placeholder="Enter password"
                className="rounded-xl border px-4 py-3 text-base outline-none"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
              />

              <button
                type="submit"
                disabled={!password.trim() || submitting}
                className="ttv-action-button ttv-touch-target rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Unlocking" : "Open Admin"}
              </button>
            </form>
          </section>
        ) : null}

        {authorized ? (
          <section className="min-w-0">
            <AdminDashboard />
          </section>
        ) : null}
      </div>
    </main>
  );
}