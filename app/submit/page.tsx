import type { Metadata } from "next";
import Link from "next/link";

import SubmitClipForm from "./SubmitClipForm";

export const metadata: Metadata = {
  title: "Submit a FailZone Clip | Tate's TV",
  description:
    "Submit your own funny fail, blooper, wipeout, or harmless chaos clip to Tate's TV for possible FailZone feature consideration.",
};

const prohibitedItems = [
  "Clips you do not own or cannot legally submit",
  "Copyrighted TV, movie, sports broadcast, or music video footage",
  "Copyrighted music that you do not have permission to use",
  "Private/security-camera footage without permission",
  "Dangerous stunts created just to get featured",
  "Illegal activity, harassment, bullying, hate, or explicit content",
  "Graphic injuries or humiliating/private moments",
  "Clips involving minors without parent or guardian permission",
];

const reviewSteps = [
  "Upload your clip to a shareable cloud link.",
  "Complete the submission form and required release agreement.",
  "Tate's TV reviews the clip for rights, quality, safety, and fit.",
  "Approved clips may be edited, credited, scheduled, and featured on FailZone.",
];

export default function SubmitClipPage() {
  return (
    <main className="ttv-submit-page">
      <section className="ttv-submit-hero">
        <div className="ttv-submit-hero-copy">
          <p className="ttv-submit-kicker">FailZone submissions</p>
          <h1>Submit Your Clip to FailZone</h1>
          <p>
            Got a funny fail, unexpected blooper, pet moment, sports wipeout,
            work fail, or harmless chaos caught on camera? Send it to Tate&apos;s
            TV for a chance to be featured on FailZone.
          </p>
          <div className="ttv-submit-hero-actions">
            <a href="#submit-clip">Start Submission</a>
            <Link href="/library">Watch Library</Link>
            <Link href="/">Back to Live TV</Link>
          </div>
        </div>

        <div className="ttv-submit-hero-card" aria-label="FailZone clip review process">
          <span>Clip Review</span>
          <strong>Owned clips only.</strong>
          <p>
            Every submission must include permission for Tate&apos;s TV and
            FailZone to review, edit, publish, stream, promote, and broadcast
            the clip across current and future platforms.
          </p>
        </div>
      </section>

      <section className="ttv-submit-grid" aria-label="Submission rules and process">
        <article>
          <span>01</span>
          <h2>What to submit</h2>
          <p>
            Funny real moments, harmless fails, bloopers, surprising recoveries,
            pet fails, everyday chaos, and short clips that feel right for
            FailZone.
          </p>
        </article>

        <article>
          <span>02</span>
          <h2>Manual review first</h2>
          <p>
            Submissions are not automatically published. Tate&apos;s TV reviews
            every clip before it appears on the website, channels, social media,
            apps, or future platforms.
          </p>
        </article>

        <article>
          <span>03</span>
          <h2>Rights matter</h2>
          <p>
            Only submit clips you own or have full permission to submit. Any
            recognizable people in the clip should be aware and okay with it
            being shared publicly.
          </p>
        </article>
      </section>

      <section className="ttv-submit-rules">
        <div>
          <p className="ttv-submit-kicker">Content rules</p>
          <h2>Do not submit these clips</h2>
          <p>
            These rules protect Tate&apos;s TV, FailZone, submitters, viewers, and
            future app-store release plans.
          </p>
        </div>

        <ul>
          {prohibitedItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="ttv-submit-process">
        <div>
          <p className="ttv-submit-kicker">How it works</p>
          <h2>Simple submission flow</h2>
        </div>

        <ol>
          {reviewSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section id="submit-clip" className="ttv-submit-panel">
        <div className="ttv-submit-panel-heading">
          <p className="ttv-submit-kicker">Official submission form</p>
          <h2>Send your FailZone clip for review</h2>
          <p>
            Paste a shareable video link and complete the rights agreement. This
            first version uses email submission so every clip can be manually
            screened before being added to Tate&apos;s TV.
          </p>
        </div>

        <SubmitClipForm />
      </section>
    </main>
  );
}
