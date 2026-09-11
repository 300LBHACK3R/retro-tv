import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:https";
import { setTimeout as delay } from "node:timers/promises";

const origin = "https://127.0.0.1:3100";
function get(path, method = "GET", headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request(
      origin + path,
      { method, headers, rejectUnauthorized: false },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body }),
        );
      },
    );
    req.on("error", reject);
    req.setTimeout(8000, () =>
      req.destroy(new Error("Test request timed out")),
    );
    req.end();
  });
}
const server = spawn(process.execPath, ["tests/https-server.mjs"], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    ADMIN_PASSWORD: "synthetic-test-password",
    ADMIN_SESSION_SECRET: "synthetic-test-signing-secret-for-local-tests",
    SUPABASE_URL: "https://invalid.test",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-not-a-service-key",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (value) => (serverLog += value));
server.stderr.on("data", (value) => (serverLog += value));
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Test server exited: " + serverLog);
    try {
      ready = (await get("/api/health")).status === 200;
    } catch {}
    if (ready) break;
    await delay(500);
  }
  assert.ok(ready, "Production server starts");
  for (const path of ["/", "/library", "/tv", "/help", "/privacy"]) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    const canonical = response.body.match(
      /<link[^>]*rel="canonical"[^>]*href="([^"]+)"/i,
    )?.[1];
    assert.ok(canonical, `${path}: canonical exists`);
    assert.equal(
      new URL(canonical).pathname,
      path,
      `${path}: correct canonical`,
    );
    assert.ok(
      response.headers["content-security-policy"].includes("object-src 'none'"),
    );
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.ok(!response.headers["x-powered-by"]);
  }
  for (const path of [
    "/admin",
    "/backup",
    "/recovery",
    "/readiness",
    "/health",
    "/launch",
  ]) {
    const response = await get(path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers["x-robots-tag"], /noindex/);
    assert.match(response.headers["cache-control"], /no-store/);
  }
  for (const path of ["/api/admin/station", "/api/admin/programming"]) {
    const response = await get(
      path,
      path.endsWith("/programming") ? "PUT" : "GET",
      { Origin: origin },
    );
    assert.equal(response.status, 401, path);
    assert.match(response.headers["cache-control"], /no-store/);
  }
  assert.equal(
    (
      await get("/api/admin/login", "POST", {
        Origin: "https://untrusted.test",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await get("/api/engagement", "GET", {
        "sec-fetch-site": "same-origin",
        DNT: "1",
      })
    ).status,
    403,
  );
  const sitemap = await get("/sitemap.xml");
  assert.ok(sitemap.body.includes("/library"));
  assert.ok(!sitemap.body.includes("/admin"));
  console.log(
    "PASS: production public routes, canonical metadata, security headers, private cache rules, admin authorization, cross-origin rejection and analytics opt-out.",
  );
} finally {
  server.kill("SIGTERM");
}
