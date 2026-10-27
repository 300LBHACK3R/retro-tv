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

Run #85, attempt 2, on `c813bc7` subsequently finished with 364 browser cases passed, 2 failed, 2 flaky and 31 skipped. The two failures were the analytics-outage test on Chrome and TV: its repeated synthetic pagehide events drained the analytics queue while teardown correctly refused to establish a new session. The test now waits for the normal visible-page flush and still requires a real 503 response before verifying tuning. The flaky admin reload test now waits for save acknowledgment and verifies the reloaded cloud response plus the rendered channel number instead of a transient “Global loaded” status. Type checking, lint and six focused telemetry unit tests passed for this follow-up. Browser confirmation of these test changes is still required. The subsequent #86 run on `d93e8bf` started before this follow-up and does not contain it. Require a new full seven-project browser run, including the paid-theme build; pending runs are not passes.

## Cleanup boundaries

### Parent/admin release follow-up — October 27

Run #90 on `0833cb0` passed the build, 109 unit tests and HTTP checks, but failed
45 browser cases (363 passed, 2 flaky). The paid-theme browser stage did not run.
This follow-up addresses the observed causes:

- Household saves notify other tabs through BroadcastChannel, with a storage-event
  fallback. Receivers reload authenticated server data; messages cannot supply
  preferences or entitlements. Unsaved local edits retain revision-conflict checks.
- Loading and normalizing station data establishes the autosave baseline. Account
  theme restoration and channel tuning no longer count as station edits.
- Authenticated browser fixtures preserve partial seeded PIN data, wait for account
  saves before reload/new-tab checks, and assert account persistence messages.
- Account outage assertions exclude Next.js's route announcer. Channel-lineup
  readiness checks use enabled controls and rendered data instead of transient text.

Local verification: 114 unit tests, type checking, lint, production build/style
checks, HTTP/security checks and `git diff --check` passed. Local browser execution
remains unavailable for the environment reasons above. The complete browser matrix
and paid-theme stage must pass on this new revision before production promotion.
The existing Kids content/PIN assertions remain in the suite.

Live Stripe products, three membership prices, portal and webhook are configured.
Production Vercel now contains the sensitive `STRIPE_SECRET_KEY`, webhook secret
and the four price variables. Presence does not verify the new restricted key's
permissions. Purchases remain disabled pending provider-flow verification.

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
