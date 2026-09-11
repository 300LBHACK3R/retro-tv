import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import type { sendPlaybackSample } from "../lib/playbackTelemetry";

test("hidden pages defer new analytics sessions and preserve established delivery", async () => {
  const code = ts.transpileModule(
    readFileSync("lib/playbackTelemetry.ts", "utf8"),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    },
  ).outputText;
  const document = { visibilityState: "hidden" };
  const requests: RequestInit[] = [];
  const exports = {} as { sendPlaybackSample: typeof sendPlaybackSample };
  vm.runInNewContext(code, {
    exports,
    navigator: {},
    document,
    crypto,
    fetch: async (_url: string, options: RequestInit) => {
      requests.push(options);
      return new Response(null, { status: 200 });
    },
  });
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
  expect(await exports.sendPlaybackSample(sample)).toBe(false);
  expect(requests).toHaveLength(0);
  document.visibilityState = "visible";
  expect(await exports.sendPlaybackSample(sample)).toBe(true);
  expect(requests).toHaveLength(2);
  document.visibilityState = "hidden";
  expect(await exports.sendPlaybackSample(sample)).toBe(true);
  expect(requests).toHaveLength(3);
  expect(requests[2]?.method).toBe("POST");
  for (const request of requests)
    expect(request).toMatchObject({
      mode: "same-origin",
      keepalive: true,
      credentials: "same-origin",
    });
});

test("unavailable analytics stops collection without rejecting or retrying", async () => {
  const code = ts.transpileModule(
    readFileSync("lib/playbackTelemetry.ts", "utf8"),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    },
  ).outputText;
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
  for (const failure of ["unavailable", "network"] as const) {
    let requests = 0;
    const exports = {} as { sendPlaybackSample: typeof sendPlaybackSample };
    vm.runInNewContext(code, {
      exports,
      navigator: {},
      document: { visibilityState: "visible" },
      fetch: async () => {
        requests += 1;
        if (failure === "network") throw new TypeError("Load failed");
        return new Response(null, { status: 503 });
      },
    });
    expect(await exports.sendPlaybackSample(sample)).toBe(false);
    expect(await exports.sendPlaybackSample(sample)).toBe(false);
    expect(requests).toBe(1);
  }
});
