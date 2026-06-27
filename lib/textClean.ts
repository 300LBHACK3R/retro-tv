export type CleanTextInput = string | number | boolean | null | undefined;

type TextReplacement = readonly [searchValue: string | RegExp, replacement: string];

const DEFAULT_SAFE_TEXT_KEY = "item";
const MAX_SAFE_TEXT_KEY_LENGTH = 96;

const TEXT_REPLACEMENTS: readonly TextReplacement[] = [
  // Bullets / separators
  ["\u00e2\u20ac\u00a2", " / "],
  ["â€¢", " / "],
  ["â€˘", " / "],
  ["Â·", " / "],
  ["•", " / "],

  // Ellipsis
  ["\u00e2\u20ac\u00a6", "..."],
  ["â€¦", "..."],
  ["…", "..."],

  // Em/en dashes
  ["\u00e2\u20ac\u201d", "-"],
  ["\u00e2\u20ac\u201c", "-"],
  ["â€”", "-"],
  ["â€“", "-"],
  ["—", "-"],
  ["–", "-"],

  // Apostrophes / single quotes
  ["\u00e2\u20ac\u2122", "'"],
  ["â€™", "'"],
  ["â€˜", "'"],
  ["’", "'"],
  ["‘", "'"],

  // Double quotes
  ["\u00e2\u20ac\u0153", '"'],
  ["\u00e2\u20ac\ufffd", '"'],
  ["â€œ", '"'],
  ["â€�", '"'],
  [/â€[\u009d\ufffd]/g, '"'],
  ["“", '"'],
  ["”", '"'],

  // Copyright / registered / trademark mojibake
  ["Â©", "(c)"],
  ["©", "(c)"],
  ["Â®", "(r)"],
  ["®", "(r)"],
  ["â„¢", "TM"],
  ["™", "TM"],

  // Spaces / invisible characters / leftovers
  ["\u00c2\u00a0", " "],
  ["\u00a0", " "],
  ["\u200b", ""],
  ["\u200c", ""],
  ["\u200d", ""],
  ["\ufeff", ""],
  ["\u00c2", ""],
  ["Â", ""],
];

const MOJIBAKE_PATTERN =
  /Ã|Â|â€|â€¢|â€¦|â€“|â€”|â€™|â€œ|â€�|�|\u00e2\u20ac|\u00c2/;

function toText(value: CleanTextInput): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
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