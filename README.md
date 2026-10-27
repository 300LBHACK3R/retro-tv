# Tate’s TV

A Canadian streaming station with a nostalgic live guide, scheduled channels and an on-demand library. Next.js App Router, React, TypeScript and Zustand run the viewer; Supabase stores station programming and Cloudflare R2 serves media. GitHub and Vercel remain the production deployment path.

## Develop

Use Node.js 22 LTS. From the project folder:

```powershell
npm ci
npm run dev
```

Keep the existing environment configuration private in `.env.local`. Required server values are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` and a separate random `ADMIN_SESSION_SECRET` (at least 32 characters recommended). Set `NEXT_PUBLIC_SITE_URL=https://www.tatestv.ca` for the production canonical address. Upload configuration is documented in [uploads and submissions setup](docs/PREMIUM_UPLOADS_AND_SUBMISSIONS_SETUP.md).

Never prefix service keys, passwords or signing secrets with `NEXT_PUBLIC_`. A source checkout without environment values still builds; cloud programming and protected services require the configured environment.

## Project organization

Keep this repository as one project folder. `app/` owns pages, API routes and styles; `components/` owns viewer/admin interfaces; `lib/` owns shared behavior, with privileged services in `lib/server/`. `public/` contains published assets, `supabase/migrations/` contains database history, `tests/` contains verification, and `docs/` contains operating instructions.

Use `npm run clean` to remove generated builds, browser reports and caches. It preserves source, original artwork, environment files and database migrations. Historical channel-logo paths can be referenced by saved cloud programming even when they have no literal source-code reference.

See [launch audit and remaining activation work](docs/LAUNCH_AUDIT.md) before advertising paid memberships.

## Viewer features

- Live playback with bounded connection retries, offline recovery, autoplay prompts and programme reporting.
- A 72-hour desktop guide and a mobile **On now** list, using the same schedule as the player. On mobile, the same live player stays visible above a compact cable-style list: station logos on the left, current and next programmes on the right, with category tabs, search and favourites. Tap a live programme to tune while keeping the guide open. **Schedule** opens that channel’s upcoming day of listings; time jumps, local day labels and **Show more programmes** make longer schedules readable. Returning to On now restores your place. Upcoming mobile listings never change playback. Desktop listings tune the channel’s current broadcast and support row density and directional keys.
- The live page stays focused on playback and channel controls; browse programmes in the Guide or the on-demand Library.
- Channels attempt playback as soon as their source is selected. If the browser blocks sound, playback retries muted with a **Turn on sound** button; a Play permission prompt remains only for devices that also block muted playback. Source interruptions do not produce false autoplay warnings, and channel changes sharing a media file reuse its buffer. Startup waits for the real live clock before choosing a programme.
- Favourite channels, a programme watchlist and on-demand resume saved on the current browser. They are separate from cloud programming updates. Storage being blocked must not prevent playback.
- Thirteen themes, free during launch until billing is explicitly enabled, including premium Midas Gold, Electric Blue and **Christmas ’96: Living Room**. Open **Themes** beside the profile on the homepage. Seasonal themes are grouped by Christmas and Halloween, with full-card previews and desktop/portrait artwork. Each profile’s chosen theme is saved in this browser and survives refreshes, navigation, new visits and profile switching. The entrance uses Halloween ’95 until **November 1, 2026 at midnight in Calgary (America/Edmonton)**, then switches automatically to Christmas ’96, including its wordmark. This calendar change never replaces a saved profile choice. The pre-hydration script restores the correct colours before React loads. More > Reduce motion and device accessibility preferences remove motion; hidden tabs pause animations. If browser storage is blocked, choices last only for the current visit. Parent accounts sync these preferences; paid access remains disabled until the provider setup and launch checks are complete.
- Mobile theme selection opens without focusing search, uses one scrollable library and keeps Close/Done above the keyboard. The mobile guide has a sticky On now bar with Find/Your channel shortcuts, a sticky schedule Back bar and compact filters. Full-page seasonal artwork adapts to phones and stays behind the viewer controls.
- Poster artwork with a title-based fallback when artwork is absent or cannot load.

