import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import AnalyticsPreference from "@/components/viewer/AnalyticsPreference";

export const metadata = pageMetadata(
  "Privacy & saved preferences",
  "How Tate's TV uses device preferences and optional viewing measurements.",
  "/privacy",
);

export default function PrivacyPage() {
  return (
    <main className="ttv-policy-page">
      <Link href="/">← Back to live TV</Link>
      <h1>Privacy & saved preferences</h1>
      <p>
        Your profile names and avatars, favourites, watchlist and library
        playback progress are saved in your browser. They do not require an
        account and do not follow you to another device. Clearing this site’s
        browser storage removes them. Theme choices last for the current visit.
      </p>
      <h2>Profiles & Kids mode</h2>
      <p>
        Each profile has separate saved items on this browser. The parent PIN is
        stored as a salted hash. Kids mode uses programming explicitly approved
        by the station, including eligible ads. Opening full-lineup profiles and
        managing profiles requires the PIN once it is set.
      </p>
      <p>
        Profiles are device preferences, not accounts or age verification.
        Clearing browser data resets the profiles and PIN. Public video links
        remain public. Profile names and PINs are not sent to station insights.
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
      <h2>Your analytics choice</h2>
      <AnalyticsPreference />
      <p>
        Optional measurement runs only after a full-lineup profile is selected.
        Kids profiles are excluded. We measure public page visits, broad traffic
        sources (such as search or social), guide and theme use, playback
        starts, errors, loading times and TV connection attempts. Broad browser
        and device categories help us identify problems on phones, Safari and
        TVs. We do not collect profile names, PINs, search text, screen
        recordings, full referring URLs or raw user-agent strings in these
        event records. The same 30-day retention and browser privacy choices
        apply.
      </p>
      <h2>Site analytics</h2>
      <p>
        Tate’s TV also uses Vercel Web Analytics for participating full-lineup
        profiles. Public page URLs are stripped of query strings and fragments;
        private pages, Kids profiles and opt-outs are excluded. Its handling of
        website analytics is described in{" "}
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
