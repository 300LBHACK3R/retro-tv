import "server-only";
import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "./supabaseAdmin";
import {
  allowedThemeIds,
  EMPTY_ACCOUNT,
  FREE_PROFILE_LIMIT,
  MEMBER_PROFILE_LIMIT,
  sanitizeHousehold,
  type AccountView,
} from "../accountModel";
import { isThemeId } from "../themes";

export async function ensureAccount(user: User) {
  const db = createSupabaseAdminClient();
  const { error } = await db
    .from("ttv_accounts")
    .upsert(
      { user_id: user.id },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (error) throw new Error("Account database unavailable");
  const { data, error: readError } = await db
    .from("ttv_accounts")
    .select("household,revision,stripe_customer_id")
    .eq("user_id", user.id)
    .single();
  if (readError) throw new Error("Account database unavailable");
  return data;
}
export async function accountView(user: User): Promise<AccountView> {
  const db = createSupabaseAdminClient();
  const [row, orders, memberships] = await Promise.all([
    ensureAccount(user),
    db
      .from("ttv_theme_orders")
      .select("theme_id")
      .eq("user_id", user.id)
      .eq("status", "paid"),
    db
      .from("ttv_memberships")
      .select("status,paid,current_period_end")
      .eq("user_id", user.id),
  ]);
  if (orders.error || memberships.error)
    throw new Error("Account data unavailable");
  const member = memberships.data.some(
    (item) =>
      item.status === "active" &&
      item.paid === true &&
      Date.parse(item.current_period_end) > Date.now(),
  );
  const owned = orders.data.map((item) => item.theme_id).filter(isThemeId);
  return {
    ...EMPTY_ACCOUNT,
    enabled: true,
    user: { id: user.id, email: user.email ?? "" },
    member,
    profileLimit: member ? MEMBER_PROFILE_LIMIT : FREE_PROFILE_LIMIT,
    ownedThemeIds: allowedThemeIds(owned, member),
    purchasedThemeIds: [...new Set(owned)],
    household: sanitizeHousehold(row.household),
    revision: Number(row.revision),
  };
}
