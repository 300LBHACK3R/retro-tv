# Code cleanup and Roku readiness — 12 November 2026

## Changes

Removed an unreferenced release-asset restoration script and unused exports without removing their active implementations. The service worker remains: it is registered by the current application. Retained the existing content, artwork, account access, billing, seasonal defaults and parental safeguards.

Updated the development dependency tree and scoped a `minimatch` override to `@typescript-eslint/typescript-estree` because its latest dependency range still selects the vulnerable major. Both root and Roku audits report zero known vulnerabilities at this review. The override can be removed when that dependency adopts a patched compatible release; keep CI audit enabled.

Added the native development app and a public Roku API that reuses the programming, library grouping, artwork and Kids approval rules. New programming continues to be managed through the existing website admin. Fixed airtimes now use the Roku time zone, with regression checks for Canadian daylight-saving transitions, standard-time regions and Newfoundland’s half-hour offset. Full source and build instructions are in `roku/README.md`.

Two local incomplete image-transfer remnants were removed after verifying each was an exact prefix of its complete original. The originals were retained; neither remnant was tracked in Git. The installer does not delete unrelated files on the owner's computer.

## Validation

- TypeScript type check and ESLint.
- 165 Node-only regression tests, including route input validation, provider failure handling, cache coalescing/expiry, live source offsets, mid-roll boundaries, Kids restrictions, artwork approval and release allowlists.
- Next.js production build, generated stylesheet checks and HTTP checks.
- BrightScript compilation and an unsigned ZIP package audit that excludes credentials, dependency folders and source maps.
- Root and Roku dependency audits: zero known vulnerabilities.

The existing master build passed the full seven-device browser suite before this work. The installer runs that workflow against the integrated candidate commit and publishes only after it passes; these new changes have not yet been verified by GitHub Actions or deployed. Physical Roku playback, Roku certification, actual email receipt and store submission remain unverified.

## Findings from the public catalog

The read-only snapshot contained 442 media records. The native projection contains 22 live channels and 51 library groups with 434 programme records. Supported URL containers include MP4/M4V/MOV, MKV, HLS and DASH. This is a format-routing check, not a successful playback claim. Direct probes of the four MKV files returned HTTP 403 from this environment, so their codecs and playback remain unverified.

The Kids library contains 255 approved items in 17 groups. No live channel currently passes the complete Kids approval check. The following otherwise approved channels are held by the global **Tow N Go Trailers (AD)** (`tow-n-go-trailers-ad-7a89a858`), which is not marked Kids-approved:

| Channel ID | Channel |
| --- | --- |
| 1 | TTV Retro |
| 3 | TTV LITTLE WORLD |
| 7 | CHRISTIAN KIDS TV |
| 9 | Tate's TV Retro 2 |
| 22 | Little Praise |

Worship (23) also requires review of `psalms-in-song-rhythm-bible-28fb2fce`. Review the actual content in admin before approving it, or restrict that advertisement's eligible channels. No approvals were granted automatically. The native app opens the available Kids library when there are no approved live channels.

The website's live media URLs still use the public R2 development endpoint. A verified production media domain, hardware checks, regional time-zone coverage and Roku advertising/store requirements are tracked in the native README. The website remains usable while that work continues.
