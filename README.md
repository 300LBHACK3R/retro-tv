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
- Nine themes, all unlocked. Electric Blue Live adds slow ambient lighting, a moving broadcast highlight and a live beacon. System/app reduced-motion preferences suppress effects, and hidden tabs pause them. Accounts, payments and theme entitlements are deferred.
- Poster artwork with a title-based fallback when artwork is absent or cannot load.

## Profiles, Kids mode & channel categories

The viewer supports up to five profiles per browser/device. Main retains existing favourites, watchlist, progress and theme; other profiles have separate saved items, progress and themes. The selected profile lasts for the tab session. Normal Live TV visits start on **Channel 1**; explicit allowed `?ch=` tune links still work.

Use the profile button to switch or manage names and avatars. Kids profiles require a 4–8 digit parent PIN. Once set, opening a full-lineup profile or profile management requires that PIN. Changing it requires access to management; cancelling preserves the old PIN. Switching removes the viewer, pauses local media, and stops casting. New pages do not automatically rejoin another profile's Cast queue. Directional keys work on the profile picker.

**Admin → Audience & Channels** provides categories and explicit Kids approvals. Review programmes and ads before approving them. A Kids channel must be approved and contain only approved media across its regular lineup and recurring blocks, plus all ads eligible for that channel, including future campaigns. Unreviewed or missing items hold the whole channel out of Kids mode; removing individual programmes would shift the live broadcast clock. Changes to files, posters, titles, descriptions or runtimes clear media approval. Save reviewed programming to the cloud using the existing admin controls.

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

Obsolete release notes, an old programming backup, the unused PowerShell smoke script, unused Next.js starter artwork and a duplicate manifest have been removed. Git history retains them. Public icons, channel logos, recovery routes, upload tooling and the development launcher remain in use.

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

Automated browser profiles do not certify physical TVs or every historical browser. Before production promotion, verify real iPhone/Safari, Android/Chrome, supported desktop browsers and the target TV/remote: video start, channel changes, extended playback, offline/reconnect, scrolling, focus, fullscreen, AirPlay/Cast and reduced motion. Use the station’s real media encodings as well as the synthetic test clip.

## Security and SEO

Public pages have route-specific canonical, Open Graph and Twitter metadata. The sitemap contains public discovery pages; admin and recovery tools are marked noindex. API responses and private tools use no-store rules, and the service worker excludes APIs, live HTML, media and private pages.

Authenticated mutations require same-origin requests, sensitive bodies are size-bounded, login attempts are throttled and metrics have signed HttpOnly browser identifiers plus database-side collection limits. The in-memory login limiter is per process; configure a shared Vercel Firewall limit for distributed abuse protection. The CSP retains the existing inline hydration allowance and HTTPS media access for station-configured sources. This is not a claim of a full security audit.

See [launch checklist](docs/LAUNCH_CHECKLIST.md) and [privacy page](app/privacy/page.tsx).
