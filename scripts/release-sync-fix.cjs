const fs = require("fs");
const path = require("path");

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function write(file, text) {
  fs.writeFileSync(path.join(root, file), text, "utf8");
  console.log("patched", file);
}

function replaceFunction(source, name, replacement) {
  const start = source.indexOf(name);

  if (start < 0) {
    throw new Error(`Could not find ${name}`);
  }

  const open = source.indexOf("{", start);

  if (open < 0) {
    throw new Error(`Could not find opening brace for ${name}`);
  }

  let depth = 0;

  for (let index = open; index < source.length; index += 1) {
    const char = source[index];

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return source.slice(0, start) + replacement + source.slice(index + 1);
    }
  }

  throw new Error(`Could not find closing brace for ${name}`);
}

let changedFiles = 0;

function patch(file, fn) {
  const before = read(file);
  const after = fn(before);

  if (after === before) {
    throw new Error(`Patch made no changes to ${file}`);
  }

  write(file, after);
  changedFiles += 1;
}

// 1. app/page.tsx:
// Player and guide schedules must both pass the same scheduleAnchor into buildSchedule.
patch("app/page.tsx", (source) => {
  let next = source;

  next = next.replace(
    /buildSchedule\(\s*activeChannelMedia,\s*\{\s*channel:\s*activeChannel,\s*availableAds,?\s*\}\s*\)/,
    "buildSchedule(activeChannelMedia, { channel: activeChannel, availableAds, now: scheduleAnchor })"
  );

  next = next.replace(
    /buildSchedule\(\s*channelMedia,\s*\{\s*channel,\s*availableAds,?\s*\}\s*\)/g,
    "buildSchedule(channelMedia, { channel, availableAds, now: scheduleAnchor })"
  );

  if (!next.includes("buildSchedule(activeChannelMedia, { channel: activeChannel, availableAds, now: scheduleAnchor })")) {
    throw new Error("activeSchedule still does not pass scheduleAnchor");
  }

  if (!next.includes("buildSchedule(channelMedia, { channel, availableAds, now: scheduleAnchor })")) {
    throw new Error("channelSchedules still do not pass scheduleAnchor");
  }

  return next;
});

// 2. components/MultiGuide.tsx:
// Guide timeline must walk REAL playback durations, not guideDuration.
patch("components/MultiGuide.tsx", (source) => {
  let next = source;

  next = replaceFunction(
    next,
    "function getItemDuration(item: BroadcastItem): number",
`function getItemDuration(item: BroadcastItem): number {
  const duration = Math.floor(Number(item.duration));

  return Number.isFinite(duration) && duration > 0 ? duration : 1;
}`
  );

  next = next.replace(
    "const availableAds = getAvailableAdItems(row.media);",
    "const availableAds = row.availableAds ?? getAvailableAdItems(row.media);"
  );

  if (next.includes("const guideDuration = Math.floor(Number(item.guideDuration));")) {
    throw new Error("MultiGuide still uses guideDuration for timeline traversal");
  }

  return next;
});

// 3. components/NowNextBar.tsx:
// Public display must keep parent title through commercials and hide segment countdown.
patch("components/NowNextBar.tsx", (source) => {
  let next = source;

  next = replaceFunction(
    next,
    "function getDisplayNowTitle(item: BroadcastItem): string",
`function getDisplayNowTitle(item: BroadcastItem): string {
  return getCleanItemTitle(item);
}`
  );

  next = replaceFunction(
    next,
    "function getDisplayTypeLabel(item: BroadcastItem): string",
`function getDisplayTypeLabel(item: BroadcastItem): string {
  if (isHiddenGuideItem(item)) {
    return "PROGRAM";
  }

  if (item.type === "movie") return "MOVIE";
  if (item.type === "show") return "SHOW";
  if (item.type === "music") return "MUSIC";
  if (item.type === "music-video") return "MUSIC VIDEO";
  if (item.type === "bumper") return "BUMPER";

  return "COMMERCIAL";
}`
  );

  next = next.replace(
    /\s*<span style=\{\{ color: "var\(--text-muted\)" \}\}>\/<\/span>\s*<span style=\{\{ color: "var\(--text-muted\)" \}\}>\s*\{formatLongClock\(currentRemaining\)\} left\s*<\/span>/,
    ""
  );

  next = next.replace(
    /\s*\{live\.item\.segmentLabel \? \(\s*<>\s*<span style=\{\{ color: "var\(--text-muted\)" \}\}>\/<\/span>\s*<span style=\{\{ color: "var\(--text-muted\)" \}\}>\s*""\s*<\/span>\s*<\/>\s*\) : null\}/,
    ""
  );

  if (next.includes("We'll Be Right Back")) {
    throw new Error("NowNextBar still exposes We'll Be Right Back");
  }

  if (next.includes("STATION BREAK")) {
    throw new Error("NowNextBar still exposes STATION BREAK");
  }

  return next;
});

console.log(`Release sync patch complete. Changed files: ${changedFiles}`);
