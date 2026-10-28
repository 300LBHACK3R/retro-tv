export const REQUEST_STATUSES = {
  requested: "Requested",
  reviewing: "Under review",
  planned: "Planned",
  added: "Added",
  unavailable: "Unavailable",
} as const;
export type ShowRequestStatus = keyof typeof REQUEST_STATUSES;
export type ShowRequest = {
  id: string;
  title: string;
  release_year: number | null;
  seasons: string;
  details: string;
  status: ShowRequestStatus;
  member_reply: string;
  created_at: string;
  updated_at: string;
};
export type AdminShowRequest = ShowRequest & { user_id: string; admin_notes: string };
export const REQUEST_PAGE_SIZE = 20;
export const MAX_OPEN_REQUESTS = 5;
export function isRequestStatus(value: unknown): value is ShowRequestStatus {
  return typeof value === "string" && Object.hasOwn(REQUEST_STATUSES, value);
}
export function requestPage(value: string | null) {
  return value && /^\d{1,5}$/.test(value) ? Number(value) : 0;
}
export function parseShowRequest(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const title = typeof input.title === "string" ? input.title.trim().replace(/\s+/g, " ") : "";
  const seasons = typeof input.seasons === "string" ? input.seasons.trim().replace(/\s+/g, " ") : "";
  const details = typeof input.details === "string" ? input.details.trim() : "";
  const year = input.releaseYear === "" || input.releaseYear == null ? null : Number(input.releaseYear);
  if (title.length < 2 || title.length > 160 || seasons.length > 80 || details.length > 1000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(title + seasons + details) ||
    (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100))) return null;
  return { title, release_year: year, seasons, details };
}
export const MEMBER_REQUEST_COLUMNS = "id,title,release_year,seasons,details,status,member_reply,created_at,updated_at";
