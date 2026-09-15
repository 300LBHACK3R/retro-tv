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
- A 72-hour desktop guide and a mobile **On now** list, using the same schedule as the player. On mobile, compare live and next programmes, search or star channels, and use **Watch** to tune. **Schedule** opens that channel’s upcoming day of listings; time jumps, local day labels and **Show more programmes** make longer schedules readable. Returning to On now restores your place. Upcoming mobile listings never change playback. Desktop listings tune the channel’s current broadcast and support row density and directional keys.
- “Tonight on Tate’s TV” and “On now” selections from actual station schedules.
- Favourite channels, a programme watchlist and on-demand resume saved on the current browser. They are separate from cloud programming updates. Storage being blocked must not prevent playback.
- Eleven themes, all free. **Haunted Arcade** is the starting theme on every fresh page load and profile selection. Its original pixel-art courtyard, glowing cabinets, pumpkin lanterns, haunted tower, headphone/witch/pumpkin ghosts, drifting mist and embers extend the seasonal look through navigation, profiles and the guide. Theme changes stay in memory across client-side navigation; a refresh, new visit or profile switch returns to Haunted Arcade. Old saved theme choices are discarded without touching profiles, PINs, favourites or progress. Reduced-motion settings are still remembered. Offscreen scenery and hidden tabs pause their animations; system/app reduced motion removes them. **Halloween After Dark** remains available as a separate free theme. Accounts, payments and saved theme preferences are deferred.
- Mobile theme selection opens without focusing search, uses one scrollable library and keeps Close/Done above the keyboard. The mobile guide has a sticky On now bar with Find/Your channel shortcuts, a sticky schedule Back bar and compact filters. Seasonal banners shrink on phones and step aside during landscape viewing.
- Poster artwork with a title-based fallback when artwork is absent or cannot load.

## Profiles, Kids mode & channel categories

The viewer supports up to five profiles per browser/device. Main retains existing favourites, watchlist and progress; other profiles have separate saved items and progress. Themes are temporary for the current visit. The selected profile lasts for the tab session. Normal Live TV visits start on **Channel 1**; explicit allowed `?ch=` tune links still work.

Five original illustrated portraits (Fox, Space explorer, Dinosaur, Robot and Cat) replace the old symbols. Their stored IDs remain stable, so existing profiles upgrade without being recreated. Images are served locally through Next image optimization.

The Haunted Arcade profile entrance joins the illustrated scene and profile cards into one surface. The artwork is shorter on phones, the real character portraits keep clear labels, and the seasonal lighting carries through PIN and profile editing screens. New tab sessions open the profile chooser; returning to it resets the theme to Haunted Arcade.

Use the profile button to switch viewers. The chooser offers Add profile directly; Manage profiles opens editing for names, avatars and Kids settings. Back, Cancel and Escape return to the previous screen and restore focus. PIN entry supports show/hide, corrected-input focus and a countdown after repeated wrong attempts. Deleting a profile requires a separate confirmation. Kids profiles require a 4–8 digit parent PIN. Once set, opening a full-lineup profile or profile management requires that PIN. Changing it requires access to management; cancelling preserves the old PIN. Switching removes the viewer, pauses local media, and stops casting. New pages do not automatically rejoin another profile's Cast queue. Directional keys work on the profile picker.

**Admin → Audience & Channels** provides categories and explicit Kids approvals. Review programmes and ads before approving them. A Kids channel must be approved and contain only approved media across its regular lineup and recurring blocks, plus all ads eligible for that channel, including future campaigns. Unreviewed or missing items hold the whole channel out of Kids mode; removing individual programmes would shift the live broadcast clock. Changes to files, posters, titles, descriptions or runtimes clear media approval. Save reviewed programming to the cloud using the existing admin controls.

**To populate Kids:** choose a children’s channel in Audience & Channels, select **Review this lineup**, show the complete list and review every programme and ad. Confirm the review, then choose **Add reviewed lineup to Kids**. The action also puts that channel in Kids & Family. Missing media blocks approval; changing the reviewed content invalidates confirmation. Use **Save** beside the cloud status to publish the reviewed programming. Parent profiles retain the full lineup.

**No existing programming is automatically approved.** Until Channel 1 qualifies, Kids sees a welcome slate with no media or ads. Faith and cartoon categories are browsing labels, not age ratings. Categories filter the guide and directory without changing channel numbers or playlists.

