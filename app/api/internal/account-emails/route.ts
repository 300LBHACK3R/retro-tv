import { timingSafeEqual } from "node:crypto";
import { deliverAccountEmails } from "@/lib/server/accountEmails";
import { privateJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected))
    return privateJson({ error: "Unauthorized" }, 401);
  return privateJson(await deliverAccountEmails());
}
