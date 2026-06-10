import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    app: "Tate's TV",
    shortName: "TTV",
    status: "healthy",
    environment: process.env.NODE_ENV ?? "unknown",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    checkedAt: new Date().toISOString(),
  });
}
