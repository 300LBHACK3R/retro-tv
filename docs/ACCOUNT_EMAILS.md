# Welcome and membership emails

Tate's TV has two branded transactional emails: a welcome after a verified account is created, and a membership confirmation after the signed Stripe webhook records paid, active access. Neither a checkout redirect nor an administrator's complimentary access grants a paid-membership email. Supabase confirmation/recovery messages and Stripe receipts remain separate services.

## Production setup

The additive database migration was applied to the existing `tates-tv` project on November 11, 2026 as `20261111151806_account_welcome_emails`. Do not reapply it there. Sending still requires the environment settings below. Post-migration checks confirmed the functions are invoker-only and cannot be called by browser roles. The advisor's [no-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) is expected for this server-only table. It also reported the separate existing [leaked-password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) as disabled; this email change does not alter Auth policy.

1. Apply the `account_welcome_emails` migration through the normal Supabase migration process. The private outbox has RLS and service-role access only. It does not backfill or email existing customers.
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

## Reliability and privacy

The database queues messages atomically with the account/membership update. Delivery runs after the account response or successful billing webhook, so provider outages do not block those responses. Account visits retry due mail for that verified user; webhooks and the authenticated daily cron drain up to two due messages per invocation. The daily schedule works on Vercel Hobby. It is a fallback, not a guarantee of prompt recovery during an extended outage or a large backlog. Monitor queue counts and provider failures before increasing volume.

Concurrent workers claim rows with a two-minute lease and a unique lease token. Before sending, the worker verifies the current Auth address and confirmation, and rechecks paid access for membership emails. It freezes the exact provider payload and reuses its idempotency key on retries. Messages with an uncertain attempt older than 23 hours enter `review` rather than being blindly resent after Resend's 24-hour idempotency window. Review provider logs before deciding whether an individual message should be requeued. Do not reset or mass-requeue the table.

The outbox stores the recipient and frozen email privately; account deletion removes its rows. Logs contain only failure categories. No profile names, browsing history, authentication tokens or tracking parameters appear in the templates. The emails do not enroll recipients in marketing.

To pause delivery, set `TTV_ACCOUNT_EMAILS_ENABLED=false` and redeploy. Queued messages are retained. Missing credentials also leave sending disabled and hide the request button; they do not change account access.

## Validation

`tests/account-emails.unit.ts` exercises the real SQL with PGlite: duplicate queue events, browser-role denial, user-scoped claims, lease recovery, old-attempt review and account deletion. Provider mocks exercise unchanged retry payloads, unverified/changed recipients, revoked access, authenticated self-service and cron authorization. These tests establish code behavior, not live inbox delivery. The HTML and plain-text templates live in `lib/accountEmails.ts`.
