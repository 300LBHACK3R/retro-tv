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

## Viewer features

- Live playback with bounded connection retries, offline recovery, autoplay prompts and programme reporting.
- A 72-hour desktop guide and a mobile **On now** list, using the same schedule as the player. On mobile, the same live player stays visible above a compact cable-style list: station logos on the left, current and next programmes on the right, with category tabs, search and favourites. Tap a live programme to tune while keeping the guide open. **Schedule** opens that channel’s upcoming day of listings; time jumps, local day labels and **Show more programmes** make longer schedules readable. Returning to On now restores your place. Upcoming mobile listings never change playback. Desktop listings tune the channel’s current broadcast and support row density and directional keys.
- The live page stays focused on playback and channel controls; browse programmes in the Guide or the on-demand Library.
- Favourite channels, a programme watchlist and on-demand resume saved on the current browser. They are separate from cloud programming updates. Storage being blocked must not prevent playback.
- Eleven themes, all free. **Halloween After Dark** is the starting theme on every fresh page load and profile selection. Its full-page moonlit manor, friendly skeletons, pumpkins, flying witch and fog render with the initial HTML, including behind the profile chooser. **Haunted Arcade** is a separate full-page pixel world with glowing cabinets, pumpkin lanterns, a haunted tower, friendly ghosts, mist and violet-green light. Both have desktop and portrait compositions and coordinated guide/menu surfaces. Theme changes stay in memory across client-side navigation; a refresh, new visit or profile switch returns to After Dark. Old saved theme choices are discarded without touching profiles, PINs, favourites or progress. There is no pause-effects button. More > Reduce motion and the device accessibility preference still remove motion, and the app setting is remembered. Hidden tabs pause animations. Accounts, payments and saved theme preferences are deferred.
- Mobile theme selection opens without focusing search, uses one scrollable library and keeps Close/Done above the keyboard. The mobile guide has a sticky On now bar with Find/Your channel shortcuts, a sticky schedule Back bar and compact filters. Full-page seasonal artwork adapts to phones and stays behind the viewer controls.
- Poster artwork with a title-based fallback when artwork is absent or cannot load.

## Profiles, Kids mode & channel categories

The viewer supports up to five profiles per browser/device. Main retains existing favourites, watchlist and progress; other profiles have separate saved items and progress. Themes are temporary for the current visit. The selected profile lasts for the tab session. Normal Live TV visits start on **Channel 1**; explicit allowed `?ch=` tune links still work.

Twenty-two locally hosted portraits are available in six labelled groups: Fox family, Cats & robots, Dragon family, Pirates, Everyday heroes and Faith. The four-column grids wrap and scroll on phones. Stored Fox, Robot and Cat IDs remain valid; retired Dinosaur selections move to Boy dragon and Space explorer selections move to Boy fox. Profile names, Kids restrictions, favourites and history are preserved. Choosing any portrait never changes Kids approval. Next image optimization serves thumbnails instead of full-size originals.

The After Dark profile entrance places real character portraits over a quiet moonlit background. The artwork fills the viewport on phones and larger screens, and seasonal lighting continues through PIN and profile editing screens. New tab sessions open the profile chooser; returning to it resets the theme to After Dark. The old inline seasonal banner and its unused wrapper component have been removed.

Use the profile button to switch viewers. The chooser offers Add profile directly; Manage profiles opens editing for names, avatars and Kids settings. Back, Cancel and Escape return to the previous screen and restore focus. PIN entry supports show/hide, corrected-input focus and a countdown after repeated wrong attempts. Deleting a profile requires a separate confirmation. Kids profiles require a 4–8 digit parent PIN. Once set, opening a full-lineup profile or profile management requires that PIN. Changing it requires access to management; cancelling preserves the old PIN. Switching removes the viewer, pauses local media, and stops casting. New pages do not automatically rejoin another profile's Cast queue. Directional keys work on the profile picker.

**Admin → Audience & Channels** provides categories and explicit Kids approvals. Review programmes and ads before approving them. A Kids channel must be approved and contain only approved media across its regular lineup and recurring blocks, plus all ads eligible for that channel, including future campaigns. Unreviewed or missing items hold the whole channel out of Kids mode; removing individual programmes would shift the live broadcast clock. Changes to files, posters, titles, descriptions or runtimes clear media approval. Save reviewed programming to the cloud using the existing admin controls.

**To populate Kids:** choose a children’s channel in Audience & Channels, select **Review this lineup**, show the complete list and review every programme and ad. Confirm the review, then choose **Add reviewed lineup to Kids**. The action also puts that channel in Kids & Family. Missing media blocks approval; changing the reviewed content invalidates confirmation. Use **Save** beside the cloud status to publish the reviewed programming. Parent profiles retain the full lineup.

**No existing programming is automatically approved.** Until Channel 1 qualifies, Kids sees a welcome slate with no media or ads. Faith and cartoon categories are browsing labels, not age ratings. Categories filter the guide and directory without changing channel numbers or playlists.

Profiles require no signup or database migration and do not sync across devices. The parent PIN is salted and hashed with PBKDF2, with a delay after repeated wrong attempts. These are household convenience controls: clearing browser data resets them, and public video/programming URLs remain public. There is no email recovery. Accounts and server-enforced media authorization remain future work.

## Schedule recurring blocks

