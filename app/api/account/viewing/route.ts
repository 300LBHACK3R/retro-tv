import { accountMutationGuard, verifiedAccount } from "@/lib/server/accountAuth";
import { accountView } from "@/lib/server/accountData";
import { readViewing, mutateViewing, ViewingError } from "@/lib/server/accountViewing";
import { privateJson, readBoundedJson } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    const { user } = await verifiedAccount();
    if (!user) return privateJson({ error: "Sign in to load your viewing." }, 401);
    return privateJson(await readViewing(await accountView(user), new URL(request.url).searchParams.get("profile") ?? ""));
  } catch (error) { return failed(error); }
}
export async function POST(request: Request) {
  try {
    const denied = await accountMutationGuard(request, "viewing", 360);
    if (denied) return denied;
    const { user } = await verifiedAccount();
    if (!user) return privateJson({ error: "Sign in to save your viewing." }, 401);
    const input = await readBoundedJson(request, 8192) as Record<string, unknown> | null;
    if (!input || input.ownerId !== user.id) return privateJson({ error: "Your account changed. Reload this page." }, 409);
    return privateJson(await mutateViewing(user, input, await accountView(user)));
  } catch (error) { return failed(error); }
}
function failed(error: unknown) {
  return privateJson({ error: error instanceof ViewingError ? error.message : "Saved viewing is temporarily unavailable." }, error instanceof ViewingError ? error.status : 503);
}
