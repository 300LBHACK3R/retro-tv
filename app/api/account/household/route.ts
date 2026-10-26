import {
  accountMutationGuard,
  verifiedAccount,
} from "@/lib/server/accountAuth";
import { accountView } from "@/lib/server/accountData";
import { billingEnabled } from "@/lib/server/billing";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { privateJson, readBoundedJson } from "@/lib/server/http";
import { sanitizeHousehold, validateHouseholdAccess } from "@/lib/accountModel";
export async function PUT(request: Request) {
  try {
    const denied = await accountMutationGuard(request, "preferences", 180);
    if (denied) return denied;
    const { user } = await verifiedAccount();
    if (!user)
      return privateJson(
        { error: "Sign in to save your account preferences." },
        401,
      );
    const input = (await readBoundedJson(request, 262144)) as {
      household?: unknown;
      revision?: unknown;
    } | null;
    const household = sanitizeHousehold(input?.household);
    if (
      !household ||
      !Number.isSafeInteger(input?.revision) ||
      Number(input?.revision) < 0
    )
      return privateJson({ error: "Invalid account preferences." }, 400);
    const state = await accountView(user);
    const error = validateHouseholdAccess(
      household,
      state.household,
      state.ownedThemeIds,
      state.profileLimit,
      billingEnabled(),
    );
    if (error) return privateJson({ error }, 403);
    const revision = Number(input!.revision);
    const result = await createSupabaseAdminClient()
      .from("ttv_accounts")
      .update({ household, revision: revision + 1 })
      .eq("user_id", user.id)
      .eq("revision", revision)
      .select("revision")
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data)
      return privateJson(
        {
          error:
            "Another device saved newer preferences. Reload them before saving again.",
        },
        409,
      );
    return privateJson({ revision: Number(result.data.revision) });
  } catch {
    return privateJson(
      { error: "Your preferences could not be saved. Please try again." },
      503,
    );
  }
}