**Admin → Channel Lineup** has Up, Down and Move to controls. Moving Channel 3 down makes it Channel 4; the previous Channel 4 becomes Channel 3. Moves renumber the complete station from 1, including off-air channels. Permanent channel IDs, programming, branding, favourites and ad assignments stay with their station. Changes save automatically; confirm the cloud status before leaving, or use its Save button.

Choose **Add Halloween channels** to create **Friday Night Horror** and **Halloween Kids** once. Both start off air, without programmes or ads. Use **Add shows** in their rows to select existing media without removing it from other channels; use Add Media for new uploads. Turn on each channel when ready. Horror is marked Adults only and cannot pass Kids review. Review Halloween Kids in **Audience & Channels** before adding it to Kids profiles; its name/category alone grants no approval. These are profile filters, not server-enforced age verification.

Use each channel's **Schedule blocks** button for recurring Friday nights. The Horror and Kids presets fill in a title and time; select actual programmes and save the block. A channel's name does not restrict it to Fridays automatically.

Open **Admin → Blocks**, select a channel, title, weekdays, local start time, duration and programmes. Presets provide starting points for cartoons, movie nights and late-night programming. Save the station to the cloud using the existing admin control.

Programmes play in the chosen order, repeat if the window is longer, and may be clipped at the window boundary. Durations are elapsed minutes. Blocks cannot overlap or be configured past local midnight. Imported invalid overlaps are ignored. Unconfigured channels retain their existing broadcast clock and commercials. The shared guide/player clock supports 23-hour and 25-hour local days.

Schedules currently use each viewer’s local timezone, matching the existing station scheduler. They are not a single Calgary-time broadcast feed worldwide.

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

The one-time release updater also checks sibling review worktrees. It removes a review folder only when its commits are already in the main release, its working tree is clean, and any private settings or local media have identical copies in the main folder. It preserves and reports unique work, locked folders and unregistered copies. Close servers using old review folders before running the updater. Delivery helpers stay outside the repository and are removed from the temporary directory after use.

Unused legacy admin access, bulk-import and preview components, unused broadcast presets, an unused media helper and the old IndexedDB media module have been removed after checking their references. Historical review notes, the old programming backup, unused smoke script, starter artwork and duplicate manifest are also removed. The unused starter favicon and duplicate SVG icon have also been removed; old installed icon URLs still resolve to the retained artwork. The offline asset list now points to the existing station logo. Git history retains deleted source. The current admin uploader, player, guide, themes, profile storage, public assets and recovery tools remain in use.

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

`public/themes/haunted-arcade-{world,mobile}.webp` contains original scenery expanded with the built-in image-generation tool on September 15, 2026. Prompt direction: recompose the original ultra-wide 16-bit haunted arcade courtyard into full-page desktop 16:10 and phone 2:3 compositions; preserve mint/violet cabinets, pumpkin lanterns and a black cat on the left, the crooked arcade tower and mint moon on the right, friendly ghosts, violet mountains, mist and wet cobblestones; keep the centre dark and calm for real app content, with rich detail around the edges; no text, logos, gore or franchise characters. The 288/227 KiB WebP sources replace the old banner artwork. A responsive picture downloads the chosen composition; CSS ghosts, cabinet light, moonlight, mist and embers stay behind playback and controls. The scene loads only when Arcade is selected.

`public/themes/halloween-after-dark-{world,mobile}.webp` contains original scenery generated with the built-in image-generation tool on September 15, 2026. Prompt direction: a painted moonlit haunted manor, twisted trees, glowing jack-o-lanterns, friendly skeletons at the gates, a harvest moon and misty violet hills; a quiet dark centre, detail around the edges, no text, logos, gore or franchise characters. The portrait companion places a skeleton with a lantern at the bottom right. The optimized source images are 240/207 KiB; a responsive picture selects one composition and Next.js delivers its appropriate size. A single component renders with the initial HTML behind the whole page; CSS witch, skeleton arm, fog, lantern light and embers animate without timers or playback hooks. Hidden tabs pause motion; OS/app reduced motion removes it. These assets replace the former small After Dark SVG vignette.

### Library artwork and upcoming titles

Open **Admin → Artwork & Coming Soon** to upload a JPG/PNG/WebP poster or paste an HTTPS artwork URL. A shared title poster covers every episode in that series, including future uploads. Portrait artwork at a 2:3 ratio fits best. Browser uploads resize images to a maximum edge of 1500px before sending them directly to the station's existing R2 media bucket. This uses the same R2 credentials, public URL and CORS configuration as media uploads; no database migration or new secret is required.

Review posters separately for Kids. Kids libraries use the existing reviewed-video catalog: reviewing a Kids channel's full lineup also approves its programmes, which then appear automatically in the library. Individual video review is available in this panel. New uploads are not automatically approved; a channel category alone does not grant Kids access. No approved videos means an empty Kids library. Parent profiles retain the full library. Device profiles remain a convenience control, not server-authenticated accounts.

Add upcoming titles, artwork, a description, and an optional arrival label/channel. Drafts are visible only to authenticated admins; published announcements appear in the library and below live channels. Kids require explicit announcement approval, and a linked channel must be a reviewed Kids channel. A poster is required before publishing. Arrival labels do not schedule playback: use Programming/Programme Blocks for that. Only announce content you are ready to offer; the update includes no invented future shows or replacement poster artwork.

Wait for **Global saved** before leaving admin. Station export/import includes title artwork and upcoming announcements. Refresh older open admin tabs after deploying this version so they cannot overwrite the new fields. The library preserves each profile's watchlist and viewing progress, loads video only on request, and keeps search and scroll position when closing title details.
