import { cookies } from "next/headers";
import { PASSWORD_COOKIE, ADMIN_SESSION_SECONDS, passwordAdminEnabled, matchesAdminPassword, createPasswordSession } from "@/lib/server/adminPassword";
import { accountMutationGuard } from "@/lib/server/accountAuth";
import { adminAccountClient, adminAccountsEnabled, clearAdminCookies, isAdminUser } from "@/lib/server/adminAuth";
import { privateJson, readBoundedJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const rejected = await accountMutationGuard(request, "admin-signin", 8);
  if (rejected) return rejected;
  if (!adminAccountsEnabled() && !passwordAdminEnabled()) return privateJson({ ok: false, error: "Admin sign-in is not configured yet." }, 503);
  try {
    const body = await readBoundedJson(request, 4096) as { email?: unknown; password?: unknown } | null;
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!email && passwordAdminEnabled()) {
      if (!password || password.length > 512 || !matchesAdminPassword(password)) {
        await clearAdminCookies();
        return privateJson({ ok: false, error: "Incorrect admin password." }, 401);
      }
      await clearAdminCookies();
      const jar = await cookies();
      jar.set(PASSWORD_COOKIE, createPasswordSession(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: ADMIN_SESSION_SECONDS });
      return privateJson({ ok: true });
    }
    if (!email || email.length > 254 || !password || password.length > 512) {
      return privateJson({ ok: false, error: "Enter your admin email and password." }, 400);
    }
    const client = await adminAccountClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !isAdminUser(data.user)) {
      try { await client.auth.signOut({ scope: "local" }); } finally { await clearAdminCookies(); }
      return privateJson({ ok: false, error: "Unable to sign in with these admin credentials." }, 401);
    }
    return privateJson({ ok: true });
  } catch {
    await clearAdminCookies();
    return privateJson({ ok: false, error: "Admin sign-in is temporarily unavailable. Please try again." }, 503);
  }
}
