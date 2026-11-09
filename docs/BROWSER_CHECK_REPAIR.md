# Theme browser-check repair

Run `42559994595` for `9b2243b` stopped before publication: 87 browser checks failed, 480 passed, four passed after retry and 31 were skipped. The failures cluster around a player-colour assertion, lazy mobile-guide rendering and touch-card alignment.

## Findings and changes

- **Player colours:** the test read a button immediately after changing from Christmas's gradient to a solid theme. It accepted only a gradient or a string beginning with `rgb(`. On the existing Vercel preview, the initial result was transparent `rgba(0, 0, 0, 0)`; after the CSS transition it was opaque `rgb(36, 49, 66)`. The replacement waits for the actual control to match a browser-resolved theme token, and still rejects transparent or unthemed controls. Failure logs include actual and expected colours and images. Electric Blue now expresses its existing button colours through those same control tokens.
- **Mobile guide:** the dialog becomes visible while its guide module is still loading. An immediate `isVisible()` selected the desktop assertion on phones and tablets. The test now waits for an actual mobile or desktop guide inside the dialog before choosing its assertions.
- **Touch cards:** iPhone and tablet checks found a two-pixel row difference, matching the hover lift. Touch browsers can retain `:hover` after tapping. Only a fine pointer that supports hovering now lifts a card; touch cards remain aligned.
- **Earlier feedback:** GitHub first runs the affected theme flows and the new administrator flows on desktop Chromium and iPhone. If they pass, the complete seven-device suite and paid-theme checks still run. The smaller initial report is uploaded separately.

The existing theme collections and verified administrator account changes are included. No production approval or browser check is bypassed. The new browser assertions must pass on GitHub before the installer advances master; examining the earlier preview is diagnostic evidence, not a completed browser run of this repair.

## Follow-up: run 42566849166 (5a34ce1)

The first repair passed 141 unit checks and all 10 focused browser checks. The complete browser run then passed 583 checks, skipped 31 existing device-specific cases and failed two tests. Paid-theme checks had not run. The raw report was downloaded and its SHA-256 matched GitHub's artifact digest.

- **Firefox commercial setup:** both failure traces show the loaded four-item fixture in Admin, an enabled Save control, successful programming responses and the healthy message `Global sync active`. The test was still waiting for the earlier `Global loaded` text. Admin fixtures now accept loaded/saved/active states and require the hydrated editor's enabled Save control. The artwork and admin-panel checks use the same readiness check. Campaign targeting, save/reload persistence, schedule previews and pausing assertions remain intact.
- **Narrow desktop Safari:** the trace records the first card at 602.765625px and the hovered second card at 600.765625px, exactly the intentional two-pixel desktop hover lift. The layout assertion now compares untransformed grid offsets. Phones and tablets additionally assert that no card has a transform, preserving the touch-layout regression check.
- **Early coverage:** the focused checks now include Chromium, Firefox, desktop Safari and iPhone, including campaign save/reload. The full seven-device suite and paid-theme suite remain required for publication.

These follow-up changes affect verification only, preserving the existing administrator, theme, account and Kids implementations. A new successful GitHub run is still required; neither the previous 583 passes nor local static validation proves this follow-up has passed browsers.
