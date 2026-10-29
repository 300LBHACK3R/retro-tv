import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import {
  allowedThemeIds,
  sanitizeHousehold,
  validateHouseholdAccess,
  validPassword,
} from "../lib/accountModel";
import { THEMES } from "../lib/themes";

test("account preferences reject invalid data, retain only bounded profile fields, and isolate theme grants", () => {
  expect(validPassword("short")).toBe(false);
  expect(validPassword("a long memorable passphrase")).toBe(true);
  expect(validPassword("x".repeat(129))).toBe(false);
  expect(
    sanitizeHousehold({ profiles: [], pin: { salt: "bad", hash: "bad" } }),
  ).toBeNull();
  expect(
    sanitizeHousehold({ profiles: Array.from({ length: 11 }, () => ({})) }),
  ).toBeNull();
  const clean = sanitizeHousehold({
    profiles: [
      {
        id: "main",
        name: "Parent",
        kids: true,
        avatar: "sun",
        theme: "midas-gold",
        admin: true,
      },
    ],
    library: {
      main: { favouriteChannels: ["1", "1", 123], watchlist: ["show:one"] },
      stranger: { favouriteChannels: ["24"] },
    },
    ownedThemeIds: ["midas-gold"],
    member: true,
  })!;
  expect(clean.profiles[0]).toEqual({
    id: "main",
    name: "Parent",
    kids: false,
    avatar: "sun",
    theme: "midas-gold",
  });
  expect(clean.library).toEqual({
    main: { favouriteChannels: ["1"], watchlist: ["show:one"] },
  });
  expect(clean).not.toHaveProperty("ownedThemeIds");
  expect(clean).not.toHaveProperty("member");
  const free = allowedThemeIds([], false);
  expect(free).toEqual(
    THEMES.filter((theme) => !theme.isPremium).map((theme) => theme.id),
  );
  expect(validateHouseholdAccess(clean, null, free, 5, true)).toContain(
    "purchase",
  );
  expect(
    validateHouseholdAccess(
      clean,
      null,
      allowedThemeIds(["midas-gold"], false),
      5,
      true,
    ),
  ).toBeNull();
  expect(allowedThemeIds([], true)).toHaveLength(THEMES.length);
  // Expiration preserves the old choice but doesn't allow a new locked selection.
  expect(validateHouseholdAccess(clean, clean, free, 5, true)).toBeNull();
  expect(
    validateHouseholdAccess(
      {
        ...clean,
        profiles: [{ ...clean.profiles[0]!, theme: "obsidian-gold" }],
      },
      clean,
      free,
      5,
      true,
    ),
  ).toContain("purchase");
  const ten = sanitizeHousehold({
    profiles: [
      { id: "main", name: "Main" },
      ...Array.from({ length: 9 }, (_, index) => ({
        id: `p-${index}`,
        name: `P${index}`,
      })),
    ],
  })!;
  expect(validateHouseholdAccess(ten, null, free, 5, true)).toContain(
    "5 profiles",
  );
  expect(validateHouseholdAccess(ten, null, free, 10, true)).toBeNull();
  expect(validateHouseholdAccess(ten, ten, free, 5, true)).toBeNull();
});

test("account entrance themes are bounded preferences and cannot grant paid access", () => {
  const baseline = sanitizeHousehold({ profiles: [{ id: "main", name: "Parent" }], entranceTheme: "christmas-neon-noel" })!;
  expect(baseline.entranceTheme).toBe("christmas-neon-noel");
  expect(sanitizeHousehold({ ...baseline, entranceTheme: "unknown" })).not.toHaveProperty("entranceTheme");
  const free = allowedThemeIds([], false);
  expect(validateHouseholdAccess(baseline, null, free, 5, true)).toBeNull();
  const locked = { ...baseline, entranceTheme: "midas-gold" as const };
  expect(validateHouseholdAccess(locked, baseline, free, 5, true)).toContain("purchase");
  expect(validateHouseholdAccess(locked, locked, free, 5, true)).toBeNull();
  expect(validateHouseholdAccess(locked, baseline, allowedThemeIds(["midas-gold"], false), 5, true)).toBeNull();
});

test("Postgres enforces private account tables, atomic rate limits, payment replay protection and event ordering", async () => {
  test.setTimeout(60_000);
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);",
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20261026194109_accounts_and_billing.sql",
        "utf8",
      ),
    );
    const user = "11111111-1111-4111-8111-111111111111";
    await db.query("insert into auth.users(id) values ($1)", [user]);
    await db.query("insert into public.ttv_accounts(user_id) values ($1)", [
      user,
    ]);
    await db.exec("set role authenticated");
    await expect(db.query("select * from public.ttv_accounts")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.query(
        "insert into public.ttv_theme_orders values ('fake',null,'midas-gold','fake','paid',1,now())",
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query("select public.ttv_apply_billing_event('fake',1,null,null)"),
    ).rejects.toThrow(/permission denied/);
    await db.exec("reset role; set role service_role");
    for (let index = 0; index < 4; index++) {
      const result = await db.query<{ allowed: boolean }>(
        "select public.ttv_account_rate_limit('test',3,900) as allowed",
      );
      expect(result.rows[0]!.allowed).toBe(index < 3);
    }
    const order = {
      session_id: "cs_test_one",
      user_id: user,
      theme_id: "midas-gold",
      payment_intent_id: "pi_test_one",
      status: "paid",
    };
    const apply = (id: string, time: number, status: string) =>
      db.query<{ applied: boolean }>(
        "select public.ttv_apply_billing_event($1,$2,$3::jsonb,null) as applied",
        [id, time, JSON.stringify({ ...order, status })],
      );
    expect((await apply("evt_paid", 100, "paid")).rows[0]!.applied).toBe(true);
    expect((await apply("evt_paid", 100, "paid")).rows[0]!.applied).toBe(false);
    await apply("evt_refunded", 200, "refunded");
    await apply("evt_old", 150, "paid");
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.ttv_theme_orders",
        )
      ).rows,
    ).toEqual([{ status: "refunded" }]);
    // A failed transaction must not consume the receipt: Stripe can retry later.
    await expect(apply("evt_invalid", 300, "invented")).rejects.toThrow();
    expect(
      (
        await db.query(
          "select * from public.ttv_billing_events where event_id='evt_invalid'",
        )
      ).rows,
    ).toHaveLength(0);
    await apply("evt_invalid", 300, "disputed");
    const member = {
      subscription_id: "sub_one",
      user_id: user,
      status: "active",
      paid: true,
      current_period_end: "2026-12-01T06:00:00Z",
    };
    await db.query(
      "select public.ttv_apply_billing_event('evt_member',400,null,$1::jsonb)",
      [JSON.stringify(member)],
    );
    await db.query(
      "select public.ttv_apply_billing_event('evt_cancel',500,null,$1::jsonb)",
      [JSON.stringify({ ...member, status: "canceled" })],
    );
    await db.query(
      "select public.ttv_apply_billing_event('evt_late',450,null,$1::jsonb)",
      [JSON.stringify(member)],
    );
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.ttv_memberships",
        )
      ).rows[0]!.status,
    ).toBe("canceled");
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [user]);
    expect(
      (await db.query("select * from public.ttv_accounts")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query<{ user_id: string | null }>(
          "select user_id from public.ttv_theme_orders",
        )
      ).rows[0]!.user_id,
    ).toBeNull();
  } finally {
    await db.close();
  }
});
