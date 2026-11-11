import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { accountEmail } from "../lib/accountEmails";
import { serverModule, jsonRequest } from "./server-harness";

const migration = "supabase/migrations/20261111151806_account_welcome_emails.sql";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";

test("account email outbox queues once, isolates browser roles, leases work and stops uncertain old retries", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);");
    await db.exec(readFileSync("supabase/migrations/20261026194109_accounts_and_billing.sql", "utf8"));
    await db.query("insert into auth.users values ($1),($2)", [alice, bob]);
    await db.query("insert into public.ttv_accounts(user_id) values ($1)", [bob]);
    await db.exec(readFileSync(migration, "utf8"));
    expect((await db.query("select * from public.ttv_account_emails")).rows).toHaveLength(0); // no historic blast
    await db.exec("set role service_role");
    await db.query("insert into public.ttv_accounts(user_id) values ($1) on conflict do nothing", [alice]);
    await db.query("insert into public.ttv_accounts(user_id) values ($1) on conflict do nothing", [alice]);
    await db.query("insert into public.ttv_memberships values ('sub_one',$1,'incomplete',false,now()+interval '1 month',1,now())", [alice]);
    expect((await db.query("select kind from public.ttv_account_emails")).rows).toEqual([{ kind: "welcome" }]);
    await db.exec("update public.ttv_memberships set status='active',paid=true; update public.ttv_memberships set event_created=2; update public.ttv_memberships set status='canceled'; update public.ttv_memberships set status='active';");
    expect((await db.query("select kind from public.ttv_account_emails order by kind")).rows).toEqual([{ kind: "membership" }, { kind: "welcome" }]);
    expect((await db.query("select * from public.ttv_claim_account_emails($1,2)", [bob])).rows).toHaveLength(0);
    const claimed = await db.query<{ id: string; lease_token: string }>("select * from public.ttv_claim_account_emails($1,2)", [alice]);
    expect(claimed.rows).toHaveLength(2);
    expect((await db.query("select * from public.ttv_claim_account_emails($1,2)", [alice])).rows).toHaveLength(0);
    await db.query("update public.ttv_account_emails set lease_until=now()-interval '1 second' where id=$1", [claimed.rows[0]!.id]);
    const reclaimed = await db.query<{ lease_token: string }>("select * from public.ttv_claim_account_emails($1,2)", [alice]);
    expect(reclaimed.rows[0]!.lease_token).not.toBe(claimed.rows[0]!.lease_token);
    await db.exec("update public.ttv_account_emails set first_attempt_at=now()-interval '24 hours',lease_until=null");
    expect((await db.query("select * from public.ttv_claim_account_emails(null,2)")).rows).toHaveLength(0);
    expect((await db.query("select distinct status from public.ttv_account_emails")).rows).toEqual([{ status: "review" }]);
    await db.exec("reset role; set role authenticated");
    await expect(db.query("select * from public.ttv_account_emails")).rejects.toThrow(/permission denied/);
    await expect(db.query("select * from public.ttv_claim_account_emails(null,2)")).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [alice]);
    expect((await db.query("select * from public.ttv_account_emails")).rows).toHaveLength(0);
  } finally { await db.close(); }
});

function emailHarness() {
  const message = { id: "message-one", user_id: alice, kind: "welcome", subscription_id: null, payload: null as null | Record<string, unknown>, attempts: 1, lease_token: "lease-one", status: "pending" };
  const calls: { body: string; key: string }[] = [];
  let confirmed = true;
  let fail = false;
  let email = "alice@example.test";
  let member = true;
  const db = {
    rpc: async () => ({ data: [message], error: null }),
    auth: { admin: { getUserById: async () => ({ data: { user: { email, email_confirmed_at: confirmed ? "2026-11-11" : null } }, error: null }) } },
    from: (table: string) => {
      let update: Record<string, unknown> = {};
      const chain = {
        update: (values: Record<string, unknown>) => { update = values; return chain; },
        eq: () => chain,
        select: () => table === "ttv_memberships" ? chain : (Object.assign(message, update), Promise.resolve({ data: [{ id: message.id }], error: null })),
        maybeSingle: async () => ({ data: { status: member ? "active" : "canceled", paid: member, current_period_end: "2099-01-01" }, error: null }),
      };
      return chain;
    },
  };
  const worker = serverModule("lib/server/accountEmails.ts", {
    "../accountEmails": { accountEmail }, "../accountModel": { validEmail: (value: unknown) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) },
    "./supabaseAdmin": { createSupabaseAdminClient: () => db },
  }, { TTV_ACCOUNT_EMAILS_ENABLED: "true", RESEND_API_KEY: "synthetic-test-only", TTV_EMAIL_FROM: "Tate's TV <hello@example.test>" }, {
    console: { warn: () => {} },
    fetch: async (_url: string, init: RequestInit) => {
      calls.push({ body: String(init.body), key: (init.headers as Record<string, string>)["Idempotency-Key"]! });
      return new Response(JSON.stringify(fail ? { error: "no" } : { id: "email-one" }), { status: fail ? 503 : 200 });
    },
  });
  return { worker, message, calls, confirm: (v: boolean) => { confirmed = v; }, fail: (v: boolean) => { fail = v; }, email: (v: string) => { email = v; }, member: (v: boolean) => { member = v; } };
}

