import { test, expect, type Page } from "@playwright/test";
import {
  EMPTY_ACCOUNT,
  allowedThemeIds,
  type AccountView,
} from "../lib/accountModel";
import { programming } from "./programming-fixture";
import { readFileSync } from "node:fs";
const video = Buffer.from(
  readFileSync("tests/fixtures/test-video.webm.base64", "utf8"),
  "base64",
);
function account(member = false): AccountView {
  return {
    ...structuredClone(EMPTY_ACCOUNT),
    enabled: true,
    user: { id: "alice", email: "alice@example.test" },
    ownedThemeIds: allowedThemeIds([], member),
    member,
    profileLimit: member ? 10 : 5,
    revision: 1,
    household: {
      profiles: [
        {
          id: "main",
          name: "Alice",
          kids: false,
          avatar: "sun",
          theme: "christmas-96-living-room",
        },
      ],
      pin: null,
      library: { main: { favouriteChannels: [], watchlist: [] } },
      showMemberBadge: false,
    },
    commerce: {
      enabled: true,
      themePrice: "C$3.00",
      membershipPrice: "C$6.00",
    },
  }; // Synthetic test price; production price remains unset.
}
async function fixture(page: Page, initial: AccountView) {
  let state = structuredClone(initial);
  let conflict = false;
  const actions: Record<string, unknown>[] = [];
  await page.addInitScript(() => {
    localStorage.setItem("ttv-analytics-disabled-v1", "1");
    if (!localStorage.getItem("ttv-profiles-v1"))
      localStorage.setItem(
        "ttv-profiles-v1",
        JSON.stringify({
          profiles: [{ id: "main", name: "Guest", kids: false, avatar: "sun" }],
        }),
      );
  });
  await page.route("**/api/account", (route) => route.fulfill({ json: state }));
  await page.route("**/api/account/auth", async (route) => {
    const body = route.request().postDataJSON();
    actions.push(body);
    if (body.action === "signin" || body.action === "confirm")
      state = account();
    if (body.action === "signout" || body.action === "delete")
      state = { ...EMPTY_ACCOUNT, enabled: true };
    await route.fulfill({
      json: {
        ok: true,
        message:
          body.action === "signup"
            ? "Check your email to confirm your account."
            : "If an account uses that email, a link will arrive shortly.",
        ...(body.action === "confirm"
          ? {
              next:
                body.type === "recovery" ? "/account?mode=reset" : "/account",
            }
          : {}),
      },
    });
  });
  await page.route("**/api/account/household", async (route) => {
    const body = route.request().postDataJSON();
    if (conflict || body.revision !== state.revision)
      return route.fulfill({
        status: 409,
        json: {
          error:
            "Another device saved newer preferences. Reload them before saving again.",
        },
      });
    state = {
      ...state,
      household: body.household,
      revision: state.revision + 1,
    };
    return route.fulfill({ json: { revision: state.revision } });
  });
  await page.route("**/api/programming", (route) =>
    route.fulfill({ json: { ok: true, programming, source: "database" } }),
  );
  await page.route("**/api/engagement", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204 }));
  await page.route("https://www.gstatic.com/**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" }),
  );
  await page.route("**/qa-media.webm", (route) =>
    route.fulfill({ contentType: "video/webm", body: video }),
  );
  return {
    state: () => state,
    actions,
    conflict: () => {
      conflict = true;
    },
    setState: (value: AccountView) => {
      state = value;
    },
  };
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

test("free account registration, confirmation resend, recovery and sign-in remain straightforward", async ({
  page,
}, info) => {
  const f = await fixture(page, { ...EMPTY_ACCOUNT, enabled: true });
  await page.goto("/account");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByLabel("Email address", { exact: true })
    .fill("alice@example.test");
  await page
    .locator('input[name="password"]')
    .fill("a long memorable passphrase");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create free account", exact: true })
    .click();
  await expect(
    page.getByText("Check your email to confirm your account.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(f.actions[0]).toMatchObject({
    action: "signup",
    adult: true,
    email: "alice@example.test",
  });
  await page
    .getByRole("button", { name: "Resend confirmation email", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Resend confirmation email", exact: true })
    .click();
  expect(f.actions.at(-1)?.action).toBe("resend");
  await page
    .getByRole("button", { name: "Back to sign in", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Forgot password?", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Send reset email", exact: true })
    .click();
  await expect.poll(() => f.actions.at(-1)?.action).toBe("recover");
  await page
    .getByRole("button", { name: "Back to sign in", exact: true })
    .click();
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("account-signin.png"),
    fullPage: true,
  });
  await page
    .locator('input[name="password"]')
    .fill("a long memorable passphrase");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your TV. Your way." }),
  ).toBeVisible();
});

test("email links require a click, strip the token and route recovery to a new password", async ({
  page,
}) => {
  const f = await fixture(page, { ...EMPTY_ACCOUNT, enabled: true });
  const token = "synthetic-confirmation-token-for-testing";
  await page.addInitScript(() => {
    localStorage.setItem(
      "ttv-profiles-v1",
      JSON.stringify({
        profiles: [{ id: "kids", name: "Kids", kids: true, avatar: "sun" }],
        pin: { salt: "a".repeat(32), hash: "b".repeat(64) },
      }),
    );
    sessionStorage.setItem(
      "ttv-profile-session-v1",
      JSON.stringify({ id: "kids", pinHash: "b".repeat(64) }),
    );
  });
  await page.goto(`/auth/confirm?token_hash=${token}&type=recovery`);
  await expect(
    page.getByRole("button", { name: "Confirm email and continue" }),
  ).toBeEnabled();
  expect(page.url()).not.toContain(token);
  expect(f.actions).toHaveLength(0);
  await page
    .getByRole("button", { name: "Confirm email and continue" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Choose a new password." }),
  ).toBeVisible();
  expect(f.actions[0]).toMatchObject({
    action: "confirm",
    token,
    type: "recovery",
  });
  const kidsAccount = account();
  kidsAccount.household!.profiles.push({
    id: "kids",
    name: "Kids",
    kids: true,
    avatar: "sun",
  });
  kidsAccount.household!.pin = { salt: "a".repeat(32), hash: "b".repeat(64) };
  f.setState(kidsAccount);
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Ask a parent" }),
  ).toBeVisible();
  await page.goto("/account?mode=reset");
  await expect(
    page.getByRole("heading", { name: "Choose a new password." }),
  ).toBeVisible();
});

