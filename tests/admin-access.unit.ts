import { test, expect } from "@playwright/test";
import { serverModule, jsonRequest } from "./server-harness";
import * as model from "../lib/accountModel";
import * as themes from "../lib/themes";

const http = serverModule("lib/server/http.ts");
const premium = themes.THEMES.find(theme => theme.isPremium)!;

function accountData(allowlist: string) {
  const adminAuth = serverModule("lib/server/adminAuth.ts", {
    "./adminPassword": serverModule("lib/server/adminPassword.ts"),
  }, { TTV_ADMIN_USER_IDS: allowlist });
  const writes: unknown[] = [];
  const db = { from: (table: string) => {
    const result = { data: table === "ttv_theme_orders" ? [{ theme_id: premium.id }] : [], error: null };
    const query = {
      upsert: async (value: unknown) => { writes.push({ table, value }); return { error: null }; },
      select: () => query,
      eq: () => query,
      single: async () => ({ data: { household: null, revision: 0, stripe_customer_id: null }, error: null }),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  } };
  return { writes, data: serverModule("lib/server/accountData.ts", {
    "./adminAuth": adminAuth,
    "./supabaseAdmin": { createSupabaseAdminClient: () => db },
    "../accountModel": model,
    "../themes": themes,
  }) };
}

test("verified administrators get all themes and ten profiles without fabricating payments or membership", async () => {
  const { data, writes } = accountData(" owner-id , second-admin ");
  const state = await data.accountView!({ id: "owner-id", email: "owner@example.test", email_confirmed_at: "today" });
  expect(state).toMatchObject({ isAdmin: true, member: false, profileLimit: 10, purchasedThemeIds: [premium.id] });
  expect(state.ownedThemeIds).toEqual(themes.THEMES.map(theme => theme.id));
  expect(writes).toEqual([{ table: "ttv_accounts", value: { user_id: "owner-id" } }]);
  const removed = await accountData("second-admin").data.accountView!({ id: "owner-id", email_confirmed_at: "today" });
  expect(removed).toMatchObject({ isAdmin: false, member: false, profileLimit: 5 });
  expect(removed.ownedThemeIds).toEqual(model.allowedThemeIds([premium.id], false));
});

test("unconfirmed owners and editable role claims cannot grant complimentary admin access", async () => {
  const { data } = accountData("owner-id");
  for (const user of [
    { id: "owner-id", email_confirmed_at: null },
    { id: "ordinary-id", email_confirmed_at: "today", email: "owner@example.test", user_metadata: { role: "admin", isAdmin: true } },
  ]) {
    const state = await data.accountView!(user);
    expect(state).toMatchObject({ isAdmin: false, member: false, profileLimit: 5 });
    expect(state.ownedThemeIds).toEqual(model.allowedThemeIds([premium.id], false));
  }
});

test("checkout never charges an administrator and ignores client-supplied admin claims", async () => {
  let isAdmin = true;
  let calls = 0;
  const route = serverModule("app/api/billing/checkout/route.ts", {
    "@/lib/server/accountAuth": { accountMutationGuard: async () => null, verifiedAccount: async () => ({ user: { id: "verified-id" } }) },
    "@/lib/server/accountData": { accountView: async () => ({ ...model.EMPTY_ACCOUNT, isAdmin }) },
    "@/lib/server/billing": { createCheckout: async () => { calls++; return "https://checkout.stripe.com/test"; } },
    "@/lib/server/http": http,
    "@/lib/themes": themes,
    "@/lib/accountModel": model,
  });
  for (const product of ["theme", "membership"]) {
    const response = await route.POST!(jsonRequest("/api/billing/checkout", { product, themeId: premium.id, planId: "monthly", requestId: "synthetic-checkout-request-001" }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("complimentary");
  }
  expect(calls).toBe(0);
  isAdmin = false;
  expect((await route.POST!(jsonRequest("/api/billing/checkout", { product: "theme", themeId: premium.id, requestId: "synthetic-checkout-request-002", isAdmin: true }))).status).toBe(200);
  expect(calls).toBe(1);
});

test("admin session advertises configured login methods without exposing identities or secrets", async () => {
  const route = serverModule("app/api/admin/session/route.ts", {
    "@/lib/server/http": http,
    "@/lib/server/adminAuth": { isAdminRequestAuthorized: async () => false, adminAccountsEnabled: () => true },
    "@/lib/server/adminPassword": { passwordAdminEnabled: () => true },
  });
  const response = await route.GET!();
  expect(await response.json()).toEqual({ ok: true, isAdmin: false, methods: { account: true, password: true } });
  expect(response.headers.get("cache-control")).toContain("no-store");
});
