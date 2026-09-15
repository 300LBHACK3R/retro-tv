import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request } from "node:https";
import { setTimeout as delay } from "node:timers/promises";
import { assertProfileStyles, assertHalloweenStyles, stylesheetPaths } from "./styles.mjs";

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
  const stylesheetResponses = new Map();
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
    if (["/", "/library", "/tv"].includes(path)) {
      const styles = [];
      for (const asset of stylesheetPaths(response.body)) {
        if (!stylesheetResponses.has(asset))
          stylesheetResponses.set(asset, await get(asset));
        const stylesheet = stylesheetResponses.get(asset);
        assert.equal(
          stylesheet.status,
          200,
          `${path}: stylesheet is available`,
        );
        assert.match(
          stylesheet.headers["content-type"],
          /^text\/css\b/,
          `${path}: correct stylesheet MIME type`,
        );
        styles.push(stylesheet.body);
      }
      assertProfileStyles(styles.join("\n"), `HTTP ${path}`);
      assertHalloweenStyles(styles.join("\n"), `HTTP ${path}`);
    }
  }
  for (const name of ["fox", "explorer", "dinosaur", "robot", "cat"]) {
    const portrait = await get(`/avatars/${name}.png`, "HEAD");
    assert.equal(portrait.status, 200, `${name}: portrait is available`);
    assert.match(portrait.headers["content-type"], /^image\/png\b/);
    const thumbnail = await get(`/_next/image?url=%2Favatars%2F${name}.png&w=128&q=75`);
    assert.equal(thumbnail.status, 200, `${name}: optimized portrait is available`);
    assert.match(thumbnail.headers["content-type"], /^image\//);
  }
  const backdrop = await get("/themes/haunted-arcade-world.webp", "HEAD");
  assert.equal(backdrop.status, 200, "Haunted Arcade backdrop is available");
  assert.match(backdrop.headers["content-type"], /^image\/webp\b/);
  const mobileBackdrop = await get("/_next/image?url=%2Fthemes%2Fhaunted-arcade-world.webp&w=640&q=75");
  assert.equal(mobileBackdrop.status, 200, "Haunted Arcade mobile optimization works");
  assert.match(mobileBackdrop.headers["content-type"], /^image\//);
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
    "PASS: production routes, profile and Halloween styles, five optimized portraits, metadata, security headers, private cache rules, authorization, cross-origin rejection and analytics opt-out.",
  );
} finally {
  server.kill("SIGTERM");
}
