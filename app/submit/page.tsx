import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ThemeButton from "@/components/ThemeButton";

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
  "Upload your clip directly or provide a secure shareable link.",
  "Complete the clip details, ownership confirmations, and release agreement.",
  "Receive a submission reference code after the clip enters the moderation queue.",
  "Tate's TV reviews rights, quality, safety, and fit before any public use.",
];

export default function SubmitClipPage() {
  return (
    <main className="ttv-submit-page">
      <header className="ttv-submit-nav">
        <Link href="/" aria-label="Back to Tate's TV live channels">
          <Image
            src="/tatestv-logo.png"
            alt="Tate's TV"
            width={210}
            height={72}
            className="h-auto w-[150px] sm:w-[190px]"
            priority
          />
        </Link>

        <nav className="ttv-submit-nav__actions" aria-label="Submission page navigation">
          <ThemeButton />
          <Link href="/library">Library</Link>
          <Link href="/">Live TV</Link>
        </nav>
      </header>

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
            Upload the video directly to Tate&apos;s TV or use a shareable cloud link.
            You will see live upload progress and receive a reference code when the
            clip has entered the protected moderation queue.
          </p>
        </div>

        <SubmitClipForm />
      </section>
    </main>
  );
}