## Profiles, Kids mode & channel categories

The viewer supports up to five profiles per browser/device. Main retains existing favourites, watchlist and progress; other profiles have separate saved items and progress. Each profile has its own saved theme choice on this browser/device. The selected profile lasts for the tab session. Normal Live TV visits start on **Channel 1**; explicit allowed `?ch=` tune links still work.

Twenty-two locally hosted portraits are available in six labelled groups: Fox family, Cats & robots, Dragon family, Pirates, Everyday heroes and Faith. The four-column grids wrap and scroll on phones. Stored Fox, Robot and Cat IDs remain valid; retired Dinosaur selections move to Boy dragon and Space explorer selections move to Boy fox. Profile names, Kids restrictions, favourites and history are preserved. Choosing any portrait never changes Kids approval. Build-time WebP thumbnails load directly; the PNG originals remain the editable source.

The seasonal profile entrance places real character portraits over a nostalgic VHS living room. The artwork fills the viewport on phones and larger screens, and seasonal lighting continues through PIN and profile editing screens. New tab sessions open the seasonal profile chooser; selecting a profile restores its saved theme. Profiles without a choice start with the current entrance theme.

Use the profile button to switch viewers. The chooser offers Add profile directly; Manage profiles opens editing for names, avatars and Kids settings. Back, Cancel and Escape return to the previous screen and restore focus. PIN entry supports show/hide, corrected-input focus and a countdown after repeated wrong attempts. Deleting a profile requires a separate confirmation. Kids profiles require a 4–8 digit parent PIN. Once set, opening a full-lineup profile or profile management requires that PIN. Changing it requires access to management; cancelling preserves the old PIN. Switching removes the viewer, pauses local media, and stops casting. New pages do not automatically rejoin another profile's Cast queue. Directional keys work on the profile picker.

**Admin → Audience & Channels** provides categories and explicit Kids approvals. Review programmes and ads before approving them. A Kids channel must be approved and contain only approved media across its regular lineup and recurring blocks, plus all ads eligible for that channel, including future campaigns. Unreviewed or missing items hold the whole channel out of Kids mode; removing individual programmes would shift the live broadcast clock. Changes to files, posters, titles, descriptions or runtimes clear media approval. Save reviewed programming to the cloud using the existing admin controls.

**To populate Kids:** choose a children’s channel in Audience & Channels, select **Review this lineup**, show the complete list and review every programme and ad. Confirm the review, then choose **Add reviewed lineup to Kids**. The action also puts that channel in Kids & Family. Missing media blocks approval; changing the reviewed content invalidates confirmation. Use **Save** beside the cloud status to publish the reviewed programming. Parent profiles retain the full lineup.

**No existing programming is automatically approved.** Until Channel 1 qualifies, Kids sees a welcome slate with no media or ads. Faith and cartoon categories are browsing labels, not age ratings. Categories filter the guide and directory without changing channel numbers or playlists.

A verified free parent account is required before opening the viewer, library or TV mode. Parents add Kids profiles inside their household; paid membership remains optional. Account profiles, favourites, watchlists and themes sync across devices; see [account and membership activation](docs/ACCOUNTS_AND_MEMBERSHIP.md). The parent PIN is salted and hashed with PBKDF2, with a delay after repeated wrong attempts. These are household controls inside the application, not private media authorization. Clearing browser data does not remove the account’s saved PIN; public video/programming URLs remain public. Registered accounts support email confirmation and password recovery; media remains public. Stripe theme purchases and monthly, six-month and annual memberships are staged behind configuration flags and require provider setup before activation.

## Schedule recurring blocks

**Admin → Channel Lineup** has Up, Down and Move to controls. Moving Channel 3 down makes it Channel 4; the previous Channel 4 becomes Channel 3. Moves renumber the complete station from 1, including off-air channels. Permanent channel IDs, programming, branding, favourites and ad assignments stay with their station. Changes save automatically; confirm the cloud status before leaving, or use its Save button.

