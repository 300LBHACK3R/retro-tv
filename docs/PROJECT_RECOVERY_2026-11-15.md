# Tate's TV recovery checkpoint — November 15, 2026

The recovered source includes the complete Roku v0.1.8 account release at `a2017688fd2ef1670a62157c02fbcc2a94d6c64b` and its seven preceding Roku upgrades. At recovery, GitHub `master` and the latest Ready Vercel production deployment were still at `14df07d9fbee6beebf02b3b5ebdac4ab97133969`. Prepared code is not evidence of production deployment.

## Continue here

1. Publish the recovered source with the owner-authenticated updater. The GitHub integration returned HTTP 403, `Resource not accessible by integration`, and the recovery shell had no GitHub credentials. No source commit was pushed or Vercel deployment started in this recovery session. The updater refuses a non-fast-forward or unexpected repository and does not alter working files.
2. Wait for the Git-triggered Vercel production deployment and verify its commit. POST `{"action":"check"}` to `/api/roku/account`; HTTP 400 with `Choose a supported account action.` confirms the route exists. It does not test real credentials or email delivery.
3. Install `tates-tv-roku-v0.1.8.zip` through the office TV developer installer and execute [ROKU_ACCOUNTS.md](ROKU_ACCOUNTS.md)'s acceptance checks. The cloud environment cannot reach the TV's local network.
4. Test a consenting adult account's existing sign-in, new signup/code, recovery, refresh/relaunch and parent PIN on both website and TV. Verify actual emails in an inbox. Use sandbox billing for lifecycle cases.

## Work completed during recovery

- Restored the saved v0.1.8 Git bundle on a fresh clone and verified its commit ancestry.
- Confirmed the account, welcome-email and membership-notice migrations already exist in production. Do not reapply them or backfill historical email.
- Checked production environment variable names for the existing account, sender and retry setup. Secrets were not read or copied.
- Published branded signup confirmation and password-reset templates in Supabase Auth. Verified the canonical Site URL, saved state, rendered previews and reopened signup source. Previous templates are preserved in the private recovery kit.
- Changed recovery copy to avoid implying the unreleased TV backend is live. Regenerated the supplied template from its single source.

## Fresh validation

- 181 server/unit tests passed on the recovered release.
- Type generation, TypeScript, ESLint, production build and CSS checks passed.
- Production HTTP/security/metadata/portrait checks passed.
- Native BrightScript compilation and package/assets checks passed.
- Nine native regression harnesses passed: viewer, guide, playback, channel strip, home, accounts, themes, theme cards and channel-strip rendering.
- 25 targeted account/email/security tests passed after the recovery-copy edit.
- Browser tests did not execute: the pinned Chromium download was unusable; installed Chromium then failed to start because the environment denied its local socket operation. This is an environment blocker, not a passing browser test or a demonstrated product defect.
- Real Roku remote/rendering/decoder checks, actual inbox delivery and real-account end-to-end checks remain outstanding. Do not describe compilation as store certification.

## Requirements to retain

Website and Roku use one Supabase identity and one household. Free viewing remains available without an account. Native signup uses the remote and email codes; website accounts must sign in. Kids restrictions and the shared parent PIN must remain enforced through restart, expiry and sign-out.

Christmas '96 is the current free seasonal entrance. All seven free native themes are packaged; preserve saved IDs and artwork. Premium native theme assets/picker, watchlist/favourite sync and cross-device viewing progress are not part of v0.1.8. Profile editing stays on the website. Consult current source and service state before reviving old backlog items.

The private recovery handoff preserves retrieved history and earlier documents. It is not a verbatim export of every conversation message or attachment. Older handoff statements are historical when they conflict with this checkpoint or current service state.
