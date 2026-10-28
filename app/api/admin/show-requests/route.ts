import { isAdminRequestAuthorized } from "@/lib/server/adminAuth";
import { isSameOriginRequest } from "@/lib/server/requestSecurity";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { privateJson, readBoundedJson } from "@/lib/server/http";
import { MEMBER_REQUEST_COLUMNS, REQUEST_PAGE_SIZE, isRequestStatus, requestPage } from "@/lib/showRequests";

const COLUMNS = `${MEMBER_REQUEST_COLUMNS},user_id,admin_notes`;
export async function GET(request: Request) {
  try {
    if (!(await isAdminRequestAuthorized())) return privateJson({ error: "Sign in to Admin." }, 401);
    const params = new URL(request.url).searchParams;
    const page = requestPage(params.get("page"));
    const status = params.get("status") || "open";
    if (!["open", "all"].includes(status) && !isRequestStatus(status)) return privateJson({ error: "Choose a valid status." }, 400);
    const search = (params.get("q") || "").trim().slice(0, 160).replace(/[%_*\\]/g, "");
    let query = createSupabaseAdminClient().from("ttv_show_requests").select(COLUMNS, { count: "exact" });
    if (status === "open") query = query.in("status", ["requested", "reviewing", "planned"]);
    else if (isRequestStatus(status)) query = query.eq("status", status);
    if (search) query = query.ilike("title", `%${search}%`);
    const { data, error, count } = await query.order("created_at", { ascending: true }).order("id", { ascending: true })
      .range(page * REQUEST_PAGE_SIZE, (page + 1) * REQUEST_PAGE_SIZE - 1);
    if (error) throw error;
    return privateJson({ requests: data, total: count ?? 0, page });
  } catch {
    return privateJson({ error: "The request inbox could not be loaded. Please try again." }, 503);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return privateJson({ error: "Request origin rejected." }, 403);
    if (!(await isAdminRequestAuthorized())) return privateJson({ error: "Sign in to Admin." }, 401);
    const input = await readBoundedJson(request) as Record<string, unknown> | null;
    if (!input || typeof input.id !== "string" || !/^[a-f0-9-]{36}$/i.test(input.id) ||
      !isRequestStatus(input.status) || typeof input.memberReply !== "string" || input.memberReply.length > 1000 ||
      typeof input.adminNotes !== "string" || input.adminNotes.length > 2000 ||
      typeof input.updatedAt !== "string" || !Number.isFinite(Date.parse(input.updatedAt))) {
      return privateJson({ error: "Choose a valid request and status, and keep notes within the limits." }, 400);
    }
    const { data, error } = await createSupabaseAdminClient().from("ttv_show_requests").update({
      status: input.status, member_reply: input.memberReply.trim(), admin_notes: input.adminNotes.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", input.id).eq("updated_at", input.updatedAt).select(COLUMNS).maybeSingle();
    if (error) throw error;
    if (!data) return privateJson({ error: "This request changed in another window. Refresh the inbox before saving." }, 409);
    return privateJson({ request: data });
  } catch {
    return privateJson({ error: "Your changes could not be saved. Please try again." }, 503);
  }
}
