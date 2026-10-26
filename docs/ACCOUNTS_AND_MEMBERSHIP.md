# Accounts and membership activation

The code is staged behind explicit flags. Free live TV, the guide and the library never require an account or payment. Keep billing disabled until the provider checks below pass. No recurring price is selected in this release.

## What ships

- Optional Supabase email/password accounts, confirmation resend, password recovery, sign-out and password-confirmed deletion.
- HttpOnly sessions; server-verified users, same-origin mutations and database rate limits. Email/password tokens are never stored in localStorage.
- Cloud household profiles, favourites, watchlists, parent-PIN hashes and per-profile themes. Optional import of existing device data. Guest data remains local. Resume positions stay on each device and are scoped to the signed-in account.
- Six premium themes at C$3 each. Membership includes all current/future premium themes, ten profiles instead of five and an optional member badge. Membership's monthly amount must be chosen by Tate.
- Stripe-hosted Checkout and billing management. Access is granted only from signed, verified payment webhooks. Redirects, browser storage and station backup metadata cannot grant purchases.
- Membership expiry retains extra profiles and saved theme choices. They become usable again after renewal; individually owned themes remain available. Refunds and unresolved disputes revoke the affected purchase.

## 1. Supabase

Use the existing project's isolated preview/test environment first. Apply `supabase/migrations/20261026_accounts_and_billing.sql` using the SQL editor or your migration process. It creates new account/billing tables and functions; it does not change station programming. Browser roles have no direct access to these tables. Only verified server handlers use the service role.

Enable email/password sign-up and **Confirm Email**. Set the minimum password length to 12. Configure custom SMTP with a verified sender domain, SPF/DKIM and suitable email limits. Supabase's default email service is not a public production delivery service. Disable email-provider link tracking for authentication messages.

Set Site URL to `https://www.tatestv.ca`. Allow `/auth/confirm` on the exact production and authorised preview origins. Use separate Supabase projects/SMTP test delivery for preview when practical; never wildcard arbitrary preview domains on production.

Replace the confirmation email action with:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your Tate’s TV account</a>
```

Replace the password recovery email action with:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset your Tate’s TV password</a>
```

These links open a page that requires a click before consuming the token, so email scanners do not automatically sign in. The page removes the token from its URL and sets `Referrer-Policy: no-referrer`. Standard fragment-token templates do not work with this server-only flow.

## 2. Environment

Add secrets through the hosting provider's environment settings; never paste them into chat, commit them or prefix them with NEXT_PUBLIC_. Redeploy after changes.

| Variable | Value / purpose |
| --- | --- |
| `TTV_ACCOUNTS_ENABLED` | `true` only after the migration, email settings and keys are ready |
| `SUPABASE_URL` | Existing project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Project publishable key or legacy anon key; the auth client runs on the server |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing server key; also signs short-lived recovery proof |
| `NEXT_PUBLIC_SITE_URL` | Exact canonical HTTPS origin for this environment |
| `NEXT_PUBLIC_THEME_BILLING_ENABLED` | Unset/`false`: all themes stay free and checkout is disabled. `true`: enforce paid themes and allow configured checkout. This is a build-time flag; rebuild after changing it. |
| `STRIPE_SECRET_KEY` | Server test key for preview; live key only for an approved production launch |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this environment's endpoint |
| `STRIPE_THEME_PRICE_ID` | Active CAD **300-cent one-time** price |
| `STRIPE_MEMBERSHIP_PRICE_ID` | Active CAD **monthly** recurring price at Tate's chosen amount; leave unset until chosen |
| `STRIPE_AUTOMATIC_TAX_ENABLED` | `true` only after Stripe Tax is configured for the business; otherwise unset |

Do not use live Stripe credentials in preview or test keys against the production account database. Webhooks reject test/live mismatches. Changing price IDs later requires a migration/reconciliation plan for existing purchases and subscriptions.

## 3. Stripe

