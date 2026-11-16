import { rokuAuthClient, rokuAccountGuard } from "@/lib/server/rokuAccount";
import { touchAccountDevice } from "@/lib/server/accountDevices";
import { accountView } from "@/lib/server/accountData";
import { readViewing, mutateViewing, ViewingError, validViewingGrant, viewingGrant } from "@/lib/server/accountViewing";
import { privateJson, readBoundedJson } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    const denied = await rokuAccountGuard(request, "viewing");
    if (denied) return denied;
    const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
    if (!token || token.length > 8192) return privateJson({ ok: false, error: "Please sign in again." }, 401);
    const { data, error } = await rokuAuthClient().auth.getUser(token);
    if (error && (!error.status || error.status >= 500 || error.status === 429)) return privateJson({ ok: false, error: "Account connection interrupted. Try again shortly." }, 503);
    if (error || !data.user?.email_confirmed_at || !await touchAccountDevice(data.user, token, "roku", "Roku TV"))
      return privateJson({ ok: false, error: "This TV was signed out. Please sign in again." }, 401);
    const input = await readBoundedJson(request, 8192) as Record<string, unknown> | null;
    const view = await accountView(data.user);
    if (!input || typeof input.profileId !== "string" || !validViewingGrant(input.profileGrant, view, token, input.profileId))
      return privateJson({ ok: false, error: "Choose your profile again to reconnect saved viewing." }, 403);
    const result = input.action === "state" ? await readViewing(view, input.profileId) : await mutateViewing(data.user, input, view);
    return privateJson({ ok: true, ...result, profileGrant: viewingGrant(view, token, input.profileId), ownedThemeIds: view.ownedThemeIds, purchasedThemeIds: view.purchasedThemeIds, member: view.member });
  } catch (error) {
    return privateJson({ ok: false, error: error instanceof ViewingError ? error.message : "Saved viewing is temporarily unavailable." }, error instanceof ViewingError ? error.status : 503);
  }
}
