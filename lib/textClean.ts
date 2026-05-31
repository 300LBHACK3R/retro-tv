export function cleanDisplayText(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replaceAll("â€¢", " / ")
    .replaceAll("â€˘", " / ")
    .replaceAll("Â·", " / ")
    .replaceAll("•", " / ")
    .replaceAll("â€”", "-")
    .replaceAll("â€“", "-")
    .replaceAll("â€™", "'")
    .replaceAll("â€œ", '"')
    .replaceAll("â€�", '"')
    .replaceAll("Â", "")
    .replace(/\s+\/\s+/g, " / ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
