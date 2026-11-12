# Tate's TV — Roku device-test build

This is a native BrightScript/SceneGraph app, not a website wrapper. It is an unsigned development build. Compilation and server tests do not establish Roku hardware compatibility or store approval.

## Included

- Live channel list with current/next listings and playback from the station clock.
- Grouped on-demand library, title search, cover images and resumed viewing.
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
- Play a regular live channel through a programme/ad boundary; confirm source offsets after a mid-roll and after rejoining a channel.
- Play MP4 and MKV files; test audio, captions, seeking and a resumed library title. File extensions alone do not establish codec compatibility.
- Disconnect/reconnect networking; verify an unavailable programme returns a usable error screen.
- Create a PIN, cancel/confirm it, enter Kids, restart the app, try an incorrect PIN, test the lockout and exit with the correct PIN. The app must remain in Kids after restart.
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
