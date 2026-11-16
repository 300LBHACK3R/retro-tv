import { recordServiceEvent } from "@/lib/server/serviceHealth";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { validEmail, validPassword } from "@/lib/accountModel";
import { accountView } from "@/lib/server/accountData";
import { accountEmailConfiguration, deliverAccountEmails } from "@/lib/server/accountEmails";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { touchAccountDevice } from "@/lib/server/accountDevices";
import { viewingGrant } from "@/lib/server/accountViewing";
import { privateJson, readBoundedJson } from "@/lib/server/http";
import { deviceAccount, deviceSession, issueChallenge, loadDeviceAccount, parentPinMatches,
  readChallenge, rokuAccountGuard, rokuAuthClient, sendRokuCode } from "@/lib/server/rokuAccount";

export const runtime = "nodejs";
const actions = new Set(["signin", "signup", "recover", "verify", "reset", "refresh", "state", "profile", "signout"]);
const failure = (error: string, status = 400) => privateJson({ ok: false, error }, status);

export async function POST(request: Request) {
  try {
    const body = await readBoundedJson(request) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || typeof body.action !== "string" || !actions.has(body.action))
      return failure("Choose a supported account action.");
    const action = body.action;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const challenge = readChallenge(body.challenge);
    const guard = await rokuAccountGuard(request, action, challenge?.email ?? email);
    if (guard) return guard;
    const client = rokuAuthClient();

    if (action === "signup" || action === "recover") {
      if (!validEmail(email)) return failure("Enter a valid email address.");
      if (action === "signup" && (!validPassword(body.password) || body.adult !== true))
        return failure("Use a password of 12–128 characters and confirm you are an adult.");
      if (!accountEmailConfiguration().ready) return failure("Email verification is temporarily unavailable. Existing accounts can still sign in.", 503);
      const purpose = action === "signup" ? "signup" : "recovery";
      const params = purpose === "signup"
        ? { type: "signup" as const, email, password: body.password as string, options: { data: { adult_household: true } } }
        : { type: "recovery" as const, email };
      const { data, error } = await createSupabaseAdminClient().auth.admin.generateLink(params);
      // Do not disclose whether this address already has a confirmed account.
      const expected = error && ["email_exists", "user_already_exists", "user_not_found"].includes(error.code ?? "");
      if (error && !expected) return failure("We couldn't send a verification code. Try again shortly.", 503);
      if (!error && data.properties?.email_otp) await sendRokuCode(email, data.properties.email_otp, purpose, randomUUID());
      return privateJson({ ok: true, challenge: issueChallenge(email, purpose), verificationRequired: true });
    }
    if (action === "signin") {
      if (!validEmail(email) || typeof body.password !== "string" || body.password.length < 1 || body.password.length > 128)
        return failure("Enter your email and password.");
      const { data, error } = await client.auth.signInWithPassword({ email, password: body.password });
      if (error || !data.session || !data.user?.email_confirmed_at)
        return failure(error?.code === "email_not_confirmed" ? "Confirm your email first, then sign in. You can restart Create account to request a TV verification code." : "Email or password did not match. Try again, or choose Forgot password.", 401);
      if (!await touchAccountDevice(data.user, data.session.access_token, "roku", "Roku TV")) return failure("Please sign in again.", 401);
      return privateJson({ ok: true, session: deviceSession(data.session) });
    }
    if (action === "verify" || action === "reset") {
      const purpose = action === "verify" ? "signup" : "recovery";
      if (!challenge || challenge.purpose !== purpose || typeof body.code !== "string" || !/^\d{6,10}$/.test(body.code))
        return failure("That code is invalid or expired. Start again to request a new code.");
      if (action === "reset" && !validPassword(body.password)) return failure("Use a new password of 12–128 characters.");
      const { data, error } = await client.auth.verifyOtp({ email: challenge.email, token: body.code, type: purpose === "signup" ? "email" : "recovery" });
      if (error || !data.session || !data.user?.email_confirmed_at) return failure("That code did not match or has expired. Try again, or start over.");
      if (action === "reset") {
        const updated = await client.auth.updateUser({ password: body.password as string });
        if (updated.error) {
          await client.auth.signOut({ scope: "local" });
          return failure("Password could not be changed. Request a new code and try a different password.");
        }
        await client.auth.signOut({ scope: "others" });
      }
      if (!await touchAccountDevice(data.user, data.session.access_token, "roku", "Roku TV")) return failure("Please sign in again.", 401);
      return privateJson({ ok: true, session: deviceSession(data.session) });
    }
    if (action === "refresh") {
      if (typeof body.refreshToken !== "string" || body.refreshToken.length < 10 || body.refreshToken.length > 4096) return failure("Please sign in again.", 401);
      const { data, error } = await client.auth.refreshSession({ refresh_token: body.refreshToken });
      if (error || !data.session || !data.user?.email_confirmed_at) {
        const expired = !error || (error.status && error.status < 500 && error.status !== 429);
        return failure(expired ? "Your sign-in expired. Please sign in again." : "Unable to refresh your account. Try again shortly.", expired ? 401 : 503);
      }
      // Return rotated credentials before loading profiles. A database outage
      // must never strand the TV with an already-consumed refresh token.
      // Device revocation is checked separately by state/viewing after rotation.
      return privateJson({ ok: true, session: deviceSession(data.session) });
    }
    const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
    if (!token || token.length > 8192) return failure("Please sign in again.", 401);
    const { data: auth, error: authError } = await client.auth.getUser(token);
    if (authError || !auth.user?.email_confirmed_at) return failure("Please sign in again.", authError?.status && authError.status >= 500 ? 503 : 401);
    if (action === "signout") {
      const { error } = await createSupabaseAdminClient().auth.admin.signOut(token, "local");
      if (error) return failure("Sign-out could not reach the server. This TV can still forget its sign-in.", 503);
      return privateJson({ ok: true });
    }
    if (!await touchAccountDevice(auth.user, token, "roku", "Roku TV")) {
      await createSupabaseAdminClient().auth.admin.signOut(token, "local");
      return failure("This TV was signed out from your account. Please sign in again.", 401);
    }
    if (action === "profile") {
      const view = await accountView(auth.user);
      const account = deviceAccount(view);
      const profile = account.profiles.find(item => item.id === body.profileId);
      if (!profile) return failure("That profile is no longer available. Refresh your account.", 404);
      if (!profile.kids && view.household?.pin) {
        const pinGuard = await rokuAccountGuard(request, "parent-pin", auth.user.id);
        if (pinGuard) return pinGuard;
        if (!await parentPinMatches(view, body.pin)) return failure("Enter the parent PIN set on your Tate's TV account.", 403);
      }
      return privateJson({ ok: true, profile, account, profileGrant: viewingGrant(view, token, profile.id) });
    }
    const account = await loadDeviceAccount(auth.user);
    after(() => deliverAccountEmails(auth.user!.id));
    return privateJson({ ok: true, account });
  } catch (error) {
    after(() => recordServiceEvent("server", "account", error instanceof Error && error.message === "Email unavailable" ? "email_failed" : "account_unavailable"));
    return failure("Account services are temporarily unavailable. Please try again shortly.", 503);
  }
}
