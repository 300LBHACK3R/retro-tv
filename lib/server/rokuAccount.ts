import "server-only";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import { createHmac, randomUUID, pbkdf2, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { accountOrigin, accountsEnabled } from "./accountAuth";
import { createSupabaseAdminClient } from "./supabaseAdmin";
import { accountView } from "./accountData";
import { accountEmailConfiguration } from "./accountEmails";
import { getClientAddress } from "./requestSecurity";
import { privateJson } from "./http";
import type { AccountView } from "../accountModel";
import { accountSecurityEmail } from "../accountEmails";
import { viewingProfiles } from "./accountViewing";

const derivePin = promisify(pbkdf2);
export type CodePurpose = "signup" | "recovery";
type Challenge = { email: string; purpose: CodePurpose; expires: number; nonce: string };

// A fresh public-key client per request prevents one TV's session from becoming
// another TV's session. This client never reads or writes website cookies.
export function rokuAuthClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(12_000) }) },
  });
}
function signature(value: string) {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(`roku-account:${value}`).digest("hex");
}
export function issueChallenge(email: string, purpose: CodePurpose) {
  const value = Buffer.from(JSON.stringify({ email, purpose, expires: Date.now() + 600_000, nonce: randomUUID() })).toString("base64url");
  return `${value}.${signature(value)}`;
}
export function readChallenge(input: unknown): Challenge | null {
  if (typeof input !== "string" || input.length > 1500) return null;
  const [value, mac, extra] = input.split(".");
  if (extra || !value || !mac || !/^[a-f0-9]{64}$/.test(mac)) return null;
  if (!timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(signature(value), "hex"))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString()) as Challenge;
    if (typeof parsed.email !== "string" || !["signup", "recovery"].includes(parsed.purpose)
      || !Number.isFinite(parsed.expires) || parsed.expires <= Date.now()) return null;
    return parsed;
  } catch { return null; }
}
export async function rokuAccountGuard(request: Request, action: string, subject = "") {
  const origin = request.headers.get("origin");
  if (origin && origin !== accountOrigin()) return privateJson({ ok: false, error: "Request origin rejected." }, 403);
  if (!accountsEnabled()) return privateJson({ ok: false, error: "Account services are temporarily unavailable. You can still watch for free." }, 503);
  const sensitive = ["signup", "recover", "verify", "reset", "parent-pin"].includes(action);
  const limit = sensitive ? 20 : action === "signin" ? 30 : action === "viewing" ? 360 : 120;
  const buckets = [{ value: `ip:${getClientAddress(request)}`, limit }];
  if (subject) buckets.push({ value: `subject:${subject}`, limit: sensitive ? 5 : 10 });
  for (const bucket of buckets) {
    const { data, error } = await createSupabaseAdminClient().rpc("ttv_account_rate_limit", {
      bucket_key: signature(`${action}:${bucket.value}`), max_requests: bucket.limit, window_seconds: 900,
    });
    if (error) return privateJson({ ok: false, error: "Account services are temporarily unavailable." }, 503);
    if (!data) return privateJson({ ok: false, error: "Too many attempts. Please try again in 15 minutes." }, 429);
  }
  return null;
}
export function deviceSession(session: Session) {
  return { accessToken: session.access_token, refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in };
}
export function deviceAccount(view: AccountView) {
  return {
    user: view.user, member: view.member, ownedThemeIds: view.ownedThemeIds, purchasedThemeIds: view.purchasedThemeIds,
    profiles: viewingProfiles(view),
    parentPinRequired: !!view.household?.pin,
  };
}
export async function loadDeviceAccount(user: User) { return deviceAccount(await accountView(user)); }
export async function parentPinMatches(view: AccountView, input: unknown) {
  const pin = view.household?.pin;
  if (!pin) return true;
  if (typeof input !== "string" || !/^\d{4,8}$/.test(input)) return false;
  const hash = await derivePin(input, Buffer.from(pin.salt, "hex"), 210_000, 32, "sha256");
  return timingSafeEqual(hash, Buffer.from(pin.hash, "hex"));
}
export async function sendRokuCode(email: string, code: string, purpose: CodePurpose, id: string) {
  const config = accountEmailConfiguration();
  if (!config.ready || !/^\d{6,10}$/.test(code)) throw new Error("Email unavailable");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `ttv-roku-code/${id}` },
    body: JSON.stringify({ from: config.sender, to: [email], ...accountSecurityEmail(purpose, code),
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
    }), signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Email unavailable");
}