Choose **Add Halloween channels** to create **Friday Night Horror** and **Halloween Kids** once. Both start off air, without programmes or ads. Use **Add shows** in their rows to select existing media without removing it from other channels; use Add Media for new uploads. Turn on each channel when ready. Horror is marked Adults only and cannot pass Kids review. Review Halloween Kids in **Audience & Channels** before adding it to Kids profiles; its name/category alone grants no approval. These are profile filters, not server-enforced age verification.

Use each channel's **Schedule blocks** button for recurring Friday nights. The Horror and Kids presets fill in a title and time; select actual programmes and save the block. A channel's name does not restrict it to Fridays automatically.

Open **Admin → Blocks**, select a channel, title, weekdays, local start time, duration and programmes. Presets provide starting points for cartoons, movie nights and late-night programming. Save the station to the cloud using the existing admin control.

Programmes play in the chosen order, repeat if the window is longer, and may be clipped at the window boundary. Durations are elapsed minutes. Blocks cannot overlap or be configured past local midnight. Imported invalid overlaps are ignored. Unconfigured channels retain their existing broadcast clock and commercials. The shared guide/player clock supports 23-hour and 25-hour local days.

Schedules currently use each viewer’s local timezone, matching the existing station scheduler. They are not a single Calgary-time broadcast feed worldwide.

## Upload and schedule commercials

### Batch uploads and existing R2 links

Open **Admin → Batch Import** to prepare up to 200 videos together. Choose the channel, media type and upload folder once. Select multiple local videos (MP4/WebM/MOV/M4V, up to 4.9 GB each), or paste existing public HTTPS video URLs to avoid reuploading. Filenames provide editable titles; **Sort by title / episode** uses numeric ordering. **Prepare / retry selected items** reads actual runtimes and uploads local files two at a time. Unsupported or unreadable files show individual errors; they do not stop the rest of the batch. Uploading does not transcode or verify every browser's codecs.

Review titles, runtimes and assignment, check the review checkbox, then **Add ready items to station**. Programmes append in queue order; commercials enter the selected channel's ad inventory without entering its programme playlist. Duplicate URLs are skipped again at commit time. Existing content and assignments are preserved. An optional end-break setting applies only to new shows/movies and enables targeted end-break ads on that channel; existing eligible ads are still required. No mid-show cuts or Kids approvals are inferred. Review new content in **Audience & Channels**, and confirm **Global saved** before leaving.

Keep the browser tab open during preparation. Draft metadata is stored in that tab's session storage, never signed upload URLs or video bytes. Refreshing or switching admin tools keeps completed public URLs; reselect unfinished local files to reconnect them. Pause/retry restarts unfinished transfers, while successful uploads are retained. This is not background or multipart-resumable uploading. Removing a queue entry never deletes its R2 file. Reusing the same URL is detected as a duplicate; a new URL for the same footage is not a content-hash duplicate check.

### Commercial campaigns

Admin tools are grouped by task and searchable. Panels load when opened. **Commercials** brings uploading, targeting, break setup and a schedule preview together; existing playlists and custom timing remain editable in their original tools.

1. Open **Admin → Commercials → Upload a commercial**. Choose the video, select **Upload to R2**, check the detected runtime and target channel, then select **Add Media**. Uploading alone does not register the commercial. Use a browser-compatible video; uploading does not transcode it.
2. Return to the commercial inventory. Choose the ad, select its channels and allowed breaks, optionally add advertiser/campaign details, then **Save campaign**. Selecting no channels pauses the ad without deleting the file. Network-wide targeting includes future channels that accept global ads.
3. Choose a channel under **Channel break setup**, pick an end-break target and review the affected programmes. **Apply end breaks & enable targeted ads** configures only unconfigured shows/movies. Shared titles, custom timing and fixed air times are skipped. Use Quick Edit for those or for carefully chosen mid-show breaks. Applying a preset changes schedule timing.
4. **Generate schedule preview** to see the scheduler's result. Whole commercials must fit the available time; remaining time is not padded with a blank screen. A longer commercial only plays partially when slicing was explicitly enabled in Quick Edit. Ads may repeat within a break. Music-video break settings remain in Playlist.
5. Confirm **Global saved**, or use the cloud Save control, before leaving. Preview after changing campaign rules or channel permissions. Review every ad explicitly before allowing it on a Kids channel; the setup action never approves content for Kids.

