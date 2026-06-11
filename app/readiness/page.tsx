"use client";

import Link from "next/link";

const readinessSections = [
  {
    title: "Core app",
    items: [
      "Home page loads",
      "Programming API responds",
      "Health API responds",
      "Player route is protected by production smoke tests",
    ],
  },
  {
    title: "Launch tools",
    items: [
      "Launch Hub is available",
      "Compatibility diagnostics are available",
      "Install instructions are available",
      "Recovery page is available",
      "Backup/restore page is available",
    ],
  },
  {
    title: "PWA / icons",
    items: [
      "Manifest route is live",
      "Apple icon is live",
      "Favicon SVG is live",
      "Favicon ICO is live",
      "Maskable icon is live",
      "Safari pinned tab is live",
    ],
  },
  {
    title: "Production checks",
    items: [
      "Smoke test validates route availability",
      "Smoke test validates headers",
      "Smoke test validates manifest JSON",
      "Smoke test validates API JSON",
      "Smoke test runs local typecheck",
      "Smoke test runs local production build",
    ],
  },
];

export default function ReadinessPage() {
  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card ttv-readiness-card">
        <div className="ttv-ops-logo">TTV</div>

        <div>
          <p className="ttv-ops-kicker">Production readiness</p>
          <h1>Tate&apos;s TV launch report</h1>
          <p>
            A clean pre-launch overview of the routes, tools, icons, diagnostics, and verification
            systems currently protecting Tate&apos;s TV.
          </p>
        </div>

        <div className="ttv-readiness-score">
          <div>
            <span>Launch status</span>
            <strong>Pre-launch hardened</strong>
          </div>

          <div>
            <span>Verification</span>
            <strong>Smoke Test V2</strong>
          </div>

          <div>
            <span>Recommended next</span>
            <strong>Real device testing</strong>
          </div>
        </div>

        <div className="ttv-readiness-grid">
          {readinessSections.map((section) => (
            <article key={section.title} className="ttv-readiness-section">
              <h2>{section.title}</h2>

              <ul>
                {section.items.map((item) => (
                  <li key={item}>
                    <span aria-hidden="true">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="ttv-ops-list">
          <strong>Final command before sharing:</strong>
          <code>.\scripts\smoke-test.ps1</code>
        </div>

        <div className="ttv-ops-actions">
          <Link href="/">Open app</Link>
          <Link href="/launch">Launch hub</Link>
          <Link href="/compat">Compatibility</Link>
          <Link href="/install">Install</Link>
          <Link href="/health">Health</Link>
          <Link href="/backup">Backup</Link>
          <Link href="/recovery">Recovery</Link>
        </div>
      </section>
    </main>
  );
}
