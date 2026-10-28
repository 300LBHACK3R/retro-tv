import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { serverModule, jsonRequest } from "./server-harness";
import * as model from "../lib/showRequests";

const http = serverModule("lib/server/http.ts");
const security = serverModule("lib/server/requestSecurity.ts");
test("show requests validate bounded input and cannot accept a forged status or member identity", () => {
  expect(model.parseShowRequest({ title: "  The   Show ", releaseYear: "1996", seasons: "Season 1", details: "A favourite", member: true, user_id: "other", status: "added" }))
    .toEqual({ title: "The Show", release_year: 1996, seasons: "Season 1", details: "A favourite" });
  for (const input of [null, {}, { title: "x" }, { title: "x".repeat(161) }, { title: "Show", releaseYear: 1800 }, { title: "Show", details: "x".repeat(1001) }, { title: "Show\u0000" }]) expect(model.parseShowRequest(input)).toBeNull();
  expect(model.isRequestStatus("toString")).toBe(false);
  expect(model.requestPage("-1")).toBe(0);
});

test("database gates paid access, prevents duplicate retries and enforces the open quota", async () => {
  test.setTimeout(60000);
  const db = new PGlite();
  const alice = "11111111-1111-4111-8111-111111111111";
  const bob = "22222222-2222-4222-8222-222222222222";
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);");
    await db.exec(readFileSync("supabase/migrations/20261026194109_accounts_and_billing.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261028232229_member_show_requests.sql", "utf8"));
    await db.query("insert into auth.users values ($1),($2)", [alice, bob]);
    await db.query("insert into public.ttv_accounts(user_id) values ($1),($2)", [alice, bob]);
    const submit = (user: string, title = "The Show") => db.query<{ result: { id: string; duplicate: boolean } }>("select public.ttv_submit_show_request($1,$2,1996,'Season 1','Details') as result", [user, title]);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await expect(db.query("select * from public.ttv_show_requests")).rejects.toThrow(/permission denied/);
      await expect(submit(alice)).rejects.toThrow(/permission denied/);
      await expect(db.query("update public.ttv_show_requests set status='added'")).rejects.toThrow(/permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    await expect(submit(alice)).rejects.toThrow(/membership_required/);
    await db.query("insert into public.ttv_memberships values ('sub_a',$1,'active',false,now()+interval '30 days',1,now())", [alice]);
    await expect(submit(alice)).rejects.toThrow(/membership_required/);
    await db.exec("update public.ttv_memberships set paid=true,current_period_end=now()-interval '1 second'");
    await expect(submit(alice)).rejects.toThrow(/membership_required/);
    await db.exec("update public.ttv_memberships set current_period_end=now()+interval '30 days'");
    const first = (await submit(alice)).rows[0]!.result;
    expect(first.duplicate).toBe(false);
    expect((await submit(alice, "  THE   SHOW ")).rows[0]!.result).toEqual({ id: first.id, duplicate: true });
    await expect(submit(bob)).rejects.toThrow(/membership_required/);
    for (let i = 0; i < 4; i++) await submit(alice, `Show ${i}`);
    await expect(submit(alice, "A sixth show")).rejects.toThrow(/request_limit/);
    // Retrying an existing title succeeds even when all five slots are full.
    expect((await submit(alice)).rows[0]!.result.duplicate).toBe(true);
    await db.query("update public.ttv_show_requests set status='added',admin_notes='Private',member_reply='Now available' where id=$1", [first.id]);
    await submit(alice, "A sixth show");
    expect((await db.query("select id from public.ttv_show_requests")).rows).toHaveLength(6);
    await db.exec("update public.ttv_memberships set paid=false");
    await expect(submit(alice, "Refunded access")).rejects.toThrow(/membership_required/);
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [alice]);
    expect((await db.query("select id from public.ttv_show_requests")).rows).toHaveLength(0);
  } finally { await db.close(); }
});

