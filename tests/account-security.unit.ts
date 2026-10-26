import { test, expect } from "@playwright/test";
import Stripe from "stripe";
import { serverModule, jsonRequest } from "./server-harness";
import * as model from "../lib/accountModel";
import * as themes from "../lib/themes";

const http = serverModule("lib/server/http.ts");
const security = serverModule("lib/server/requestSecurity.ts");
const env = {
  TTV_ACCOUNTS_ENABLED: "true",
  SUPABASE_URL: "https://qa.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key-not-a-production-secret",
};

test("account guards fail closed; recovery is signed, expiring, user-bound and HttpOnly", async () => {
  const jar = new Map<string, string>();
  const options: Record<string, unknown>[] = [];
  let limit = true;
  const auth = serverModule(
    "lib/server/accountAuth.ts",
    {
      "next/headers": {
        cookies: async () => ({
          get: (name: string) => ({ value: jar.get(name) }),
          getAll: () => [...jar].map(([name, value]) => ({ name, value })),
          set: (name: string, value: string, opts: Record<string, unknown>) => {
            jar.set(name, value);
            options.push(opts);
          },
        }),
      },
      "./supabaseAdmin": {
        createSupabaseAdminClient: () => ({
          rpc: async () => ({ data: limit, error: null }),
        }),
      },
      "./requestSecurity": security,
      "./http": http,
    },
    env,
  );
  expect(
    (
      await auth.accountMutationGuard!(
        jsonRequest("/api/account/auth", {}, "POST", "https://evil.example"),
        "signin",
      )
    ).status,
  ).toBe(403);
  expect(
    await auth.accountMutationGuard!(
      jsonRequest("/api/account/auth", {}),
      "signin",
    ),
  ).toBeNull();
  limit = false;
  expect(
    (
      await auth.accountMutationGuard!(
        jsonRequest("/api/account/auth", {}),
        "signin",
      )
    ).status,
  ).toBe(429);
  await auth.setRecovery!("alice");
  expect(options[0]).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 900,
  });
  expect(await auth.hasRecovery!("alice")).toBe(true);
  expect(await auth.hasRecovery!("bob")).toBe(false);
  const valid = jar.get("ttv_password_recovery")!;
  jar.set("ttv_password_recovery", valid.replace("alice", "bob"));
  expect(await auth.hasRecovery!("bob")).toBe(false);
  jar.set("ttv_password_recovery", valid.replace(/\.\d+\./, ".1."));
  expect(await auth.hasRecovery!("alice")).toBe(false);
  jar.set("sb-qa-auth-token.0", "secret");
  await auth.clearAccountCookies!();
  expect(jar.get("sb-qa-auth-token.0")).toBe("");
  expect(await auth.hasRecovery!("alice")).toBe(false);
});

