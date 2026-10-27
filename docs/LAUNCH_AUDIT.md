# Tate’s TV launch audit — October 27, 2026

## Release status

This review starts from account/membership commit `c813bc7`. It is a code-readiness review, not certification that production payments are live. The last confirmed production release was `b515956`, before the account feature. Keep purchases disabled until the provider and deployment checks below pass.

## Changes in this update

- Fixed overlapping household saves. Previously, several callers waiting for one request could each submit the next revision, falsely reporting a cross-device conflict. A single writer now drains pending edits while all callers await the same operation. Real server revision conflicts still pause syncing and remain visible to the user.
- Added a regression that reproduced revisions `[0, 1, 1, 1]` before the fix and verifies exactly `[0, 1]` afterward, including an edit made during the first request.
- Updated the project map and removed obsolete documentation saying accounts were deferred.
- Extended `npm run clean` to include the paid-build browser reports and results. Cleanup removes generated output, not source, environment files or migrations.

## Verification performed

| Check | Result |
| --- | --- |
| Type generation and TypeScript | Passed |
| ESLint | Passed |
| Unit and provider-boundary tests | 105 passed |
| Production build and generated styles | Passed |
| Production HTTP routes and security checks | Passed |
| Production dependency audit | No known vulnerabilities reported |
| Whitespace validation | Passed |
| Source import-reference scan | No unreferenced modules found under `lib/` or `components/`; this is not proof every export is necessary |
| Local browser execution | Blocked by environment: Chromium archives failed to download; WebKit could not launch because system libraries are missing |

The HTTP suite covers public routes, profile assets, metadata, private cache rules, authorization, cross-origin rejection and analytics opt-out. Unit tests include account authorization, recovery proof, bounded artwork uploads, household ownership, database permissions, payment verification, webhook replay protection, refunds and the membership intervals. Provider responses are controlled in these tests; they do not prove real email delivery or completed live payments.

The latest observed upstream run was #85, attempt 2, on `c813bc7`: pre-browser checks passed and browser testing was still running. This update needs its own full seven-project browser run, including the paid-theme build. Never treat a pending run as a pass.

## Cleanup boundaries

Keep one project folder with separate pages, interfaces, shared logic, server services, assets and tests. Combining server credentials, browser code and styles in one source file would make the application harder to maintain and compromise framework boundaries.

Channel-logo paths may exist in cloud programming rather than source literals. Original portrait PNGs generate optimized WebP images during the build. Database migrations preserve deployment history. None of those were deleted merely because a text search did not find a direct reference.

## Required before advertising paid memberships

1. Publish this branch for CI and require a green Viewer quality run, including Safari, phones, tablets, TV layout and the paid-theme cases. Deploy the reviewed account release with purchases still disabled.
2. Verify real confirmation, resend, sign-in, password recovery and sign-out using the configured sender. Check that the confirmation link is not consumed by an email scanner. Verify preferences survive refresh and sync between two devices.
3. Complete any remaining Stripe live account review and confirm payments are enabled. Create or verify the live CAD prices: C$3 per theme; C$4.99 monthly; C$24.99 billed every six months; C$44.99 billed yearly. Test-mode price IDs cannot be used as live IDs.
4. Configure the live server key, live price IDs, customer portal and signed webhook. Use [the account activation guide](ACCOUNTS_AND_MEMBERSHIP.md) for exact environment names and webhook events. Do not put secrets into browser-visible variables.
5. On an isolated preview database with Stripe test mode, complete checkout, cancellation, payment failure, refund, dispute and duplicate-webhook cases. Verify all three membership terms, theme ownership, extra-profile behavior after expiry, and account deletion. Do not connect sandbox payments to the production account database.
6. Enable paid access only after those checks, rebuild the deployment, and verify production status and the intended live checkout amounts. Existing viewers must retain access to free viewing, guide and library.

The previously observed Supabase and SMTP setup is useful progress, but an enabled setting is not evidence of successful delivery. The same distinction applies to a configured Stripe product and a functioning paid-membership journey.
