# Theme browser-check repair

Run `42559994595` for `9b2243b` stopped before publication: 87 browser checks failed, 480 passed, four passed after retry and 31 were skipped. The failures cluster around a player-colour assertion, lazy mobile-guide rendering and touch-card alignment.

## Findings and changes

- **Player colours:** the test read a button immediately after changing from Christmas's gradient to a solid theme. It accepted only a gradient or a string beginning with `rgb(`. On the existing Vercel preview, the initial result was transparent `rgba(0, 0, 0, 0)`; after the CSS transition it was opaque `rgb(36, 49, 66)`. The replacement waits for the actual control to match a browser-resolved theme token, and still rejects transparent or unthemed controls. Failure logs include actual and expected colours and images. Electric Blue now expresses its existing button colours through those same control tokens.
- **Mobile guide:** the dialog becomes visible while its guide module is still loading. An immediate `isVisible()` selected the desktop assertion on phones and tablets. The test now waits for an actual mobile or desktop guide inside the dialog before choosing its assertions.
- **Touch cards:** iPhone and tablet checks found a two-pixel row difference, matching the hover lift. Touch browsers can retain `:hover` after tapping. Only a fine pointer that supports hovering now lifts a card; touch cards remain aligned.
- **Earlier feedback:** GitHub first runs the affected theme flows and the new administrator flows on desktop Chromium and iPhone. If they pass, the complete seven-device suite and paid-theme checks still run. The smaller initial report is uploaded separately.

The existing theme collections and verified administrator account changes are included. No production approval or browser check is bypassed. The new browser assertions must pass on GitHub before the installer advances master; examining the earlier preview is diagnostic evidence, not a completed browser run of this repair.
