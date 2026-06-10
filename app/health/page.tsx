"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HealthPayload = {
  ok: boolean;
  app: string;
  shortName: string;
  status: string;
  environment: string;
  version: string;
  checkedAt: string;
};

type CheckState =
  | { status: "loading" }
  | { status: "healthy"; data: HealthPayload }
  | { status: "failed"; message: string };

export default function HealthPage() {
  const [state, setState] = useState<CheckState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const response = await fetch("/api/health", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Health endpoint returned ${response.status}`);
        }

        const data = (await response.json()) as HealthPayload;

        if (!cancelled) {
          setState({ status: "healthy", data });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "failed",
            message: error instanceof Error ? error.message : "Unknown health check error",
          });
        }
      }
    }

    checkHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card">
        <div className="ttv-ops-logo">TTV</div>

        <div>
          <p className="ttv-ops-kicker">Production health</p>
          <h1>Tate&apos;s TV status</h1>
          <p>
            Quick production check for deploy state, API response, and launch readiness.
          </p>
        </div>

        <div className="ttv-ops-status" data-status={state.status}>
          {state.status === "loading" ? (
            <>
              <strong>Checking...</strong>
              <span>Contacting the health endpoint.</span>
            </>
          ) : null}

          {state.status === "healthy" ? (
            <>
              <strong>Healthy</strong>
              <span>{state.data.app} is responding normally.</span>
              <code>Version: {state.data.version}</code>
              <code>Environment: {state.data.environment}</code>
              <code>Checked: {state.data.checkedAt}</code>
            </>
          ) : null}

          {state.status === "failed" ? (
            <>
              <strong>Health check failed</strong>
              <span>{state.message}</span>
            </>
          ) : null}
        </div>

        <div className="ttv-ops-actions">
          <Link href="/">Back to app</Link>
          <Link href="/recovery">Open recovery</Link>
        </div>
      </section>
    </main>
  );
}