Campaign weekdays use each viewer's local broadcast day. Existing daily time restrictions are evaluated at that day's start, not continuously; they are retained but not presented as reliable hourly campaign scheduling. The preview starts at the generated schedule's beginning; it is not a promise of the next live item, paid impressions, frequency capping or advertiser billing. No new service, database migration or dependency is required.

## Station insights setup

Apply [the station insights migration](supabase/migrations/20260911_station_insights.sql) once in the existing Supabase project’s SQL editor. It creates a separate, private playback table and three service-role-only functions. It does not modify programming or submissions. Reapplying it is safe.

Set `ADMIN_SESSION_SECRET` in Vercel if it is not already configured. **Admin → Insights** shows seven-day watch time, returning-device estimates, starts, buffering, errors, reports and content issues. Records older than 30 days are pruned during collection and report refresh. DNT/GPC clients are excluded; casting sessions are excluded. Counts represent participating browser installations, not unique people, and should not be used for billing.

Media link checks only probe the exact HTTPS origins configured in `R2_MEDIA_PUBLIC_BASE_URL` or `R2_PUBLIC_BASE_URL`; they do not follow redirects. Other media URLs remain playable but are marked unverified by the checker. A successful HEAD response is not proof of codec/device playback.

Missing metrics configuration disables collection without interrupting viewing. No migration is executed by a build, viewer request or release helper.

### Traffic, retention and reliability

After the station migration, apply [growth analytics](supabase/migrations/20260916_growth_analytics.sql) in the same Supabase SQL editor. **Admin → Insights** adds public page views, returning-device estimates, devices starting playback, a seven-day UTC trend, traffic-source categories, theme/guide use, TV connections and browser/device error breakdowns. The existing watch-time and channel reports remain available. `ADMIN_SESSION_SECRET` and the existing server-only Supabase configuration are required. Missing setup produces an explicit message in Insights, not invented zero counts.

Only selected full-lineup profiles participate. Kids profiles, private routes, DNT/GPC and viewers who opt out on `/privacy` are excluded. Profile names, profile IDs, PINs, search text, raw user agents, IPs and raw referrer URLs are not stored in the event tables. Pageview URLs sent to Vercel have queries and fragments removed. Existing data collected before this release is not retroactively classified by profile type. The signed random device cookie expires after 30 days; returning counts mean a browser identifier created on an earlier UTC day, not registered users. Blockers, shared devices and storage clearing affect counts. Events are best-effort, rate limited, deduplicated by UUID and retained for at most 30 days during active collection/report refresh. They are not suitable for ad billing. Cast receiver watch time and failures before JavaScript/profile startup are outside this report.

Enable **Web Analytics** in the Vercel project's Analytics tab for its traffic dashboard; first-party Insights does not require Vercel custom-event billing or a new tracking vendor. This update does not change a hosting plan. Raw event tables and RPCs are accessible only to the server service role, and the report endpoint requires admin authentication.

### Search and sharing

Public routes include canonical URLs, descriptions, Open Graph/Twitter previews, structured Website/Organization/WebApplication data and a sitemap at `https://www.tatestv.ca/sitemap.xml`. Private/admin routes stay excluded from indexing. To verify search ownership, set the actual token supplied by Google Search Console as `GOOGLE_SITE_VERIFICATION`, or Bing Webmaster Tools as `BING_SITE_VERIFICATION`, in Vercel, redeploy, then submit the sitemap. Verification and search traffic cannot be confirmed until those services are connected. No fabricated ratings or video metadata are published.

### Safari startup

Programming, player preferences and saved-library storage tolerate blocked reads and quota failures without clearing existing data. Unsupported storage falls back to the current tab's memory. Profile startup and controls are covered by Node regression checks plus browser tests for denied storage and full quota. The Next.js/Tailwind versions used here target Safari 16.4 or newer. Audible autoplay may require tapping Play; physical iPhone/iPad/macOS Safari and TV handoff still need device testing.

