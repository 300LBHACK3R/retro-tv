import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata(
  "Privacy & saved preferences",
  "How Tate's TV uses device preferences and anonymous playback information.",
  "/privacy",
);

export default function PrivacyPage() {
  return (
    <main className="ttv-policy-page">
      <Link href="/">← Back to live TV</Link>
      <h1>Privacy & saved preferences</h1>
      <p>
        Your favourites, watchlist, theme and library playback progress are
        saved in your browser. They do not require an account and do not follow
        you to another device. Clearing this site’s browser storage removes
        them.
      </p>
      <h2>Understanding playback</h2>
      <p>
        When station insights are enabled, Tate’s TV uses a random, signed
        browser identifier to estimate returning devices and collect programme
        identifiers, viewing time, buffering, playback starts and errors. The
        identifier expires after 30 days. These station records do not include
        your name, email, IP address or video URLs.
      </p>
      <p>
        Playback collection respects your browser’s Do Not Track and Global
        Privacy Control settings. Records older than 30 days are removed when
        new samples arrive or the station report is refreshed. A blocked
        connection or unavailable reporting service does not stop playback.
      </p>
      <h2>Site analytics</h2>
      <p>
        Tate’s TV also uses Vercel Web Analytics for website traffic. Its
        handling of website analytics is described in{" "}
        <a
          href="https://vercel.com/docs/analytics/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          Vercel’s analytics privacy information
        </a>
        .
      </p>
      <h2>Clip submissions</h2>
      <p>
        Submitting a clip shares the contact details and content you enter with
        the station so it can review and respond to your submission. These
        submissions are separate from anonymous viewing measurements.
      </p>
    </main>
  );
}
