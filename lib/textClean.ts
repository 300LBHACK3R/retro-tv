export type CleanTextInput = string | number | boolean | null | undefined;

const TEXT_REPLACEMENTS: Array<[string, string]> = [
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
  ["\u00e2\u20ac\u0153", "\""],
  ["\u00e2\u20ac\ufffd", "\""],
  ["â€œ", "\""],
  ["â€�", "\""],
  ["“", "\""],
  ["”", "\""],

  // Copyright / registered / trademark mojibake
  ["Â©", "(c)"],
  ["Â®", "(r)"],
  ["â„¢", "TM"],

  // Spaces / leftovers
  ["\u00c2\u00a0", " "],
  ["\u00a0", " "],
  ["\u200b", ""],
  ["\u200c", ""],
  ["\u200d", ""],
  ["\ufeff", ""],
  ["\u00c2", ""],
  ["Â", ""],
];

function toText(value: CleanTextInput): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function collapseWhitespace(value: string): string {
  return value
    .replace(/[ \t\r\n]+/g, " ")
    .replace(/\s+\/\s+/g, " / ")
    .replace(/\s+-\s+/g, " - ")
    .trim();
}

export function cleanDisplayText(value: CleanTextInput): string {
  const rawValue = toText(value);

  const replaced = TEXT_REPLACEMENTS.reduce(
    (current, [bad, good]) => current.split(bad).join(good),
    rawValue,
  );

  return collapseWhitespace(replaced);
}

export function cleanTitleText(value: CleanTextInput): string {
  return cleanDisplayText(value)
    .replace(/\s+\.\s+/g, ". ")
    .replace(/\s+,\s+/g, ", ")
    .replace(/\s+:\s+/g, ": ")
    .replace(/\s+;\s+/g, "; ")
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
    .slice(0, 96);
}

export function createSafeTextKey(value: CleanTextInput, fallback = "item"): string {
  const slug = createTextSlug(value);

  return slug || fallback;
}

export function hasMojibake(value: CleanTextInput): boolean {
  const text = toText(value);

  return /Ã|Â|â€|â€¢|â€¦|â€“|â€”|â€™|â€œ|â€�/.test(text);
}

export function cleanMaybeText<T extends CleanTextInput>(value: T): string {
  return cleanDisplayText(value);
}