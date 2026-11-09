import { noStoreJson } from "@/lib/server/http";
import type { NextResponse } from "next/server";
import { adminAccountsEnabled, isAdminRequestAuthorized } from "@/lib/server/adminAuth";
import { passwordAdminEnabled } from "@/lib/server/adminPassword";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AdminSessionResponse = {
  ok: boolean;
  isAdmin: boolean;
  methods: { account: boolean; password: boolean };
};

function jsonResponse(
  body: AdminSessionResponse,
  init?: ResponseInit,
): NextResponse<AdminSessionResponse> {
  return noStoreJson(body, init);
}

export async function GET() {
  const isAdmin = await isAdminRequestAuthorized();

  return jsonResponse({
    ok: true,
    isAdmin,
    methods: { account: adminAccountsEnabled(), password: passwordAdminEnabled() },
  });
}
