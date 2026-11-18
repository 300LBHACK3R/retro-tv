# Premium Roku v0.1.13 browser release repair

Run [44231014049](https://github.com/300LBHACK3R/retro-tv/actions/runs/44231014049)
passed the security repair, native Roku job, static checks, unit tests, build,
HTTP checks and early browser smoke checks. The full browser suite then reported
633 passed, 31 skipped and eight failed checks. The publisher correctly kept
production unchanged.

Seven failures were the same account-filter assertion on seven devices: it
still expected two Christmas themes after Home After School added a third.
The account test now checks exact theme identities, including the new design
when billing is off. With billing enabled, the active Free filter must show
only Christmas '96; it must exclude both paid Christmas designs.

The eighth failure was the iPhone Neon Noël preview assertion. Reproduction
showed a lazy image at y=1107 in a 664px viewport, with naturalWidth=0. Scrolling
the card into view caused the image to load successfully. The test now scrolls
first, asserts that the card is in view, and still requires the image to load
with nonzero natural width before applying the theme. No image-loading assertion
or application behavior was removed.

Both checks run in the early smoke group. The complete browser suite now runs
in three required parallel jobs, followed by paid-theme rebuilds and checks
in each job. See [browser CI setup](CI_BROWSER_IMAGE.md) for coverage and reports.
Typecheck, lint, unit, security, build, HTTP and native checks remain required.
The temporary build-dependency mitigation is unchanged; its scope and expiry
are documented in [the security repair](PREMIUM_ROKU_SECURITY_FIX.md).

The Browser-Fix source ZIP includes the entire pending premium release and all
prior repairs from production base 628a465. Use its new publisher; older
publishers pin earlier failing commits. The publisher still requires the exact
commit's entire Viewer quality run to pass and rechecks master ancestry before
a normal fast-forward production push. It preserves local working files.

No SQL change or new Roku package is required for this repair. Wait for Vercel
production to become Ready, then refresh the account and reopen the guide.
The existing tates-tv-roku-v0.1.13.zip remains correct. Physical TV acceptance
remains pending; browser and native contract tests do not replace it.

Completed verification results are recorded in the release ZIP's VERIFICATION.txt.
