import { accountMutationGuard, verifiedAccount } from "@/lib/server/accountAuth";
import { accountEmailConfiguration, deliverAccountEmails } from "@/lib/server/accountEmails";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { privateJson } from "@/lib/server/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const denied = await accountMutationGuard(request, "welcome-email", 3);
    if (denied) return denied;
    const { user } = await verifiedAccount();
    if (!user) return privateJson({ error: "Sign in to request your welcome email." }, 401);
    const config = accountEmailConfiguration();
    if (!config.enabled || !config.ready) return privateJson({ error: "Welcome emails are not available yet. Your account access is unchanged." }, 503);
    const db = createSupabaseAdminClient();
    const membership = await db.from("ttv_memberships").select("subscription_id")
      .eq("user_id", user.id).eq("status", "active").eq("paid", true)
      .gt("current_period_end", new Date().toISOString()).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (membership.error) throw new Error("Account unavailable");
    const subscription = membership.data?.subscription_id;
    const key = subscription ? `membership:${subscription}` : `welcome:${user.id}`;
    // The recipient is ALWAYS resolved from the verified account. No body fields
    // can select another email address, account, membership or message kind.
    const queued = await db.from("ttv_account_emails").upsert({
      user_id: user.id, kind: subscription ? "membership" : "welcome",
      dedupe_key: key, subscription_id: subscription ?? null,
    }, { onConflict: "dedupe_key", ignoreDuplicates: true });
    if (queued.error) throw new Error("Email unavailable");
    await deliverAccountEmails(user.id);
    const result = await db.from("ttv_account_emails").select("status")
      .eq("dedupe_key", key).eq("user_id", user.id).single();
    if (result.error) throw new Error("Email unavailable");
    if (["review", "canceled"].includes(result.data.status))
      return privateJson({ error: "Your welcome email needs a delivery check. Please use the Help page. Your account access is unchanged." }, 503);
    return privateJson({ ok: true, message: result.data.status === "accepted"
      ? "Your welcome email has been sent. Check your inbox and junk folder."
      : "Your welcome email is queued. You can keep watching while we retry delivery." });
  } catch {
    return privateJson({ error: "The welcome email could not be requested. Please try again later." }, 503);
  }
}
