# Member requests and show organization

Members open **Library → Request a Show** or **Account → Request a Show**. Only verified accounts with an active, paid, unexpired membership can submit. Individual theme purchases do not qualify. Each account has up to five open requests. Repeat submissions for the same title/year/seasons return the original request. Members retain access to their own history when membership ends.

Review **Admin → Show Requests**. The inbox starts with open requests, oldest first, and supports title search, status filters and pagination. Statuses are Requested, Under review, Planned, Added and Unavailable. Member replies appear in that account; private notes are never returned by the member API. This release uses in-app replies, not outgoing email notifications. Requests do not automatically add programmes or promise availability.

The migration `20261028232229_member_show_requests.sql` was applied to the existing Supabase project. Access to the table and submission function is server-only; membership and the five-open-request limit are checked in one transaction. No extra environment variables are required for requests.

## Series and season artwork

The Library reads explicit season and episode codes from titles, then filenames. It groups punctuation variants and supports codes at either end of a title. Unknown season numbers remain in Other episodes; it never renumbers an uploaded Season 4 to Season 1. Legacy artwork and watchlist keys are kept as aliases so improved grouping preserves saved choices.

**Admin → Show Organization** lists shows, season filters, episode search, and missing/repeated numbering for review. Corrections write standardized display titles; they do not rename or delete video files, change channel assignments or invent missing episodes. Display-title edits reset Kids content approval, as other title edits already do.

**Admin → Artwork & Coming Soon → Choose title → Artwork scope** selects either the whole-show default or one season. Save season artwork once; all current and future episodes recognized as that season use it. The whole-show poster remains the fallback. Season artwork has its own Kids approval and uses the existing global programming save process. Wait for Global saved before leaving.

Artwork uses the existing upload service. Direct computer uploads still require the station's R2 environment configuration; a public R2 image URL works without those upload credentials. Do not claim direct uploads or Stripe checkout have been repaired by this release.

## Validation

Unit coverage includes actual PostgreSQL migration execution, role grants, paid-access checks, quota and duplicate handling, account isolation, private notes, admin update conflicts, season parsing, preserved saved keys and season artwork inheritance. Browser regression cases cover member forms, inbox review, episode search and season poster selection; run Viewer quality after pushing the release.