Create a product named “Tate’s TV premium theme” with one C$3 CAD one-time price. The selected theme is recorded in server-generated checkout metadata and checkout text. Do not enable adjustable quantities, promotion codes or free trials for this release.

Create “Tate’s TV Membership” only after the owner chooses a monthly CAD amount. Configure customer portal payment-method updates, invoice history and subscription cancellation **at the end of the paid period**. Leave subscription price switching disabled. Add the site's `/privacy` and `/terms` URLs, merchant support contact information and business details. Enable customer receipts and configure tax treatment appropriate to the business before live payments.

Webhook endpoint: `https://www.tatestv.ca/api/billing/webhook` (use the preview origin for test mode). Use the Stripe API version `2026-09-30.endive` matching the installed Stripe 23 SDK, not a legacy subscription/invoice event schema. Select:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`

Events are idempotent and the receipt and entitlement update commit together. Stripe retries failed database writes. Use Stripe's resend-event tool after a transient outage. A checkout success URL never grants access by itself. Membership checks retrieve the current subscription and paid invoice/payment state. Refunds affect access; account deletion cancels memberships but does not issue refunds automatically.

## 4. Before enabling live purchases

Use a real preview deployment and Stripe test mode to verify:

1. New email receives confirmation; scanner GET alone does not consume it; clicking confirms; reuse fails. Sign-in with an unconfirmed address fails. Resend and recovery email delivery work.
2. A confirmed account signs in on two devices. Themes, favourites and watchlists sync; another account cannot read or write them. Overlapping preference writes show a conflict rather than overwriting newer changes.
3. Guest data can be explicitly imported, remains available after sign-out, and is never silently overwritten. Password reset invalidates refresh sessions. Deletion requires the password and removes cloud household data.
4. A C$3 test payment unlocks only its selected theme. Cancelled/failed payment and manually visiting the success URL do not unlock anything. Duplicate/out-of-order webhooks do not duplicate access. A full refund revokes it.
5. A test membership unlocks all premium themes and ten profiles. Cancellation retains access to the paid period's end; expiration falls back to five without deleting the other profiles. Individually bought themes still work.
6. Billing portal cancellation, receipts and account deletion work. Run a failed-renewal and dispute/refund test. Verify a won dispute restores eligible access.
7. Guest live TV, guide, library and free themes remain usable throughout. Children’s profile controls still work. Enable production only once these checks pass with the owner's chosen prices and business settings.

Automated local tests use controlled provider responses and Postgres (PGlite). They verify implementation boundaries but do not establish live email delivery, Stripe merchant readiness or production credentials. `npm run test:unit`, `npm run build`, `npm run test:http` and `npm run test:browser` are the regular gates. To test the paid theme UI, clear the generated `.next` build directory, build with `NEXT_PUBLIC_THEME_BILLING_ENABLED=true`, then run browser tests with that same flag and `--grep @billing`. CI uses a fresh build when changing this flag so a previous free-theme bundle cannot be reused.

## Storage and recovery notes

Existing local theme ownership in station backups is legacy metadata only. The old browser `unlockTheme` action is removed. Paid access comes from server-owned purchase records. Cosmetic theme CSS/assets remain public assets; this is purchase entitlement management, not DRM.

Do not drop billing tables to roll back a UI deployment. Keep the webhook running while subscriptions exist. Account deletion detaches retained transaction records from the deleted auth user and removes the household. Parent PINs are household convenience controls, not media access authorization; public media URLs remain public.

## Poster upload fix

Prepared JPG/PNG/WebP posters up to 3 MB now POST to `/api/admin/artwork`. The server verifies the admin session, origin, byte limit and image format before uploading to R2. Browser-to-R2 CORS is no longer needed for poster uploads; large video uploads still use their direct upload route. Missing configuration, expired admin sessions and R2 write-permission failures have separate messages. Uploading prepares the poster; **Save title artwork** publishes it through the existing station sync. Wait for Global saved.

References: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates), [Stripe webhooks](https://docs.stripe.com/webhooks), [Stripe customer portal](https://docs.stripe.com/customer-management).
