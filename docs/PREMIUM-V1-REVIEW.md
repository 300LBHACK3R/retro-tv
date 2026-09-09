# Tate's TV Premium V1 review

Prepared 2026-09-09 from `master` at `b468eadf9ba9ca12a15e41d34afb1042cc60ad55`.
Local review branch: `refactor/premium-v1`. This is a review candidate, not a production release. GitHub rejected the write with HTTP 403 (integration lacks access), so the branch and workflow have not been published. The downloadable package contains the unpushed commit in a Git bundle.

## What changed

- A calmer midnight palette, restrained cyan and pink accents, original retro branding, clearer typography, and a player-first layout.
- A horizontal channel rail, searchable channel directory, mobile bottom navigation, and focused guide and settings dialogs.
- Normal, Theater, Mini, and TV layouts share one viewer structure. TV navigation remains available without station-management links.
- More readable Library browsing with existing series grouping, filtering, playback, and resume behavior retained.
- Shared dialog focus trapping and restoration, one numeric tuning handler, better touch targets, and reduced-motion support.
- Cloud programming refreshes preserve the viewer's selected channel, theme, and preferences. Explicit backup restores still restore the snapshot.
- The service worker no longer caches live page HTML, private routes, APIs, media, Next.js chunks, or React Server Component responses. Its version is bumped so installed clients update.
- Google Cast's existing SDK host is allowed by the script policy. Actual Cast and AirPlay operation still requires device testing over HTTPS.
- Removed unreferenced legacy viewer components, the recursive stored-string rewriter, and the old broad source-rewrite script. Display-only text cleanup remains.
- Added a browser regression suite and a GitHub Actions quality workflow using synthetic programming rather than cloud writes.

The scheduler, live engine, guide schedule calculation, MultiGuide, Player, public programming endpoint, channel records, R2 files, and Supabase data were not rewritten. No runtime dependency upgrade is included. The only added dependency is the Playwright test runner.

## Verification at preparation

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| Production build | Passed; all routes compiled |
| ESLint | Passed with 4 existing warnings in MultiGuide, Player, PreviewPlayer, and scheduler |
| Node regression checks | 3 passed: refresh/restore preferences, channel-number handling, service-worker exclusions |
| Whitespace validation | Passed |
| Public production programming GET | Responded successfully with 23 channels and 440 media records; read-only |
| Interactive browser QA | Pending: the available preview blocked application JavaScript |
| Local HTTP route smoke | Incomplete: the isolated runtime did not provide a reachable production server |
| Automated browser matrix | Added but not run; GitHub upload was denied, so no Actions run exists |
| Physical phones, tablets, TVs, Cast, AirPlay, PWA | Pending |
| Authenticated Admin and real submission/upload flow | Pending; cloud credentials and infrastructure were not changed |

A successful build does not prove playback, mobile layout, casting, or cloud uploads. The browser suite checks directory tuning, guide dialogs, theme persistence, Library filtering, page overflow, and TV navigation using synthetic schedules. It does not certify codecs, every browser version, real television remotes, casting receivers, or the live ad transitions.

## Open a separate Windows review checkout

Use `Open-Premium-Review.ps1` from the downloadable package. Its dry run verifies the repository, baseline, bundle checksum, and unused target branch/folder. The actual run imports the bundled commit and opens a separate Git worktree. Existing branches and uncommitted work remain in place. It never pushes, merges, deploys, or edits cloud data.

After opening that review checkout:

```powershell
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run dev
```

Configure the review checkout with the existing approved development environment privately if it needs live programming. Do not put credentials into source files or commits.

For the automated UI checks, stop the development server and run:

```powershell
npx playwright install chromium firefox webkit
npm run build
npm run test:browser
```

The suite intercepts programming requests with synthetic channels. CI generates a synthetic video with FFmpeg; local runs without `.qa/test.webm` cover UI behavior with a missing-media response. Review the screenshots and results, not just the exit code. Browser checks remain unexecuted in this delivery.

## Required release checks

1. Chrome, Edge, Firefox, Android Chrome portrait/landscape, iPhone/iPad Safari, tablet width, and an installed PWA: readable layout, no clipped controls or page overflow, no hydration errors.
2. Tune with the channel rail, directory, keyboard numbers, and remote. Check guide scrolling, mobile guide layout, Escape/Tab focus, and closed-dialog focus restoration.
3. Check every theme, preference persistence after reload, Normal/Theater/Mini, control auto-hide and return, fullscreen, and Library search/resume.
4. Verify live player, Now/Next, and guide agree through a program boundary and a custom commercial break.
5. On the intended TV hardware, test `/tv?ch=<id>`, remote navigation, playback controls, Google Cast discovery/channel changes/ad transitions/Sync Live/disconnect, and Safari AirPlay over HTTPS.
6. Sign in to protected Admin and test the approved editing workflow. Verify actual submission storage and uploads only after confirming the separate cloud setup.
7. Keep this change in draft until review passes. Merge and release deliberately; do not force-push or bypass failed checks.

## Rollback

The unchanged production baseline is `b468eadf9ba9ca12a15e41d34afb1042cc60ad55`. Before merging, abandoning this review branch leaves production as it was. If later deployed, restore the prior Vercel deployment, then revert the merged change through Git. Do not reset a shared branch or delete cloud programming/media to roll back a UI change.
