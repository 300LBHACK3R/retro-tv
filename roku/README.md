# Tate's TV — Roku v0.1.9 device-test build

This is a native BrightScript/SceneGraph app, not a website wrapper. It is an unsigned development build. Compilation and server tests do not establish Roku hardware compatibility or store approval.

Read [CONNECTED_TV.md](../docs/CONNECTED_TV.md) for the required database migration, release order and connected-device acceptance checklist.

## Included

- Normal app launch opens the profile-style Home screen with **Watch for free**, **Sign in** and **Create account** cards. Watch for free opens the shared viewer and automatically starts live TV when the catalogue is ready. The saved Kids restriction still applies. Home and viewer show the installed version for device testing.
- Logo, Christmas room and guest portrait are packaged locally. Home in the menu and Back from the navigation menu return to the cards and stop playback.
- Sign in and Create account use the existing website account system directly on the TV: Roku email sharing or manual email entry, password keyboard, signup verification code and password recovery. Household profiles and membership status come from the website. The TV restores its own session after restart and can sign out without signing out the website. See [account setup and acceptance checks](../docs/ROKU_ACCOUNTS.md).
- A shared live viewer after Watch for free: inline video, now/next details, and a horizontal channel strip. It starts channel 1 when that channel is in the current audience's lineup, otherwise the first available channel.
- A live Now/Next guide available from fullscreen with OK or Left/Right, from the inline player with Right, and from the Live guide menu. Five large rows fit on each page. Arrow keys browse and page through the filtered lineup; OK tunes the selected station fullscreen. Video keeps running in a small header preview. Back restores the previous layout without seeking or retuning.
- Grouped on-demand library, four-column artwork grid, title search and resumed viewing. Library titles open fullscreen; Back returns to the same library.
- OK on the inline player opens fullscreen. Up/Down change live channels without leaving fullscreen; a five-second banner identifies the station and its controls. Back restores the browsing layout without replacing the Video node or seeking. Library playback retains native Roku transport; fullscreen Options remains available for captions/audio.
- Persistent Kids mode with a local four-digit parent PIN, bounded retry lockout, separate viewing history, and server-filtered channels, programmes and artwork.
- All seven free website themes: Christmas '96, Halloween '95, Halloween After Dark, Haunted Arcade, Neon CRT, Classic Cable 2006 and Bright Cable 2008. Seasonal room artwork and theme previews are packaged locally. Home, viewer, guide, cards, keyboard and PIN dialogs use the selected palette, including dark text for Bright Cable. Selection is saved on the device and marked in the theme grid; older Christmas/Classic Blue preferences migrate automatically.
- The guide shares the viewer's backdrop, with themed panels behind its text. Christmas uses forest-green panels and gold highlights throughout the viewer and guide. Neon CRT and both cable themes have lightweight full-screen gradient backdrops. The playing channel keeps a LIVE label; a contrasting outline identifies the remote selection. Preview cards show each theme's own colours and a clear Selected badge, without carrying that badge into recycled library cards.
- Cold and warm deep links, playback/network error screens, remote navigation, and launch-performance signalling.
- Live segment changes follow the station clock. Old source-position notifications and early file endings cannot repeatedly reopen or skip a short commercial. A decoder failure shows a safe error code, preserves navigation and retries at the next scheduled segment. OK retries the selected station immediately.

Fixed airtimes, day-specific campaigns and programme blocks use the Roku's configured time zone, including daylight-saving transitions. Ordinary browser dates keep their existing behaviour. The app reads the existing public programming database through `/api/roku/catalog` and `/api/roku/play`. Browsing refreshes every minute; the server coalesces reads for at most 15 seconds. New shows, posters and channel changes therefore require no app rebuild. Playback eligibility is checked again when tuning in. An expired cache is never used after a database failure.

The TV shares household profiles, saved lists, favourites, resume positions and theme preferences with the website. Profile editing, show requests, reactions and administration remain website features. All fourteen themes have native designs and account-checked premium access. The guide is Now/Next, not a full time grid. No payment or database credentials are packaged in the app.

