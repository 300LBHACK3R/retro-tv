import { spawnSync } from "node:child_process";

// brs is a test-only interpreter supplied by npm exec, never shipped to Roku.
const suites = [
  ["tests", "ThemeMotion", "motion"],
  ["tests", "Viewer", "Guide", "viewer"],
  ["tests", "ThemeStyle", "GuideRender", "LiveGuide", "guide"],
  ["tests", "Playback", "playback"],
  ["tests", "ThemeStyle", "ChannelStrip", "channelstrip"],
  ["tests", "ThemeStyle", "HomeScreen", "home"],
  ["tests", "Accounts", "accounts"],
  ["tests", "AccountTask", "account-wire"],
  ["tests", "ApiTask", "api-wire"],
  ["tests", "Viewing", "viewing"],
  ["dist/staging", "ThemeStyle", "Themes", "TatesScene", "themes"],
  ["dist/staging", "ThemeStyle", "ArtworkCard", "theme-cards"],
  ["dist/staging", "ThemeStyle", "ChannelStrip", "channelstrip-render"],
];
for (const [root, ...names] of suites) {
  const test = names.pop();
  const result = spawnSync(process.platform === "win32" ? "brs.cmd" : "brs", [
    "--root", root, ...names.map(name => `components/${name}.brs`), `tests/${test}.brs`,
  ], { encoding: "utf8", shell: process.platform === "win32" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  process.stdout.write(output);
  // The interpreter can return zero after STOP. Require explicit completion.
  if (result.error || result.status !== 0 || /FAIL|error:/i.test(output) || !output.includes("PASS:")) {
    throw new Error(`Roku ${test} checks failed: ${result.error?.message ?? result.status}`);
  }
}
console.log(`PASS: all ${suites.length} native regression suites completed.`);
