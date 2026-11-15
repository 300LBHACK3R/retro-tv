import type Stripe from "stripe";

export type MembershipNoticeKind = "renewal_reminder" | "payment_failed" | "membership_ending" | "membership_ended";
export type MembershipNoticeContext = { periodEnd: number; invoiceId?: string };
export type MembershipNotice = { kind: MembershipNoticeKind; key: string; context: MembershipNoticeContext };
export function isMembershipNotice(kind: string): kind is MembershipNoticeKind {
  return ["renewal_reminder", "payment_failed", "membership_ending", "membership_ended"].includes(kind);
}

/** The caller resolves the Stripe customer and validates the membership price. */
export function membershipNotice(subscription: Stripe.Subscription, periodEnd: number, eventType: string, now = Date.now() / 1000): MembershipNotice | null {
  const invoice = typeof subscription.latest_invoice === "object" ? subscription.latest_invoice : null;
  const ending = subscription.cancel_at_period_end || !!subscription.cancel_at;
  const context = { periodEnd, ...(invoice?.id ? { invoiceId: invoice.id } : {}) };
  if (eventType === "invoice.upcoming" && subscription.status === "active" && !ending && periodEnd > now && !subscription.pause_collection)
    return { kind: "renewal_reminder", key: `renewal:${subscription.id}:${periodEnd}`, context };
  if (eventType === "invoice.payment_failed" && ["past_due", "unpaid"].includes(subscription.status) && invoice?.id && invoice.status === "open")
    return { kind: "payment_failed", key: `payment-failed:${invoice.id}`, context };
  if (eventType === "customer.subscription.updated" && ending && subscription.status === "active" && invoice?.status === "paid" && periodEnd > now
    && (!subscription.cancel_at || subscription.cancel_at <= periodEnd))
    return { kind: "membership_ending", key: `ending:${subscription.id}:${subscription.cancel_at ?? periodEnd}`, context: { ...context, periodEnd: subscription.cancel_at ?? periodEnd } };
  if (eventType === "customer.subscription.deleted" && subscription.status === "canceled")
    return { kind: "membership_ended", key: `ended:${subscription.id}`, context };
  return null;
}

/** Suppress a queued notice when the customer has already fixed/changed billing. */
export function membershipNoticeCurrent(kind: MembershipNoticeKind, context: MembershipNoticeContext, subscription: Stripe.Subscription, now = Date.now() / 1000) {
  if (!context || !Number.isFinite(context.periodEnd)) return false;
  const invoice = typeof subscription.latest_invoice === "object" ? subscription.latest_invoice : null;
  const ending = subscription.cancel_at_period_end || !!subscription.cancel_at;
  if (kind === "renewal_reminder") return subscription.status === "active" && !ending && !subscription.pause_collection && context.periodEnd > now
    && subscription.items.data.some(item => item.current_period_end === context.periodEnd);
  if (kind === "payment_failed") return ["past_due", "unpaid"].includes(subscription.status) && !!context.invoiceId && invoice?.id === context.invoiceId && invoice.status === "open";
  if (kind === "membership_ending") return subscription.status === "active" && ending && invoice?.status === "paid" && context.periodEnd > now
    && subscription.items.data.some(item => item.current_period_end >= context.periodEnd)
    && (subscription.cancel_at === context.periodEnd || (subscription.cancel_at_period_end && subscription.items.data.some(item => item.current_period_end === context.periodEnd)));
  return subscription.status === "canceled";
}
