import { expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// Paths captured from Next 16.3.8 builds, with and without an adapter.
const pages = [
  ["index", "/page", "c6377dd9ce6a1c2cd100eb4344e843eb4639b9ed26f84643f77680e9eb454c4b"],
  ["library", "/library/page", "30202ec59d1fced11670edf1124f3b941bdf823e206a8cb969c8678256380804"],
  ["tv", "/tv/page", "d9e006d867c77151815add21e67c6551a9afb6331ad3aeae14a0ff531a1e07ea"],
] as const;

const html = `<html data-ttv-theme="halloween-90s-night"><head>
<link rel="stylesheet" href="/_next/static/chunks/viewer.css?dpl=test">
</head><body><div class="ttv-seasonal-world ttv-halloween90-world" aria-hidden="true">
<picture><source srcSet="/themes/halloween-90s-mobile.webp">
<img class="ttv-halloween90-art" src="/themes/halloween-90s-world.webp"></picture>
</div></body></html>`;

const css = `
.ttv-profile-screen,.ttv-profile-header,.ttv-profile-grid,.ttv-profile-card,
.ttv-profile-avatar,.ttv-profile-portrait,.ttv-profile-panel,.ttv-profile-form,
.ttv-profile-actions,.ttv-profile-primary,.ttv-profile-back { color: white; }
.ttv-seasonal-world,.ttv-haunted-world,.ttv-haunted-mist,.ttv-haunted-preview-art,
.theme-dialog__scroll,[data-ttv-theme="halloween-haunted-arcade"],
.ttv-afterdark-world,.ttv-afterdark-art,.ttv-afterdark-scrim,.ttv-afterdark-fog,
.ttv-afterdark-witch,.ttv-afterdark-skeleton,.ttv-afterdark-skeleton-wave,
.ttv-afterdark-preview-art,.ttv-halloween90-world,.ttv-halloween90-art,
.ttv-halloween90-scanlines,.ttv-halloween90-screen-glow,.ttv-halloween90-preview-art { display: block; }
@keyframes ttv-ghost-float { to { transform: translateY(1px); } }
@keyframes ttv-afterdark-flight { to { transform: translateX(1px); } }
@media (prefers-reduced-motion: reduce) { * { animation: none; } }
`;

function put(root: string, path: string, value: string) {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, value);
}

function fixture(adapter: boolean) {
  const root = mkdtempSync(join(tmpdir(), "ttv-build-styles-"));
  put(root, "required-server-files.json", JSON.stringify({ config: { adapterPath: adapter ? "test-adapter" : undefined } }));
  put(root, "server/app-paths-manifest.json", JSON.stringify(Object.fromEntries(pages.map(([, source]) => [source, `app${source}.js`]))));
  for (const [name, , hash] of pages) {
    put(root, adapter ? `server/route-cache/APP_PAGE/${hash}/$/${name}.html` : `server/app/${name}.html`, html);
  }
  put(root, "static/chunks/viewer.css", css);
  return root;
}

function runGate(root: string) {
  // Run the real ESM checker just as npm run build does; Playwright's unit
  // loader otherwise converts .mjs imports to CommonJS for this project.
  const result = spawnSync(process.execPath, ["--input-type=module", "-e",
    "import { verifyBuild } from './tests/styles.mjs'; verifyBuild(process.argv[1]);", root],
  { encoding: "utf8" });
  if (result.error) throw result.error;
  return result;
}

for (const adapter of [false, true]) {
  const layout = adapter ? "adapter route-cache" : "ordinary server/app";
  test(`style gate validates all three viewer pages in ${layout} output`, () => {
    const root = fixture(adapter);
    try {
      const valid = runGate(root);
      expect(valid.status, valid.stderr).toBe(0);
      // A missing current homepage must fail even if an old build left a copy.
      const [name, , hash] = pages[0];
      const scoped = `server/route-cache/APP_PAGE/${hash}/$/${name}.html`;
      const ordinary = `server/app/${name}.html`;
      put(root, adapter ? ordinary : scoped, html);
      rmSync(join(root, adapter ? scoped : ordinary));
      const missing = runGate(root);
      expect(missing.status).toBe(1);
      expect(missing.stderr).toContain("ENOENT");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test("adapter style gate rejects missing linked CSS and cannot pass using an unused CSS chunk", () => {
  const root = fixture(true);
  try {
    rmSync(join(root, "static/chunks/viewer.css"));
    const missing = runGate(root);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("ENOENT");
    put(root, "static/chunks/unused-old-build.css", css);
    put(root, "static/chunks/viewer.css", "body { color: white; }");
    const broken = runGate(root);
    expect(broken.status).toBe(1);
    expect(broken.stderr).toContain("missing .ttv-profile-screen");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
