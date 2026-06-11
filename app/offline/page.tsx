import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card ttv-offline-card">
        <div className="ttv-ops-logo">TTV</div>

        <div>
          <p className="ttv-ops-kicker">Offline mode</p>
          <h1>You&apos;re offline</h1>
          <p>
            Tate&apos;s TV needs an internet connection for live programming, video playback, admin,
            uploads, and schedule updates. Reconnect and reload the app.
          </p>
        </div>

        <div className="ttv-help-callout">
          <strong>What still works?</strong>
          <p>
            Some app shell pages may load from cache, but live channels and videos require the
            network.
          </p>
        </div>

        <div className="ttv-ops-actions">
          <Link href="/">Try app again</Link>
          <Link href="/help">Help</Link>
          <Link href="/install">Install</Link>
          <Link href="/compat">Compatibility</Link>
        </div>
      </section>
    </main>
  );
}
