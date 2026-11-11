import "server-only";
import { accountEmail, type AccountEmailKind } from "../accountEmails";
import { validEmail } from "../accountModel";
import { createSupabaseAdminClient } from "./supabaseAdmin";

type EmailPayload = { from: string; to: string[]; subject: string; html: string; text: string; reply_to?: string };
type OutboxEmail = {
  id: string;
  user_id: string;
  kind: AccountEmailKind;
  subscription_id: string | null;
  payload: EmailPayload | null;
  attempts: number;
  lease_token: string;
};

export function accountEmailConfiguration() {
  const sender = process.env.TTV_EMAIL_FROM?.trim() ?? "";
  const address = sender.match(/<([^<>]+)>$/)?.[1] ?? sender;
  const replyTo = process.env.TTV_EMAIL_REPLY_TO?.trim();
  return {
    enabled: process.env.TTV_ACCOUNT_EMAILS_ENABLED === "true",
    ready: !!process.env.RESEND_API_KEY && validEmail(address) && !/[\r\n]/.test(sender)
      && (!replyTo || (validEmail(replyTo) && !/[\r\n]/.test(replyTo))),
    sender,
    replyTo,
  };
}

/** Provider acceptance is recorded separately from actual inbox delivery. */
export async function deliverAccountEmails(userId?: string) {
  const config = accountEmailConfiguration();
  if (!config.enabled || !config.ready) return { enabled: config.enabled, ready: config.ready, accepted: 0 };
  let accepted = 0;
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.rpc("ttv_claim_account_emails", { for_user: userId ?? null, batch_size: 2 });
    if (error) throw new Error("queue_unavailable");
    for (const message of (data ?? []) as OutboxEmail[]) {
      const save = async (values: Record<string, unknown>) => {
        const result = await db.from("ttv_account_emails").update(values)
          .eq("id", message.id).eq("lease_token", message.lease_token).eq("status", "sending").select("id");
        if (result.error || result.data?.length !== 1) throw new Error("queue_write_failed");
      };
      try {
        const { data: auth, error: authError } = await db.auth.admin.getUserById(message.user_id);
        if (authError) throw new Error("recipient_lookup_failed");
        const recipient = auth.user;
        if (!recipient?.email_confirmed_at || !validEmail(recipient.email)) {
          await save({ status: "canceled", last_error: "recipient_unverified", lease_until: null });
          continue;
        }
        // Don't send an activation email if access was refunded/revoked while queued.
        if (message.kind === "membership") {
          const member = await db.from("ttv_memberships").select("status,paid,current_period_end")
            .eq("subscription_id", message.subscription_id).eq("user_id", message.user_id).maybeSingle();
          if (member.error) throw new Error("membership_lookup_failed");
          if (!member.data || member.data.status !== "active" || member.data.paid !== true || Date.parse(member.data.current_period_end) <= Date.now()) {
            await save({ status: "canceled", last_error: "membership_inactive", lease_until: null });
            continue;
          }
        }
        let payload = message.payload;
        if (payload && (payload.to.length !== 1 || payload.to[0] !== recipient.email)) {
          await save({ status: "canceled", last_error: "recipient_changed", lease_until: null });
          continue;
        }
        if (!payload) {
          payload = { from: config.sender, to: [recipient.email!], ...accountEmail(message.kind), ...(config.replyTo ? { reply_to: config.replyTo } : {}) };
          // Freeze the exact request before any network call. Retries keep the
          // same payload even when templates or sender settings change later.
          await save({ payload, first_attempt_at: new Date().toISOString() });
        }
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `ttv-account-email/${message.id}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          // Do not log provider response bodies: they can contain addresses.
          throw new Error(`provider_http_${response.status}`);
        }
        const result = await response.json() as { id?: string };
        if (typeof result.id !== "string" || !result.id) throw new Error("provider_invalid_response");
        await save({ status: "accepted", provider_id: result.id, accepted_at: new Date().toISOString(), last_error: null, lease_until: null });
        accepted++;
      } catch (error) {
        const known = error instanceof Error && /^(queue_write_failed|recipient_lookup_failed|membership_lookup_failed|provider_http_\d{3}|provider_invalid_response)$/.test(error.message);
        const reason = known ? (error as Error).message : "delivery_interrupted";
        try {
          await save({ status: "pending", last_error: reason, lease_until: null, next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** Math.min(message.attempts, 6)) * 60_000).toISOString() });
        } catch { /* A crashed lease is reclaimed safely with the same key. */ }
        console.warn("Tate's TV account email pending:", reason);
      }
    }
  } catch {
    console.warn("Tate's TV account email queue unavailable");
  }
  return { enabled: true, ready: true, accepted };
}
