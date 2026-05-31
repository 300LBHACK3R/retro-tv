export function cleanDisplayText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("\u00e2\u20ac\u00a2", " / ")
    .replaceAll("\u00e2\u20ac\u00a6", "...")
    .replaceAll("\u00e2\u20ac\u201d", "-")
    .replaceAll("\u00e2\u20ac\u201c", "-")
    .replaceAll("\u00e2\u20ac\u2122", "'")
    .replaceAll("\u00e2\u20ac\u0153", '"')
    .replaceAll("\u00e2\u20ac\ufffd", '"')
    .replaceAll("\u00c2\u00a0", " ")
    .replaceAll("\u00c2", "")
    .replaceAll("â€¢", " / ")
    .replaceAll("â€˘", " / ")
    .replaceAll("â€¦", "...")
    .replaceAll("â€”", "-")
    .replaceAll("â€“", "-")
    .replaceAll("â€™", "'")
    .replaceAll("â€œ", '"')
    .replaceAll("â€�", '"')
    .replaceAll("Â·", " / ")
    .replaceAll("•", " / ")
    .replace(/\s+\/\s+/g, " / ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
