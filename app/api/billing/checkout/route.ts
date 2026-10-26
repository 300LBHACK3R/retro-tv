import {
  accountMutationGuard,
  verifiedAccount,
} from "@/lib/server/accountAuth";
import { accountView } from "@/lib/server/accountData";
import { createCheckout } from "@/lib/server/billing";
import { privateJson, readBoundedJson } from "@/lib/server/http";
import { isThemeId } from "@/lib/themes";
export async function POST(request: Request) {
  try {
    const denied = await accountMutationGuard(request, "checkout", 15);
    if (denied) return denied;
    const { user } = await verifiedAccount();
    if (!user)
      return privateJson(
        { error: "Sign in before buying a theme or membership." },
        401,
      );
    const input = (await readBoundedJson(request)) as Record<
      string,
      unknown
    > | null;
    if (
      !input ||
      !["theme", "membership"].includes(String(input.product)) ||
      typeof input.requestId !== "string" ||
      !/^[a-zA-Z0-9-]{20,80}$/.test(input.requestId)
    )
      return privateJson({ error: "Invalid checkout request." }, 400);
    const state = await accountView(user);
    if (
      input.product === "theme" &&
      isThemeId(input.themeId) &&
      state.ownedThemeIds.includes(input.themeId)
    )
      return privateJson(
        { error: "Your account already has access to this theme." },
        409,
      );
    if (input.product === "membership" && state.member)
      return privateJson(
        { error: "Your membership is already active. Use Manage membership." },
        409,
      );
    const url = await createCheckout(
      user,
      input.product as "theme" | "membership",
      typeof input.themeId === "string" ? input.themeId : undefined,
      input.requestId,
    );
    return privateJson({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const expected = [
      "Purchases are not available yet.",
      "Choose a premium theme.",
      "You already have a membership or an unfinished membership payment. Use Manage membership.",
    ];
    return privateJson(
      {
        error: expected.includes(message)
          ? message
          : "Checkout is temporarily unavailable. No purchase was completed here.",
      },
      503,
    );
  }
}