## Source map

| Location                                                          | Responsibility                                                   |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `app/`                                                           | Routes, API endpoints, metadata and shared styles                |
| `components/admin/`                                              | Admin dashboard, programming, uploads and station management      |
| `components/themes/`                                             | Theme picker, previews, seasonal scenery and runtime              |
| `components/library/`                                            | Posters, title details and coming-soon presentation               |
| `components/viewer/`                                              | Viewer controls, guide, saved items, recovery and navigation |
| `components/MultiGuide.tsx`                                       | Responsive guide presentation and visible timeline rendering     |
| `components/viewer/MobileGuide.tsx`                               | Mobile channel comparison and paged channel schedules            |
| `lib/guideTimeline.ts`                                            | Guide projection from broadcast schedules                        |
| `lib/liveEngine.ts`, `lib/scheduler.ts`, `lib/programmeBlocks.ts` | Shared clock, commercials and recurring windows                  |
| `lib/themes.ts`, `app/styles/themes/`                             | Theme tokens and visual effects                                  |
| `lib/deviceLibrary.ts`, `lib/libraryCatalog.ts`                   | Device saves, grouping and validated resume records              |
| `app/api/`, `lib/server/`                                         | Authentication, input limits, storage access and metrics         |
| `supabase/migrations/`                                            | Reviewed database migrations                                     |
| `tests/`                                                          | Unit, production HTTP and browser regression checks              |
| `scripts/dev.mjs`                                                 | Required portable Next.js development launcher                   |
| `public/`                                                        | Stable URLs for portraits, logos, themes, icons and service worker |
| `docs/`                                                          | Setup, launch and app-store reference documents                  |

## Phone playback

Phones use their hardware volume. The local video ignores saved desktop volume/mute settings; a tap-to-start prompt still handles browser autoplay restrictions. TV volume remains available when controlling a Cast receiver, since it is a different device.

Rotate to landscape to fill the web viewport; portrait restores the page. Native browser chrome is controlled by the browser, so the app does not depend on a fullscreen API gesture. Opening the guide keeps the same video mounted above the listings. Choose **More > Mini** for the floating player; it remains floating through rotation and returns after closing the guide. No phone remote, volume slider or fullscreen-entry button is shown. The on-screen remote remains available on desktop and in TV mode.

## Watch on TV

The player's **Watch on TV** button opens the supported device picker directly: AirPlay when the video exposes Safari's AirPlay API, Google Cast when its SDK is ready, or the browser's Remote Playback picker when available. Connection status comes from the receiver/browser, not from opening a picker. Cancelling does not show an error. The connection sheet includes retry, stop casting, channel selection and receiver volume where supported.

On Samsung phones, a Roku stick uses **Smart View** screen mirroring; it is not a Google Cast receiver. The connection sheet shows the Samsung steps. Compatible Apple devices can use AirPlay to supported Roku models. Direct Android-to-Roku app casting requires a native sender and a matching Roku app; the website and its installable PWA do not implement that integration. TV Mode links are for devices with a web browser, not Roku pairing.

Cast initialization waits for Google's asynchronous SDK callback with a bounded fallback instead of treating script download completion as SDK readiness. An older failed channel load cannot launch a fallback over a newer selection. AirPlay/Remote Playback connections bypass the local network-retry watchdog and periodic drift correction; explicit tuning and programme transitions still use the live schedule. A browser tab can be suspended by the phone, so uninterrupted scheduled playback with the phone asleep must be verified on real hardware and ultimately needs a receiver-owned live stream or native app.

