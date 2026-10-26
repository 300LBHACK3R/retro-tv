import "server-only";
import Stripe from "stripe";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "./supabaseAdmin";
import { ensureAccount } from "./accountData";
import { accountOrigin } from "./accountAuth";
import {
  EMPTY_ACCOUNT,
  THEME_PRICE_CENTS,
  MEMBERSHIP_PLANS,
  type MembershipPlanId,
  type AccountView,
} from "../accountModel";
import { getThemeById, isThemeId } from "../themes";

export function billingEnabled() {
  return process.env.NEXT_PUBLIC_THEME_BILLING_ENABLED === "true";
}
export function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Billing unavailable");
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
    timeout: 15_000,
  });
}
let priceCache: { until: number; value: AccountView["commerce"] } | null = null;
function membershipPriceId(plan: MembershipPlanId) {
  const prices = {
    monthly: process.env.STRIPE_MEMBERSHIP_PRICE_ID,
    "six-month": process.env.STRIPE_MEMBERSHIP_6MONTH_PRICE_ID,
    annual: process.env.STRIPE_MEMBERSHIP_ANNUAL_PRICE_ID,
  };
  return prices[plan];
}
export async function commerceCatalog(): Promise<AccountView["commerce"]> {
  if (
    !billingEnabled() ||
    !process.env.STRIPE_SECRET_KEY ||
    !process.env.STRIPE_WEBHOOK_SECRET ||
    !process.env.STRIPE_THEME_PRICE_ID
  )
    return EMPTY_ACCOUNT.commerce;
  if (priceCache && priceCache.until > Date.now()) return priceCache.value;
  const stripe = stripeClient();
  const [theme, memberships] = await Promise.all([
    stripe.prices.retrieve(process.env.STRIPE_THEME_PRICE_ID),
    Promise.all(MEMBERSHIP_PLANS.map(async (plan) => {
      const id = membershipPriceId(plan.id);
      return id ? { plan, price: await stripe.prices.retrieve(id) } : null;
    })),
  ]);
  if (
    !theme.active ||
    theme.type !== "one_time" ||
    theme.currency !== "cad" ||
    theme.unit_amount !== THEME_PRICE_CENTS
  )
    throw new Error("Theme price configuration is invalid");
  const format = (amount: number) => `C$${(amount / 100).toFixed(2)}`;
  const membershipPlans = memberships.flatMap((entry) => {
    if (!entry) return [];
    const { plan, price } = entry;
    if (!price.active || price.type !== "recurring" || price.currency !== "cad" ||
        price.unit_amount !== plan.amount || price.recurring?.interval !== plan.interval ||
        price.recurring.interval_count !== plan.intervalCount)
      throw new Error("Membership price configuration is invalid");
    return [{ id: plan.id, price: format(price.unit_amount) }];
  });
  const value = {
    enabled: true,
    themePrice: format(theme.unit_amount),
    membershipPlans,
  };
  priceCache = { until: Date.now() + 300_000, value };
  return value;
}
export async function customerFor(user: User) {
  const account = await ensureAccount(user);
  if (account.stripe_customer_id) return account.stripe_customer_id as string;
  const customer = await stripeClient().customers.create(
    {
      email: user.email,
      metadata: { application: "tates-tv", user_id: user.id },
    },
    { idempotencyKey: `ttv-customer:${user.id}` },
  );
  const { error } = await createSupabaseAdminClient()
    .from("ttv_accounts")
    .update({ stripe_customer_id: customer.id })
    .eq("user_id", user.id);
  if (error) throw new Error("Billing account unavailable");
  return customer.id;
}
export async function createCheckout(
  user: User,
  product: "theme" | "membership",
  themeId: string | undefined,
  requestId: string,
  planId: MembershipPlanId = "monthly",
) {
  const catalog = await commerceCatalog();
  if (
    !catalog.enabled ||
    (product === "membership" && !catalog.membershipPlans.some(plan => plan.id === planId))
  )
    throw new Error("Purchases are not available yet.");
  if (
    product === "theme" &&
    (!isThemeId(themeId) || !getThemeById(themeId).isPremium)
  )
    throw new Error("Choose a premium theme.");
  const stripe = stripeClient();
  const customer = await customerFor(user);
  if (product === "membership") {
    const subscriptions = await stripe.subscriptions.list({
      customer,
      status: "all",
      limit: 100,
    });
    if (
      subscriptions.data.some((sub) =>
        [
          "active",
          "trialing",
          "past_due",
          "unpaid",
          "incomplete",
          "paused",
        ].includes(sub.status),
      )
    )
      throw new Error(
        "You already have a membership or an unfinished membership payment. Use Manage membership.",
      );
  }
  const metadata = {
    application: "tates-tv",
    user_id: user.id,
    product,
    theme_id: product === "theme" ? themeId! : "",
    plan_id: product === "membership" ? planId : "",
  };
  const pending = await stripe.checkout.sessions.list({
    customer,
    status: "open",
    limit: 100,
  });
  const existing = pending.data.find(
    (session) =>
      session.metadata?.application === "tates-tv" &&
      session.metadata.product === product &&
      session.metadata.theme_id === metadata.theme_id &&
      (product !== "membership" || session.metadata.plan_id === planId),
  );
  if (existing?.url) return existing.url;
  if (product === "membership") {
    for (const session of pending.data) {
      if (session.metadata?.application === "tates-tv" && session.metadata.product === "membership")
        await stripe.checkout.sessions.expire(session.id);
    }
  }
  const session = await stripe.checkout.sessions.create(
    {
      mode: product === "membership" ? "subscription" : "payment",
      integration_identifier: "tates_tv_hosted_qmnrwzjk",
      customer,
      line_items: [
        {
          price:
            product === "membership"
              ? membershipPriceId(planId)!
              : process.env.STRIPE_THEME_PRICE_ID!,
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      metadata,
      ...(product === "membership"
        ? { subscription_data: { metadata } }
        : { payment_intent_data: { metadata } }),
      success_url: `${accountOrigin()}/account?checkout=success`,
      cancel_url: `${accountOrigin()}/account?checkout=cancelled`,
      automatic_tax: {
        enabled: process.env.STRIPE_AUTOMATIC_TAX_ENABLED === "true",
      },
      customer_update: { address: "auto" },
      custom_text: {
        submit: {
          message:
            product === "membership"
              ? `Membership is billed upfront ${MEMBERSHIP_PLANS.find(plan => plan.id === planId)!.renewal} and renews automatically. Cancel future renewals in your account. Viewing stays free.`
              : `One-time purchase: ${getThemeById(themeId).name}. Viewing stays free.`,
        },
      },
    },
    {
      idempotencyKey: `ttv-checkout:${user.id}:${product}:${product === "membership" ? planId : themeId}:${requestId}`,
    },
  );
  if (!session.url) throw new Error("Checkout unavailable");
  return session.url;
}

async function customerOwner(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
) {
  const id = typeof customer === "string" ? customer : customer?.id;
  if (!id) return null;
  const { data, error } = await createSupabaseAdminClient()
    .from("ttv_accounts")
    .select("user_id")
    .eq("stripe_customer_id", id)
    .maybeSingle();
  if (error) throw new Error("Billing account lookup failed");
  return data?.user_id as string | undefined;
}
async function chargeDisputed(stripe: Stripe, charge: Stripe.Charge | null) {
  if (!charge?.disputed) return false;
  const disputes = await stripe.disputes.list({
    charge: charge.id,
    limit: 100,
  });
  return disputes.data.some(
    (dispute) =>
      dispute.status !== "won" && dispute.status !== "warning_closed",
  );
}
export async function applyBillingEvent(event: Stripe.Event) {
  const stripe = stripeClient();
  let order: Record<string, unknown> | null = null;
  let membership: Record<string, unknown> | null = null;
  let sessionId: string | null = null;
  let subscriptionId: string | null = null;
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode === "subscription")
      subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription?.id ?? null);
    else sessionId = session.id;
  } else if (event.type.startsWith("customer.subscription.")) {
    subscriptionId = (event.data.object as Stripe.Subscription).id;
  } else if (
    event.type === "invoice.paid" ||
    event.type === "invoice.payment_failed"
  ) {
    const invoice = event.data.object as Stripe.Invoice;
    const sub = invoice.parent?.subscription_details?.subscription;
    subscriptionId = typeof sub === "string" ? sub : (sub?.id ?? null);
  } else if (
    event.type === "charge.refunded" ||
    event.type === "charge.dispute.created" ||
    event.type === "charge.dispute.closed"
  ) {
    const object = event.data.object;
    const chargeId =
      event.type === "charge.refunded"
        ? object.id
        : typeof (object as Stripe.Dispute).charge === "string"
          ? ((object as Stripe.Dispute).charge as string)
          : ((object as Stripe.Dispute).charge as Stripe.Charge).id;
    const charge = await stripe.charges.retrieve(chargeId);
    const paymentIntent =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (paymentIntent) {
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: paymentIntent,
        limit: 1,
      });
      sessionId = sessions.data[0]?.id ?? null;
      if (!sessionId) {
        const payments = await stripe.invoicePayments.list({
          payment: { type: "payment_intent", payment_intent: paymentIntent },
          limit: 1,
        });
        const linked = payments.data[0]?.invoice;
        if (linked) {
          const invoice = await stripe.invoices.retrieve(
            typeof linked === "string" ? linked : linked.id,
          );
          const sub = invoice.parent?.subscription_details?.subscription;
          subscriptionId = typeof sub === "string" ? sub : (sub?.id ?? null);
        }
      }
    }
  } else return;
  if (sessionId) {
    // Always retrieve authoritative state; the redirect and event metadata never grant ownership alone.
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent.latest_charge"],
    });
    const owner = await customerOwner(session.customer);
    const theme = session.metadata?.theme_id;
    if (
      !owner ||
      session.metadata?.application !== "tates-tv" ||
      session.metadata.user_id !== owner ||
      !isThemeId(theme) ||
      !getThemeById(theme).isPremium
    )
      return;
    const items = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 2,
    });
    if (
      session.mode !== "payment" ||
      items.data.length !== 1 ||
      items.data[0]?.price?.id !== process.env.STRIPE_THEME_PRICE_ID ||
      items.data[0]?.quantity !== 1
    )
      return;
    const intent = session.payment_intent as Stripe.PaymentIntent | null;
    const charge = intent?.latest_charge as Stripe.Charge | null;
    const disputed = await chargeDisputed(stripe, charge);
    const status = charge?.refunded
      ? "refunded"
      : disputed
        ? "disputed"
        : session.payment_status === "paid" && intent?.status === "succeeded"
          ? "paid"
          : "unpaid";
    if (!intent?.id) return;
    order = {
      session_id: session.id,
      user_id: owner,
      theme_id: theme,
      payment_intent_id: intent.id,
      status,
    };
  }
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice"],
    });
    const owner = await customerOwner(subscription.customer);
    if (
      !owner ||
      subscription.metadata.application !== "tates-tv" ||
      subscription.metadata.user_id !== owner
    )
      return;
    const item = subscription.items.data.find(
      (item) => MEMBERSHIP_PLANS.some(plan => item.price.id === membershipPriceId(plan.id)),
    );
    const invoice = subscription.latest_invoice as Stripe.Invoice | null;
    let paid = invoice?.status === "paid";
    if (paid && invoice) {
      const payments = await stripe.invoicePayments.list({
        invoice: invoice.id,
        status: "paid",
        limit: 100,
      });
      paid = false;
      for (const payment of payments.data) {
        const pi = payment.payment.payment_intent;
        if (!pi) continue;
        const intent = await stripe.paymentIntents.retrieve(
          typeof pi === "string" ? pi : pi.id,
          { expand: ["latest_charge"] },
        );
        const charge = intent.latest_charge as Stripe.Charge | null;
        if (
          charge &&
          !charge.refunded &&
          !(await chargeDisputed(stripe, charge)) &&
          intent.status === "succeeded"
        )
          paid = true;
      }
    }
    membership = {
      subscription_id: subscription.id,
      user_id: owner,
      status: item ? subscription.status : "canceled",
      paid,
      current_period_end: new Date(
        (item?.current_period_end ?? 0) * 1000,
      ).toISOString(),
    };
  }
  const { error } = await createSupabaseAdminClient().rpc(
    "ttv_apply_billing_event",
    {
      event_id: event.id,
      event_created: event.created,
      theme_order: order,
      membership,
    },
  );
  if (error) throw new Error("Billing event could not be saved");
}
