# Browser runner setup

Viewer quality run 43049915375 failed twice before any browser test started. Both jobs stalled fetching Linux packages from `http://azure.archive.ubuntu.com/ubuntu` until the 12-minute install timeout. Typecheck, lint, all 146 unit tests, production dependency audit, build and HTTP checks passed on both attempts. The missing-artifact notices were consequences of tests never starting.

The workflow now runs in Playwright's official Ubuntu Noble container, which already contains the browsers and Linux dependencies. It uses version **1.63.0**, matching the committed lockfile, and pins the registry's verified multi-platform digest. Microsoft Container Registry confirmed a Linux AMD64 image is present. No Ubuntu package install runs during the job.

`scripts/verify-ci-browsers.mjs` rejects a package/image version mismatch and launches Chromium, Firefox and WebKit before the other checks. It has a two-minute step limit and a 20-second launch limit per engine. The existing smoke checks, complete seven-device browser suite, paid-theme rebuild and billing checks remain required. Production publication still waits for Viewer quality to pass.

When updating Playwright, update the lockfile, the workflow image tag/digest and `TTV_CI_PLAYWRIGHT_VERSION` together. Verify the tag and digest against Microsoft Container Registry; never substitute an unverified image or use `latest`.

References: [Playwright on GitHub Actions with containers](https://playwright.dev/docs/ci#via-containers) and [official Docker image/version matching](https://playwright.dev/docs/docker).

Local static validation does not prove the hosted browser suite passed. The first GitHub run with this workflow must verify the container pull, all three browser launches and the complete tests before master can advance.
