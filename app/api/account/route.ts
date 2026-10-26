import { accountsEnabled, verifiedAccount } from "@/lib/server/accountAuth";
import { accountView } from "@/lib/server/accountData";
import { commerceCatalog } from "@/lib/server/billing";
import { privateJson } from "@/lib/server/http";
import { EMPTY_ACCOUNT } from "@/lib/accountModel";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!accountsEnabled()) return privateJson(EMPTY_ACCOUNT);
  try {
    const { user } = await verifiedAccount();
    const state = user
      ? await accountView(user)
      : { ...EMPTY_ACCOUNT, enabled: true };
    try {
      state.commerce = await commerceCatalog();
    } catch {
      /* Account access stays available during a payment outage. */
    }
    return privateJson(state);
  } catch {
    return privateJson(
      {
        error:
          "Account services are temporarily unavailable. Please try again.",
      },
      503,
    );
  }
}
