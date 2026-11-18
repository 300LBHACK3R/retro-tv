# Website and Roku live broadcast alignment

The reported Channel 1 mismatch was reproduced against the public production
lineup on November 17, 2026 in Regina. At the same instant and timezone, the
website selected **TTVCommercials4**, source second **355**, with **109** seconds
remaining. Roku's production playback endpoint selected **Pokemon - Dig Those
Diglett S01-EP31**, source second **1279**, with **89** seconds remaining.

Channel 1 uses `daily-random`. The website builds the day's schedule with
`createBroadcastDayAnchor()` (local midnight); Roku passed the current instant
to the scheduler. Its date seed uses the supplied date's ISO date, so Roku
changed rotation at UTC midnight while the website retained its local day's
rotation. Commercial breaks consequently occupied different positions.

Roku's catalogue, playback and guide now build schedules with the same local
midnight anchor as the website. The shared anchor helper preserves the Roku
request's timezone-aware date using the existing `copyScheduleDate` helper.
Ordinary browser Dates keep their existing behavior. Playback positions and
response timestamps still use the current instant, not midnight.

## Verification

- Eight regression cases failed before the repair and pass afterward. They
  cover evening rollover, local midnight, timezone preservation, half-hour
  zones, DST transition days, commercial boundaries and programme resumption.
- All **199 unit tests** pass, including existing Roku playback/guide contracts.
- Typecheck, changed-file ESLint, production build and HTTP checks pass.
- Replaying the reported instant with the repair makes Roku select the same
  commercial, source second 355 and remaining 109 seconds as the website.
- **198 complete schedule comparisons** on the downloaded public production
  snapshot match: 22 Roku-eligible channels, three Canadian timezones and three
  instants surrounding UTC rollover. No production data was changed.
- Native Roku source is unchanged. Full GitHub Viewer quality, including all
  browser groups, remains required before the publisher updates production.

## Release

Use **TatesTV-Live-Sync-Fix-v0.1.13.zip** and its
`Publish-TatesTV-Live-Sync.ps1` publisher. The source bundle contains the entire
pending premium release, security mitigation, Browser-Fix and this alignment
repair. It can update from production base `628a465` or the included Browser-Fix
commit. Older publishers still pin their older commits.

The publisher preserves working files, checks exact source and bundle hashes,
waits for the complete exact-commit Viewer quality run, and rechecks master
ancestry before a normal fast-forward push. No force-push or reset is used.

After the matching Vercel production deployment is Ready, refresh the website
and tune Roku away from Channel 1 and back to request the corrected schedule
immediately. No SQL migration or Roku reinstall is required for this fix.

The comparison assumes the same programming snapshot and device timezone.
Network buffering can still introduce a small playback delay; this repair
addresses selecting different scheduled segments. Physical TV acceptance is
still separate from the automated and read-only production-data checks.

The previous [browser repair](PREMIUM_ROKU_BROWSER_FIX.md) and temporary
[security mitigation](PREMIUM_ROKU_SECURITY_FIX.md) remain included unchanged.
