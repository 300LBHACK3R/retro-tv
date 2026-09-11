import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import type { sendPlaybackSample } from "../lib/playbackTelemetry";

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
