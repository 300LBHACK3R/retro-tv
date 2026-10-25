const MOJIBAKE_SEPARATOR_RUN =
  /[\u00c2\u00c3\u0192\u00e2\u20ac\u0161\u00ac\u201a\u201c\u201d\u2018\u2019\u201e\ufffd]{2,}/gu;
export type CleanTextInput = string | number | boolean | null | undefined;

type TextReplacement = readonly [searchValue: string | RegExp, replacement: string];

const TEXT_REPLACEMENTS: readonly TextReplacement[] = [
  // Bullets / separators
  ["\u00e2\u20ac\u00a2", " / "],
  ["Ã¢â‚¬Â¢", " / "],
  ["Ã¢â‚¬Ë˜", " / "],
  ["Ã‚Â·", " / "],
  ["â€¢", " / "],

  // Ellipsis
  ["\u00e2\u20ac\u00a6", "..."],
  ["Ã¢â‚¬Â¦", "..."],
  ["â€¦", "..."],

  // Em/en dashes
  ["\u00e2\u20ac\u201d", "-"],
  ["\u00e2\u20ac\u201c", "-"],
  ["Ã¢â‚¬â€", "-"],
  ["Ã¢â‚¬â€œ", "-"],
  ["â€”", "-"],
  ["â€“", "-"],

  // Apostrophes / single quotes
  ["\u00e2\u20ac\u2122", "'"],
  ["Ã¢â‚¬â„¢", "'"],
  ["Ã¢â‚¬Ëœ", "'"],
  ["â€™", "'"],
  ["â€˜", "'"],

  // Double quotes
  ["\u00e2\u20ac\u0153", '"'],
  ["\u00e2\u20ac\ufffd", '"'],
  ["Ã¢â‚¬Å“", '"'],
  ["Ã¢â‚¬ï¿½", '"'],
  [/Ã¢â‚¬[\u009d\ufffd]/g, '"'],
  ["â€œ", '"'],
  ["â€", '"'],

  // Copyright / registered / trademark mojibake
  ["Ã‚Â©", "(c)"],
  ["Â©", "(c)"],
  ["Ã‚Â®", "(r)"],
  ["Â®", "(r)"],
  ["Ã¢â€žÂ¢", "TM"],
  ["â„¢", "TM"],

  // Spaces / invisible characters / leftovers
  ["\u00c2\u00a0", " "],
  ["\u00a0", " "],
  ["\u200b", ""],
  ["\u200c", ""],
  ["\u200d", ""],
  ["\ufeff", ""],
  ["\u00c2", ""],
  ["Ã‚", ""],
];

function toText(value: CleanTextInput): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(MOJIBAKE_SEPARATOR_RUN, " / ");
}

function applyTextReplacement(
  current: string,
  searchValue: string | RegExp,
  replacement: string,
): string {
  if (searchValue instanceof RegExp) {
    return current.replace(searchValue, replacement);
  }

  return current.split(searchValue).join(replacement);
}

function collapseWhitespace(value: string): string {
  return value
    .replace(/[ \t\r\n\f\v]+/g, " ")
    .replace(/\s+\/\s+/g, " / ")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanDisplayText(value: CleanTextInput): string {
  const rawValue = toText(value);

  const replaced = TEXT_REPLACEMENTS.reduce((current, [bad, good]) => {
    return applyTextReplacement(current, bad, good);
  }, rawValue);

  return collapseWhitespace(replaced);
}