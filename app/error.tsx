"use client";

import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Tate's TV app error:", error);
  }, [error]);

  return (
    <main className="ttv-launch-screen">
      <section className="ttv-launch-card" role="alert" aria-label="Tate's TV recovery screen">
        <div className="ttv-launch-logo">TTV</div>

        <div>
          <p className="ttv-launch-kicker">Playback recovery</p>
          <h1>Something glitched.</h1>
          <p>
            The app hit a temporary issue. Your saved channels and uploads should still be safe.
          </p>
        </div>

        <div className="ttv-launch-actions">
          <button type="button" onClick={reset}>
            Try again
          </button>

          <button type="button" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </div>
      </section>
    </main>
  );
}
