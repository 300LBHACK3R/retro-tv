import {
  accountClient,
  clearAccountCookies,
  accountMutationGuard,
  accountOrigin,
  hasRecovery,
  setRecovery,
  verifiedAccount,
} from "@/lib/server/accountAuth";
import { ensureAccount } from "@/lib/server/accountData";
import { stripeClient } from "@/lib/server/billing";
import { createSupabaseAdminClient } from "@/lib/server/supabaseAdmin";
import { privateJson, readBoundedJson } from "@/lib/server/http";
import { validEmail, validPassword } from "@/lib/accountModel";
export async function POST(request: Request) {
  try {
    const input = (await readBoundedJson(request)) as Record<
      string,
      unknown
    > | null;
    const action = typeof input?.action === "string" ? input.action : "";
    if (
      ![
        "signup",
        "signin",
        "recover",
        "resend",
        "confirm",
        "reset",
        "signout",
        "delete",
      ].includes(action)
    )
      return privateJson({ error: "Invalid request." }, 400);
    const denied = await accountMutationGuard(
      request,
      action,
      ["signup", "recover", "resend"].includes(action) ? 5 : 20,
    );
    if (denied) return denied;
    const client = await accountClient();
    if (action === "signout") {
      try {
        await client.auth.signOut({ scope: "local" });
      } catch {
        // Removing the HttpOnly credentials still signs this browser out.
      } finally {
        await clearAccountCookies();
      }
      return privateJson({ ok: true });
    }
    if (action === "confirm") {
      const type = input!.type;
      const token = input!.token;
      if (
        (type !== "email" && type !== "recovery") ||
        typeof token !== "string" ||
        !/^[a-zA-Z0-9_-]{20,256}$/.test(token)
      )
        return privateJson(
          { error: "This email link is invalid. Please request a new one." },
          400,
        );
      const { data, error } = await client.auth.verifyOtp({
        token_hash: token,
        type,
      });
      if (error || !data.user || !data.session)
        return privateJson(
          {
            error:
              "This email link has expired or has already been used. Please request a new one.",
          },
          400,
        );
      await setRecovery(type === "recovery" ? data.user.id : null);
      return privateJson({
        ok: true,
        next: type === "recovery" ? "/account?mode=reset" : "/account",
      });
    }
    if (action === "reset") {
      const { user } = await verifiedAccount();
      if (!user || !(await hasRecovery(user.id)))
        return privateJson(
          { error: "Request a new password reset email first." },
          401,
        );
      if (!validPassword(input!.password))
        return privateJson(
          { error: "Use a password between 12 and 128 characters." },
          400,
        );
      const { error } = await client.auth.updateUser({
        password: input!.password,
      });
      if (error)
        return privateJson(
          {
            error:
              "The password could not be updated. Try a different password or request a new reset email.",
          },
          400,
        );
      await client.auth.signOut({ scope: "global" });
      await clearAccountCookies();
      return privateJson({
        ok: true,
        message: "Password updated. Sign in with your new password.",
      });
    }
    if (action === "delete") {
      const { user } = await verifiedAccount();
      if (
        !user ||
        input!.confirmed !== true ||
        typeof input!.password !== "string"
      )
        return privateJson(
          { error: "Confirm deletion and enter your password." },
          400,
        );
      const { data, error } = await client.auth.signInWithPassword({
        email: user.email!,
        password: input!.password,
      });
      if (error || data.user?.id !== user.id)
        return privateJson(
          { error: "The password could not be verified." },
          401,
        );
      const account = await ensureAccount(user);
      if (account.stripe_customer_id) {
        const stripe = stripeClient();
        for await (const subscription of stripe.subscriptions.list({
          customer: account.stripe_customer_id,
          status: "all",
          limit: 100,
        })) {
          if (!["canceled", "incomplete_expired"].includes(subscription.status))
            await stripe.subscriptions.cancel(subscription.id);
        }
        await stripe.customers.del(account.stripe_customer_id);
      }
      const removed = await createSupabaseAdminClient().auth.admin.deleteUser(
        user.id,
      );
      if (removed.error) throw removed.error;
      await client.auth.signOut({ scope: "local" });
      await clearAccountCookies();
      return privateJson({ ok: true });
    }
    const email =
      typeof input!.email === "string" ? input!.email.trim().toLowerCase() : "";
    if (!validEmail(email))
      return privateJson({ error: "Enter a valid email address." }, 400);
    if (action === "resend") {
      const { error } = await client.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${accountOrigin()}/auth/confirm` },
      });
      if (error && error.code !== "user_already_exists")
        return privateJson(
          {
            error:
              "The confirmation email could not be sent. Please try again shortly.",
          },
          503,
        );
      return privateJson({
        ok: true,
        message:
          "If that email has an unconfirmed account, a new confirmation link will arrive shortly.",
      });
    }
    if (action === "recover") {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${accountOrigin()}/auth/confirm`,
      });
      if (error)
        return privateJson(
          {
            error:
              "The reset email could not be sent. Please try again shortly.",
          },
          503,
        );
      return privateJson({
        ok: true,
        message:
          "If an account uses that email, a password reset link will arrive shortly.",
      });
    }
    if (
      typeof input!.password !== "string" ||
      input!.password.length > 128 ||
      (action === "signup" && !validPassword(input!.password))
    )
      return privateJson(
        { error: "Use a password between 12 and 128 characters." },
        400,
      );
    if (action === "signup") {
      if (input!.adult !== true)
        return privateJson(
          { error: "An adult must create and manage the household account." },
          400,
        );
      const { error } = await client.auth.signUp({
        email,
        password: input!.password,
        options: {
          emailRedirectTo: `${accountOrigin()}/auth/confirm`,
          data: { adult_household: true },
        },
      });
      if (
        error &&
        !["user_already_exists", "email_exists"].includes(error.code ?? "")
      )
        return privateJson(
          {
            error:
              "We couldn’t create the account. Try another password or try again shortly.",
          },
          400,
        );
      return privateJson({
        ok: true,
        message:
          "Check your email to confirm your account. If you already have an account, sign in or reset your password.",
      });
    }
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: input!.password,
    });
    if (error || !data.user?.email_confirmed_at)
      return privateJson(
        {
          error:
            "Sign-in failed. Check your email, password and confirmation email.",
        },
        401,
      );
    await ensureAccount(data.user);
    return privateJson({ ok: true });
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
