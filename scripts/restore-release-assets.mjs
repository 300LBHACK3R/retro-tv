// Only used by source-file deployments that omit the large public assets.
// Ordinary Git deployments already contain public/ and do not run this script.
import { execFileSync } from "node:child_process";
import { mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = mkdtempSync(join(tmpdir(), "ttv-assets-"));
try {
  execFileSync("git", ["clone", "--filter=blob:none", "--no-checkout", "https://github.com/300LBHACK3R/retro-tv.git", directory], { stdio: "inherit" });
  execFileSync("git", ["-C", directory, "checkout", "23966ce9261290e65963f7e8a92735f5a11e31ba", "--", "public"], { stdio: "inherit" });
  cpSync(join(directory, "public"), "public", { recursive: true });
} finally {
  rmSync(directory, { recursive: true, force: true });
}
