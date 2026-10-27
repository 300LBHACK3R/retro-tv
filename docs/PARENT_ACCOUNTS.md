# Required free parent accounts

The viewer entry points `/`, `/library` and `/tv` now show account registration/sign-in until `/api/account` returns an authenticated user. That endpoint uses Supabase `getUser` and requires a confirmed email. Existing local profiles cannot grant access. Auth service failures do not restore device-only viewing. Paid membership is never required to pass this gate.

New households start with the parent profile. The parent adds Kids profiles inside the household. There is no separate child email registration. Existing adult-confirmation signup and password-recovery flows remain in place. Old device data is preserved for explicit import after sign-in, not used as account identity.

Kids viewing still requires a parent PIN. Full-lineup profile selection and profile management require that PIN once set. Account settings now show “Ask a parent” both in Kids mode and when a PIN-protected household is at the locked profile chooser. This closes the chooser-to-account-page shortcut. Free households retain five profiles; membership remains an optional upgrade.

Kids channels must pass the existing complete-lineup approval checks, including eligible ads and recurring blocks. Library content and direct title links use the reviewed catalogue. Missing approvals produce an empty Kids view, never a fallback to adult programming. Content is not newly approved by this update.

## Security boundary

This change controls the application’s viewing and account-setting flow. Household PINs are client-side parental controls inside a shared authenticated parent session, not separate server-issued child identities. Public programming and R2 media URLs remain public. This is not a guarantee against a child deliberately bypassing client code or opening a known media URL. Strong media-level enforcement requires private media delivery and server-authorized child sessions as a separate change. Server account data remains isolated by authenticated parent identity; purchase entitlements remain server-owned.

## Release verification

Type checking, lint, production build and HTTP/security checks passed locally. The full existing unit suite passed, followed by the added outage regression and focused Kids/PIN checks. Browser tests now use authenticated free-household fixtures rather than implicitly exercising guest viewing. New browser cases cover all three signed-out entry routes, auth outage, and locked account settings; existing Kids tests cover unapproved deep links and PIN transitions.

Local browser execution remains blocked by unavailable Chromium downloads and missing WebKit system libraries. Require the feature branch's GitHub Viewer quality run to pass, including paid-theme tests, before publishing to master. Prior green runs on `1d5b56f` do not validate this change.

Before production promotion, confirm a real parent can register, receive confirmation, sign in and recover a password on the existing account release. A mandatory-account rollout depends on working auth and email delivery. Keep `NEXT_PUBLIC_THEME_BILLING_ENABLED=false` until live billing is configured and verified. No migration, new provider key or paid membership is needed for this UI change.