test("account theme saves survive refresh without replacing guest profiles", async ({
  page,
}) => {
  const f = await fixture(page, account());
  await page.goto("/");
  await page
    .getByRole("button", { name: "Watch as Alice", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open theme library", exact: true })
    .click();
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/account/household") &&
      response.request().method() === "PUT" &&
      response.ok(),
  );
  await page.locator('.theme-card[data-theme-id="shaw-2006"]').click();
  await saved;
  expect(f.state().household?.profiles[0]?.theme).toBe("shaw-2006");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-ttv-theme",
    "shaw-2006",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ttv-profiles-v1")!).profiles[0].name,
    ),
  ).toBe("Guest");
  await page.goto("/account");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Watch as Guest", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Watch as Alice", exact: true }),
  ).toHaveCount(0);
});

test("membership badge syncs, payment redirects cannot grant themes, and preference conflicts are visible", async ({
  page,
}, info) => {
  const f = await fixture(page, account(true));
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "You’re a member. Thank you." }),
  ).toBeVisible();
  await page.getByLabel("Show my member badge").check();
  await expect.poll(() => f.state().household?.showMemberBadge).toBe(true);
  await noOverflow(page);
  await page.screenshot({
    path: info.outputPath("account-membership.png"),
    fullPage: true,
  });
  f.conflict();
  await page.getByLabel("Show my member badge").uncheck();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Another device saved newer preferences",
  );
  await page
    .getByRole("button", { name: "Discard unsaved changes and reload" })
    .click();
  await expect(page.getByLabel("Show my member badge")).toBeChecked();
  f.setState(account());
  await page.goto("/account?checkout=success");
  await expect(
    page.getByText(/Your purchase appears here after payment verification/),
  ).toBeVisible();
  await expect(page.locator('[data-theme-buy="midas-gold"]')).toHaveText(
    "Buy · C$3.00",
  );
  await expect(
    page.getByRole("button", { name: "Join for C$6.00/month" }),
  ).toBeEnabled();
});

test("a preference outage does not prevent explicit sign-out without saving", async ({
  page,
}) => {
  const f = await fixture(page, account(true));
  f.conflict();
  await page.goto("/account");
  await page.getByLabel("Show my member badge").check();
  await page
    .getByRole("button", { name: "Sign out without saving", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Watch as Guest", exact: true }),
  ).toBeVisible();
  expect(f.actions.at(-1)?.action).toBe("signout");
});

test("expired membership keeps extra profiles and saves while requiring membership to use them", async ({
  page,
}) => {
  const state = account();
  state.household!.profiles.push(
    ...Array.from({ length: 9 }, (_, index) => ({
      id: `p-${index}`,
      name: `Person ${index + 1}`,
      kids: false,
      avatar: "sun" as const,
    })),
  );
  await fixture(page, state);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Watch as Person 9", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Watch as Person 3", exact: true }),
  ).toBeEnabled();
  await noOverflow(page);
});

test("@billing premium access comes from verified purchases, not local saved ownership", async ({
  page,
}) => {
  test.skip(
    process.env.NEXT_PUBLIC_THEME_BILLING_ENABLED !== "true",
    "Requires the billing-enabled build.",
  );
  const f = await fixture(page, account());
  await page.addInitScript(() =>
    localStorage.setItem(
      "retro-tv-programming-v1",
      JSON.stringify({
        version: 6,
        state: { ownedPremiumThemes: ["midas-gold"], themeId: "midas-gold" },
      }),
    ),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Watch as Alice", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open theme library", exact: true })
    .click();
  await page.locator('.theme-card[data-theme-id="midas-gold"]').click();
  await expect(page).toHaveURL(/\/account\?theme=midas-gold$/);
  await expect(page.locator('[data-theme-buy="midas-gold"]')).toHaveText(
    "Buy · C$3.00",
  );
  const state = f.state();
  state.ownedThemeIds.push("midas-gold");
  f.setState(state);
  await page.reload();
  await expect(page.locator('[data-theme-buy="midas-gold"]')).toHaveText(
    "Owned",
  );
  await page.getByRole("link", { name: "Watch TV", exact: true }).click();
  await page
    .getByRole("button", { name: "Open theme library", exact: true })
    .click();
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/account/household") &&
      response.request().method() === "PUT" &&
      response.ok(),
  );
  await page.locator('.theme-card[data-theme-id="midas-gold"]').click();
  await saved;
  expect(f.state().household?.profiles[0]?.theme).toBe("midas-gold");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-ttv-theme",
    "midas-gold",
  );
  state.ownedThemeIds = allowedThemeIds([], false);
  f.setState({ ...state, household: f.state().household });
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-ttv-theme",
    "midas-gold",
  );
  expect(f.state().household?.profiles[0]?.theme).toBe("midas-gold");
  await expect(
    page.getByRole("button", { name: "Open theme library", exact: true }),
  ).toBeVisible();
});
