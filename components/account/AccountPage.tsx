"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  accountRequest,
  announceAccountChange,
  useAccount,
} from "@/lib/accountStore";
import {
  flushAccountChanges,
  importDeviceProfiles,
  refreshAccount,
  retryAccountSave,
} from "@/lib/accountSync";
import { useProfiles } from "@/lib/deviceProfiles";
import { isThemeId, THEMES } from "@/lib/themes";
import { THEME_PREVIEWS } from "@/components/themes/themePreviews";
import TatesTvLogo from "@/components/themes/TatesTvLogo";
import { PROGRESS_STORAGE_KEY } from "@/lib/libraryCatalog";
import { EMPTY_ACCOUNT, MEMBERSHIP_PLANS, type MembershipPlanId } from "@/lib/accountModel";

type Mode = "signin" | "signup" | "recover" | "resend" | "reset" | "confirm";
function stripeRedirect(value: unknown) {
  if (typeof value !== "string")
    throw new Error("Checkout could not be opened.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)
  )
    throw new Error("Checkout returned an invalid address.");
  window.location.assign(url.href);
}
export default function AccountPage({
  confirmation = false,
}: {
  confirmation?: boolean;
}) {
  const account = useAccount();
  const kids = useProfiles(
    (state) =>
      state.profiles.find((profile) => profile.id === state.activeId)?.kids,
  );
  const [mode, setMode] = useState<Mode>(confirmation ? "confirm" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [adult, setAdult] = useState(false);
  const [token, setToken] = useState("");
  const [confirmationType, setConfirmationType] = useState("email");
  const [selectedTheme, setSelectedTheme] = useState("");
  const [checkout, setCheckout] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "reset") setMode("reset");
    setSelectedTheme(
      isThemeId(params.get("theme")) ? params.get("theme")! : "",
    );
    setCheckout(params.get("checkout") ?? "");
    if (confirmation) {
      setToken(params.get("token_hash") ?? "");
      setConfirmationType(params.get("type") ?? "email");
      // Keep confirmation secrets out of copied URLs, navigation and referrers.
      window.history.replaceState(null, "", "/auth/confirm");
    }
  }, [confirmation]);
  useEffect(() => {
    if (checkout !== "success") return;
    let attempts = 0;
    const timer = setInterval(() => {
      if (++attempts > 10) {
        clearInterval(timer);
        return;
      }
      void refreshAccount().catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [checkout]);
  async function task(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await task(async () => {
      const result = await accountRequest("/api/account/auth", {
        action: mode,
        email,
        password,
        adult,
        token,
        type: confirmationType,
      });
      setPassword("");
      if (mode === "signin" || mode === "confirm") {
        announceAccountChange();
        window.location.assign(
          result.next ??
            `/account${selectedTheme ? `?theme=${selectedTheme}` : ""}`,
        );
      } else if (mode === "reset") {
        announceAccountChange();
        await refreshAccount(true);
        setMode("signin");
        setMessage(result.message);
      } else setMessage(result.message);
    });
  }
  async function leaveAccount(remove = false, discardUnsaved = false) {
    await task(async () => {
      if (!discardUnsaved) await flushAccountChanges();
      if (!remove && !discardUnsaved && useAccount.getState().syncError)
        throw new Error(
          "Save or reload your pending profile changes before signing out.",
        );
      await accountRequest("/api/account/auth", {
        action: remove ? "delete" : "signout",
        password,
        confirmed: deleteConfirmed,
      });
      const owner = account.user?.id;
      try {
        for (let index = localStorage.length - 1; index >= 0; index--) {
          const key = localStorage.key(index);
          if (
            owner &&
            key?.startsWith(`${PROGRESS_STORAGE_KEY}:account:${owner}:`)
          )
            localStorage.removeItem(key);
        }
        sessionStorage.removeItem("ttv-profile-session-v1");
      } catch {
        /* Session credentials have already been cleared by the server. */
      }
      useAccount.setState({ ...EMPTY_ACCOUNT, ready: true, syncError: "" });
      announceAccountChange();
      // A full navigation discards all authenticated in-memory household state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    });
  }
  async function buy(product: "theme" | "membership", themeId?: string, planId?: MembershipPlanId) {
    await task(async () => {
      await flushAccountChanges();
      if (useAccount.getState().syncError)
        throw new Error(
          "Save or reload your pending profile changes before opening checkout.",
        );
      stripeRedirect(
        (
          await accountRequest("/api/billing/checkout", {
            product,
            themeId,
            planId,
            requestId: crypto.randomUUID(),
          })
        ).url,
      );
    });
  }
  const authForm = mode === "confirm" || mode === "reset" || !account.user;
  return (
    <main className="ttv-account-page">
      <header>
        <Link href="/" className="ttv-account-back">
          ← Back to free TV
        </Link>
        <Link href="/privacy">Privacy</Link>
      </header>
      <div className="ttv-account-brand">
        <TatesTvLogo width={240} height={160} sizes="240px" />
      </div>
      {kids && mode !== "confirm" && mode !== "reset" ? (
        <section className="ttv-account-card">
          <h1>Ask a parent</h1>
          <p>
            Account and purchase settings are for the adult who manages your
            household.
          </p>
          <Link href="/">Back to TV</Link>
        </section>
      ) : !account.ready ? (
        <section className="ttv-account-card">
          <h1>Your Tate’s TV account</h1>
          <p role="status">Loading your account…</p>
        </section>
      ) : (
        <>
          {error || account.error ? (
            <p role="alert" className="ttv-account-notice ttv-account-error">
              {error || account.error}
            </p>
          ) : null}
          {message ? (
            <p role="status" className="ttv-account-notice">
              {message}
            </p>
          ) : null}
          {account.syncError ? (
            <div role="alert" className="ttv-account-notice ttv-account-error">
              <p>{account.syncError}</p>
              <button
                disabled={busy}
                onClick={() => void task(retryAccountSave)}
              >
                Retry saving
              </button>
              <button
                disabled={busy}
                onClick={() => void task(() => refreshAccount(true))}
              >
                Discard unsaved changes and reload
              </button>
              <button
                disabled={busy}
                onClick={() => void leaveAccount(false, true)}
              >
                Sign out without saving
              </button>
            </div>
          ) : null}
          {authForm ? (
            <section className="ttv-account-card ttv-account-auth">
              <p className="ttv-account-eyebrow">Free account · Free TV</p>
              <h1>
                {mode === "signup"
                  ? "Make yourself at home."
                  : mode === "recover"
                    ? "Forgot your password?"
                    : mode === "resend"
                      ? "Need a new confirmation email?"
                      : mode === "reset"
                        ? "Choose a new password."
                        : mode === "confirm"
                          ? "One last step."
                          : "Welcome back."}
              </h1>
              <p>
                {mode === "confirm"
                  ? "Confirm this email link to continue securely."
                  : "Save your household profiles, favourite channels, watchlist and themes across devices."}
              </p>
              {!account.enabled ? (
                <p role="status">
                  Account registration is getting ready. You can keep watching
                  free TV.
                </p>
              ) : (
                <>
                  {mode === "signin" || mode === "signup" ? (
                    <div className="ttv-account-tabs">
                      <button
                        type="button"
                        aria-pressed={mode === "signin"}
                        onClick={() => {
                          setMode("signin");
                          setError("");
                        }}
                      >
                        Sign in
                      </button>
                      <button
                        type="button"
                        aria-pressed={mode === "signup"}
                        onClick={() => {
                          setMode("signup");
                          setError("");
                        }}
                      >
                        Create account
                      </button>
                    </div>
                  ) : null}
                  <form onSubmit={submit}>
                    {mode !== "reset" && mode !== "confirm" ? (
                      <label>
                        Email address
                        <input
                          name="email"
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          required
                          maxLength={254}
                        />
                      </label>
                    ) : null}
                    {mode !== "recover" &&
                    mode !== "resend" &&
                    mode !== "confirm" ? (
                      <label>
                        Password
                        <span className="ttv-account-password">
                          <input
                            name="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete={
                              mode === "signin"
                                ? "current-password"
                                : "new-password"
                            }
                            minLength={mode === "signin" ? 1 : 12}
                            maxLength={128}
                            value={password}
                            onChange={(event) =>
                              setPassword(event.target.value)
                            }
                            required
                          />
                          <button
                            type="button"
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? "Hide" : "Show"}
                          </button>
                        </span>
                        {mode !== "signin" ? (
                          <small>
                            At least 12 characters. A longer passphrase works
                            well.
                          </small>
                        ) : null}
                      </label>
                    ) : null}
                    {mode === "signup" ? (
                      <label className="ttv-account-check">
                        <input
                          type="checkbox"
                          checked={adult}
                          onChange={(event) => setAdult(event.target.checked)}
                          required
                        />
                        <span>
                          I’m an adult creating this household account. I agree
                          to the{" "}
                          <Link href="/terms">account and purchase terms</Link>{" "}
                          and have read the{" "}
                          <Link href="/privacy">privacy information</Link>.
                        </span>
                      </label>
                    ) : null}
                    <button
                      className="ttv-account-primary"
                      disabled={busy || (mode === "confirm" && !token)}
                    >
                      {busy
                        ? "Please wait…"
                        : mode === "signup"
                          ? "Create free account"
                          : mode === "recover"
                            ? "Send reset email"
                            : mode === "resend"
                              ? "Resend confirmation email"
                              : mode === "reset"
                                ? "Save new password"
                                : mode === "confirm"
                                  ? "Confirm email and continue"
                                  : "Sign in"}
                    </button>
                  </form>
                  {mode === "signin" || mode === "signup" ? (
                    <button
                      className="ttv-account-text"
                      onClick={() => {
                        setMode("resend");
                        setMessage("");
                      }}
                    >
                      Resend confirmation email
                    </button>
                  ) : null}
                  {mode === "signin" ? (
                    <button
                      className="ttv-account-text"
                      onClick={() => {
                        setMode("recover");
                        setMessage("");
                      }}
                    >
                      Forgot password?
                    </button>
                  ) : (
                    <button
                      className="ttv-account-text"
                      onClick={() => {
                        setMode("signin");
                        setMessage("");
                      }}
                    >
                      Back to sign in
                    </button>
                  )}
                </>
              )}
              <Link className="ttv-account-guest" href="/">
                Continue watching for free →
              </Link>
            </section>
          ) : (
            <div className="ttv-account-dashboard">
              <section className="ttv-account-card">
                <p className="ttv-account-eyebrow">Your account</p>
                <h1>Your TV. Your way.</h1>
                <p className="ttv-account-email">{account.user!.email}</p>
                <p>
                  {account.saving
                    ? "Saving your preferences…"
                    : "Profiles, favourites, watchlist and theme choices sync with your account."}
                </p>
                <div className="ttv-account-actions">
                  <Link href="/">Watch TV</Link>
                  <button disabled={busy} onClick={() => void leaveAccount()}>
                    Sign out
                  </button>
                </div>
                {!account.household ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void task(async () => {
                        await importDeviceProfiles();
                        if (useAccount.getState().syncError)
                          throw new Error(useAccount.getState().syncError);
                        setMessage("Your device profiles have been imported.");
                      })
                    }
                  >
                    Import this device’s existing profiles and saved items
                  </button>
                ) : null}
              </section>
              {checkout === "success" ? (
                <p className="ttv-account-notice" role="status">
                  Thanks for supporting Tate’s TV. Your purchase appears here
                  after payment verification.{" "}
                  <button onClick={() => void task(() => refreshAccount())}>
                    Refresh purchases
                  </button>
                </p>
              ) : checkout === "cancelled" ? (
                <p className="ttv-account-notice" role="status">
                  Checkout was cancelled. You can keep watching for free.
                </p>
              ) : null}
              <section className="ttv-account-card ttv-account-membership">
                <p className="ttv-account-eyebrow">Tate’s TV Membership</p>
                <h2>
                  {account.member
                    ? "You’re a member. Thank you."
                    : "A little extra for your TV."}
                </h2>
                <ul>
                  <li>
                    Every current and future premium theme while your membership
                    is active
                  </li>
                  <li>Up to 10 household profiles, instead of 5</li>
                  <li>An optional member badge beside your profile</li>
                </ul>
                <p>Live TV, the guide and the on-demand library stay free.</p>
                {account.member ? (
                  <label className="ttv-account-check">
                    <input
                      type="checkbox"
                      checked={account.showMemberBadge}
                      onChange={(event) =>
                        useAccount.setState({
                          showMemberBadge: event.target.checked,
                        })
                      }
                    />
                    Show my member badge
                  </label>
                ) : (
                  account.commerce.membershipPlans.length ? (
                    <div className="ttv-membership-plans" aria-label="Membership plans">
                      {account.commerce.membershipPlans.map(({ id, price }) => {
                        const plan = MEMBERSHIP_PLANS.find(option => option.id === id)!;
                        const savings = MEMBERSHIP_PLANS[0].amount * plan.months - plan.amount;
                        return <article key={id} data-membership-plan={id}>
                          <h3>{plan.label}</h3>
                          <p className="ttv-membership-total">{price}</p>
                          <p>Billed upfront {plan.renewal}.</p>
                          {plan.months > 1 ? <small>About C${(plan.amount / plan.months / 100).toFixed(2)}/month · save C${(savings / 100).toFixed(2)} compared with monthly billing.</small> : <small>Pay one month at a time.</small>}
                          <button className="ttv-account-primary" disabled={busy || !account.commerce.enabled}
                            onClick={() => void buy("membership", undefined, id)}>
                            Choose {plan.label.toLowerCase()} · {price}
                          </button>
                        </article>;
                      })}
                    </div>
                  ) : <button disabled>Membership opens soon</button>
                )}
                <p>
                  <small>
                    Prices are in CAD, plus any applicable tax. Each plan renews automatically at its selected interval. Cancel future renewals through
                    Manage billing. Individually purchased themes stay yours
                    when membership ends.
                  </small>
                </p>
                <button
                  disabled={busy}
                  onClick={() =>
                    void task(async () =>
                      stripeRedirect(
                        (await accountRequest("/api/billing/portal", {})).url,
                      ),
                    )
                  }
                >
                  Manage billing
                </button>
              </section>
              <section className="ttv-account-card">
                <h2>Just want a theme?</h2>
                <p>
                  Buy it once for your account. No membership required.{" "}
                  {account.commerce.themePrice} each, plus any applicable tax.
                </p>
                <div className="ttv-account-themes">
                  {THEMES.filter((theme) => theme.isPremium).map((theme) => (
                    <article
                      key={theme.id}
                      className={
                        selectedTheme === theme.id ? "is-selected" : ""
                      }
                    >
                      <div className="ttv-account-theme-art">
                        <Image
                          src={THEME_PREVIEWS[theme.id].image}
                          alt=""
                          fill
                          sizes="(max-width: 600px) 90vw, 280px"
                        />
                      </div>
                      <h3>{theme.name}</h3>
                      <button
                        data-theme-buy={theme.id}
                        disabled={
                          busy ||
                          account.ownedThemeIds.includes(theme.id) ||
                          !account.commerce.enabled
                        }
                        onClick={() => void buy("theme", theme.id)}
                      >
                        {account.purchasedThemeIds.includes(theme.id)
                          ? "Owned"
                          : account.member
                            ? "Included with membership"
                          : `Buy · ${account.commerce.themePrice}`}
                      </button>
                    </article>
                  ))}
                </div>
              </section>
              <section className="ttv-account-card">
                <h2>Account settings</h2>
                <button
                  disabled={busy}
                  onClick={() =>
                    void task(async () => {
                      const result = await accountRequest("/api/account/auth", {
                        action: "recover",
                        email: account.user!.email,
                      });
                      setMessage(result.message);
                    })
                  }
                >
                  Send password reset email
                </button>
                <button
                  className="ttv-account-text"
                  onClick={() => {
                    setDeleting(!deleting);
                    setPassword("");
                  }}
                >
                  Delete account
                </button>
                {deleting ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void leaveAccount(true);
                    }}
                  >
                    <p>
                      Deleting your account removes its synced profiles and
                      purchases and cancels its membership. This does not
                      automatically refund previous payments. Device-only guest
                      profiles stay on this browser.
                    </p>
                    <label>
                      Confirm your password
                      <input
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                    </label>
                    <label className="ttv-account-check">
                      <input
                        type="checkbox"
                        required
                        checked={deleteConfirmed}
                        onChange={(event) =>
                          setDeleteConfirmed(event.target.checked)
                        }
                      />
                      I understand this permanently deletes my account.
                    </label>
                    <button disabled={busy} className="ttv-account-danger">
                      Permanently delete account
                    </button>
                  </form>
                ) : null}
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}
