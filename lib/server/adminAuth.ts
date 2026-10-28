import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { PASSWORD_COOKIE, validPasswordSession } from "./adminPassword";
import type { User } from "@supabase/supabase-js";

export const ADMIN_COOKIE_NAME = "ttv-admin-auth";
const LEGACY_COOKIE_NAME = "ttv_admin_session";

/** Deployment-controlled IDs grant access, never profiles or editable metadata. */
export function isAdminUser(user: Pick<User, "id" | "email_confirmed_at"> | null) {
  const ids = (process.env.TTV_ADMIN_USER_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean);
  return !!user?.email_confirmed_at && ids.includes(user.id);
}

export function adminAccountsEnabled() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.TTV_ADMIN_USER_IDS?.trim());
}

/** A separate cookie name isolates admin login from household sessions. */
export async function adminAccountClient() {
  if (!adminAccountsEnabled()) throw new Error("Admin accounts unavailable");
  const jar = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: {
      name: ADMIN_COOKIE_NAME,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8,
    },
    cookies: {
      getAll: () => jar.getAll().filter(({ name }) => name === ADMIN_COOKIE_NAME || name.startsWith(`${ADMIN_COOKIE_NAME}.`)),
      setAll: values => values.forEach(({ name, value, options }) => jar.set(name, value, options)),
    },
  });
}

export async function clearAdminCookies() {
  const jar = await cookies();
  for (const { name } of jar.getAll()) {
    if (name === PASSWORD_COOKIE || name === LEGACY_COOKIE_NAME || name === ADMIN_COOKIE_NAME || name.startsWith(`${ADMIN_COOKIE_NAME}.`)) {
      jar.set(name, "", { path: "/", maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" });
    }
  }
}

export async function isAdminRequestAuthorized(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.getAll().find(({ name }) => name === PASSWORD_COOKIE)?.value;
  if (token && validPasswordSession(token)) return true;
  if (!adminAccountsEnabled()) return false;
  try {
    const client = await adminAccountClient();
    // Verify with Auth on every request, not a cached role or browser claims.
    const { data, error } = await client.auth.getUser();
    return !error && isAdminUser(data.user);
  } catch {
    return false;
  }
}
