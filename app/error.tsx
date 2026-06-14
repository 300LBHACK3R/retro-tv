"use client";

import { useEffect, useState } from "react";

type ErrorPageProps = {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
};

export default function ErrorPage({
  error,
  reset,
}: ErrorPageProps) {
  const [isResetting, setIsResetting] =
    useState(false);

  useEffect(() => {
    console.error(
      "[TATE'S TV ERROR]",
      {
        message: error.message,
        digest: error.digest,
        stack: error.stack,
      },
    );
  }, [error]);

  function handleReset() {
    if (isResetting) {
      return;
    }

    setIsResetting(true);

    try {
      reset();
    } finally {
      window.setTimeout(() => {
        setIsResetting(false);
      }, 1500);
    }
  }

  function handleReload() {
    if (typeof window === "undefined") {
      return;
    }

    window.location.reload();
  }

  function handleHardReload() {
    if (typeof window === "undefined") {
      return;
    }

    window.location.assign("/");
  }

  return (
    <main
      className="ttv-launch-screen"
      role="main"
    >
      <section
        className="ttv-launch-card"
        role="alert"
        aria-live="assertive"
        aria-label="Tate's TV recovery screen"
      >
        <div
          className="ttv-launch-logo"
          aria-hidden="true"
        >
          TTV
        </div>

        <div>
          <p className="ttv-launch-kicker">
            Playback Recovery
          </p>

          <h1>
            Something glitched.
          </h1>

          <p>
            Tate&apos;s TV hit an
            unexpected error.
            Your saved channels,
            programming,
            uploads, and settings
            should still be safe.
          </p>
        </div>

        <div className="ttv-launch-actions">
          <button
            type="button"
            onClick={handleReset}
            disabled={isResetting}
          >
            {isResetting
              ? "Recovering..."
              : "Try Again"}
          </button>

          <button
            type="button"
            onClick={handleReload}
          >
            Reload App
          </button>

          <button
            type="button"
            onClick={handleHardReload}
          >
            Return Home
          </button>
        </div>

        {process.env.NODE_ENV !==
          "production" && (
          <details
            style={{
              marginTop: "1rem",
              textAlign: "left",
              width: "100%",
            }}
          >
            <summary>
              Developer Details
            </summary>

            <pre
              style={{
                marginTop: "0.75rem",
                whiteSpace:
                  "pre-wrap",
                wordBreak:
                  "break-word",
                fontSize:
                  "0.75rem",
                opacity: 0.8,
              }}
            >
              {JSON.stringify(
                {
                  message:
                    error.message,
                  digest:
                    error.digest,
                },
                null,
                2,
              )}
            </pre>
          </details>
        )}
      </section>
    </main>
  );
}