# Browser runner setup

Viewer quality run 43049915375 failed twice before any browser test started. Both jobs stalled fetching Linux packages from `http://azure.archive.ubuntu.com/ubuntu` until the 12-minute install timeout. Typecheck, lint, all 146 unit tests, production dependency audit, build and HTTP checks passed on both attempts. The missing-artifact notices were consequences of tests never starting.

The workflow now runs in Playwright's official Ubuntu Noble container, which already contains the browsers and Linux dependencies. It uses version **1.63.0**, matching the committed lockfile, and pins the registry's verified multi-platform digest. Microsoft Container Registry confirmed a Linux AMD64 image is present. No Ubuntu package install runs during the job.

Run 43062957361 confirmed the image pulled successfully and Chromium launched. Firefox then rejected running as root while GitHub's mounted `/github/home` belongs to `pwuser`. The container now uses `--user 1001`, matching Playwright's official GitHub Actions container example and the runner-owned directories. This setting applies to the preflight and every browser test, without changing the home directory or disabling Firefox's ownership check.

`scripts/verify-ci-browsers.mjs` rejects a package/image version mismatch and launches Chromium, Firefox and WebKit before the other checks. It has a two-minute step limit and a 20-second launch limit per engine. The existing smoke checks, complete seven-device browser suite, paid-theme rebuild and billing checks remain required. Production publication still waits for Viewer quality to pass.

When updating Playwright, update the lockfile, the workflow image tag/digest and `TTV_CI_PLAYWRIGHT_VERSION` together. Verify the tag and digest against Microsoft Container Registry; never substitute an unverified image or use `latest`.

References: [Playwright on GitHub Actions with containers](https://playwright.dev/docs/ci#via-containers) and [official Docker image/version matching](https://playwright.dev/docs/docker).

Validation of the ownership repair: actionlint passed, and a parsed-workflow comparison confirmed that only the container user changed. The pinned AMD64 image layers were downloaded from Microsoft Container Registry and SHA-256 verified, then extracted into an isolated filesystem. Running the unchanged preflight inside that filesystem as UID/GID 1001 with `/github/home` owned by the same user successfully launched Chromium, Firefox and WebKit. This local user-namespace/chroot check is not a GitHub Actions run; the hosted job must still pass the complete application tests before master can advance.
