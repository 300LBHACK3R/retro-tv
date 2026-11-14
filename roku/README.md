# Tate's TV — Roku device-test build

This is a native BrightScript/SceneGraph app, not a website wrapper. It is an unsigned development build. Compilation and server tests do not establish Roku hardware compatibility or store approval.

## Included

- Profile-style home screen on every normal launch, with **Watch for free** and **Create account** cards. Logo, Christmas room, guest portrait and account QR code are packaged locally, so the home screen does not wait for the network. Back from the navigation menu, or its Home entry, returns here.
- Create account shows a scannable link to the existing website account screen. It explicitly describes website signup; it does not claim to link or sign in the Roku. A saved Kids session can continue free viewing but cannot open this account screen until a parent exits Kids with the PIN.
- A shared live viewer after Watch for free: inline video, now/next details, and a horizontal channel strip. It starts channel 1 when that channel is in the current audience's lineup, otherwise the first available channel.
- A three-column live guide showing channel, on now and up next. Video keeps running in a small header player while browsing the guide, artwork library, search results or themes.
- Grouped on-demand library, four-column artwork grid, title search and resumed viewing. Library titles open fullscreen; Back returns to the same library.
- OK on the live player opens fullscreen. Back restores the browsing layout without replacing the Video node or seeking; native Roku transport and caption controls remain available in fullscreen.
- Persistent Kids mode with a local four-digit parent PIN, bounded retry lockout, separate viewing history, and server-filtered channels, programmes and artwork.
- Free Christmas '96 and Classic Blue styles across navigation, lists, controls, keyboard and PIN dialogs. The Christmas logo and room artwork come from the website's existing assets.
- Cold and warm deep links, playback/network error screens, remote navigation, and launch-performance signalling.

Fixed airtimes, day-specific campaigns and programme blocks use the Roku's configured time zone, including daylight-saving transitions. Ordinary browser dates keep their existing behaviour. The app reads the existing public programming database through `/api/roku/catalog` and `/api/roku/play`. Browsing refreshes every minute; the server coalesces reads for at most 15 seconds. New shows, posters and channel changes therefore require no app rebuild. Playback eligibility is checked again when tuning in. An expired cache is never used after a database failure.

This first build uses device-local profiles and two free styles. It does not yet include website account linking, paid-theme synchronization, memberships, show requests, watchlists, reactions, admin editing or a full time-grid guide. Those website features remain available on the website. No payment credentials or database credentials are packaged in the app.

## Build

Use Node 22 and npm from the repository root:

```sh
npm --prefix roku ci
npm --prefix roku run build
npm --prefix roku audit
```

The output is `roku/dist/tates-tv-roku.zip`. A generated copy of the existing Christmas logo is included during the build; do not commit `roku/images/logo.png`, `dist`, signing keys or signed packages. The compiler version and dependencies are locked. CI compiles and checks the package on each feature/master push.

The optional `tests/viewer.brs` harness exercises the actual viewer routing with mock node fields and focus. Run it from `roku/` with an installed BrightScript interpreter (`brs --root tests components/Viewer.brs tests/viewer.brs`; verified with brs 0.45.0 in an isolated test environment). That interpreter is not a build dependency and is not included in the ZIP. These checks cover free/Kids entry, deferred tuning, deep-link priority, uninterrupted resizing, browse focus and native fullscreen controls. They do not emulate SceneGraph rendering, networking, decoding or physical remote behaviour.

## Install on a test Roku

1. Deploy the website update first. `https://www.tatestv.ca/api/roku/catalog?audience=all` must return `ok: true` and `version: 1`.
2. Use a physical Roku on the same network as the computer, running Roku OS 11 or newer. Record its model and OS from **Settings → System → About**.
3. On the remote press **Home three times, Up twice, Right, Left, Right, Left, Right**. Enable the developer installer, accept the displayed developer terms, set a developer password and restart.
4. Open the device's displayed IP address in the computer's browser. Sign in as `rokudev` using the password set on the device. Upload `tates-tv-roku.zip` without unzipping it, then select **Install**.
5. A Roku holds one sideloaded development app at a time. Installing this replaces that development slot, not normal store apps.

Official instructions: https://developer.roku.com/dev/docs/developer-setup
Developer enrollment: https://developer.roku.com/enrollment/standard

## Device acceptance checks

Record results and the Roku model/OS before calling this release ready:

- Cold launch, warm launch, readable artwork, long titles, every menu and Back/Options behaviour.
- Launch without an account: check the Christmas home, highlighted profile cards, left/right/OK, free entry, Home return and account QR on a phone. Close the account screen with OK and Back; selection stays on Create account. Restart with networking disconnected: the home artwork and cards must still be usable. Deep links still open their target directly.
- From Watch for free, confirm live video starts inside the viewer and now/next matches the station. Press OK for fullscreen, then Back: playback should continue at the same position. Press Down for the channel strip, Left/Right to browse and OK to tune. Up returns to the player; Back returns to the menu.
- Open the guide and library during playback: confirm the small header player continues, text and focus borders are readable, and scrolling stays responsive. Open a library title, then Back to its episode grid. Test a slow channel response while moving between menu, guide and library: completion must not steal browsing focus.
- Play a regular live channel through a programme/ad boundary; confirm source offsets after a mid-roll and after rejoining a channel.
- Play MP4 and MKV files; test audio, captions, seeking and a resumed library title. File extensions alone do not establish codec compatibility.
- Disconnect/reconnect networking; verify an unavailable programme returns a usable error screen.
- Create a PIN, cancel/confirm it, enter Kids, restart the app, try an incorrect PIN, test the lockout and exit with the correct PIN. The app must remain in Kids after restart.
- From the home screen in Kids mode, Watch for free must retain the Kids filter; Create account must show the parent notice and return focus to the cards, including when dismissed with Back.
- Test approved Kids titles and blocked adult deep links. Review every programme and eligible ad before approving a Kids channel in the website admin.
- Check both themes, keyboard and PIN colours, persisted selection and independent Household/Kids bookmarks.
- Run cold/warm deep links using a channel's `channel:<id>` with `mediaType=live`, an episode's `media:<id>` with `mediaType=episode`, and a movie with `mediaType=movie`. Series links open their episode list.
- Measure startup/video performance on hardware. The compiler cannot certify performance or the native node layout.

## Remaining publication work

- Run the above checks on real hardware, fix any device failures, and create the signed `.pkg` using the developer installer. Keep the signing key/password private and retain them for updates.
- Finish store-size artwork, screenshots, descriptions, support/privacy details, distribution territories and the required dashboard certification checks.
- Confirm distribution rights for every title and territory. `TTV_ROKU_CHANNEL_IDS` optionally limits this feed to comma-separated permanent channel IDs; an explicitly empty value exposes no release content. Library items are limited to those channels when this setting is present.
- Decide and implement Roku's required advertising integration for a public ad-supported release. Existing station clips are scheduled, but this build does not contain the Roku Advertising Framework or certified ad measurement.
- Move production media delivery from the rate-limited R2 development hostname to a verified custom media domain before scaling distribution.
- Compare a fixed-time channel on the Roku and website with both devices set to the same time zone. Canadian and US zone names, valid IANA zones and fixed UTC offsets are supported; additional Roku-specific regional aliases must be mapped before expanding distribution to those regions.

Publishing and certification: https://developer.roku.com/dev/docs/channel-publishing-guide
Streaming specifications: https://developer.roku.com/dev/docs/media

There is no submitted store application or promised approval date associated with this ZIP.
