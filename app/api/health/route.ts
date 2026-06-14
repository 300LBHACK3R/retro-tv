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

export function GET() {
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