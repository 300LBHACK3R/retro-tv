import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { spawn } from "node:child_process";
import { request } from "node:https";
import { setTimeout as delay } from "node:timers/promises";
import { assertProfileStyles, assertHalloweenStyles, assertDefaultScenery, stylesheetPaths } from "./styles.mjs";

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
    assert.match(response.body, /<meta name="description" content="[^"]+"/, `${path}: description`);
    assert.match(response.body, /<meta property="og:image" content="https:\/\/[^"]+"/, `${path}: share image`);
    assert.match(response.body, /<meta name="twitter:card" content="summary_large_image"/, `${path}: share card`);
    const structured = JSON.parse(response.body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.ok(structured["@graph"].some(node => node["@type"] === "WebSite" && node.isAccessibleForFree === true), `${path}: valid website structured data`);
    assert.ok(
      response.headers["content-security-policy"].includes("object-src 'none'"),
    );
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.ok(!response.headers["x-powered-by"]);
    if (["/", "/library", "/tv"].includes(path)) {
      assertDefaultScenery(response.body, `HTTP ${path}`);
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
  const favicon = await get("/favicon.ico", "HEAD");
  assert.equal((await get("/opengraph-image.png", "HEAD")).status, 200, "Search/share preview is available");
  assert.equal(favicon.status, 200, "Station favicon is available");
  assert.equal(Number(favicon.headers["content-length"]), statSync("public/favicon.ico").size, "The retained station icon replaces the starter icon");
  const svg = await get("/favicon.svg");
  const legacyIcon = await get("/icon.svg");
  for (const icon of [svg, legacyIcon]) {
    assert.equal(icon.status, 200);
    assert.match(icon.headers["content-type"], /^image\/svg\+xml/);
  }
  assert.equal(legacyIcon.body, svg.body, "Installed manifests keep their icon through the alias");
  const manifest = JSON.parse((await get("/manifest.webmanifest")).body);
  for (const icon of manifest.icons) assert.equal((await get(icon.src, "HEAD")).status, 200, `Manifest icon ${icon.src}`);
  const worker = await get("/sw.js");
  const shellArray = worker.body.match(/const APP_SHELL_URLS = (\[[\s\S]*?\]);/)[1];
  for (const [, path] of shellArray.matchAll(/"([^"\n]+)"/g)) {
    assert.equal((await get(path, "HEAD")).status, 200, `Offline precache asset ${path}`);
  }
  for (const name of ["fox", "explorer", "dinosaur", "robot", "girlcat", "boycat", "jesus", "kidsjesus"]) {
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
  const arcadePortrait = await get("/themes/haunted-arcade-mobile.webp", "HEAD");
  assert.equal(arcadePortrait.status, 200, "Haunted Arcade portrait is available");
  assert.match(arcadePortrait.headers["content-type"], /^image\/webp\b/);
  const arcadeThumbnail = await get("/_next/image?url=%2Fthemes%2Fhaunted-arcade-mobile.webp&w=640&q=75");
  assert.equal(arcadeThumbnail.status, 200, "Haunted Arcade portrait optimization works");
  assert.match(arcadeThumbnail.headers["content-type"], /^image\//);
  for (const name of ["world", "mobile"]) {
    const artwork = await get(`/themes/halloween-after-dark-${name}.webp`, "HEAD");
    assert.equal(artwork.status, 200, `After Dark ${name}: artwork is available`);
    assert.match(artwork.headers["content-type"], /^image\/webp\b/);
    const optimized = await get(`/_next/image?url=%2Fthemes%2Fhalloween-after-dark-${name}.webp&w=640&q=75`);
    assert.equal(optimized.status, 200, `After Dark ${name}: image optimization works`);
    assert.match(optimized.headers["content-type"], /^image\//);
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
    "PASS: production routes, profile and Halloween styles, eight optimized portraits, metadata, security headers, private cache rules, authorization, cross-origin rejection and analytics opt-out.",
  );
} finally {
  server.kill("SIGTERM");
}