test("member API scopes reads to the verified account, hides private notes and rejects unsigned submissions", async () => {
  let user: { id: string } | null = null;
  let member = false;
  let rpcCalls = 0;
  const filters: unknown[][] = [];
  const query = {
    select: (columns: string) => { expect(columns).not.toContain("admin_notes"); expect(columns).not.toContain("user_id"); return query; },
    eq: (...args: unknown[]) => { filters.push(args); return query; },
    order: () => query,
    range: async () => ({ data: [], count: 0, error: null }),
  };
  const api = serverModule("app/api/account/show-requests/route.ts", {
    "@/lib/server/accountAuth": { accountsEnabled: () => true, verifiedAccount: async () => ({ user }), accountMutationGuard: async (request: Request) => security.isSameOriginRequest!(request) ? null : http.privateJson!({}, 403) },
    "@/lib/server/supabaseAdmin": { createSupabaseAdminClient: () => ({ from: () => query, rpc: async (_: string, args: Record<string, unknown>) => {
      rpcCalls++; expect(args.requester).toBe("alice"); expect(args).not.toHaveProperty("status");
      return member ? { data: { id: "id", duplicate: false }, error: null } : { error: { message: "membership_required" } };
    } }) },
    "@/lib/server/http": http, "@/lib/showRequests": model,
  });
  expect((await api.GET!(new Request("https://www.tatestv.ca/api/account/show-requests"))).status).toBe(401);
  expect((await api.POST!(jsonRequest("/api/account/show-requests", { title: "The Show" }))).status).toBe(401);
  expect(rpcCalls).toBe(0);
  user = { id: "alice" };
  const response = await api.GET!(new Request("https://www.tatestv.ca/api/account/show-requests?user_id=bob"));
  expect(response.status).toBe(200); expect(filters).toEqual([["user_id", "alice"]]);
  expect(response.headers.get("cache-control")).toContain("private, no-store");
  const input = { title: "The Show", member: true, user_id: "bob", status: "added" };
  expect((await api.POST!(jsonRequest("/api/account/show-requests", input))).status).toBe(403);
  member = true;
  expect((await api.POST!(jsonRequest("/api/account/show-requests", input))).status).toBe(200);
  expect((await api.POST!(jsonRequest("/api/account/show-requests", input, "POST", "https://evil.example"))).status).toBe(403);
  expect(rpcCalls).toBe(2);
});

test("admin request updates require admin auth, same origin and a matching version", async () => {
  let authorized = false;
  let conflict = false;
  let writes = 0;
  const filters: unknown[][] = [];
  const query = { update: () => { writes++; return query; }, eq: (...args: unknown[]) => { filters.push(args); return query; }, select: () => query, maybeSingle: async () => ({ error: null, data: conflict ? null : { id: "id" } }) };
  const api = serverModule("app/api/admin/show-requests/route.ts", {
    "@/lib/server/adminAuth": { isAdminRequestAuthorized: async () => authorized },
    "@/lib/server/requestSecurity": security, "@/lib/server/http": http, "@/lib/showRequests": model,
    "@/lib/server/supabaseAdmin": { createSupabaseAdminClient: () => ({ from: () => query }) },
  });
  const input = { id: "11111111-1111-4111-8111-111111111111", status: "added", memberReply: "Enjoy!", adminNotes: "Private", updatedAt: "2026-10-28T12:00:00.000Z" };
  expect((await api.PATCH!(jsonRequest("/api/admin/show-requests", input, "PATCH"))).status).toBe(401);
  authorized = true;
  expect((await api.PATCH!(jsonRequest("/api/admin/show-requests", input, "PATCH", "https://evil.example"))).status).toBe(403);
  expect(writes).toBe(0);
  expect((await api.PATCH!(jsonRequest("/api/admin/show-requests", input, "PATCH"))).status).toBe(200);
  expect(filters).toEqual([["id", input.id], ["updated_at", input.updatedAt]]);
  conflict = true;
  expect((await api.PATCH!(jsonRequest("/api/admin/show-requests", input, "PATCH"))).status).toBe(409);
});
