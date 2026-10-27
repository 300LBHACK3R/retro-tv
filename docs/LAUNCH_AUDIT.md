# Tate’s TV launch verification — October 27, 2026

## Live status

Application commit 23966ce9261290e65963f7e8a92735f5a11e31ba is deployed to
https://www.tatestv.ca. Required free parent-account entry and the separate
/admin email/password login are live. The admin user is active, email-verified
and has a password configured; an authenticated admin sign-in was not performed.

**Purchases are not operational yet.** Production has the billing flag enabled
and live price/webhook settings, but Stripe rejects the configured server key
with StripeAuthenticationError when retrieving each of the four prices. The
account API therefore returns its safe disabled-commerce fallback. Account
access remains available. Replace the Production STRIPE_SECRET_KEY with a valid
live key for the Tate’s TV Stripe account, rebuild, and verify /api/account reports
commerce.enabled: true and all three membership plans. Never paste the key into
chat, source files or browser-visible variables.

The user confirmed these CAD prices for launch:

| Product | Charge |
| --- | --- |
| Individual premium theme | C$3 once |
| Monthly membership | C$4.99 every month |
| Six-month membership | C$24.99 upfront every six months |
| Annual membership | C$44.99 upfront every year |

Stripe reports charges and payouts enabled, no currently-due verification
requirements, active live prices, an enabled webhook endpoint and an active
billing portal. Those provider settings do not establish that the application's
separately configured key is valid.

## Verification evidence

| Check | Result |
| --- | --- |
| TypeScript, lint, build/styles, HTTP/security suite | Passed on application commit 23966ce |
| Unit/provider-boundary suite | 114 passed |
| Production dependency audit | 0 reported vulnerabilities; repeated in the temporary test environment |
| GitHub Viewer quality run #91 | 404 passed; 6 failures in the same theme-save test; paid stage skipped |
| Corrected theme-save test | Passed on Chrome, Firefox, Safari/WebKit, Android, iPhone and tablet in focused runs; TV intentionally skips this mobile case |
| Billing-enabled browser build | 28 passed across all seven projects: purchases versus local ownership, refunds, membership access, access filters and plan requests |
| Live desktop/mobile account UI | Required parent account, signup form/adult agreement and mobile overflow checks passed |
| Live admin UI and authorization | Separate email/password form visible; anonymous admin mutation denied with 401 |
| Live checkout authorization | Anonymous checkout denied with 401 |
| Live browser exceptions | None observed in the public account/admin smoke checks |
| Live commerce catalog | Blocked by Stripe authentication; disabled fallback confirmed |

The test correction waits for the household-save guard to clear before the
first hard navigation and asserts the restored theme. No product assertion
was removed. The first parallel WebKit run in the two-core temporary machine had
failures/flakiness; Safari and both Apple mobile layouts passed in subsequent
individual/serial runs. The original GitHub run remains failed; focused
follow-up passes are not represented as a green full CI run. A fresh full CI
run is needed after pushing the correction.

The temporary browser environment was stopped after verification. No production
credentials were copied into it, and reports/screenshots were not added to Git.

## Remaining account-holder checks

1. Replace the rejected Stripe key in Vercel and rebuild. Verify the live catalog,
   authenticated Checkout and the intended charge before advertising memberships.
2. Verify actual confirmation-email delivery, sign-in, recovery and sign-out.
   The configured SMTP sender is not proof of delivery.
3. Complete provider lifecycle checks in an isolated Stripe sandbox: payment,
   webhook delivery, cancellation, failed renewal and refund. Browser/unit
   provider fixtures do not establish completed real payments.
4. Sync the reviewed release and CI correction to GitHub master. The connected
   GitHub integration rejected repository writes with HTTP 403; a bundle is
   supplied for the owner to push. Production was deployed directly from the
   reviewed existing feature commit.

Kids profiles share the parent's household session and use PIN and approved-
content controls. They are not separate authenticated child identities.

## Project organization

Keep one repository with separate pages, components, shared logic, server
services, assets, migrations and tests. Combining browser code and server
credentials into one file would compromise framework boundaries. Generated
build/test output is disposable; original portraits, cloud-referenced channel
logos and migration history are not unused just because a literal search finds
no reference.
