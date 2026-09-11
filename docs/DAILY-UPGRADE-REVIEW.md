# Daily viewer upgrade · 11 September 2026

Built from production commit `3b8b1d54e9eca551880aefb6b81580ab6bfae05c` on branch `feature/daily-tv-experience`.

## Delivered

Guide search, favourites, density controls, remote navigation and visible-window rendering; nine corrected themes including animated Electric Blue Live; daily programme discovery; device watchlists; bounded playback recovery and reporting; recurring programme blocks; station diagnostics and aggregate viewing metrics; route metadata, private cache rules and input/security cleanup. Accounts and payments remain deferred.

## Verification completed

- Production Next.js build and TypeScript: passed.
- ESLint: zero errors and zero warnings.
- 17 Node regression tests: passed. Includes four timezones, both daylight-saving transitions, guide/player agreement, device-save isolation, storage validation, nine-theme text contrast, bounded JSON, request origins and signed browser identities.
- Production HTTP checks: public routes, canonical metadata, security headers, private cache rules, protected endpoints, cross-origin rejection and DNT handling passed.
- Production dependency audit: zero reported vulnerabilities at verification time.
- Supabase SQL executed in an isolated PGlite PostgreSQL engine: initial migration, reapplication, aggregates, 30-per-minute collection limit, role permissions and 30-day retention passed. It has **not** been applied to production.
- Browser suite parses and lists 63 project/test combinations, with nine tests across seven profiles and project-specific skips. This is test discovery, not a passing browser run.

## Remaining release gates

The available browser preview was blocked by the browser security policy. Interactive, visual, cross-browser and physical-device validation could not be completed in this environment. Run the updated GitHub `Viewer quality` workflow and inspect its screenshots/traces, then test actual target devices and media before promoting to master. No claim of universal browser/device compatibility is made.

Apply `supabase/migrations/20260911_station_insights.sql` in the existing Supabase project and configure `ADMIN_SESSION_SECRET` to activate station-wide insights. Configure the documented R2 public origin for automatic link checks. Missing metrics setup does not block viewing.

The source review package does not merge master, deploy production, edit live programming, or apply database migrations. The optional helper `-Push` uploads only the feature branch, which can trigger the existing Vercel preview integration.
