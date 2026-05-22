import { NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/server/adminAuth";

export async function GET() {
  return NextResponse.json({
    isAdmin: await isAdminRequestAuthorized(),
  });
}