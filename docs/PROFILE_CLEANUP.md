# Profile entrance and native cleanup — v0.1.11

The website profile chooser puts its logo, heading and portraits directly on the
theme backdrop. Seasonal pages use a soft contrast wash with no framed panel.
PIN entry and profile editing keep their compact form panels. Account access,
profile management, focus restoration and Kids authorization are unchanged.

Roku household selection reuses the home portrait cards instead of a system
message dialog. Left/Right pages through at most three portraits at a time; OK
submits the selected profile's ID for server authorization. Back retains the
previous audience and returns to the previous title/channel. Adult selection
still requires the account parent PIN where configured. Canceling local PIN
setup restores the picker instead of leaving its selection inactive.

Both clients use `lib/profilePortraits.ts`. Roku packages all 22 portraits as
small optimized PNGs; the build checks each file. The native logo is resized to its display needs; the full-size website originals are preserved. Unknown IDs use the guest portrait.
The old profile-button dialog branch and obsolete chooser/container CSS were
removed rather than maintained alongside the new screen.

The release includes the v0.1.10 JSON-key/sign-in repair. It also guards Favourite
channels while the catalogue is loading and preserves each theme's intended
backdrop opacity when moving between Home and the viewer.

## Keep one project

Use the existing `C:\Users\techn\retro-tv` checkout. Source stays in `app/`,
`components/`, `lib/`, `roku/`, `public/`, `tests/`, `supabase/` and `docs/` under
that one root. These directories have distinct build/runtime responsibilities.
Do not flatten them or remove migrations and historical artwork URLs.

`npm run clean -- --dry-run` previews cleanup. `npm run clean` removes only
reproducible web/Roku builds, caches, resized portraits and test output. Stop
development/test servers first. Original PNG artwork, private settings, source,
lockfiles, dependencies and migrations remain. Builds regenerate required files.

## Release and acceptance

The source update is based on production `314c78a` and includes the previously
unpublished `957f7a1` sign-in hotfix. No database migration or new secret is needed.
Publish the fix branch, require **Viewer quality** success for its exact commit,
then fast-forward production normally. Never force-push over newer work.

Build the installable native archive with `npm --prefix roku ci` and
`npm --prefix roku run build`. Upload the standalone **tates-tv-roku-v0.1.11.zip**
to the developer installer, using **Replace with zip** (or **Install with zip**
when the development slot is empty). Do not upload a source/recovery bundle.

The native test runner requires explicit PASS completion from all eleven suites;
an interpreter STOP or zero exit status alone is not success. CI runs every suite
after package verification. Off-device tests do not certify physical rendering,
Roku networking, media decoders or remote timing.

On the TV, verify sign-in and choosing Main/Kids, persistent login after restart,
the correct portraits, fourth/fifth profile paging, cancel/retry/Back focus,
parent PIN rejection and cancellation, Continue Watching/watchlists/favourites,
owned themes and normal live/guide/library playback. Confirm the prior channel
or title returns when canceling profile selection. Record model and Roku OS.

Kids content approval remains separate. This release does not approve the
pending Tow-N-Go advertisement or weaken the approved-channel filter.
