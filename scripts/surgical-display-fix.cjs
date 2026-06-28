const fs = require("fs");
const path = require("path");

const root = process.cwd();

function filePath(file) {
  return path.join(root, file);
}

function exists(file) {
  return fs.existsSync(filePath(file));
}

function read(file) {
  return fs.readFileSync(filePath(file), "utf8");
}

function write(file, text) {
  fs.writeFileSync(filePath(file), text, "utf8");
  console.log("patched", file);
}

function patchFile(file, patcher) {
  if (!exists(file)) {
    console.warn("missing", file);
    return;
  }

  const before = read(file);
  const after = patcher(before);

  if (after !== before) {
    write(file, after);
  } else {
    console.log("no change", file);
  }
}

const badSeparators = [
  "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢",
  "ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢",
  "Ã¢â‚¬Â¢",
  "â€¢",
  "Ã‚Â·",
  "Â·",
  "•",
];

function cleanDisplaySeparators(source) {
  let next = source;

  for (const separator of badSeparators) {
    next = next.split(separator).join(" / ");
  }

  return next;
}

function hideActAndPartLabels(source) {
  return source
    .replace(/\s*\/\s*\{[^{}\n]*segmentLabel[^{}\n]*\}/g, "")
    .replace(/\{\s*[^{}\n]*segmentLabel[^{}\n]*\?\s*[^{}\n]*:\s*[^{}\n]*\}/g, '""')
    .replace(/\{\s*[^{}\n]*segmentLabel[^{}\n]*\}/g, '""')
    .replace(/\/\s*Act\s*\d+/gi, "")
    .replace(/\/\s*Part\s*\d+/gi, "")
    .replace(/\bAct\s*\d+\b/gi, "")
    .replace(/\bPart\s*\d+\b/gi, "");
}

patchFile("components/NowNextBar.tsx", (source) => {
  let next = source;

  next = cleanDisplaySeparators(next);
  next = hideActAndPartLabels(next);

  // Force the Next Up line to use a hardcoded safe separator.
  next = next.replace(
    /\{getDisplayTypeLabel\(nextVisibleItem\)\}[\s\S]{0,260}?\{formatLongClock\(nextDuration\)\}/g,
    '{getDisplayTypeLabel(nextVisibleItem)}{" / "}{formatLongClock(nextDuration)}'
  );

  // If the current/live line exposes a segment label, remove it.
  next = next.replace(
    /\{formatLongClock\((currentDuration|duration|remainingDuration|itemDuration)\)\}[\s\S]{0,180}?segmentLabel[\s\S]{0,80}?\}/g,
    '{formatLongClock($1)}'
  );

  return next;
});

patchFile("components/Player.tsx", (source) => {
  let next = source;

  next = cleanDisplaySeparators(next);
  next = hideActAndPartLabels(next);

  return next;
});

patchFile("components/MultiGuide.tsx", (source) => {
  let next = source;

  next = cleanDisplaySeparators(next);
  next = hideActAndPartLabels(next);

  return next;
});

patchFile("lib/scheduler.ts", (source) => {
  let next = source;

  // Internal splitting can still happen, but public act labels must not exist.
  next = next.replace(/segmentLabel:\s*label,/g, "segmentLabel: undefined,");
  next = next.replace(/segmentLabel:\s*segmentLabel,/g, "segmentLabel: undefined,");
  next = next.replace(/segmentLabel:\s*`[^`]*`,/g, "segmentLabel: undefined,");
  next = next.replace(/segmentLabel:\s*"[^"]*",/g, "segmentLabel: undefined,");
  next = next.replace(/segmentLabel:\s*'[^']*',/g, "segmentLabel: undefined,");

  return next;
});

patchFile("lib/textClean.ts", (source) => {
  let next = source;

  // Keep existing functions, just add runtime cleanup for these broken separators.
  if (!next.includes("MOJIBAKE_SEPARATOR_RUN")) {
    next = next.replace(
      "export function cleanDisplayText(value: unknown): string {",
      `const MOJIBAKE_SEPARATOR_RUN =
  /(?:ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢|ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢|Ã¢â‚¬Â¢|â€¢|Ã‚Â·|Â·|•)/g;

export function cleanDisplayText(value: unknown): string {`
    );

    next = next.replace(
      "return String(value)",
      'return String(value).replace(MOJIBAKE_SEPARATOR_RUN, " / ")'
    );
  }

  return next;
});

console.log("Surgical guide/display patch complete.");