Connection references: [Google Web Sender support](https://developers.google.com/cast/docs/web_sender), [Roku app casting](https://support.roku.com/article/360002990094), [Roku screen mirroring](https://support.roku.com/article/screen-mirror-your-phone-tablet-or-computer), [Roku AirPlay](https://support.roku.com/article/360057488733).

## Keep one clean working folder

Use `C:\Users\techn\retro-tv` as the main Windows checkout. Apply updates there instead of creating new review folders. Keep the source directories, public assets, dependency lockfile, configuration, migrations and tests together; each has a separate purpose in the build or station maintenance.

Stop any running development or test server, then use `npm run clean` to remove generated Next.js output, build folders, TypeScript cache, coverage and browser reports. `npm ci` recreates dependencies when needed. These generated files do not belong in source archives. Keep private environment settings and local media outside shared archives.

Admin, themes, library and viewer components have dedicated subfolders inside this one project. Keep `app/`, `lib/`, `public/`, tests and configuration in their framework locations; moving everything into a flat directory would break routing and public asset URLs. Do not keep another copy of the source inside this folder.

Old installers and release ZIPs belong in Downloads, not in the source tree. Local backup copies and one-time Tate's TV update downloads are ignored by Git. Before removing a separate Windows review folder, check `git worktree list`, its uncommitted changes, and whether it contains unique environment settings or media. `npm run clean` only removes reproducible build output; it does not remove other checkouts, source files, profiles, environment settings or uploads.

The source audit removed unused scheduling and text helpers, abandoned reaction definitions, unused cookie setters, an obsolete theme stylesheet and selectors for retired screens. Theme layout lookup now lives in the theme registry. Active migrations, recovery routes, tests, artwork and installed-app icons remain necessary. Channel logos may be referenced by cloud programming even when their filenames do not appear in source code; do not delete public artwork based on import searches alone. Git history retains removed source.

## Quality gates

```powershell
npm run typecheck
npm run lint
npm run test:unit
npm run audit:prod
npm run build
npm run test:http
npx playwright install chromium firefox webkit
npm run test:browser
```

`Viewer quality` runs these gates in GitHub for pull requests, master and the release branches. Its seven browser profiles cover desktop Chromium, Firefox and WebKit, Android/iPhone/tablet emulation and a 1920×1080 TV viewport. Browser fixtures do not access production programming, analytics or Cast devices.

`npm run typecheck` generates Next.js declarations before invoking TypeScript. This makes checks reproducible on a fresh checkout, including static image imports, without relying on a previous development server or build. Keep the generated `next-env.d.ts` file out of version control.

Profile styles are imported directly by the root layout. The build and HTTP checks verify that the CSS linked by `/`, `/library` and `/tv` actually contains the profile layout rules. Vercel uses the same build command, so an asset missing those styles fails the deployment build. Browser checks also assert styled cards and usable PIN controls; a successful click alone does not establish that the layout loaded.

Automated browser profiles do not certify physical TVs or every historical browser. Before production promotion, verify real iPhone/Safari, Android/Chrome, supported desktop browsers and the target TV/remote: video start, channel changes, extended playback, offline/reconnect, scrolling, focus, fullscreen, AirPlay/Cast and reduced motion. Use the station’s real media encodings as well as the synthetic test clip.

## Security and SEO

Public pages have route-specific canonical, Open Graph and Twitter metadata. The sitemap contains public discovery pages; admin and recovery tools are marked noindex. API responses and private tools use no-store rules, and the service worker excludes APIs, live HTML, media and private pages.

Authenticated mutations require same-origin requests, sensitive bodies are size-bounded, login attempts are throttled and metrics have signed HttpOnly browser identifiers plus database-side collection limits. The in-memory login limiter is per process; configure a shared Vercel Firewall limit for distributed abuse protection. The CSP retains the existing inline hydration allowance and HTTPS media access for station-configured sources. This is not a claim of a full security audit.

See [launch checklist](docs/LAUNCH_CHECKLIST.md) and [privacy page](app/privacy/page.tsx).

## Original portrait assets

`public/avatars/` contains the 22 character portraits supplied for Tate’s TV. The family and character portraits replace the retired `fox.png`, `robot.png`, `explorer.png` and `dinosaur.png` files. Doctor images use the filenames `maledoctors.png` and `femaledoctors.png`. The installer reads the actual PNG files already in the owner’s local `public/avatars/` folder, validates them and commits them with the picker update. It does not generate or substitute artwork. Portraits are not programme artwork or Kids suitability labels.

`npm run dev` and `npm run build` automatically prepare 512-pixel WebP copies in `public/avatars/portraits/` using Next.js’s installed Sharp dependency. Those generated files are ignored by Git; the PNG originals remain the editable source. The profile picker serves the small WebP files directly so interrupted loads/reloads cannot stall in the runtime image optimizer. After replacing a PNG while development is already running, use `npm run prepare:portraits` to refresh its preview.

`public/themes/haunted-arcade-{world,mobile}.webp` contains original scenery expanded with the built-in image-generation tool on September 15, 2026. Prompt direction: recompose the original ultra-wide 16-bit haunted arcade courtyard into full-page desktop 16:10 and phone 2:3 compositions; preserve mint/violet cabinets, pumpkin lanterns and a black cat on the left, the crooked arcade tower and mint moon on the right, friendly ghosts, violet mountains, mist and wet cobblestones; keep the centre dark and calm for real app content, with rich detail around the edges; no text, logos, gore or franchise characters. The 288/227 KiB WebP sources replace the old banner artwork. A responsive picture downloads the chosen composition; CSS ghosts, cabinet light, moonlight, mist and embers stay behind playback and controls. The scene loads only when Arcade is selected.

`public/themes/halloween-after-dark-{world,mobile}.webp` contains original scenery generated with the built-in image-generation tool on September 15, 2026. Prompt direction: a painted moonlit haunted manor, twisted trees, glowing jack-o-lanterns, friendly skeletons at the gates, a harvest moon and misty violet hills; a quiet dark centre, detail around the edges, no text, logos, gore or franchise characters. The portrait companion places a skeleton with a lantern at the bottom right. The optimized source images are 240/207 KiB; a responsive picture selects one composition and Next.js delivers its appropriate size. The scene loads when After Dark is selected; CSS witch, skeleton arm, fog, lantern light and embers animate without timers or playback hooks. Hidden tabs pause motion; OS/app reduced motion removes it. These assets replace the former small After Dark SVG vignette.

`public/themes/halloween-90s-{world,mobile}.webp` contains original desktop and portrait artwork for Halloween '95: Be Kind, Rewind. The VCR has one tape aligned with its slot. This default scene renders in the initial HTML on the profile screen and viewer, with lighting and dust that respect reduced motion. `public/themes/previews/` holds compact screenshots of the real guide styles using fictional sample programming. Theme previews are lazy-loaded, sized images; the theme picker never loads video for its cards. Update the corresponding preview when a theme's appearance changes.

### Library artwork and upcoming titles

Open **Admin → Artwork & Coming Soon** to upload a JPG/PNG/WebP poster or paste an HTTPS artwork URL. A shared title poster covers every episode in that series, including future uploads. Portrait artwork at a 2:3 ratio fits best. Browser uploads resize images to a maximum edge of 1500px before sending them directly to the station's existing R2 media bucket. This uses the same R2 credentials, public URL and CORS configuration as media uploads; no database migration or new secret is required.

Review posters separately for Kids. Kids libraries use the existing reviewed-video catalog: reviewing a Kids channel's full lineup also approves its programmes, which then appear automatically in the library. Individual video review is available in this panel. New uploads are not automatically approved; a channel category alone does not grant Kids access. No approved videos means an empty Kids library. Parent profiles retain the full library. Device profiles remain a convenience control, not server-authenticated accounts.

Add upcoming titles, artwork, a description, and an optional arrival label/channel. Drafts are visible only to authenticated admins; published announcements appear in the library and below live channels. Kids require explicit announcement approval, and a linked channel must be a reviewed Kids channel. A poster is required before publishing. Arrival labels do not schedule playback: use Programming/Programme Blocks for that. Only announce content you are ready to offer; the update includes no invented future shows or replacement poster artwork.

Wait for **Global saved** before leaving admin. Station export/import includes title artwork and upcoming announcements. Refresh older open admin tabs after deploying this version so they cannot overwrite the new fields. The library preserves each profile's watchlist and viewing progress, loads video only on request, and keeps search and scroll position when closing title details.
