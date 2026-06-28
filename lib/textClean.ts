export function cleanDisplayText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    // Triple/double encoded bullet separators.
    .replace(/\u00C3\u0192\u00C2\u00A2\u00C3\u00A2\u00E2\u20AC\u0161\u00C2\u00AC\u00C3\u201A\u00C2\u00A2/g, " / ")
    .replace(/\u00C3\u00A2\u00E2\u201A\u00AC\u00C2\u00A2/g, " / ")
    .replace(/\u00E2\u20AC\u00A2/g, " / ")
    .replace(/\u00C3\u201A\u00C2\u00B7/g, " / ")
    .replace(/\u00C2\u00B7/g, " / ")

    // Broken dashes.
    .replace(/\u00E2\u20AC\u201C/g, " - ")
    .replace(/\u00E2\u20AC\u201D/g, " - ")

    // Broken apostrophes/quotes.
    .replace(/\u00E2\u20AC\u2122/g, "'")
    .replace(/\u00E2\u20AC\u02DC/g, "'")
    .replace(/\u00E2\u20AC\u0153/g, '"')
    .replace(/\u00E2\u20AC\u009D/g, '"')

    // Stray encoding leftovers.
    .replace(/\u00C2/g, "")
    .replace(/\uFFFD/g, "")

    // Normalize separators/spaces.
    .replace(/\s+\/\s+/g, " / ")
    .replace(/\s+-\s+/g, " - ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
