# Premium Roku, Christmas 2005 and Admin — v0.1.13

This release adds a native timeline guide, larger browse previews, portrait library cards, a paid Christmas motion theme, and a simpler Admin workspace. Website deployment must complete before installing the new Roku package.

## Christmas 2005: Home After School

A snowy neighbourhood at dusk: warm streetlights, varied house decorations, a Nativity, snowmen and reindeer. Custom generated background artwork is shared across website and Roku, with optimized landscape/portrait web images and a native TV image. Decorative snow, gentle light flicker, a snow trim, and small Santa/snowman ornaments sit around the guide controls.

- One-time purchase: **C$3**, using the existing shared CAD 300-cent Stripe theme price. No new Stripe price or database migration is required.
- Existing membership and verified administrator complimentary access still apply. Roku reads verified account entitlements; it does not trust device-local ownership.
- Existing themes and the free Christmas entrance default remain available.
- Website motion respects reduced-motion preferences and pauses in hidden tabs. Roku uses a bounded 32-sprite loop and one light animation; decorations stop during fullscreen playback and when switching themes.
- Local development builds with billing disabled retain the existing unlocked test mode. Production must keep `NEXT_PUBLIC_THEME_BILLING_ENABLED=true`, as currently configured.

## Roku guide and viewer

The guide uses the same scheduler and hidden-commercial folding as the website. `/api/roku/guide` returns display metadata only, in three-hour pages across the next 72 hours. Times use the Roku timezone, including local-midnight and DST boundaries. Kids approval and the Roku release channel allowlist apply to this feed too.

The native grid builds only four comfortable rows or five compact rows at a time. Channel logos/numbers, programme titles/durations, a current-time line and a full selected-title header replace the old now/next list. Search, categories and favourite filtering use the current authorized catalogue. Selecting a future listing watches that channel live; it does not play a future programme on demand.

| Remote control | Guide action |
| --- | --- |
| Left / Right | Previous / next programme; crossing the edge loads another time window |
| Up / Down | Channels; Up at the first channel reaches dates, then filters |
| OK / Play | Watch the selected channel live |
| Rewind / Fast Forward | Back / forward three hours within the horizon |
| Replay | Return to now and refresh |
| Channel Up / Down | Page through channels |
| Back | Close the guide and preserve playback |

One existing video decoder continues playing in a 320×180 guide preview or a 224×126 library preview. Show and episode cards use 2:3 portrait artwork. Theme previews retain their landscape layout. Opening, closing and refreshing the guide stops obsolete requests and ignores stale replies. A failed refresh retains existing listings and offers retry; tuning remains available.

## Admin organization

Five sections replace the wall of tools: Library, Uploads, Channels, Inbox and Operations. Search finds every tool across sections. Desktop uses a narrow navigation column; mobile uses compact wrapping controls. The saved tool selection is retained.

Removed duplicate dashboard totals, the fixed 23-channel launch summary, the redundant Close Admin button, unused styles/metadata, and the read-only layout dimensions. Backups retain their contents summary in a collapsed disclosure. Editing, inventory deletion, single-item uploads, batch imports, artwork/Kids review, scheduling, account controls, backups and service diagnostics retain their existing safeguards.

## Release

1. Run `Publish-TatesTV-Premium.ps1` from the extracted release folder. It verifies the bundle hash, stages the exact release commit, and waits for Viewer quality to pass before a normal fast-forward push to production. It refuses to overwrite newer production work or reset local changes.
2. Wait for the matching Vercel production deployment to be **Ready**. Check `/api/roku/guide?audience=all` returns `ok:true`.
3. When home, upload **tates-tv-roku-v0.1.13.zip** to the Roku Development Application Installer. Use **Replace with zip**, or **Install with zip** if no development app is installed. Upload the native ZIP directly; do not upload the source/release ZIP.
4. No SQL update is required.

## Physical-device acceptance still required

- Open Guide during a live programme and during an ad; confirm video/audio continue and the current listing matches the channel.
- Test long titles, Search, every category, empty favourites, comfortable/compact rows, future dates, fast-forward/rewind, Replay and Back.
- Verify Kids never receives adult channels, including after profile switches and refreshes.
- On an ordinary account, confirm Christmas 2005 is locked before purchase and available after purchase/account refresh. Existing members/admins retain included access. Confirm ownership on the same website account and Roku.
- Switch themes repeatedly; check winter effects stop outside that theme and during fullscreen video. Check older Roku responsiveness and moving snow/light appearance.
- Open Library, browse portrait cards, resume an episode, and return to live TV without duplicate audio.
- Confirm sign-in persistence after restart, password recovery, Kids PIN, cross-device progress, watchlists, favourites and device revocation from the earlier account rollout.

Automated tests and layout review are not a substitute for actual Roku hardware acceptance. Release verification results are recorded alongside the update package.
