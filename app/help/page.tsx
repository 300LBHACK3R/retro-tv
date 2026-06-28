import Link from "next/link";

const helpSections = [
  {
    title: "Watching Tate's TV",
    items: [
      "Open the main app and let the current channel load.",
      "Use the channel controls to move between channels.",
      "Open the guide to see what is currently playing.",
      "Use fullscreen for the best retro TV experience.",
    ],
  },
  {
    title: "If video does not play",
    items: [
      "Tap or click the player once to allow browser playback.",
      "Refresh the page if the browser paused the video.",
      "Try Chrome, Edge, Safari, or Firefox.",
      "Use the Recovery page if the app looks broken after an update.",
    ],
  },
  {
    title: "Install as an app",
    items: [
      "Use the Install page for iPhone, Android, desktop, and TV browser instructions.",
      "On iPhone, open in Safari and choose Add to Home Screen.",
      "On Android, open in Chrome and choose Install app or Add to Home screen.",
      "On desktop, use the install icon in Chrome or Edge when available.",
    ],
  },
  {
    title: "Device compatibility",
    items: [
      "Use the Compatibility page to test your browser.",
      "MP4 support is the most important video requirement.",
      "Touch warnings are normal on desktop computers.",
      "Standalone warnings are normal unless the app is installed.",
    ],
  },
];

export default function HelpPage() {
  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card ttv-help-card">
        <div className="ttv-ops-logo">TTV</div>

        <div>
          <p className="ttv-ops-kicker">Help & support</p>
          <h1>How to use Tate&apos;s TV</h1>
          <p>
            Quick help for watching, installing, troubleshooting playback, and checking device
            compatibility.
          </p>
        </div>

        <div className="ttv-help-grid">
          {helpSections.map((section) => (
            <article key={section.title} className="ttv-help-section">
              <h2>{section.title}</h2>

              <ul>
                {section.items.map((item) => (
                  <li key={item}>
                    <span aria-hidden="true">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="ttv-help-callout">
          <strong>Still acting weird?</strong>
          <p>
            Use Recovery to clear local browser state, or Backup to save and restore local settings
            before major updates.
          </p>
        </div>

        <div className="ttv-ops-actions">
          <Link href="/">Open app</Link>
          <Link href="/install">Install</Link>
          <Link href="/compat">Compatibility</Link>
          <Link href="/recovery">Recovery</Link>
          <Link href="/backup">Backup</Link>
          <Link href="/launch">Launch hub</Link>
        </div>
      </section>
    </main>
  );
}