test("email retries keep the original payload and idempotency key; unverified or changed recipients and revoked memberships never send", async () => {
  const h = emailHarness();
  h.fail(true);
  expect((await h.worker.deliverAccountEmails!(alice)).accepted).toBe(0);
  expect(h.message.status).toBe("pending");
  expect(h.message.payload).toBeTruthy();
  h.fail(false);
  expect((await h.worker.deliverAccountEmails!(alice)).accepted).toBe(1);
  expect(h.message.status).toBe("accepted");
  expect(h.calls[0]).toEqual(h.calls[1]);
  h.email("changed@example.test");
  await h.worker.deliverAccountEmails!(alice);
  expect(h.message.status).toBe("canceled");
  expect(h.calls).toHaveLength(2);
  const unconfirmed = emailHarness();
  unconfirmed.confirm(false);
  await unconfirmed.worker.deliverAccountEmails!(alice);
  expect(unconfirmed.calls).toHaveLength(0);
  const canceled = emailHarness();
  canceled.message.kind = "membership";
  canceled.member(false);
  await canceled.worker.deliverAccountEmails!(alice);
  expect(canceled.calls).toHaveLength(0);
});

test("welcome email request binds to the signed-in account and rejects anonymous requests and a missing sender", async () => {
  let user: { id: string } | null = null;
  let ready = true;
  let queued: Record<string, unknown> | null = null;
  const scopes: unknown[] = [];
  const route = serverModule("app/api/account/welcome/route.ts", {
    "@/lib/server/accountAuth": { accountMutationGuard: async () => null, verifiedAccount: async () => ({ user }) },
    "@/lib/server/accountEmails": { accountEmailConfiguration: () => ({ enabled: true, ready }), deliverAccountEmails: async (id: string) => { scopes.push(id); } },
    "@/lib/server/http": { privateJson: (v: unknown, status = 200) => Response.json(v, { status }) },
    "@/lib/server/supabaseAdmin": { createSupabaseAdminClient: () => ({ from: () => {
      const chain = {
        select: () => chain, eq: (_key: string, value: string) => { scopes.push(value); return chain; }, gt: () => chain,
        order: () => chain, limit: () => chain,
        maybeSingle: async () => ({ data: { subscription_id: "sub_alice" }, error: null }),
        single: async () => ({ data: { status: "accepted" }, error: null }),
        upsert: async (v: Record<string, unknown>) => { queued = v; return { error: null }; },
      }; return chain;
    } }) },
  });
  const req = () => jsonRequest("/api/account/welcome", { email: "stranger@example.test", user_id: bob, kind: "welcome" });
  expect((await route.POST!(req())).status).toBe(401);
  user = { id: alice }; ready = false;
  expect((await route.POST!(req())).status).toBe(503);
  ready = true;
  expect((await route.POST!(req())).status).toBe(200);
  expect(queued).toEqual({ user_id: alice, kind: "membership", dedupe_key: "membership:sub_alice", subscription_id: "sub_alice" });
  expect(scopes).not.toContain(bob);
});

test("scheduled email retries require the configured bearer secret", async () => {
  let calls = 0;
  const imports = {
    "@/lib/server/accountEmails": { deliverAccountEmails: async () => { calls++; return { accepted: 0 }; } },
    "@/lib/server/http": { privateJson: (v: unknown, status = 200) => Response.json(v, { status }) },
  };
  const disabled = serverModule("app/api/internal/account-emails/route.ts", imports);
  const handler = serverModule("app/api/internal/account-emails/route.ts", imports, { CRON_SECRET: "synthetic-cron-secret" });
  const req = (authorization: string) => new Request("https://www.tatestv.ca/api/internal/account-emails", { headers: { authorization } });
  expect((await disabled.GET!(req("Bearer "))).status).toBe(401);
  expect((await handler.GET!(req("Bearer wrong"))).status).toBe(401);
  expect(calls).toBe(0);
  expect((await handler.GET!(req("Bearer synthetic-cron-secret"))).status).toBe(200);
  expect(calls).toBe(1);
});

test("transactional emails include plain text, branded buttons and truthful membership terms", () => {
  const welcome = accountEmail("welcome");
  const membership = accountEmail("membership");
  expect(welcome.text).toContain("Your email is confirmed");
  expect(membership.text).toContain("renews automatically");
  expect(membership.html).toContain("up to 10 profiles");
  for (const mail of [welcome, membership]) {
    expect(mail.html).toContain('href="https://www.tatestv.ca/tv"');
    expect(mail.html).toContain('alt="Tate\'s TV"');
    expect(mail.text).toContain("doesn't subscribe you to marketing emails");
    expect(mail.html).not.toMatch(/<script|<form|token_hash|utm_/);
    expect(Buffer.byteLength(mail.html)).toBeLessThan(65536);
  }
});
