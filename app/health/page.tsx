"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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

function isHealthPayload(value: unknown): value is HealthPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<HealthPayload>;

  return (
    typeof payload.ok === "boolean" &&
    typeof payload.app === "string" &&
    typeof payload.shortName === "string" &&
    typeof payload.status === "string" &&
    typeof payload.environment === "string" &&
    typeof payload.version === "string" &&
    typeof payload.checkedAt === "string"
  );
}

export default function HealthPage() {
  const [state, setState] = useState<CheckState>({
    status: "loading",
  });

  const checkHealth = useCallback(async () => {
    try {
      setState({ status: "loading" });

      const response = await fetch("/api/health", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          `Health endpoint returned ${response.status}`,
        );
      }

      const data: unknown = await response.json();

      if (!isHealthPayload(data)) {
        throw new Error(
          "Health endpoint returned an unexpected response.",
        );
      }

      setState({
        status: "healthy",
        data,
      });
    } catch (error) {
      setState({
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "Unknown health check error",
      });
    }
  }, []);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  return (
    <main className="ttv-ops-screen">
      <section className="ttv-ops-card">
        <div className="ttv-ops-logo">
          TTV
        </div>

        <div>
          <p className="ttv-ops-kicker">
            Production health
          </p>

          <h1>Tate&apos;s TV Status</h1>

          <p>
            Quick production check for deployment
            status, API availability, and launch
            readiness.
          </p>
        </div>

        <div
          className="ttv-ops-status"
          data-status={state.status}
        >
          {state.status === "loading" && (
            <>
              <strong>Checking...</strong>
              <span>
                Contacting the health endpoint.
              </span>
            </>
          )}

          {state.status === "healthy" && (
            <>
              <strong>Healthy</strong>

              <span>
                {state.data.app} is responding
                normally.
              </span>

              <code>
                Version: {state.data.version}
              </code>

              <code>
                Environment:{" "}
                {state.data.environment}
              </code>

              <code>
                Checked: {state.data.checkedAt}
              </code>
            </>
          )}

          {state.status === "failed" && (
            <>
              <strong>
                Health Check Failed
              </strong>

              <span>
                {state.message}
              </span>
            </>
          )}
        </div>

        <div className="ttv-ops-actions">
          <button
            type="button"
            onClick={() => {
              void checkHealth();
            }}
          >
            Refresh Health Check
          </button>

          <Link href="/">
            Back to App
          </Link>

          <Link href="/recovery">
            Open Recovery
          </Link>
        </div>
      </section>
    </main>
  );
}