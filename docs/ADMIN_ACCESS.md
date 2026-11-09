# Administrator accounts

Administrator access uses an email-confirmed Supabase Auth account whose immutable user ID is listed in the server-only `TTV_ADMIN_USER_IDS` environment variable. Keep the existing approved IDs when changing configuration. Never grant access from a profile name, an email match alone, client input or editable user metadata.

## Sign in

1. Open `/admin` and sign in with the approved account's email and Tate's TV password.
2. Use the existing control centre to manage channels, schedules, media, artwork, commercials, Kids approvals, branding, requests, submissions, insights and backups.
3. Open `/account` and sign in with the same credentials for complimentary viewer access: every theme and up to ten profiles. The account dashboard links back to administration.

Administrative and household sessions are deliberately separate. Signing out of administration does not sign a household out of viewing. Parent PINs and ordinary viewer accounts never authorize management endpoints. The backup shared-password login remains available only when configured; it does not identify a viewer account or grant viewer entitlements.

Use **Forgot password?** for account recovery. This sends a recovery email through the configured Auth provider; delivering that email still depends on the provider's email setup. Never share a temporary password or recovery token in a repository.

## Complimentary access

The account API computes `isAdmin` from the verified identity on each load. Administrators receive the full theme catalogue and the maximum household profile limit. Checkout rejects purchases for an administrator before contacting Stripe. Purchased themes and actual paid memberships remain separately recorded; no fake payment, order or subscription is created.

Existing subscriptions are not automatically cancelled. An administrator with prior billing history retains the billing-management entry point. Removing an ID from the allowlist removes its complimentary entitlements on the next account refresh; protected admin APIs independently recheck authorization. Previously purchased items remain available.

An admin account does not bypass Kids viewing restrictions. Administrative show-request handling uses the existing request inbox rather than a paid-member purchase prompt.

## Deployment and verification

Deploy this code before expecting the email login or complimentary account labels. No database migration is required. Keep account services and the existing server-only admin allowlist enabled on the target deployment.

Unit coverage verifies confirmed identity, role revocation, rejection of forged metadata, separate sessions, checkout protection and non-secret login-method discovery. Browser coverage exercises email login, explicit backup login, account navigation and applying a premium theme without checkout. Browser and real owner login checks must pass before calling the complete flow verified.

Admin authorization does not configure payment-provider credentials, upload storage or email delivery. Those remain separate deployment services described in `RELEASE_READINESS_2026-11-08.md`.
