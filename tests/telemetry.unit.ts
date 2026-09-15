import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as events from "../lib/analyticsEvents";
import type * as client from "../lib/analyticsClient";
import type * as playback from "../lib/playbackTelemetry";

function telemetry(fetch: typeof globalThis.fetch) {
  const document = { visibilityState: "visible", referrer: "" };
  let allowed = true;
  const exports = {} as typeof client;
  const run = (
    file: string,
    output: object,
    imports: Record<string, unknown>,
  ) =>
    vm.runInNewContext(
      ts.transpileModule(readFileSync(file, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      {
        exports: output,
        require: (key: string) => imports[key],
        document,
        crypto,
        fetch,
        AbortController,
        window: {
          setTimeout,
          clearTimeout,
          location: { pathname: "/", origin: "https://www.tatestv.ca" },
        },
      },
    );
  run("lib/analyticsClient.ts", exports, {
    "./analyticsPrivacy": { analyticsAllowed: () => allowed },
    "./analyticsEvents": events,
    "./deviceProfiles": {
      useProfiles: { getState: () => ({ activeId: "main" }) },
    },
  });
  const player = {} as typeof playback;
  run("lib/playbackTelemetry.ts", player, { "./analyticsClient": exports });
  return {
    document,
    client: exports,
    player,
    exclude: () => {
      allowed = false;
    },
  };
}
const sample = {
  channelId: "24",
  mediaId: "test",
  mode: "live" as const,
  watchSeconds: 2,
  bufferSeconds: 0,
  starts: 1,
  errors: 0,
  startupMs: 100,
  reports: 0,
};

test("hidden pages defer new analytics sessions and preserve established delivery", async () => {
  const requests: RequestInit[] = [];
  const t = telemetry(async (_url, options) => {
    requests.push(options!);
    return new Response(null, { status: 200 });
  });
  t.document.visibilityState = "hidden";
  expect(await t.player.sendPlaybackSample(sample)).toBe(false);
  expect(requests).toHaveLength(0);
  t.document.visibilityState = "visible";
  expect(await t.player.sendPlaybackSample(sample)).toBe(true);
  t.document.visibilityState = "hidden";
  expect(await t.player.sendPlaybackSample(sample)).toBe(true);
  expect(requests).toHaveLength(3);
  expect(requests[2]).toMatchObject({
    method: "POST",
    keepalive: true,
    mode: "same-origin",
    credentials: "same-origin",
  });
});

test("unavailable analytics backs off without rejecting or immediately retrying", async () => {
  for (const failure of ["unavailable", "network"] as const) {
    let count = 0;
    const t = telemetry(async () => {
      count += 1;
      if (failure === "network") throw new TypeError("Load failed");
      return new Response(null, { status: 503 });
    });
    expect(await t.player.sendPlaybackSample(sample)).toBe(false);
    expect(await t.player.sendPlaybackSample(sample)).toBe(false);
    expect(count).toBe(1);
  }
});

test("privacy changes discard queued events and prevent playback samples", async () => {
  let count = 0;
  const t = telemetry(async () => {
    count += 1;
    return new Response(null, { status: 200 });
  });
  t.client.trackAnalytics("guide_open");
  t.exclude();
  await t.client.flushAnalytics();
  expect(await t.player.sendPlaybackSample(sample)).toBe(false);
  expect(count).toBe(0);
});

test("event batching preserves counts while bounding requests and payloads", async () => {
  const requests: RequestInit[] = [];
  const t = telemetry(async (_url, options) => {
    requests.push(options!);
    return new Response(null, { status: 200 });
  });
  for (let i = 0; i < 30; i++) t.client.trackAnalytics("guide_open");
  await t.client.flushAnalytics();
  expect(requests).toHaveLength(2);
  const batch = JSON.parse(String(requests[1]!.body));
  expect(batch.type).toBe("events");
  expect(batch.events).toHaveLength(10);
  expect(
    new Set(batch.events.map((event: { id: string }) => event.id)).size,
  ).toBe(10);
});
