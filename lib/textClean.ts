const MOJIBAKE_SEPARATOR_RUN =
  /[\u00c2\u00c3\u0192\u00e2\u20ac\u0161\u00ac\u201a\u201c\u201d\u2018\u2019\u201e\ufffd]{2,}/gu;
export type CleanTextInput = string | number | boolean | null | undefined;

type TextReplacement = readonly [searchValue: string | RegExp, replacement: string];

const DEFAULT_SAFE_TEXT_KEY = "item";
const MAX_SAFE_TEXT_KEY_LENGTH = 96;

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

const MOJIBAKE_PATTERN =
  /Ãƒ|Ã‚|Ã¢â‚¬|Ã¢â‚¬Â¢|Ã¢â‚¬Â¦|Ã¢â‚¬â€œ|Ã¢â‚¬â€|Ã¢â‚¬â„¢|Ã¢â‚¬Å“|Ã¢â‚¬ï¿½|ï¿½|\u00e2\u20ac|\u00c2/;

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

export function collapseWhitespace(value: string): string {
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

export function cleanTitleText(value: CleanTextInput): string {
  return cleanDisplayText(value)
    .replace(/\s*\.\s*/g, ". ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*:\s*/g, ": ")
    .replace(/\s*;\s*/g, "; ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .trim();
}

export function normalizeSearchText(value: CleanTextInput): string {
  return cleanDisplayText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/._:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createTextSlug(value: CleanTextInput): string {
  return normalizeSearchText(value)
    .replace(/[/._:]+/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SAFE_TEXT_KEY_LENGTH);
}

export function createSafeTextKey(
  value: CleanTextInput,
  fallback = DEFAULT_SAFE_TEXT_KEY,
): string {
  const slug = createTextSlug(value);
  const fallbackSlug = createTextSlug(fallback);

  return slug || fallbackSlug || DEFAULT_SAFE_TEXT_KEY;
}

export function hasMojibake(value: CleanTextInput): boolean {
  return MOJIBAKE_PATTERN.test(toText(value));
}

export function cleanMaybeText<T extends CleanTextInput>(value: T): string {
  return cleanDisplayText(value);
}