import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as analyticsEvents from "../lib/analyticsEvents";

// Execute server-only modules in Node with controlled framework boundaries.
// Their actual request parsing and signature code runs unchanged.
function serverModule(file: string, imports: Record<string, unknown> = {}) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports: Record<string, (...args: any[]) => any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  const nodeRequire = createRequire(process.cwd() + "/package.json");
  vm.runInNewContext(output, {
    exports,
    require: (name: string) =>
      name === "server-only" ? {} : (imports[name] ?? nodeRequire(name)),
    process: {
      env: {
        NODE_ENV: "production",
        ADMIN_SESSION_SECRET: "synthetic-test-key-not-a-production-secret",
      },
    },
    Request,
    Response,
    URL,
    TextDecoder,
    Uint8Array,
    Buffer,
    Date,
    Map,
  });
  return exports;
}

test("analytics ingestion requires a same-origin signed session and stores only allowlisted dimensions", async () => {
  const writes: unknown[] = [];
  let signed = true;
  const http = serverModule("lib/server/http.ts");
  const security = serverModule("lib/server/requestSecurity.ts");
  const route = serverModule("app/api/engagement/route.ts", {
    "@/lib/server/http": http,
    "@/lib/server/requestSecurity": security,
    "@/lib/analyticsEvents": analyticsEvents,
    "@/lib/server/viewerSession": {
      getViewerSession: async () =>
        signed
          ? { id: "6406ea15-c50f-4b79-bec0-538adcc52f11", returning: true }
          : null,
    },
    "@/lib/server/supabaseAdmin": {
      createSupabaseAdminClient: () => ({
        rpc: async (_name: string, values: unknown) => {
          writes.push(values);
          return { error: null };
        },
      }),
    },
  });
  const event = {
    id: "7406ea15-c50f-4b79-bec0-538adcc52f11",
    name: "page_view",
    path: "/",
    detail: "",
    source: "direct",
    value: 0,
  };
  const request = (events: unknown[], headers: Record<string, string> = {}) =>
    new Request("https://tatestv.ca/api/engagement", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://tatestv.ca",
        "user-agent": "Mozilla/5.0 (iPhone) Mobile Safari/604.1",
        ...headers,
      },
      body: JSON.stringify({ type: "events", events }),
    });
  const privacyHeaders: Record<string, string>[] = [
    { origin: "https://evil.test" },
    { dnt: "1" },
    { "sec-gpc": "1" },
  ];
  for (const headers of privacyHeaders)
    expect((await route.POST!(request([event], headers))).status).toBe(403);
  signed = false;
  expect((await route.POST!(request([event]))).status).toBe(401);
  signed = true;
  for (const events of [
    [],
    Array(11).fill(event),
    [{ ...event, profileName: "private" }],
    [{ ...event, path: "/admin" }],
  ])
    expect((await route.POST!(request(events))).status).toBe(400);
  expect(writes).toHaveLength(0);
  expect((await route.POST!(request([event]))).status).toBe(200);
  expect(writes).toEqual([
    {
      viewer_id: "6406ea15-c50f-4b79-bec0-538adcc52f11",
      returning_viewer: true,
      event_batch: [event],
      browser_name: "Safari",
      device_type: "Phone",
    },
  ]);
});

test("JSON input limits actual bytes, rejects invalid UTF-8 and handles chunked requests", async () => {
  const { readBoundedJson } = serverModule("lib/server/http.ts");
  const request = (body: BodyInit) =>
    new Request("https://tatestv.ca/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit);
  expect(await readBoundedJson!(request('{"ok":true}'), 100)).toEqual({
    ok: true,
  });
  expect(
    await readBoundedJson!(request('{"data":"' + "x".repeat(2000) + '"}'), 100),
  ).toBeNull();
  expect(
    await readBoundedJson!(request(new Uint8Array([0xff, 0xfe])), 100),
  ).toBeNull();
  expect(await readBoundedJson!(request("invalid"), 100)).toBeNull();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(" ".repeat(100)));
      controller.enqueue(new TextEncoder().encode(" ".repeat(100)));
      controller.close();
    },
  });
  expect(await readBoundedJson!(request(stream), 150)).toBeNull();
});

test("production mutations reject cross-origin and same-site sibling requests", () => {
  const { isSameOriginRequest, consumeRateLimit } = serverModule(
    "lib/server/requestSecurity.ts",
  );
  const request = (headers: HeadersInit) =>
    new Request("https://tatestv.ca/api/admin/programming", { headers });
  expect(isSameOriginRequest!(request({ origin: "https://tatestv.ca" }))).toBe(
    true,
  );
  expect(
    isSameOriginRequest!(request({ origin: "https://evil.example" })),
  ).toBe(false);
  expect(
    isSameOriginRequest!(
      request({
        origin: "https://evil.example",
        "x-forwarded-host": "evil.example",
      }),
    ),
  ).toBe(false);
  expect(
    isSameOriginRequest!(
      new Request("https://localhost:3100/api/test", {
        headers: { host: "127.0.0.1:3100", origin: "https://127.0.0.1:3100" },
      }),
    ),
  ).toBe(true);
  expect(isSameOriginRequest!(request({ "sec-fetch-site": "same-site" }))).toBe(
    false,
  );
  expect(
    isSameOriginRequest!(request({ "sec-fetch-site": "same-origin" })),
  ).toBe(true);
  expect(isSameOriginRequest!(request({}))).toBe(false);
  for (let i = 0; i < 8; i++)
    expect(
      consumeRateLimit!({ key: "test", limit: 8, windowMs: 60000 }).allowed,
    ).toBe(true);
  expect(
    consumeRateLimit!({ key: "test", limit: 8, windowMs: 60000 }).allowed,
  ).toBe(false);
});

test("viewer identity is signed, private and cannot be replaced with a forged token", async () => {
  let token = "";
  let attributes: Record<string, unknown> = {};
  const { getViewerSession } = serverModule("lib/server/viewerSession.ts", {
    "next/headers": {
      cookies: async () => ({
        get: () => ({ value: token }),
        set: (
          _name: string,
          value: string,
          options: Record<string, unknown>,
        ) => {
          token = value;
          attributes = options;
        },
      }),
    },
  });
  expect(await getViewerSession!()).toBeNull();
  const created = await getViewerSession!(true);
  expect(created.id).toMatch(/^[a-f0-9-]{36}$/);
  expect(attributes).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 30 * 86400,
  });
  expect(await getViewerSession!()).toEqual(created);
  token = "00000000-0000-4000-8000-000000000000" + token.slice(36);
  expect(await getViewerSession!()).toBeNull();
});
