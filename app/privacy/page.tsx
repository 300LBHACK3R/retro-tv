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
        Your household profiles, favourites, watchlist and theme choices sync
        with your parent account. Playback settings and resume positions stay
        on the current device. Clearing browser storage removes those local
        settings but does not delete your account or its saved parent PIN.
      </p>
      <h2>Parent accounts and optional purchases</h2>
      <p>A verified parent account is required to use the viewer and library. Paid membership is optional. Children use Kids profiles inside a parent’s household rather than separate email accounts. Email addresses and password authentication are managed by Supabase. We do not store your plaintext password. Account sessions use secure HttpOnly cookies. When signed in, your household profiles, salted parent-PIN hash, favourites, watchlist and theme choices are stored with your account and sync across devices. Device-only profiles are imported only when you choose to import them. Playback resume positions remain on the current device.</p>
      <p>Stripe handles checkout, payment details, receipts and subscription billing. Tate’s TV keeps purchase and membership identifiers and status to provide access. Card details are not stored by Tate’s TV. Cancelling membership stops future renewals; individually purchased themes remain available. Signed-in purchases and account pages are excluded from optional viewing analytics.</p>
      <p>You can sign out, request a password reset or delete your account from Account settings. Account deletion removes synced household data and cancels membership. Payment providers may retain transaction records for their own legal and accounting requirements. Clearing browser storage alone does not delete a registered account or cancel a subscription.</p>
      <h2>Profiles & Kids mode</h2>
      <p>
        Each profile has separate saved items, in the signed-in household account. The parent PIN is
        stored as a salted hash. Kids mode uses programming explicitly approved
        by the station, including eligible ads. Opening full-lineup profiles and
        managing profiles requires the PIN once it is set.
      </p>
      <p>
        Household profiles are separate from account sign-in and are not age verification.
        Clearing browser data does not remove the parent PIN saved to your account. Public video links
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
