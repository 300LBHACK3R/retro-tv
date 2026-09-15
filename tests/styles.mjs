import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Validate the assets referenced by each built page, rather than scanning all
// chunks: a leftover CSS file on disk is no help to a visitor who never gets it.
export function stylesheetPaths(html) {
  const paths = new Set();
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([\w-]+)=["']([^"']*)["']/g)].map((match) => [
        match[1].toLowerCase(),
        match[2].replaceAll("&amp;", "&"),
      ]),
    );
    if (!attributes.rel?.split(/\s+/).includes("stylesheet")) continue;
    const url = new URL(attributes.href, "https://styles.test");
    assert.equal(
      url.origin,
      "https://styles.test",
      "Styles must be served by this app",
    );
    assert.ok(
      url.pathname.startsWith("/_next/static/"),
      "Expected a built CSS asset",
    );
    paths.add(url.pathname);
  }
  assert.ok(paths.size, "The page must link its stylesheets");
  return [...paths];
}

export function assertProfileStyles(css, context = "Profile entry") {
  for (const name of [
    "screen",
    "header",
    "grid",
    "card",
    "avatar",
    "portrait",
    "panel",
    "form",
    "actions",
    "primary",
    "back",
  ]) {
    assert.ok(
      new RegExp(`\\.ttv-profile-${name}(?=[\\s,.:#\\[{])`).test(css),
      `${context}: missing .ttv-profile-${name} in the delivered CSS`,
    );
  }
}

export function assertHalloweenStyles(css, context = "Halloween") {
  for (const name of ["scene", "pumpkins", "sky", "copy", "witch", "bats", "lantern"])
    assert.ok(css.includes(`.ttv-halloween-${name}`), `${context}: missing ${name} styling`);
  assert.ok(css.includes("prefers-reduced-motion"), `${context}: missing reduced motion support`);
  for (const name of ["ttv-haunted-world", "ttv-haunted-mist", "ttv-haunted-preview-art"])
    assert.ok(css.includes(name), `${context}: missing ${name}`);
  assert.ok(css.includes("halloween-haunted-arcade"), `${context}: missing second Halloween theme`);
  assert.ok(css.includes("ttv-ghost-float"), `${context}: missing ghost animation`);
  assert.ok(css.includes(".theme-dialog__scroll"), `${context}: missing scrollable theme picker`);
  assert.ok(css.includes("ttv-witch-flight"), `${context}: missing seasonal animation`);
}

function verifyBuild() {
  for (const route of ["index", "library", "tv"]) {
    const html = readFileSync(`.next/server/app/${route}.html`, "utf8");
    const css = stylesheetPaths(html)
      .map((path) =>
        readFileSync(resolve(".next", path.slice("/_next/".length)), "utf8"),
      )
      .join("\n");
    assertProfileStyles(css, `Built ${route} page`);
    assertHalloweenStyles(css, `Built ${route} page`);
    assert.ok(html.includes('data-ttv-theme="halloween-haunted-arcade"'), `${route}: seasonal first paint`);
  }
  console.log("PASS: built viewer pages link profile portrait and Halloween styles with the seasonal first paint.");
}

async function verifySite(origin) {
  const site = new URL(origin);
  assert.equal(site.protocol, "https:", "Use the HTTPS site address");
  assert.ok(
    !site.username && !site.password,
    "Do not put credentials in the site address",
  );
  const assets = new Map();
  async function get(path, contentType) {
    const response = await fetch(new URL(path, site.origin), {
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 200, `${path}: asset request failed`);
    assert.ok(
      response.headers.get("content-type")?.startsWith(contentType),
      `${path}: unexpected content type`,
    );
    return response.text();
  }
  for (const route of ["/", "/library", "/tv"]) {
    const html = await get(route, "text/html");
    const styles = [];
    for (const path of stylesheetPaths(html)) {
      if (!assets.has(path)) assets.set(path, await get(path, "text/css"));
      styles.push(assets.get(path));
    }
    assertProfileStyles(styles.join("\n"), `Published ${route}`);
    assertHalloweenStyles(styles.join("\n"), `Published ${route}`);
  }
  for (const name of ["fox", "explorer", "dinosaur", "robot", "cat"]) {
    const response = await fetch(new URL(`/avatars/${name}.png`, site.origin), {
      method: "HEAD", signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 200, `${name}: published portrait is available`);
    assert.ok(response.headers.get("content-type")?.startsWith("image/png"), `${name}: portrait MIME type`);
  }
  for (const path of ["/themes/haunted-arcade-world.webp", "/_next/image?url=%2Fthemes%2Fhaunted-arcade-world.webp&w=640&q=75"]) {
    const response = await fetch(new URL(path, site.origin), {
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 200, `${path}: published Haunted Arcade artwork is available`);
    assert.ok(response.headers.get("content-type")?.startsWith("image/"), `${path}: artwork MIME type`);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${path}: artwork is not empty`);
  }
  console.log("PASS: live viewer pages serve complete profile and Halloween styles, all five portraits and optimized Haunted Arcade artwork.");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    if (process.argv[2] === "--url") await verifySite(process.argv[3]);
    else verifyBuild();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
