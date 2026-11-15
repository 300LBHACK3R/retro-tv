# Account and membership emails

Tate's TV sends branded service emails for verified signup, paid membership activation, upcoming renewal, payment failure, cancellation and membership ending. Checkout redirects and complimentary access do not grant paid-membership emails. Roku verification/recovery codes use the same design; website confirmation/recovery templates are supplied for Supabase. Stripe receipts remain separate. These messages do not subscribe a customer to marketing.

## Production setup

The private outbox was added to production on November 11, 2026 as `20261111151806_account_welcome_emails`. The additive notice migration `20261115042157_account_membership_notices` was applied on November 15, 2026. Both are already applied to the existing `tates-tv` project; do not reapply them there. The notice migration does not queue historical messages. Readback confirmed RLS remains enabled and both anonymous and authenticated browser roles lack table access. Sending still requires the environment settings below. Post-migration checks confirmed the functions are invoker-only and cannot be called by browser roles. The advisor's [no-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) is expected for this server-only table. It also reported the separate existing [leaked-password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) as disabled; this email change does not alter Auth policy.

1. In a new environment, apply the repository migrations through the normal Supabase migration process. The private outbox has RLS and service-role access only. It does not backfill or email existing customers.
2. In Resend, verify the sending domain and its DNS records. Create a **sending-only** API key scoped to that domain. Disable click/open tracking for these transactional messages.
3. Add the following in Vercel's **Production** environment. Enter credentials directly in Vercel, never in chat or Git.

| Variable | Setting |
| --- | --- |
| `RESEND_API_KEY` | Sensitive; the Resend sending key |
| `TTV_EMAIL_FROM` | `Tate's TV <address@verified-domain>` using the actual verified sender, not this placeholder |
| `TTV_EMAIL_REPLY_TO` | Optional monitored reply address; omit if unavailable |
| `TTV_ACCOUNT_EMAILS_ENABLED` | `true` once migration and sender setup are complete |
| `CRON_SECRET` | Sensitive, random value of at least 32 characters; authorizes the scheduled retry route |

4. Deploy the code with these settings. Keep the sending flag unset in previews that share production data. A separate preview database and Resend test recipient are required for isolated provider testing.
5. For an existing account, sign in and open **Account → Settings → Email my welcome**. A paid active member gets the membership version. The button never accepts another recipient and does not send a second copy when the provider already accepted the first.
6. Check Resend's message record and the recipient's inbox/junk folder. Provider acceptance is **not** proof of delivery. Check desktop/mobile rendering in the actual mail clients, the Start watching link and account link. For a new signup, verify confirmation first, then one welcome; for a new membership, verify one activation email after the paid entitlement is saved. Repeated webhooks must not send duplicates.

## Notice triggers and stale messages

| Email | Trigger and eligibility |
| --- | --- |
| Welcome | Verified account; one account welcome |
| Membership active | Paid, active membership recorded by the signed webhook |
| Renewal reminder | Stripe `invoice.upcoming`; active, uncancelled subscription with a future period end |
| Payment needs attention | Current latest invoice is open and subscription is past due/unpaid |
| Cancellation confirmed | Paid current membership has cancellation scheduled for period end |
| Membership ended | Subscription deleted/cancelled; no replacement paid active membership |

The production webhook was updated on November 15, 2026 to include `invoice.upcoming`, preserving all ten existing events. No checkout, payment or subscription was created by this setup. Reminder timing follows Stripe Billing's upcoming-invoice configuration; verify that setting and a sandbox event before promising a fixed notice period. Monthly/annual amounts are not hard-coded into messages; the account's billing portal supplies current amounts.

Notice keys identify the subscription, billing period or invoice. Immediately before delivery, the worker reloads Stripe state and verifies account ownership. Resolved payment failures, resumed subscriptions, changed periods and ended notices superseded by a new paid membership are suppressed. Cancellation and activation messages also require current paid access in the application database.

## Website confirmation and recovery templates

`lib/accountEmails.ts` is the source for all designs. Run `node scripts/prepare-account-email-templates.mjs` after editing its security template. This generates:

- `supabase/templates/confirmation.html`: publish in Supabase Authentication → Email → Confirm signup.
- `supabase/templates/recovery.html`: publish in Supabase Authentication → Email → Reset password.

Both templates were published to production Auth on November 15, 2026 during project recovery. The dashboard saved both changes, the signup template was reopened and matched the generated source exactly, and both previews were inspected. Site URL was verified as `https://www.tatestv.ca`. The subjects are “One last step — welcome to Tate's TV 📺” and “Reset your Tate's TV password”. Preserve the template tokens. Both templates open the existing scanner-safe `/auth/confirm` page; the token is consumed only by the user's confirmation. Recovery wording does not promise the Roku backend is already deployed. Check custom SMTP configuration and disable provider link tracking. Do not replace the website links with Roku's numeric-code templates. Saving and previewing templates is not proof of actual inbox delivery.

Roku verification/recovery codes use Resend directly after deployment and require the same sender configuration above. Codes and passwords are never placed in logs or queued in the membership outbox. User-requested codes expire at the application challenge's ten-minute deadline.

## Reliability and privacy

The database queues welcome and activation messages atomically with the account/membership update. Lifecycle notices are idempotently upserted after canonical billing validation; a failed enqueue fails the webhook so Stripe can retry it. Delivery runs after the account response or successful billing webhook, so provider outages do not block those responses. Account visits retry due mail for that verified user; webhooks and the authenticated daily cron drain up to two due messages per invocation. The daily schedule works on Vercel Hobby. It is a fallback, not a guarantee of prompt recovery during an extended outage or a large backlog. Monitor queue counts and provider failures before increasing volume.

Concurrent workers claim rows with a two-minute lease and a unique lease token. Before sending, the worker verifies the current Auth address and confirmation, and rechecks paid access for membership emails. It freezes the exact provider payload and reuses its idempotency key on retries. Messages with an uncertain attempt older than 23 hours enter `review` rather than being blindly resent after Resend's 24-hour idempotency window. Review provider logs before deciding whether an individual message should be requeued. Do not reset or mass-requeue the table.

The outbox stores the recipient and frozen email privately; account deletion removes its rows. Logs contain only failure categories. No profile names, browsing history, authentication tokens or tracking parameters appear in the templates. The emails do not enroll recipients in marketing.

To pause delivery, set `TTV_ACCOUNT_EMAILS_ENABLED=false` and redeploy. Queued messages are retained. Missing credentials also leave sending disabled and hide the request button; they do not change account access.

## Validation

`tests/account-emails.unit.ts` exercises the real SQL with PGlite: duplicate queue events, browser-role denial, user-scoped claims, lease recovery, old-attempt review and account deletion. Provider mocks exercise unchanged retry payloads, unverified/changed recipients, revoked access, authenticated self-service and cron authorization. These tests establish code behavior, not live inbox delivery. The HTML and plain-text templates live in `lib/accountEmails.ts`. `tests/membership-notices.unit.ts` covers notice eligibility, obsolete notices and the additive migration. Static desktop/mobile renders have been inspected; actual Gmail, Proton, Outlook, dark-mode and inbox delivery checks remain deployment acceptance work.
