# Release scope and remaining setup

## Changes

- Removed The Rewind Room page, movie-upload panel, tape controls, navigation, metadata and dedicated tests. The ordinary library, artwork editor, live guide and player remain. No cloud programming, uploaded media, profiles or payment records are deleted. The removed feature remains recoverable from Git history.
- All three Halloween themes are free. Christmas '96 Living Room is free. Tate's TV Neon CRT, Classic Cable 2006 and Bright Cable 2008 remain free. Neon Noël is C$3 one-time in paid mode, with existing purchase/member entitlements respected. Future Christmas additions must remain paid except the classic free theme; a catalogue regression test enforces this.
- Kids mode persists a restriction hint through account expiry, reload and account-service failure. Unauthenticated playback stays locked on those devices until a parent signs in. Ordinary guest viewing stays free. This is an application parental control, not device-wide filtering: private media authorization and separate child identities are not implemented.

## Verified in this work

- Production was on e3c6261. The newer Rewind Room repair 24120df passed Viewer quality but was not production; this release explicitly reverses both Rewind Room commits.
- Live guest viewing loaded and displayed playback in the browser.
- 136 unit tests passed, including account isolation, payment validation, Kids catalogue rules and new outage/expiry guard coverage. Type checking, lint, production builds, built CSS checks and HTTP/security checks passed. The production dependency audit reported no advisories.
- New browser regressions cover Kids sessions expiring or failing on `/`, `/library?title=qa-movie` and `/tv`, plus recovery to the protected chooser. These new browser tests still require a green Viewer quality run on the final pushed commit. A previous green run does not validate this change.
- Local visual preview could not complete because the managed development runtime reported `uv_resident_set_memory` failures and blocked development-resource requests. Production build/HTTP verification is separate from browser verification.

## Confirmed release blockers

1. GitHub writes through the connected integration return 403, "Resource not accessible by integration." The supplied installer imports a Git bundle in the owner's existing checkout and uses their normal Git access. It does not force-push or discard committed local work.
2. Production `/api/account` reports `commerce.enabled: false` although the production billing flag is true. The connected Stripe account, lltechsolutions.ca (`acct_1UMcJpAd84SP9apX`), has no active prices and only L&L webhook endpoints. Production references theme price `price_1UV10HAhWEzW5vX4UUOT4HUQ`. Confirm the original Tate's TV Stripe account and replace rejected credentials there rather than creating duplicate products in the wrong account. See `ACCOUNTS_AND_MEMBERSHIP.md`, including its earlier rejected-key diagnosis. No live charge or refund was made here.
3. The project environment listing contains no R2 upload settings. Supply the existing bucket's credentials and public URL directly in Vercel, following `PREMIUM_UPLOADS_AND_SUBMISSIONS_SETUP.md`. Then verify an authenticated small poster upload, Save title artwork and Global saved. Existing playback does not verify write access.
4. Actual email confirmation/recovery delivery, two-device account sync, real payment/webhook delivery and physical Roku playback remain unverified. Database tables have RLS enabled; server-only tables intentionally have no browser policies. No production schema, content approvals or account records were changed.

## Launch sequence

Run the installer in the existing `C:\Users\techn\retro-tv` checkout. It preserves committed local work, checks the integrated result, pushes a feature branch and waits for its exact commit's Viewer quality result. With `-Publish`, master advances only after that result succeeds; Vercel must then report that exact release before the script says LIVE. A LIVE code deployment does not certify the provider checks above. Finish payment, upload, email and real-device verification before advertising them as ready. Roku submission and approval remain a separate release step.