test("authentication rejects unconfirmed sessions, arbitrary OTP types and password resets without recovery proof", async () => {
  let recovery = false;
  let confirmed = false;
  const calls: string[] = [];
  const user = { id: "alice", email: "alice@example.test" };
  const auth = {
    signInWithPassword: async () => ({
      data: {
        user: { ...user, email_confirmed_at: confirmed ? "2026-10-26" : null },
      },
      error: null,
    }),
    signUp: async () => {
      calls.push("signup");
      return { error: null };
    },
    updateUser: async () => {
      calls.push("reset");
      return { error: null };
    },
    signOut: async () => ({ error: null }),
  };
  const route = serverModule("app/api/account/auth/route.ts", {
    "@/lib/server/accountAuth": {
      accountMutationGuard: async () => null,
      accountClient: async () => ({ auth }),
      verifiedAccount: async () => ({ user }),
      hasRecovery: async () => recovery,
      clearAccountCookies: async () => {},
      accountOrigin: () => "https://www.tatestv.ca",
    },
    "@/lib/server/accountData": { ensureAccount: async () => ({}) },
    "@/lib/server/billing": {},
    "@/lib/server/supabaseAdmin": {},
    "@/lib/server/http": http,
    "@/lib/accountModel": model,
  });
  const post = (body: unknown) =>
    route.POST!(jsonRequest("/api/account/auth", body));
  expect(
    (
      await post({
        action: "signup",
        email: user.email,
        password: "short",
        adult: true,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await post({
        action: "signup",
        email: user.email,
        password: "long memorable passphrase",
        adult: false,
      })
    ).status,
  ).toBe(400);
  expect(calls).toEqual([]);
  expect(
    (
      await post({
        action: "signin",
        email: user.email,
        password: "long memorable passphrase",
      })
    ).status,
  ).toBe(401);
  confirmed = true;
  expect(
    (
      await post({
        action: "signin",
        email: user.email,
        password: "long memorable passphrase",
      })
    ).status,
  ).toBe(200);
  expect(
    (await post({ action: "confirm", type: "invite", token: "x".repeat(32) }))
      .status,
  ).toBe(400);
  expect(
    (await post({ action: "reset", password: "new long memorable passphrase" }))
      .status,
  ).toBe(401);
  recovery = true;
  expect(
    (await post({ action: "reset", password: "new long memorable passphrase" }))
      .status,
  ).toBe(200);
  expect(calls).toEqual(["reset"]);
});

test("household writes bind the authenticated owner and revision, never accept client theme grants", async () => {
  const filters: unknown[] = [];
  let match = true;
  let signedIn = true;
  const query = {
    eq: (key: string, value: unknown) => {
      filters.push([key, value]);
      return query;
    },
    select: () => query,
    maybeSingle: async () => ({
      data: match ? { revision: 2 } : null,
      error: null,
    }),
  };
  const route = serverModule("app/api/account/household/route.ts", {
    "@/lib/server/accountAuth": {
      accountMutationGuard: async () => null,
      verifiedAccount: async () => ({
        user: signedIn ? { id: "alice" } : null,
      }),
    },
    "@/lib/server/accountData": {
      accountView: async () => ({
        ownedThemeIds: model.allowedThemeIds([], false),
        profileLimit: 5,
        household: null,
      }),
    },
    "@/lib/server/billing": { billingEnabled: () => true },
    "@/lib/server/supabaseAdmin": {
      createSupabaseAdminClient: () => ({
        from: () => ({ update: () => query }),
      }),
    },
    "@/lib/server/http": http,
    "@/lib/accountModel": model,
  });
  const household = {
    profiles: [{ id: "main", name: "Main", theme: "midas-gold" }],
    member: true,
    ownedThemeIds: ["midas-gold"],
  };
  const put = () =>
    route.PUT!(
      jsonRequest(
        "/api/account/household",
        { user_id: "bob", household, revision: 1 },
        "PUT",
      ),
    );
  expect((await put()).status).toBe(403);
  household.profiles[0]!.theme = "christmas-96";
  expect((await put()).status).toBe(200);
  expect(filters).toEqual([
    ["user_id", "alice"],
    ["revision", 1],
  ]);
  match = false;
  expect((await put()).status).toBe(409);
  signedIn = false;
  expect((await put()).status).toBe(401);
});

test("Stripe webhook verifies the exact payload, rejects tampering and test/live mismatch, and retries failed transactions", async () => {
  const stripe = new Stripe("sk_test_synthetic");
  let fail = false;
  let calls = 0;
  const secret = "whsec_synthetic_testing_only";
  const route = serverModule(
    "app/api/billing/webhook/route.ts",
    {
      "@/lib/server/http": http,
      "@/lib/server/billing": {
        stripeClient: () => stripe,
        applyBillingEvent: async () => {
          calls++;
          if (fail) throw new Error("db unavailable");
        },
      },
    },
    { STRIPE_SECRET_KEY: "sk_test_synthetic", STRIPE_WEBHOOK_SECRET: secret },
  );
  const post = (body: string, signature?: string) =>
    route.POST!(
      new Request("https://www.tatestv.ca/api/billing/webhook", {
        method: "POST",
        headers: signature ? { "stripe-signature": signature } : {},
        body,
      }),
    );
  const payload = JSON.stringify({
    id: "evt_qa",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: {} },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  expect((await post(payload)).status).toBe(400);
  expect((await post(payload + " ", signature)).status).toBe(400);
  expect((await post(payload, signature)).status).toBe(200);
  expect(calls).toBe(1);
  const live = payload.replace('"livemode":false', '"livemode":true');
  expect(
    (
      await post(
        live,
        stripe.webhooks.generateTestHeaderString({ payload: live, secret }),
      )
    ).status,
  ).toBe(400);
  expect(calls).toBe(1);
  fail = true;
  expect((await post(payload, signature)).status).toBe(500);
});

test("payment fulfillment checks canonical Stripe customer, price, payment and refund state", async () => {
  const writes: Record<string, unknown>[] = [];
  const charge = { id: "ch_1", refunded: false, disputed: false };
  const session = {
    id: "cs_1",
    mode: "payment",
    customer: "cus_alice",
    metadata: {
      application: "tates-tv",
      user_id: "alice",
      theme_id: "midas-gold",
    },
    payment_status: "paid",
    payment_intent: { id: "pi_1", status: "succeeded", latest_charge: charge },
  };
  const line = { price: { id: "price_theme" }, quantity: 1 };
  const stripe = {
    checkout: {
      sessions: {
        retrieve: async () => session,
        listLineItems: async () => ({ data: [line] }),
      },
    },
    disputes: { list: async () => ({ data: [{ status: "won" }] }) },
  };
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      expect([key, value]).toEqual(["stripe_customer_id", "cus_alice"]);
      return query;
    },
    maybeSingle: async () => ({ data: { user_id: "alice" }, error: null }),
  };
  const billing = serverModule(
    "lib/server/billing.ts",
    {
      stripe: {
        default: class {
          constructor() {
            return stripe;
          }
        },
      },
      "./supabaseAdmin": {
        createSupabaseAdminClient: () => ({
          from: () => query,
          rpc: async (_: string, input: Record<string, unknown>) => {
            writes.push(input);
            return { error: null };
          },
        }),
      },
      "./accountData": {},
      "./accountAuth": {},
      "../accountModel": model,
      "../themes": themes,
    },
    {
      STRIPE_SECRET_KEY: "sk_test_synthetic",
      STRIPE_THEME_PRICE_ID: "price_theme",
    },
  );
  const event = {
    id: "evt_1",
    created: 100,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_1",
        mode: "payment",
        metadata: { user_id: "attacker" },
        payment_status: "paid",
      },
    },
  };
  session.payment_status = "unpaid";
  await billing.applyBillingEvent!(event);
  expect(writes.at(-1)!.theme_order).toMatchObject({
    user_id: "alice",
    status: "unpaid",
  });
  session.payment_status = "paid";
  await billing.applyBillingEvent!(event);
  expect(writes.at(-1)!.theme_order).toMatchObject({
    user_id: "alice",
    status: "paid",
  });
  charge.refunded = true;
  await billing.applyBillingEvent!(event);
  expect(writes.at(-1)!.theme_order).toMatchObject({ status: "refunded" });
  charge.refunded = false;
  charge.disputed = true;
  await billing.applyBillingEvent!(event);
  expect(writes.at(-1)!.theme_order).toMatchObject({ status: "paid" });
  const count = writes.length;
  session.metadata.user_id = "attacker";
  await billing.applyBillingEvent!(event);
  expect(writes).toHaveLength(count);
  session.metadata.user_id = "alice";
  line.price.id = "price_wrong";
  await billing.applyBillingEvent!(event);
  expect(writes).toHaveLength(count);
});

