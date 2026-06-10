import Link from "next/link";

export default function NotFound() {
  return (
    <main className="ttv-launch-screen">
      <section className="ttv-launch-card">
        <div className="ttv-launch-logo">404</div>

        <div>
          <p className="ttv-launch-kicker">Signal lost</p>
          <h1>Channel not found.</h1>
          <p>
            That page does not exist, but the live TV lineup is still waiting.
          </p>
        </div>

        <Link className="ttv-launch-link" href="/">
          Back to Tate&apos;s TV
        </Link>
      </section>
    </main>
  );
}
