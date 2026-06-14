import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Android Preparation | Tate's TV",
  description:
    "Preparation checklist for packaging Tate's TV as an Android Trusted Web Activity and publishing to Google Play.",
};

const PACKAGE_NAME = "ca.tatestv.app";

const androidSteps = [
  "Finish PWA smoke test and install testing.",
  "Create Google Play Console developer account.",
  "Use Bubblewrap / Trusted Web Activity for Android wrapper.",
  `Set Android package name to ${PACKAGE_NAME}.`,
  "Generate release signing key.",
  "Replace assetlinks.json fingerprint with release SHA-256.",
  "Build Android App Bundle.",
  "Prepare screenshots, icon, feature graphic, privacy details, and store listing.",
  "Submit to Google Play review.",
] as const;

const importantFiles = [
  "/.well-known/assetlinks.json",
  "/manifest.webmanifest",
  "/retro-logo.png",
  "/privacy",
  "/terms",
] as const;

export default function AndroidPrepPage() {
  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card ttv-readiness-card">
        <div className="ttv-ops-logo">TTV</div>

        <div>
          <p className="ttv-ops-kicker">Android Store Preparation</p>

          <h1>Tate&apos;s TV for Google Play</h1>

          <p>
            Preparation checklist for packaging Tate&apos;s TV as an Android
            Trusted Web Activity and submitting it to Google Play.
          </p>
        </div>

        <div className="ttv-ops-list">
          <strong>Recommended Android package name:</strong>
          <code>{PACKAGE_NAME}</code>
        </div>

        <div className="ttv-readiness-grid">
          <article className="ttv-readiness-section">
            <h2>Phase 2 Checklist</h2>

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
            <h2>Important Files</h2>

            <ul>
              {importantFiles.map((file) => (
                <li key={file}>
                  <span aria-hidden="true">✓</span>
                  {file}
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="ttv-help-callout">
          <strong>Important:</strong>

          <p>
            The asset links file remains a placeholder until the Android release
            signing key exists. Once the key is generated, replace the SHA-256
            fingerprint and redeploy before Play Store testing.
          </p>
        </div>

        <nav
          className="ttv-ops-actions"
          aria-label="Android preparation navigation"
        >
          <Link href="/">Open App</Link>
          <Link href="/install">Install</Link>
          <Link href="/compat">Compatibility</Link>
          <Link href="/readiness">Readiness</Link>
          <Link href="/launch">Launch Hub</Link>
        </nav>
      </section>
    </main>
  );
}