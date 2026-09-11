import { privateJson } from "@/lib/server/http";
import {
  consumeRateLimit,
  getClientAddress,
} from "@/lib/server/requestSecurity";
import { readStationProgramming, probeMedia } from "@/lib/server/stationHealth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type HealthResponse = {
  ok: boolean;
  app: string;
  shortName: string;
  status: string;
  environment: string;
  version: string;
  checkedAt: string;
};

function jsonResponse(
  body: HealthResponse,
  init?: ResponseInit,
): NextResponse<HealthResponse> {
  const response = NextResponse.json(body, init);

  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");

  return response;
}

function getVersion(): string {
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA;

  if (!commitSha) {
    return "local";
  }

  return commitSha.slice(0, 7);
}

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("deep") === "1") {
    if (
      !consumeRateLimit({
        key: `readiness:${getClientAddress(request)}`,
        limit: 12,
        windowMs: 60000,
      }).allowed
    )
      return privateJson({ ok: false, status: "rate-limited" }, 429);
    try {
      const programming = await readStationProgramming();
      const channel = programming?.channels.find(
        (item) => item.isEnabled !== false && item.mediaIds.length > 0,
      );
      const sample = programming?.media.find((item) =>
        channel?.mediaIds.includes(item.id),
      );
      const media = sample
        ? await probeMedia(sample.file)
        : { status: "unverified" };
      const ready = !!channel && media.status === "reachable";
      return privateJson(
        {
          ok: ready,
          app: "Tate's TV",
          status: ready ? "ready" : "degraded",
          checks: {
            application: "ok",
            programming: channel ? "ok" : "empty",
            media: media.status,
          },
          version: getVersion(),
          checkedAt: new Date().toISOString(),
        },
        ready ? 200 : 503,
      );
    } catch {
      return privateJson(
        {
          ok: false,
          app: "Tate's TV",
          status: "degraded",
          checks: {
            application: "ok",
            programming: "unavailable",
            media: "unverified",
          },
          version: getVersion(),
          checkedAt: new Date().toISOString(),
        },
        503,
      );
    }
  }
  return jsonResponse({
    ok: true,
    app: "Tate's TV",
    shortName: "TTV",
    status: "healthy",
    environment: process.env.NODE_ENV ?? "unknown",
    version: getVersion(),
    checkedAt: new Date().toISOString(),
  });
}
