# Connected TV release — Roku 0.1.9

Prepared November 16, 2026. This change is not yet live. The last confirmed production revision is `65372cfd89390aa55fec7fefccbf95be74f08248` (Roku 0.1.8).

## Release order

1. Apply `supabase/migrations/20261116014623_connected_tv_experience.sql` to the existing Tate's TV Supabase project `ghiwpzsurrtqupcysfik`. This is additive: four private tables and three server-only functions, with no historical emails or modifications to programming. Existing account/email migrations must remain installed. The preparation attempt did **not** apply it: Supabase's confirmation expired and readback showed all new tables absent.
2. Publish the feature branch and run Viewer quality CI. The attached PowerShell publisher only stages `feature/connected-tv-experience`; it leaves master, local files and the checked-out branch alone. GitHub integration writes returned 403 in preparation, so no remote branch was created here.
3. After the migration is confirmed and branch checks pass, merge the feature branch into master. Wait for the production deployment to be Ready. Do not deploy this code before the migration: authenticated account requests require the new device registry.
4. Confirm website sign-in, Account → Your devices, Library → Continue watching and Admin → Service Health. Health should load without a database/migration error.
5. Only then install `tates-tv-roku-v0.1.9.zip` using Replace with zip at the Roku developer installer (previously `http://192.168.1.168`). No TV steps are needed until Tate is home.

No new secret, subscription, payment change or email campaign is required. Keep provider credentials out of the package and chat.

## What changed

- Signed-in progress is shared by account and profile. The website saves at most about every 15 seconds and flushes on pause/close; Roku saves after 15 seconds of position change and on pause/stop. Completed titles are marked watched. Guest Roku bookmarks remain local. Previously local bookmarks are not automatically assigned to a cloud profile.
- Watchlists and favourite channels use the existing shared household record. Roku makes targeted, revision-checked changes. Website preferences refresh on visibility changes and once a minute; Roku refreshes while connected. Open *** → Saved viewing** from a browse screen to see Continue Watching, Watchlist and Favourite channels or add/remove the focused title/current channel. Resume badges identify partially watched episodes.
- All fourteen website themes have native artwork and checked text contrast. Free, Owned, Included with membership/account and Locked states are distinct. The seven free themes remain available. Neon Noel has its matching packaged seasonal backdrop. Native static artwork does not reproduce website CSS animations.
- Account → Your devices lists named sessions and their last connection. Rename a screen or revoke it individually. Revocation is checked server-side on protected requests; it cannot be undone by refreshing or re-enrolling the same session. The TV checks periodically and loses account access on its next connected check. Offline playback can continue; this is application access revocation, not remote control of the physical Roku or other apps.
- Admin → Service Health checks authentication/programming connectivity, pending/failed/review email counts and recent diagnostic counts. **Check saved videos** probes up to 20 server-known files per batch, records results, and allows stopping between batches. It distinguishes confirmed missing files from reports and hosts that cannot be verified. HEAD availability cannot establish codec compatibility. No scan was run against the production catalogue during preparation.

## Security and recovery behaviour

All new tables have RLS and no browser-role privileges. Only server handlers use the service role. Progress is capped at 300 titles per profile, uses server timestamps, ordered playback sequence numbers and revisions. Delayed retries do not rewind progress; writes based on another screen's outdated revision are rejected. A conflict asks the viewer to reconnect/reload instead of silently overwriting it. Network failures retain the active queue while the app remains open; abruptly closing an offline app can lose unsent progress.

TV profile grants are signed, expire after twelve hours, renew on successful requests, and bind the verified user/session/profile, Kids status and parent PIN state. Profile or account switches clear private TV caches. Expired/revoked accounts retain the saved Kids restriction. Premium ownership always comes from the server.

Device records store verified session IDs, names, type and activity; no access tokens or raw user agents. Health reports contain daily counts with no account IDs, credentials or customer emails. Website playback reports respect existing analytics controls; Kids diagnostic reports omit programme IDs. Thirty-day diagnostic retention is applied when new events arrive. Delivery errors are not proof an email reached or failed to reach the inbox: provider logs and real inbox tests remain necessary.

## Validation during preparation

- 184 automated unit tests passed, including PostgreSQL/RLS, duplicate and out-of-order progress, backward seeking, two-screen conflicts, device revocation and PIN/session/profile-bound grants.
- Type checking, lint, production build/style checks and production HTTP/security checks passed before final packaging; see the release handoff for the final run.
- Roku compiler/package verification passed: 58 expected files, all 14 theme assets, checked text contrast and package under 10 MB.
- Off-device Roku harnesses passed for accounts, playback, viewer navigation, all theme selections and the new sync queue. These mock network/SceneGraph boundaries; they are not hardware tests.
- New browser tests cover device rename/revocation and incoming Continue Watching updates. They could not run here: the pinned browser download failed and system Chromium was blocked by a socket permission. Run the repository's pinned-browser CI before merging.

## At-home acceptance — pending

Use one adult profile and one Kids profile; do not use a real customer account.

1. Website sign-in and existing-account sign-in on TV. Create a fresh test account on TV; verify its email and website access. Check the welcome email in the real inbox.
2. Request recovery on TV, enter its email code and change the password. Confirm the new password on website and TV, rejected old password and usable retry/cancel screens.
3. Restart the Roku app/device and confirm sign-in restores. Disconnect/reconnect networking; confirm temporary outages do not erase credentials. Enter Kids, restart, reject an incorrect PIN and require the correct parent PIN to return to an adult profile.
4. Start an episode on the computer, pause, wait for saving, then open the same profile/title on TV and resume near that position. Pause TV, return to the browser and verify the newer position. Repeat with a backward seek and completed episode. Confirm another profile sees independent history.
5. Save/remove a show on the phone and check the Roku watchlist. Favourite/remove a channel on Roku and check the website. Verify Kids saved items contain only approved programming.
6. Use an account that already owns Neon Noel: apply it on Roku and verify Owned plus matching artwork. Check a non-owning account sees Locked, a member sees Included, and the seven free styles always work. Do not make a real purchase solely for testing.
7. Rename the TV from Your devices. Sign out that TV from the website, wait for its next online check (about a minute), and confirm it loses account access while the browser remains signed in. Repeat while TV is offline; confirm removal takes effect after reconnecting and Kids remains locked.
8. Open Admin health, run a media check, and verify an intentionally unavailable test file appears with an actionable result. Restore it and recheck. Check email provider logs and real inboxes separately.

Record model, Roku OS, installed app version, action and result for any failure. Do not call this a hardware-certified or store-published release until those steps and Roku's publication requirements are complete.