Profiles require no signup or database migration and do not sync across devices. The parent PIN is salted and hashed with PBKDF2, with a delay after repeated wrong attempts. These are household convenience controls: clearing browser data resets them, and public video/programming URLs remain public. There is no email recovery. Accounts and server-enforced media authorization remain future work.

## Schedule recurring blocks

Open **Admin → Blocks**, select a channel, title, weekdays, local start time, duration and programmes. Presets provide starting points for cartoons, movie nights and late-night programming. Save the station to the cloud using the existing admin control.

Programmes play in the chosen order, repeat if the window is longer, and may be clipped at the window boundary. Durations are elapsed minutes. Blocks cannot overlap or be configured past local midnight. Imported invalid overlaps are ignored. Unconfigured channels retain their existing broadcast clock and commercials. The shared guide/player clock supports 23-hour and 25-hour local days.

Schedules currently use each viewer’s local timezone, matching the existing station scheduler. They are not a single Calgary-time broadcast feed worldwide.

## Station insights setup

Apply [the station insights migration](supabase/migrations/20260911_station_insights.sql) once in the existing Supabase project’s SQL editor. It creates a separate, private playback table and three service-role-only functions. It does not modify programming or submissions. Reapplying it is safe.

Set `ADMIN_SESSION_SECRET` in Vercel if it is not already configured. **Admin → Insights** shows seven-day watch time, returning-device estimates, starts, buffering, errors, reports and content issues. Records older than 30 days are pruned during collection and report refresh. DNT/GPC clients are excluded; casting sessions are excluded. Counts represent participating browser installations, not unique people, and should not be used for billing.

Media link checks only probe the exact HTTPS origins configured in `R2_MEDIA_PUBLIC_BASE_URL` or `R2_PUBLIC_BASE_URL`; they do not follow redirects. Other media URLs remain playable but are marked unverified by the checker. A successful HEAD response is not proof of codec/device playback.

Missing metrics configuration disables collection without interrupting viewing. No migration is executed by a build, viewer request or release helper.

## Source map

| Location                                                          | Responsibility                                                   |
| ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| `components/viewer/`                                              | Viewer controls, discovery, saved items, recovery and navigation |
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

## Keep one clean working folder

Use `C:\Users\techn\retro-tv` as the main Windows checkout. Apply updates there instead of creating new review folders. Keep the source directories, public assets, dependency lockfile, configuration, migrations and tests together; each has a separate purpose in the build or station maintenance.

Stop any running development or test server, then use `npm run clean` to remove generated Next.js output, build folders, TypeScript cache, coverage and browser reports. `npm ci` recreates dependencies when needed. These generated files do not belong in source archives. Keep private environment settings and local media outside shared archives.

Unused legacy admin access, bulk-import and preview components, unused broadcast presets, an unused media helper and the old IndexedDB media module have been removed after checking their references. Historical review notes, the old programming backup, unused smoke script, starter artwork and duplicate manifest are also removed. Git history retains deleted source. The current admin uploader, player, guide, themes, profile storage, public assets and recovery tools remain in use.

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

`public/avatars/` contains the five original character portraits generated for Tate’s TV with the image-generation tool on September 15, 2026. The shared art direction was a polished, friendly animated-film character portrait with expressive eyes, a teal/violet background, centered head and shoulders, no text, no logos, and no existing franchise character. Individual subjects: orange fox in a teal jacket; brown-skinned space explorer in a cream/purple helmet; teal retro-TV robot; mint dinosaur with purple spikes; purple cat with a teal scarf. These images are used only as profile portraits, not as programme artwork or Kids suitability labels.

`public/themes/haunted-arcade-world.webp` is original scenery created with the built-in image-generation tool on September 15, 2026, then optimized to a 356 KiB WebP. Prompt direction: an ultra-wide 16-bit haunted arcade courtyard after closing; glowing mint/violet cabinets, pumpkin lanterns and a black cat on the left; a crooked haunted tower, warm windows, friendly ghosts and a pale mint moon on the right; a calm dark indigo centre for real HTML text; violet mountains, ground mist, neon reflections and pixel stars. No typography, logos, gore or franchise characters. Responsive image delivery, separate CSS ghosts/mist and a shared Pause effects control keep decoration independent of playback and profile controls.
