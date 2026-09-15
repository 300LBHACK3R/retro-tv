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
  assert.ok(css.includes(".ttv-seasonal-world"), `${context}: missing full-page scenery layout`);
  assert.ok(css.includes("prefers-reduced-motion"), `${context}: missing reduced motion support`);
  for (const name of ["ttv-haunted-world", "ttv-haunted-mist", "ttv-haunted-preview-art"])
    assert.ok(css.includes(name), `${context}: missing ${name}`);
  assert.ok(css.includes("halloween-haunted-arcade"), `${context}: missing second Halloween theme`);
  assert.ok(css.includes("ttv-ghost-float"), `${context}: missing ghost animation`);
  assert.ok(css.includes(".theme-dialog__scroll"), `${context}: missing scrollable theme picker`);
  for (const name of ["world", "art", "scrim", "fog", "witch", "skeleton", "skeleton-wave", "preview-art"])
    assert.ok(css.includes(`.ttv-afterdark-${name}`), `${context}: missing full-page After Dark ${name}`);
  assert.ok(css.includes("ttv-afterdark-flight"), `${context}: missing seasonal animation`);
}

export function assertDefaultScenery(html, context) {
  assert.ok(html.includes('data-ttv-theme="halloween-night"'), `${context}: After Dark is the starting theme`);
  // Verify real server-rendered elements, not strings embedded in RSC scripts.
  assert.match(html, /<div[^>]*class="ttv-seasonal-world ttv-afterdark-world"[^>]*aria-hidden="true"/, `${context}: default scenery exists before hydration`);
  assert.match(html, /<source[^>]*srcSet="[^"<>]*halloween-after-dark-mobile/, `${context}: mobile composition is available on first paint`);
  assert.match(html, /<img[^>]*class="ttv-afterdark-art"/, `${context}: default artwork is server-rendered`);
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
    assertDefaultScenery(html, `Built ${route}`);
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
    assertDefaultScenery(html, `Published ${route}`);
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
  for (const path of [
    "/themes/haunted-arcade-mobile.webp",
    "/_next/image?url=%2Fthemes%2Fhaunted-arcade-mobile.webp&w=640&q=75",
    "/themes/haunted-arcade-world.webp", "/_next/image?url=%2Fthemes%2Fhaunted-arcade-world.webp&w=640&q=75",
    "/themes/halloween-after-dark-world.webp", "/themes/halloween-after-dark-mobile.webp",
    "/_next/image?url=%2Fthemes%2Fhalloween-after-dark-world.webp&w=1080&q=75",
    "/_next/image?url=%2Fthemes%2Fhalloween-after-dark-mobile.webp&w=640&q=75",
  ]) {
    const response = await fetch(new URL(path, site.origin), {
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(response.status, 200, `${path}: published Halloween artwork is available`);
    assert.ok(response.headers.get("content-type")?.startsWith("image/"), `${path}: artwork MIME type`);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${path}: artwork is not empty`);
  }
  console.log("PASS: live viewer pages serve complete profile and Halloween styles, all five portraits and optimized Halloween artwork.");
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
