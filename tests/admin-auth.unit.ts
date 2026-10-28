import { test, expect } from "@playwright/test";
import { serverModule, jsonRequest } from "./server-harness";

const http = serverModule("lib/server/http.ts");
const passwordAuth = serverModule("lib/server/adminPassword.ts");
const env = { SUPABASE_URL: "https://qa.supabase.co", SUPABASE_PUBLISHABLE_KEY: "qa-key", TTV_ADMIN_USER_IDS: "staff-id" };

test("admin verifies identity, ignores editable roles and old/parent cookies, fails closed", async () => {
  let user: Record<string, unknown> | null = { id: "parent-id", email_confirmed_at: "today", user_metadata: { admin: true } };
  let unavailable = false;
  const jar = new Map([
    ["sb-qa-auth-token", "parent-session"],
    ["ttv_admin_session", "old-admin-session"],
    ["ttv-admin-auth.0", "staff-session"],
  ]);
  let options: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const auth = serverModule("lib/server/adminAuth.ts", {
    "./adminPassword": passwordAuth,
    "next/headers": { cookies: async () => ({
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      set: (name: string, value: string) => jar.set(name, value),
    }) },
    "@supabase/ssr": { createServerClient: (_url: string, _key: string, config: unknown) => {
      options = config;
      return { auth: { getUser: async () => {
        if (unavailable) throw new Error("offline");
        return { data: { user }, error: null };
      } } };
    } },
  }, env);
  expect(await auth.isAdminRequestAuthorized!()).toBe(false);
  expect(options.cookieOptions).toMatchObject({ name: "ttv-admin-auth", httpOnly: true, secure: true, sameSite: "strict" });
  expect(options.cookies.getAll()).toEqual([{ name: "ttv-admin-auth.0", value: "staff-session" }]);
  user = { id: "staff-id", email_confirmed_at: null };
  expect(await auth.isAdminRequestAuthorized!()).toBe(false);
  user = { id: "staff-id", email_confirmed_at: "today" };
  expect(await auth.isAdminRequestAuthorized!()).toBe(true);
  user = null;
  expect(await auth.isAdminRequestAuthorized!()).toBe(false);
  unavailable = true;
  expect(await auth.isAdminRequestAuthorized!()).toBe(false);
  await auth.clearAdminCookies!();
  expect(jar.get("sb-qa-auth-token")).toBe("parent-session");
  expect(jar.get("ttv-admin-auth.0")).toBe("");
  expect(jar.get("ttv_admin_session")).toBe("");
});

test("admin login rejects nonstaff, clears credentials, preserves password whitespace and honors guard", async () => {
  let staff = false;
  let rejected: Response | null = null;
  let cleared = 0;
  const calls: unknown[] = [];
  const route = serverModule("app/api/admin/login/route.ts", {
    "@/lib/server/adminPassword": passwordAuth,
    "@/lib/server/http": http,
    "@/lib/server/accountAuth": { accountMutationGuard: async () => rejected },
    "@/lib/server/adminAuth": {
      adminAccountsEnabled: () => true,
      isAdminUser: () => staff,
      clearAdminCookies: async () => { cleared++; },
      adminAccountClient: async () => ({ auth: {
        signInWithPassword: async (credentials: unknown) => { calls.push(credentials); return { data: { user: {} }, error: null }; },
        signOut: async (options: unknown) => { calls.push(options); },
      } }),
    },
  });
  const request = () => jsonRequest("/api/admin/login", { email: " staff@example.test ", password: " password with spaces " });
  expect((await route.POST!(request())).status).toBe(401);
  expect(cleared).toBe(1);
  expect(calls[1]).toEqual({ scope: "local" });
  staff = true;
  expect((await route.POST!(request())).status).toBe(200);
  expect(calls[2]).toEqual({ email: "staff@example.test", password: " password with spaces " });
  rejected = new Response(null, { status: 429 });
  expect((await route.POST!(request())).status).toBe(429);
  expect(calls).toHaveLength(3);
});

test("admin logout clears only its cookies even when provider fails, rejects foreign origins", async () => {
  let cleared = 0;
  const security = serverModule("lib/server/requestSecurity.ts");
  const route = serverModule("app/api/admin/logout/route.ts", {
    "@/lib/server/http": http,
    "@/lib/server/requestSecurity": security,
    "@/lib/server/adminAuth": {
      adminAccountClient: async () => { throw new Error("offline"); },
      clearAdminCookies: async () => { cleared++; },
    },
  });
  expect((await route.POST!(jsonRequest("/api/admin/logout", {}, "POST", "https://evil.test"))).status).toBe(403);
  expect(cleared).toBe(0);
  expect((await route.POST!(jsonRequest("/api/admin/logout", {}))).status).toBe(200);
  expect(cleared).toBe(1);
});

test("password admin sessions reject wrong passwords, tampering, expiry and password rotation", async () => {
  const credentials = { ADMIN_PASSWORD: "synthetic-admin-password", ADMIN_SESSION_SECRET: "synthetic-signing-secret-for-tests" };
  const auth = serverModule("lib/server/adminPassword.ts", {}, credentials);
  expect(auth.matchesAdminPassword!("wrong")).toBe(false);
  expect(auth.matchesAdminPassword!(credentials.ADMIN_PASSWORD)).toBe(true);
  const now = Date.now();
  const token = auth.createPasswordSession!(now);
  expect(auth.validPasswordSession!(token, now)).toBe(true);
  expect(auth.validPasswordSession!(token + "x", now)).toBe(false);
  expect(auth.validPasswordSession!(token, now + 8 * 60 * 60 * 1000)).toBe(false);
  expect(auth.validPasswordSession!(token, now - 1000)).toBe(false);
  const rotated = serverModule("lib/server/adminPassword.ts", {}, { ...credentials, ADMIN_PASSWORD: "new-synthetic-password" });
  expect(rotated.validPasswordSession!(token, now)).toBe(false);
  expect(passwordAuth.validPasswordSession!(token, now)).toBe(false);
});

test("password-only login sets a secure admin cookie and honors incorrect-password rejection", async () => {
  const auth = serverModule("lib/server/adminPassword.ts", {}, { ADMIN_PASSWORD: "synthetic-admin-password", ADMIN_SESSION_SECRET: "synthetic-signing-secret-for-tests" });
  const issued: unknown[][] = [];
  const route = serverModule("app/api/admin/login/route.ts", {
    "@/lib/server/http": http,
    "next/headers": { cookies: async () => ({ set: (...args: unknown[]) => issued.push(args) }) },
    "@/lib/server/accountAuth": { accountMutationGuard: async () => null },
    "@/lib/server/adminPassword": auth,
    "@/lib/server/adminAuth": { adminAccountsEnabled: () => false, clearAdminCookies: async () => {} },
  });
  expect((await route.POST!(jsonRequest("/api/admin/login", { password: "wrong" }))).status).toBe(401);
  expect(issued).toHaveLength(0);
  expect((await route.POST!(jsonRequest("/api/admin/login", { password: "synthetic-admin-password" }))).status).toBe(200);
  expect(issued[0]?.[0]).toBe("ttv-admin-password");
  expect(issued[0]?.[2]).toMatchObject({ httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 28800 });
});
