import Link from "next/link";

const androidSteps = [
  "Finish PWA smoke test and install testing.",
  "Create Google Play Console developer account.",
  "Use Bubblewrap / Trusted Web Activity for Android wrapper.",
  "Set Android package name to ca.tatestv.app.",
  "Generate release signing key.",
  "Replace assetlinks.json fingerprint with release SHA-256.",
  "Build Android App Bundle.",
  "Prepare screenshots, icon, feature graphic, privacy details, and store listing.",
  "Submit to Google Play review."
];

export default function AndroidPrepPage() {
  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card ttv-readiness-card">
        <div className="ttv-ops-logo">TTV</div>

        <div>
          <p className="ttv-ops-kicker">Android store prep</p>
          <h1>Tate&apos;s TV for Google Play</h1>
          <p>
            Preparation checklist for wrapping Tate&apos;s TV as an Android Trusted Web Activity
            and submitting it to Google Play.
          </p>
        </div>

        <div className="ttv-ops-list">
          <strong>Recommended Android package name:</strong>
          <code>ca.tatestv.app</code>
        </div>

        <div className="ttv-readiness-grid">
          <article className="ttv-readiness-section">
            <h2>Phase 2 checklist</h2>
            <ul>
              {androidSteps.map((step) => (
                <li key={step}>
                  <span aria-hidden="true">✓</span>
                  {step}
                </li>
              ))}
            </ul>
          </article>

          <article className="ttv-readiness-section">
            <h2>Important files</h2>
            <ul>
              <li>
                <span aria-hidden="true">✓</span>
                /.well-known/assetlinks.json
              </li>
              <li>
                <span aria-hidden="true">✓</span>
                /manifest.webmanifest
              </li>
              <li>
                <span aria-hidden="true">✓</span>
                /favicon-512.png
              </li>
              <li>
                <span aria-hidden="true">✓</span>
                /privacy
              </li>
              <li>
                <span aria-hidden="true">✓</span>
                /terms
              </li>
            </ul>
          </article>
        </div>

        <div className="ttv-help-callout">
          <strong>Important:</strong>
          <p>
            The asset links file is a placeholder until the Android release signing key exists.
            Once the key is generated, replace the fingerprint and redeploy before Play Store
            testing.
          </p>
        </div>

        <div className="ttv-ops-actions">
          <Link href="/">Open app</Link>
          <Link href="/install">Install</Link>
          <Link href="/compat">Compatibility</Link>
          <Link href="/readiness">Readiness</Link>
          <Link href="/launch">Launch hub</Link>
        </div>
      </section>
    </main>
  );
}
