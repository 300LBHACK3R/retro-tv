# Shared website and Roku accounts

Roku v0.1.8 signs in to the existing Supabase account used by tatestv.ca. It does not create a second customer identity or a second subscription. Watch for free remains available without an account. Household profile selection opens live TV automatically.

## Deploy before installing

1. Publish this revision to the website. GitHub connector writes were denied in the preparation environment; the downloadable bundle/updater is for the repository owner's authenticated Git installation. No remote branch or production deployment was created during preparation.
2. Production already has migration `20261115042157_account_membership_notices`. A fresh environment needs the repository migrations, including the existing account rate-limit function. The account route requires the existing `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TTV_ACCOUNTS_ENABLED=true` and trusted site origin. It does not introduce another signing secret.
3. Review [ACCOUNT_EMAILS.md](ACCOUNT_EMAILS.md). Existing accounts can sign in without Resend, but new TV accounts and recovery need a configured sender/key. The outbox sending flag controls welcome and membership notices; it does not disable user-requested security codes. The production webhook already includes `invoice.upcoming`. The website confirmation/reset email templates were published in Supabase's Auth dashboard on November 15, 2026; actual inbox delivery still needs acceptance testing.
4. Check `POST https://www.tatestv.ca/api/roku/account` with JSON `{"action":"check"}`. A deployed route returns HTTP 400 with `Choose a supported account action.`; a 404/HTML response means the new code is absent. This only checks route availability, not credentials or sending.
5. Upload `tates-tv-roku-v0.1.8.zip` to the office TV's developer installer at `http://192.168.1.168`, then choose **Replace with zip**. Keep the ZIP intact. Verify **v0.1.8** on Home before testing.

## Account flow

- **Sign in:** Roku's email-sharing prompt prefills an editable keyboard; declining uses manual entry. Enter the existing Tate's TV password, then choose a household profile.
- **Create account:** enter email, confirm adult household ownership, choose a password of 12–128 characters, then enter the code delivered to that email. Choose a profile after verification. A confirmed existing email should use Sign in or Forgot password.
- **Forgot password:** request a code, enter it on the TV, then choose a new password. It changes the shared website password and revokes other refresh sessions. Already issued access tokens retain their normal short lifetime.
- **Choose profile:** reload current household data, select a profile and verify the website parent PIN when entering an adult profile that requires it. A Kids profile without an account PIN prompts for a local TV PIN first.
- **Sign out:** forget this TV's credentials and request revocation of this TV session. Website sessions remain signed in. Network failure cannot stop the TV from forgetting its local sign-in.

The app uses on-device authentication. Roku's non-TV Everywhere authentication requirements do not permit an external QR/website activation flow as the replacement for it. Official references: [on-device authentication](https://developer.roku.com/dev/docs/on-device-authentication) and [authentication and linking](https://developer.roku.com/dev/docs/authentication-and-linking).

## Data and security boundaries

`/api/roku/account` uses a fresh stateless Supabase client for each request. Native requests use bearer credentials, not browser cookies. A supplied browser Origin must match the configured site. Durable rate limits cover IPs, account identifiers and parent PIN attempts. Signup/recovery challenges are signed, purpose-bound and expire after ten minutes; Supabase validates the one-time code.

Only access/refresh credentials are saved in Roku registry. Passwords and codes are cleared from dialogs and task fields after use. Session refresh is single-flight and rotated credentials are saved before loading profiles. A temporary outage does not discard the saved login. Late/cancelled responses do not activate a different account; a cancelled refresh still saves rotated credentials so the TV can reconnect later.

An account-backed Kids lock retains its household owner through expiry/sign-out. Signing in as another adult account cannot release that lock. Adult profile selection verifies the shared parent PIN on the server; a local PIN also remains enforced where applicable. The account response never includes the stored parent PIN hash or privileged provider identifiers.

## Current feature boundaries

Roku reads household profiles, membership status and theme ownership. All seven free native themes remain available. A profile's theme is applied when that style is packaged; premium website themes use the default fallback. Premium native theme assets/picker are not part of v0.1.8. Editing profiles, favourites, watchlists and show requests remain on the website. Roku viewing progress and theme changes remain local to the device.

## Acceptance on the TV and a real inbox

Use a consenting adult test account. No real email or paid subscription was created during automated verification.

1. Existing confirmed website account: sign in, check household names and membership status, select a profile and confirm immediate live playback. Relaunch and confirm the TV restores the account. Cancel each dialog and check remote focus returns to the right card.
2. New account: decline and accept Roku email sharing in separate attempts; check both keyboard paths. Complete adult confirmation, password and email-code verification. Verify the welcome arrives once and the account can sign in on the website.
3. Wrong/expired code and duplicate address: confirm understandable recovery, no accidental account replacement and no credentials displayed in errors. Repeat only within rate limits.
4. Forgot password: verify delivery, invalid-code handling, new password and website sign-in. The old password must fail. Sign out on Roku and confirm the website remains signed in in the ordinary sign-out flow.
5. Network loss during sign-in, refresh and profile loading: free viewing/navigation remain available, no account-switching race, and reconnect restores the intended account. Test remote Back during every stage.
6. Kids: select a Kids profile, restart, attempt adult selection with a wrong/correct parent PIN. Try Home/free viewing and an expired login. A different account must not unlock the original household's Kids session. Test a local TV PIN when no website PIN exists.
7. Sandbox billing: deliver activation, upcoming invoice, failure, cancellation and deletion events. Resolve a failed invoice before delivery and resume a cancellation before delivery; obsolete notices must not send. Repeat events to check deduplication. Never create live paid subscriptions merely for this automated check.
8. Inspect real messages in desktop/mobile email clients, including junk folders, links, images disabled and dark mode. Provider acceptance and static rendering do not establish inbox delivery.

Automated validation includes 181 server/unit tests, production build, HTTP/security checks, native compilation, package/assets checks and nine BrightScript regression harnesses. Browser automation and physical Roku rendering/remote tests were not completed in the preparation environment. Compilation is not store certification.
