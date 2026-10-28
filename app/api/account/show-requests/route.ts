import { accountsEnabled, accountMutationGuard, verifiedAccount } from "@/lib/server/accountAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { privateJson, readBoundedJson } from "@/lib/server/http";
import { MEMBER_REQUEST_COLUMNS, REQUEST_PAGE_SIZE, parseShowRequest, requestPage } from "@/lib/showRequests";

export async function GET(request: Request) {
  try {
    if (!accountsEnabled()) return privateJson({ error: "Accounts are temporarily unavailable." }, 503);
    const { user } = await verifiedAccount();
    if (!user) return privateJson({ error: "Sign in to see your requests." }, 401);
    const page = requestPage(new URL(request.url).searchParams.get("page"));
    // History remains available after membership expires. Only this account's rows are returned.
    const { data, count, error } = await createSupabaseAdminClient().from("ttv_show_requests")
      .select(MEMBER_REQUEST_COLUMNS, { count: "exact" }).eq("user_id", user.id)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(page * REQUEST_PAGE_SIZE, (page + 1) * REQUEST_PAGE_SIZE - 1);
    if (error) throw error;
    return privateJson({ requests: data, total: count ?? 0, page });
  } catch {
    return privateJson({ error: "Your requests could not be loaded. Please try again." }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const denied = await accountMutationGuard(request, "show-request", 15);
    if (denied) return denied;
    const { user } = await verifiedAccount();
    if (!user) return privateJson({ error: "Sign in to request a show." }, 401);
    const input = parseShowRequest(await readBoundedJson(request));
    if (!input) return privateJson({ error: "Enter a show title (2–160 characters), a valid year, and keep your notes within the limits." }, 400);
    // The transaction verifies paid membership, serializes this account's writes,
    // deduplicates retries and enforces the open-request limit in the database.
    const { data, error } = await createSupabaseAdminClient().rpc("ttv_submit_show_request", {
      requester: user.id, show_title: input.title, show_year: input.release_year,
      show_seasons: input.seasons, show_details: input.details,
    });
    if (error) {
      if (error.message.includes("membership_required")) return privateJson({ error: "An active paid membership is required to request a show." }, 403);
      if (error.message.includes("request_limit")) return privateJson({ error: "You have 5 open requests. You can submit another when one is marked Added or Unavailable." }, 409);
      throw error;
    }
    return privateJson({ ok: true, duplicate: data.duplicate, id: data.id });
  } catch {
    return privateJson({ error: "We could not confirm your request. Please retry; the same show will not be submitted twice." }, 503);
  }
}
