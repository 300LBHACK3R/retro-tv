# Premium Roku v0.1.13 release check repair

The first `Viewer quality` run for `c874a5b` stopped in the mobile theme-collection browser check. Both Christmas entry points still expected two cards, while the new Home After School theme correctly added a third. The failing assertion was repeated on retry; Firefox's concurrently running test was interrupted by the failure limit, not reported as a separate assertion failure.

The check now verifies the exact three Christmas theme IDs, including the new design, for both the Christmas collection tile and the seasonal holiday filter. An unrelated theme cannot satisfy the assertion merely by making the count three. The Gold collection still expects its two existing designs. No application behavior, billing rules, administrator permissions, or Roku package changes are part of this repair.

The original run passed TypeScript, lint, unit tests, dependency checks, the production build, HTTP checks, and the native Roku job. Those successes did not include the full browser suite: it was blocked by this failed check. The repaired source must pass a fresh complete `Viewer quality` run before the publisher advances production. No workflow check is removed or bypassed.

Publish the repaired website/source bundle, then wait for the matching Vercel production deployment to become Ready. The existing `tates-tv-roku-v0.1.13.zip` remains the correct installer. If already installed, refresh the signed-in Roku account and reopen the guide after the website deployment. No SQL migration is needed.
