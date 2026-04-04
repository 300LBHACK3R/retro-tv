import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get("tates_tv_admin")?.value === "true";

  return NextResponse.json({ isAdmin });
}