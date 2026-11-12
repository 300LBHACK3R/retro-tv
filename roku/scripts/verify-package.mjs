import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = "dist/staging";
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const paths = files(root).map(path => relative(root, path).replaceAll("\\", "/"));
for (const required of ["manifest", "source/main.brs", "components/TatesScene.xml", "components/ApiTask.xml", "images/logo.png"])
  assert.ok(paths.includes(required), `Missing ${required}`);
for (const path of paths)
  assert.match(path, /^(manifest|(?:source|components)\/[\w/-]+\.(?:brs|xml)|images\/[\w-]+\.png)$/, `Unexpected package file: ${path}`);
const manifest = readFileSync(join(root, "manifest"), "utf8");
assert.match(manifest, /^supports_input_launch=1$/m);
assert.match(manifest, /^ui_resolutions=hd$/m);
const archive = readFileSync("dist/tates-tv-roku.zip");
assert.equal(archive.readUInt32LE(0), 0x04034b50, "ZIP signature");
assert.ok(statSync("dist/tates-tv-roku.zip").size < 10_000_000, "Keep the beta package under 10 MB");
console.log(`PASS: native package contains ${paths.length} expected files; no credentials, source maps, or development dependencies.`);