## Build

Use Node 22.13 or newer and npm from the repository root:

```sh
npm --prefix roku ci
npm --prefix roku run build
npm --prefix roku audit
```

The output is `roku/dist/tates-tv-roku.zip`. The build derives the complete theme catalogue and colours from `lib/themes.ts`; a missing preview or seasonal background fails the build instead of hiding the theme. Roku uses native layouts and static artwork; website CSS effects and animations are not ported. All fourteen themes have native artwork, including Neon Noel. Premium themes require current account ownership or membership; labels distinguish Owned, Included and Locked. A generated copy of the existing Christmas logo is included during the build; do not commit `roku/images/logo.png`, `dist`, signing keys or signed packages. The compiler version and dependencies are locked. CI compiles and checks the package on each feature/master push.

The build removes obsolete generated theme images, verifies packaged assets and theme-to-node bindings, and checks at least 4.5:1 text contrast on the specified solid backgrounds. Translucent artwork, actual font sizing and TV display settings still require visual checks on a Roku.

Native regression checks run the actual component functions with mock nodes, network boundaries and time. All eleven suites are required in CI after the package build. To run them locally from `roku/`:

```sh
npm exec --yes --ignore-scripts --package=brs@0.45.0 -- node scripts/test-native.mjs
```

That interpreter is not a build dependency and is not included in the ZIP. Checks cover home/free/Kids entry, deferred tuning, deep-link priority, resizing, guide paging/selection/refresh, focus during delayed responses, Back, fullscreen channel arrows, strip navigation, selected-channel retry, commercial boundaries, decoder failure recovery, stale responses and VOD progress. They do not emulate SceneGraph rendering, networking, decoding or physical remote behaviour.

## Remote controls

| Context | Control | Behaviour |
| --- | --- | --- |
| Home | Left/Right, OK | Choose free viewing, sign in, create account or select a household profile |
| Household profiles | Left/Right, OK, Back | Browse portrait cards across pages, choose a profile, return |
| Account dialogs | Direction pad, OK, Back | Enter details, submit or cancel |
| Inline live player | OK | Open fullscreen; retry selected station if the clip failed |
| Inline live player | Down | Focus channel strip |
| Inline live player | Right | Open the live guide |
| Channel strip | Left/Right, OK, Up | Browse, tune, return to player |
| Menu | Up/Down, OK or Right | Browse navigation and open its content |
| Browse screens | Play | Open the current video fullscreen |
| Live guide | Up/Down, Left/Right | Browse channels, page by five |
| Live guide | OK, Back | Watch selected channel fullscreen, return without tuning |
| Library | Direction pad, OK | Browse and select titles |
| Episode list | Back | Return to its library |
| Browse screens | Back | Return to menu, then Home |
| Supported remotes | Channel Up/Down | Cycle the allowed live lineup, wrapping at the ends |
| Fullscreen live TV | Up/Down | Next/previous allowed channel, with wrapping |
| Fullscreen live TV | OK or Left/Right | Open the Now/Next guide with a video preview |
| Fullscreen | Back | Return to the viewer without seeking or restarting |
| Fullscreen library video | Play/Pause, Rewind, Fast Forward, Replay | Roku's native transport controls |
| Fullscreen | * | Roku's native caption/audio options where available |
| Browse screens | * | Viewer options and remote help |
| Any screen | Roku Home, volume, mute, power | System/TV controls; not intercepted by the app |

Live viewing follows the station clock and does not implement time-shifting. Pause and seeking are available for library titles. Captions require caption tracks in the source; the app does not generate them.

## Install on a test Roku

