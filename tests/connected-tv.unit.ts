import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { serverModule, jsonRequest } from "./server-harness";
import { defaults } from "../lib/profiles";
import { buildLibrary } from "../lib/libraryCatalog";
import { viewerCatalog } from "../lib/audience";
import { isThemeId } from "../lib/themes";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const first = "33333333-3333-4333-8333-333333333333";
const second = "44444444-4444-4444-8444-444444444444";
test("cloud progress orders retries, permits backward seeks and rejects stale writes from another screen", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);");
    await db.exec(readFileSync("supabase/migrations/20261116014623_connected_tv_experience.sql", "utf8"));
    await db.query("insert into auth.users values ($1),($2)", [alice, bob]);
    await db.exec("set role service_role");
    const save = async (playback: string, revision: number, sequence: number, position: number, profile = "main") => (await db.query<{ result: { accepted: boolean; entry: { revision: number; position: number } } }>("select ttv_save_progress($1,$2,'episode', $3,600,$4,$5,$6) as result", [alice, profile, position, revision, playback, sequence])).rows[0]!.result;
    expect((await save(first, 0, 1, 120)).accepted).toBe(true);
    expect((await save(first, 0, 2, 60)).entry.position).toBe(60); // intentional rewind
    expect((await save(first, 0, 1, 120)).entry.position).toBe(60); // delayed old retry
    expect((await save(second, 1, 1, 300)).accepted).toBe(false);
    expect((await save(second, 2, 1, 300)).accepted).toBe(true);
    expect((await save(first, 2, 3, 80)).accepted).toBe(false);
    expect((await save(second, 3, 2, 600)).entry.position).toBe(600);
    expect((await save(first, 0, 1, 20, "kids")).entry.position).toBe(20);
    const touch = async (user = alice) => (await db.query<{ ok: boolean }>("select ttv_touch_device($1,$2,'roku','Living room') ok", [user, first])).rows[0]!.ok;
    expect(await touch()).toBe(true);
    await db.query("update ttv_account_devices set name='Renamed TV',revoked_at=now() where session_id=$1", [first]);
    expect(await touch()).toBe(false);
    expect(await touch(bob)).toBe(false);
    expect((await db.query("select name from ttv_account_devices")).rows).toEqual([{ name: "Renamed TV" }]);
    await db.query("select ttv_record_service_event('roku','playback','video_error','episode')");
    await db.query("select ttv_record_service_event('roku','playback','video_error','episode')");
    expect((await db.query("select count,last_seen_at is not null as recent from ttv_service_events")).rows).toEqual([{ count: 2, recent: true }]);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`reset role; set role ${role}`);
      for (const table of ["ttv_profile_progress", "ttv_account_devices", "ttv_service_events", "ttv_media_checks"]) await expect(db.query(`select * from ${table}`)).rejects.toThrow(/permission denied/);
      await expect(touch()).rejects.toThrow(/permission denied/);
      await expect(save(first, 0, 1, 20)).rejects.toThrow(/permission denied/);
    }
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [alice]);
    expect((await db.query("select * from ttv_profile_progress")).rows).toHaveLength(0);
    expect((await db.query("select * from ttv_account_devices")).rows).toHaveLength(0);
  } finally { await db.close(); }
});
test("TV profile grants bind the verified identity, session, profile and current parent PIN", () => {
  const devices = serverModule("lib/server/accountDevices.ts", { "./supabaseAdmin": {} });
  const viewing = serverModule("lib/server/accountViewing.ts", {
    "../profiles": { defaults }, "../libraryCatalog": { buildLibrary }, "../audience": { viewerCatalog }, "../themes": { isThemeId },
    "./accountData": {}, "./supabaseAdmin": {}, "./stationHealth": {}, "./accountDevices": devices,
  }, { SUPABASE_SERVICE_ROLE_KEY: "test-only-signing-key" });
  const token = (id: string, session: string) => `header.${Buffer.from(JSON.stringify({ sub: id, session_id: session })).toString("base64url")}.signature`;
  const view = { user: { id: alice }, profileLimit: 5, household: { profiles: defaults, pin: { salt: "salt", hash: "hash" } } };
  const grant = viewing.viewingGrant!(view, token(alice, first), "main");
  expect(viewing.validViewingGrant!(grant, view, token(alice, first), "main")).toBe(true);
  expect(viewing.validViewingGrant!(grant + "x", view, token(alice, first), "main")).toBe(false);
  expect(viewing.validViewingGrant!(grant, view, token(alice, second), "main")).toBe(false);
  expect(viewing.validViewingGrant!(grant, view, token(alice, first), "kids")).toBe(false);
  expect(viewing.validViewingGrant!(grant, { ...view, user: { id: bob } }, token(bob, first), "main")).toBe(false);
  expect(viewing.validViewingGrant!(grant, { ...view, household: { profiles: defaults, pin: null } }, token(alice, first), "main")).toBe(false);
  expect(viewing.validViewingGrant!(grant, { ...view, household: { ...view.household, profiles: [{ id: "main", kids: true }] } }, token(alice, first), "main")).toBe(false);
  expect(devices.verifiedSessionId!(token(bob, first), alice)).toBeNull();
  expect(devices.verifiedSessionId!("invalid", alice)).toBeNull();
});
test("web viewing rejects an old tab writing under a new account and keeps reads private", async () => {
  let writes = 0;
  const http = serverModule("lib/server/http.ts");
  const route = serverModule("app/api/account/viewing/route.ts", {
    "@/lib/server/http": http,
    "@/lib/server/accountAuth": { accountMutationGuard: async () => null, verifiedAccount: async () => ({ user: { id: alice } }) },
    "@/lib/server/accountData": { accountView: async () => ({}) },
    "@/lib/server/accountViewing": { ViewingError: Error, readViewing: async () => ({ progress: {} }), mutateViewing: async () => { writes++; return {}; } },
  });
  expect((await route.POST!(jsonRequest("/api/account/viewing", { ownerId: bob }))).status).toBe(409);
  expect(writes).toBe(0);
  const response = await route.GET!(new Request("https://www.tatestv.ca/api/account/viewing?profile=main"));
  expect(response.headers.get("cache-control")).toContain("no-store");
});