test("checkout fixes the price on the server and reuses an open session for the same account and theme", async () => {
  const created: Record<string, unknown>[] = [];
  let priceAmount = 300;
  let open = false;
  const stripe = {
    prices: {
      retrieve: async () => ({
        id: "price_theme",
        active: true,
        type: "one_time",
        currency: "cad",
        unit_amount: priceAmount,
      }),
    },
    checkout: {
      sessions: {
        list: async (input: Record<string, unknown>) => {
          expect(input.customer).toBe("cus_alice");
          return {
            data: open
              ? [
                  {
                    url: "https://checkout.stripe.com/previous",
                    metadata: {
                      application: "tates-tv",
                      product: "theme",
                      theme_id: "midas-gold",
                    },
                  },
                ]
              : [],
          };
        },
        create: async (input: Record<string, unknown>) => {
          created.push(input);
          return { url: "https://checkout.stripe.com/test" };
        },
      },
    },
  };
  const load = () =>
    serverModule(
      "lib/server/billing.ts",
      {
        stripe: {
          default: class {
            constructor() {
              return stripe;
            }
          },
        },
        "./supabaseAdmin": {},
        "./accountData": {
          ensureAccount: async () => ({ stripe_customer_id: "cus_alice" }),
        },
        "./accountAuth": { accountOrigin: () => "https://www.tatestv.ca" },
        "../accountModel": model,
        "../themes": themes,
      },
      {
        NEXT_PUBLIC_THEME_BILLING_ENABLED: "true",
        STRIPE_SECRET_KEY: "sk_test_synthetic",
        STRIPE_WEBHOOK_SECRET: "whsec_synthetic",
        STRIPE_THEME_PRICE_ID: "price_theme",
      },
    );
  const billing = load();
  const membershipResult = await billing.createCheckout!(
    { id: "alice" }, "membership", undefined, "request_one",
  ).then(() => null, (error: Error) => error.message);
  expect(membershipResult).toContain("not available");
  await billing.createCheckout!(
    { id: "alice" },
    "theme",
    "midas-gold",
    "request_two",
  );
  expect(created[0]).toMatchObject({
    customer: "cus_alice",
    mode: "payment",
    line_items: [{ price: "price_theme", quantity: 1 }],
    client_reference_id: "alice",
    metadata: { user_id: "alice", theme_id: "midas-gold" },
  });
  open = true;
  expect(
    await billing.createCheckout!(
      { id: "alice" },
      "theme",
      "midas-gold",
      "request_three",
    ),
  ).toBe("https://checkout.stripe.com/previous");
  expect(created).toHaveLength(1);
  priceAmount = 1;
  expect(await load().commerceCatalog!().then(() => null, (error: Error) => error.message)).toContain("configuration");
});