1. Deploy this website revision first, including `/api/roku/account`. `https://www.tatestv.ca/api/roku/catalog?audience=all` must return `ok: true` and `version: 1`. Follow [ROKU_ACCOUNTS.md](../docs/ROKU_ACCOUNTS.md) for email configuration and the backend readiness check.
2. Use a physical Roku on the same network as the computer, running Roku OS 11 or newer. Record its model and OS from **Settings → System → About**.
3. On the remote press **Home three times, Up twice, Right, Left, Right, Left, Right**. Enable the developer installer, accept the displayed developer terms, set a developer password and restart.
4. Open the device's displayed IP address in the computer's browser. Sign in as `rokudev` using the password set on the device. Upload `tates-tv-roku.zip` without unzipping it, then select **Install**.
5. A Roku holds one sideloaded development app at a time. Installing this replaces that development slot, not normal store apps.

Official instructions: https://developer.roku.com/dev/docs/developer-setup
Developer enrollment: https://developer.roku.com/enrollment/standard

## Device acceptance checks

Record results and the Roku model/OS before calling this release ready:

- Cold launch, warm launch, readable artwork, long titles, every menu and Back/Options behaviour.
- Launch without an account: Home must open first. Check the installed version at bottom right. Select Watch for free: the viewer must open and begin playing without another keypress. Test highlighted cards, left/right/OK, Sign in and Create account. Cancel keyboards and dialogs with Back; focus must return to the originating card. Restart with networking disconnected: navigation and Home must remain usable, and the viewer must show a retry message. Deep links must still open their target directly instead of first playing the default station.
- From Watch for free, confirm live video starts inside the viewer and now/next matches the station. Press OK for fullscreen, then Back: playback should continue at the same position. Press Down for the channel strip, Left/Right to browse and OK to tune. Up returns to the player; Back returns to the menu.
- In live fullscreen, press Up/Down through multiple channels and wrap at both ends. Confirm the picture stays fullscreen, each station matches its banner and the banner clears after five seconds. Open the guide with OK or Left/Right; browse with Up/Down and page with Left/Right. Back must restore the same fullscreen station without restarting. OK on the playing row must also return without restarting; OK on another row must tune it fullscreen. Repeat from the inline player using Right and from the Live guide menu. Check that delayed catalogue/play responses do not steal guide focus.
- Open the guide and library during playback: confirm the small header player continues, text and focus borders are readable, and scrolling stays responsive. Open a library title, then Back to its episode grid. Test a slow channel response while moving between menu, guide and library: completion must not steal browsing focus.
- Play a regular live channel through programme → commercial → programme; confirm picture/audio, source offsets after a mid-roll and after rejoining a channel. Check short back-to-back ads. A deliberately unavailable clip must show its error code and move on at the next scheduled segment without a modal. Back/Home must cancel recovery.
- Play MP4 and MKV files; test audio, captions, seeking and a resumed library title. File extensions alone do not establish codec compatibility.
- Disconnect/reconnect networking; verify an unavailable programme returns a usable error screen.
- Create a PIN, cancel/confirm it, enter Kids, restart the app, try an incorrect PIN, test the lockout and exit with the correct PIN. The app must remain in Kids after restart.
- From the home screen in Kids mode, Watch for free must retain the Kids filter; Create account must show the parent notice and return focus to the cards, including when dismissed with Back.
- Test approved Kids titles and blocked adult deep links. Review every programme and eligible ad before approving a Kids channel in the website admin.
- Select every free theme and check its artwork, grid badge, guide, keyboard and PIN colours. Restart to confirm persistence. Check independent Household/Kids bookmarks. In Bright Cable, unfocused text must be dark and text on selected blue controls must be white.
- For v0.1.9, confirm Themes shows **14 themes**, with seven free styles and account-checked premium access. Select Christmas, open the guide and look for green panels, gold highlights and the Christmas backdrop. Browse away from the playing row: LIVE must stay on the tuned channel while the contrasting outline moves with the remote. Repeat with the other six styles, then open the library to check that theme badges do not persist on title cards. Switching themes must not restart the live video.
- Complete the signup, sign-in, recovery, session, profile and Kids checks in [ROKU_ACCOUNTS.md](../docs/ROKU_ACCOUNTS.md).
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
