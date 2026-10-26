import {
  accountMutationGuard,
  accountOrigin,
  verifiedAccount,
} from "@/lib/server/accountAuth";
import { ensureAccount } from "@/lib/server/accountData";
import { stripeClient } from "@/lib/server/billing";
import { privateJson } from "@/lib/server/http";
export async function POST(request: Request) {
  try {
    const denied = await accountMutationGuard(request, "billing-portal", 20);
    if (denied) return denied;
    const { user } = await verifiedAccount();
    if (!user) return privateJson({ error: "Sign in to manage billing." }, 401);
    const account = await ensureAccount(user);
    if (!account.stripe_customer_id)
      return privateJson(
        { error: "There are no purchases to manage yet." },
        404,
      );
    const session = await stripeClient().billingPortal.sessions.create({
      customer: account.stripe_customer_id,
      return_url: `${accountOrigin()}/account`,
    });
    return privateJson({ url: session.url });
  } catch {
    return privateJson(
      { error: "Billing management is temporarily unavailable." },
      503,
    );
  }
}
