# Premium Roku v0.1.13 — build security repair

The publisher stopped correctly on run [44221619248](https://github.com/300LBHACK3R/retro-tv/actions/runs/44221619248).
Both jobs stopped at `npm audit` after GitHub reviewed
[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
The previous Christmas collection assertion repair remains included. Production
was not changed by that failed run.

## Why a temporary mitigation is necessary

As checked on November 17, 2026 (Canada), upstream lists no patched release;
the latest published picomatch is 4.0.7 and is affected. The root lockfile has
picomatch 2.3.2 and 4.0.4; the Roku build lockfile has 2.3.2. All are development
dependencies. The raw audits report 14 website and 8 Roku dependency findings,
all tracing to this one advisory. The production-only website audit reports zero.
Application source does not directly import these glob tools.

`npm audit fix --force` proposes unrelated compiler/linter downgrades. This
repair preserves every dependency version and integrity in both lockfiles.

## Protection and its limits

- Both packages run `scripts/security/picomatch.mjs` after installation. It
  checks each locked picomatch installation, validates its version and the
  complete upstream parser SHA-256, and makes one reversible change.
- The parser's existing literal fallback now applies to **every** repeated
  `+(...)` and `*(...)` extglob. Those forms match literal filenames instead of
  compiling repeated expressions. This prevents the documented single-branch
  exponential backtracking, including when `maxExtglobRecursion` is disabled.
- Ordinary `**/*.tsx`, braces, `@(a|b)` and negative `!(*.test)` matching remain
  available. Repeated extglob matching is intentionally unavailable in these
  build tools until an upstream fix is reviewed. Any future tooling that needs
  those forms must be reviewed, not silently allowed.
- Unknown parser versions or altered parser bytes stop installation. A second
  install is idempotent. A production-only install can omit these dev packages.
- No runtime website/Roku source or packaged artwork changes in this repair.
  It is not a general-purpose upstream picomatch fix or a claim that all possible
  regular-expression vulnerabilities have been eliminated.

## Security checks remain active

`npm run audit:security` still runs and prints the **complete** `npm audit --json`.
It accepts only this exact advisory and its dependency chain, only when every
reported node is marked development-only and every affected installed parser
has the verified protection. It rejects other advisories (of any severity),
production dependency findings, absent protection, unknown schemas, network
failures, missing dependency information and dependency cycles.

Raw `npm audit` **still exits nonzero**: the package names/versions have not been
renamed to hide the finding. The CI step is a checked mitigation review, not a
claim that the registry has removed the advisory. The review expires at
**2026-12-18 00:00 UTC** and then blocks releases until reviewed. Do not extend
that deadline without checking the upstream fix and the dependency paths.
All existing unit, native, browser, HTTP, build and paid-theme checks remain.

## Validation commands

```sh
npm ci
npm run test:security
npm run audit:security
npm run audit:prod
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run test:http
npm --prefix roku ci
npm --prefix roku run audit:security
npm --prefix roku run build
# From roku/:
npm exec --yes --ignore-scripts --package=brs@0.45.0 -- node scripts/test-native.mjs
```

The security regression suite tests the actual installed regex implementations
inside child processes with hard deadlines, plus rejection paths for the audit
review. Unmodified picomatch was separately reproduced hanging on `+(*a)` and
terminated after one second. Protected copies complete the same class of inputs
and retain normal source-file matching. See the download's `VERIFICATION.txt`
for completed release checks rather than treating this command list as evidence.

## Remove the temporary protection

When upstream releases a fix, review its advisory and regression coverage;
update the actual parent dependencies/overrides and both lockfiles; remove the
postinstall protection and temporary audit review; restore plain `npm audit`
in both CI jobs; run fresh installs, audits, builds, native tests and browser
checks. Do not merely relabel the installed package or remove the failing check.

## Publishing and the TV

Use the Security-Fix publisher, which includes all pending v0.1.13 source from
production base `628a465`. It waits for the exact new commit's Viewer quality
run to succeed before a normal fast-forward push to master, and refuses to
overwrite newer production work. No SQL migration is needed. Wait for Vercel
production to become Ready before refreshing the Roku account and guide.
The existing `tates-tv-roku-v0.1.13.zip` is still the correct device installer.
The larger source update ZIP is not a Roku installer. Real TV testing remains
pending until Tate is home.
