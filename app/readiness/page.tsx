"use client";

import Link from "next/link";

const readinessSections = [
  {
    title: "Core Application",
    items: [
      "Home page loads successfully",
      "Programming API responds correctly",
      "Health API responds correctly",
      "Player experience covered by production smoke tests",
    ],
  },
  {
    title: "Operations & Launch Tools",
    items: [
      "Launch Hub available",
      "Compatibility diagnostics available",
      "Installation guidance available",
      "Recovery tools available",
      "Backup and restore tools available",
    ],
  },
  {
    title: "PWA & Platform Assets",
    items: [
      "Manifest route available",
      "Apple touch icon available",
      "SVG favicon available",
      "ICO favicon available",
      "Maskable icon available",
      "Safari pinned tab icon available",
    ],
  },
  {
    title: "Verification Systems",
    items: [
      "Smoke Test validates route availability",
      "Smoke Test validates response headers",
      "Smoke Test validates manifest output",
      "Smoke Test validates API responses",
      "Smoke Test executes TypeScript validation",
      "Smoke Test executes production build validation",
    ],
  },
];

const finalChecks = [
  "Test on iPhone Safari",
  "Test on Android Chrome",
  "Test on Windows Chrome",
  "Test on Firefox Desktop",
  "Test fullscreen playback",
  "Test channel switching",
  "Test guide navigation",
  "Test PWA installation",
];

export default function ReadinessPage() {
  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card ttv-readiness-card">
        <div
          className="ttv-ops-logo"
          aria-hidden="true"
        >
          TTV
        </div>

        <div>
          <p className="ttv-ops-kicker">
            Production Readiness
          </p>

          <h1>
            Tate&apos;s TV Launch Report
          </h1>

          <p>
            Overview of launch readiness,
            operational tooling, verification
            systems, platform assets, and
            production safeguards currently
            protecting Tate&apos;s TV.
          </p>
        </div>

        <div className="ttv-readiness-score">
          <div>
            <span>
              Launch Status
            </span>

            <strong>
              Pre-Launch Hardened
            </strong>
          </div>

          <div>
            <span>
              Verification Suite
            </span>

            <strong>
              Smoke Test V2
            </strong>
          </div>

          <div>
            <span>
              Recommended Next Step
            </span>

            <strong>
              Real Device Testing
            </strong>
          </div>
        </div>

        <div className="ttv-readiness-grid">
          {readinessSections.map(
            (section) => (
              <article
                key={section.title}
                className="ttv-readiness-section"
              >
                <h2>
                  {section.title}
                </h2>

                <ul>
                  {section.items.map(
                    (item) => (
                      <li key={item}>
                        <span aria-hidden="true">
                          ✓
                        </span>

                        {item}
                      </li>
                    ),
                  )}
                </ul>
              </article>
            ),
          )}
        </div>

        <div className="ttv-ops-list">
          <strong>
            Final Launch Validation
          </strong>

          <ul>
            {finalChecks.map(
              (item) => (
                <li key={item}>
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>

        <div className="ttv-ops-list">
          <strong>
            Final Command Before Sharing
          </strong>

          <code>
            .\scripts\smoke-test.ps1
          </code>
        </div>

        <div className="ttv-ops-actions">
          <Link href="/">
            Open App
          </Link>

          <Link href="/launch">
            Launch Hub
          </Link>

          <Link href="/compat">
            Compatibility
          </Link>

          <Link href="/install">
            Install
          </Link>

          <Link href="/health">
            Health
          </Link>

          <Link href="/backup">
            Backup
          </Link>

          <Link href="/recovery">
            Recovery
          </Link>
        </div>
      </section>
    </main>
  );
}