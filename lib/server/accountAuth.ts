import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "./supabaseAdmin";
import { getClientAddress, isSameOriginRequest } from "./requestSecurity";
import { privateJson } from "./http";

export function accountsEnabled() {
  return (
    process.env.TTV_ACCOUNTS_ENABLED === "true" &&
    !!process.env.SUPABASE_URL &&
    !!process.env.SUPABASE_PUBLISHABLE_KEY &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
export function accountOrigin() {
  const url = new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.tatestv.ca",
  );
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    throw new Error("HTTPS account origin required");
  return url.origin;
}
/** Server-only auth: provider sessions live in HttpOnly cookies, never localStorage. */
export async function accountClient() {
  if (!accountsEnabled()) throw new Error("Accounts unavailable");
  const jar = await cookies();
  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      },
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) =>
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          ),
      },
    },
  );
}
export async function verifiedAccount() {
  const client = await accountClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at) return { client, user: null };
  return { client, user: data.user };
}
export async function accountMutationGuard(
  request: Request,
  action: string,
  limit = 30,
) {
  if (!isSameOriginRequest(request))
    return privateJson({ error: "Request origin rejected." }, 403);
  if (!accountsEnabled())
    return privateJson(
      { error: "Account services are temporarily unavailable. Please try again shortly." },
      503,
    );
  // Signing out must still clear credentials during a database outage.
  if (action === "signout") return null;
  const key = createHash("sha256")
    .update(
      `${process.env.SUPABASE_SERVICE_ROLE_KEY}:${action}:${getClientAddress(request)}`,
    )
    .digest("hex");
  const { data, error } = await createSupabaseAdminClient().rpc(
    "ttv_account_rate_limit",
    { bucket_key: key, max_requests: limit, window_seconds: 900 },
  );
  if (error)
    return privateJson(
      { error: "Account services are temporarily unavailable." },
      503,
    );
  if (!data)
    return privateJson(
      { error: "Too many attempts. Please try again in 15 minutes." },
      429,
    );
  return null;
}
const RECOVERY_COOKIE = "ttv_password_recovery";
function recoverySignature(value: string) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(`password-recovery:${value}`)
    .digest("hex");
}
export async function setRecovery(userId: string | null) {
  const value = userId ? `${userId}.${Date.now() + 900_000}` : "";
  (await cookies()).set(
    RECOVERY_COOKIE,
    value ? `${value}.${recoverySignature(value)}` : "",
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: value ? 900 : 0,
    },
  );
}
export async function hasRecovery(userId: string) {
  const value = (await cookies()).get(RECOVERY_COOKIE)?.value ?? "";
  const [id, expires, signature] = value.split(".");
  if (
    id !== userId ||
    !/^\d+$/.test(expires ?? "") ||
    Number(expires) <= Date.now() ||
    !/^[a-f0-9]{64}$/.test(signature ?? "")
  )
    return false;
  return timingSafeEqual(
    Buffer.from(signature!, "hex"),
    Buffer.from(recoverySignature(`${id}.${expires}`), "hex"),
  );
}

export async function clearAccountCookies() {
  const jar = await cookies();
  const prefix = `sb-${new URL(process.env.SUPABASE_URL!).hostname.split(".")[0]}-auth-token`;
  for (const cookie of jar.getAll())
    if (cookie.name.startsWith(prefix))
      jar.set(cookie.name, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
  await setRecovery(null);
}
