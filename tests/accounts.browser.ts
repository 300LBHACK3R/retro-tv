import { test, expect, type Page } from "@playwright/test";
import {
  EMPTY_ACCOUNT,
  allowedThemeIds,
  MEMBERSHIP_PLANS,
  type AccountView,
} from "../lib/accountModel";
import { programming } from "./programming-fixture";
import { THEMES } from "../lib/themes";
import { readFileSync } from "node:fs";
import { waitForHouseholdSave } from "./viewer-fixture";
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
      membershipPlans: MEMBERSHIP_PLANS.map(plan => ({ id: plan.id, price: `C$${(plan.amount / 100).toFixed(2)}` })),
    },
  };
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
  await page.route("**/api/account/show-requests?*", route => route.fulfill({ json: { requests: [], total: 0, page: 0 } }));
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

for (const path of ["/", "/library?title=qa-movie", "/tv"]) {
  test(`guests can watch at ${path} without restoring old device profiles`, async ({ page }) => {
    await fixture(page, { ...EMPTY_ACCOUNT, enabled: true });
    await page.addInitScript(() => {
      sessionStorage.setItem("ttv-profile-session-v1", JSON.stringify({ id: "main", pinHash: null }));
    });
    await page.goto(path);
    await expect(page.getByRole("link", { name: "Guest · Sign in to save", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who’s watching?" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Welcome back." })).toHaveCount(0);
    await noOverflow(page);
  });
}

test("an account outage still allows isolated guest viewing", async ({ page }) => {
  await fixture(page, { ...EMPTY_ACCOUNT, enabled: true });
  await page.route("**/api/account", route => route.fulfill({ status: 503, json: { error: "Account service unavailable" } }));
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Guest · Sign in to save", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who’s watching?" })).toHaveCount(0);
});

test("a locked household cannot open billing through the profile chooser", async ({ page }) => {
  const parent = account();
  parent.household!.pin = { salt: "a".repeat(32), hash: "b".repeat(64) };
  await fixture(page, parent);
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Ask a parent" })).toBeVisible();
  await expect(page.locator("[data-membership-plan]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete account", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "What would you love to watch?" })).toHaveCount(0);
});

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
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("link", { name: "Guest · Sign in to save", exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-ttv-theme", "shaw-2006");
  expect(await page.evaluate(() => sessionStorage.getItem("ttv-profile-session-v1"))).toBeNull();
  await expect(
    page.getByRole("button", { name: "Watch as Alice", exact: true }),
  ).toHaveCount(0);
});

test("saved account appearance follows the profile chooser and returning sign-in without restoring a session", async ({ page }, info) => {
  const f = await fixture(page, account());
  const root = page.locator("html");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Who’s watching?" })).toBeVisible();
  await expect(root).toHaveAttribute("data-ttv-theme", "christmas-96-living-room");
  await page.getByRole("button", { name: "Watch as Alice", exact: true }).click();
  await page.getByRole("button", { name: "Open theme library", exact: true }).click();
  await page.locator('.theme-card[data-theme-id="christmas-neon-noel"]').click();
  await waitForHouseholdSave(page);
  expect(f.state().household?.entranceTheme).toBe("christmas-neon-noel");
  await page.getByRole("button", { name: /^Switch profile:/ }).click();
  await expect(page.getByRole("heading", { name: "Who’s watching?" })).toBeVisible();
  await expect(root).toHaveAttribute("data-ttv-theme", "christmas-neon-noel");
  expect(await page.evaluate(() => sessionStorage.getItem("ttv-profile-session-v1"))).toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Who’s watching?" })).toBeVisible();
  await expect(root).toHaveAttribute("data-ttv-theme", "christmas-neon-noel");
  await page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("pageshow")); });
  await expect(root).toHaveAttribute("data-ttv-theme", "christmas-neon-noel");
  await page.locator(".ttv-noel-art").evaluate((image: HTMLImageElement) => image.decode());
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath("neon-noel-profile-entrance.png") });
  await page.getByRole("button", { name: "Watch as Alice", exact: true }).click();
  await waitForHouseholdSave(page);
  await page.goto("/account");
  await expect(root).toHaveAttribute("data-ttv-theme", "christmas-neon-noel");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name: "Guest · Sign in to save", exact: true })).toBeVisible();
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(root).toHaveAttribute("data-ttv-theme", "christmas-neon-noel");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(root).toHaveAttribute("data-ttv-theme", "christmas-neon-noel");
  expect(await page.evaluate(() => sessionStorage.getItem("ttv-profile-session-v1"))).toBeNull();
  await expect(page.getByRole("button", { name: "Watch as Alice", exact: true })).toHaveCount(0);
  await page.locator(".ttv-noel-art").evaluate((image: HTMLImageElement) => image.decode());
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath("neon-noel-signin.png") });
});

test("guest previews never replace the login appearance and verified account preferences win after sign-in", async ({ page }) => {
  await fixture(page, { ...EMPTY_ACCOUNT, enabled: true });
  await page.addInitScript(() => {
    if (!localStorage.getItem("ttv-login-theme-v1")) localStorage.setItem("ttv-login-theme-v1", "christmas-neon-noel");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open theme library", exact: true }).click();
  await page.locator('.theme-card[data-theme-id="christmas-96-living-room"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", "christmas-96-living-room");
  expect(await page.evaluate(() => localStorage.getItem("ttv-login-theme-v1"))).toBe("christmas-neon-noel");
  await page.goto("/account");
  await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", "christmas-neon-noel");
  await page.getByLabel("Email address", { exact: true }).fill("alice@example.test");
  await page.locator('input[name="password"]').fill("a long memorable passphrase");
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your TV. Your way." })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", "christmas-96-living-room");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Who’s watching?" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", "christmas-96-living-room");
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
    page.getByRole("button", { name: "Choose monthly · C$4.99", exact: true }),
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
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("link", { name: "Guest · Sign in to save", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Watch as Alice", exact: true })).toHaveCount(0);
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
  state.purchasedThemeIds.push("midas-gold");
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
  state.purchasedThemeIds = [];
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

test("theme access filters combine with styles, holidays and search while free access remains clear", async ({ page }) => {
  await fixture(page, account());
  await page.goto("/");
  await page.getByRole("button", { name: "Watch as Alice", exact: true }).click();
  await page.getByRole("button", { name: "Open theme library", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Theme Library", exact: true });
  const access = dialog.getByRole("group", { name: "Theme access", exact: true });
  const paidBuild = process.env.NEXT_PUBLIC_THEME_BILLING_ENABLED === "true";
  await access.getByRole("button", { name: "Free", exact: true }).click();
  await expect(dialog.locator(".theme-card")).toHaveCount(THEMES.filter(theme => !paidBuild || !theme.isPremium).length);
  await dialog.getByRole("group", { name: "Theme categories" }).getByRole("button", { name: "Seasonal", exact: true }).click();
  await dialog.getByRole("button", { name: "Christmas", exact: true }).click();
  await expect(dialog.locator(".theme-card")).toHaveCount(2);
  await expect(dialog.locator('[data-theme-id="christmas-96-living-room"]')).toBeVisible();
  await expect(dialog.locator('[data-theme-id="christmas-neon-noel"]')).toBeVisible();
  await dialog.getByRole("searchbox").fill("not-a-theme");
  await expect(dialog.locator(".theme-card")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Show all themes", exact: true }).click();
  await expect(access.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.locator(".theme-card")).toHaveCount(THEMES.length);
  await access.getByRole("button", { name: "Paid", exact: true }).click();
  await expect(dialog.locator(".theme-card")).toHaveCount(paidBuild ? THEMES.filter(theme => theme.isPremium).length : 0);
  if (!paidBuild) await expect(dialog.getByText("All themes are currently free.")).toBeVisible();
  await access.getByRole("button", { name: "Owned", exact: true }).click();
  await expect(dialog.getByText("No purchased themes yet.")).toBeVisible();
  await noOverflow(page);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test("@billing Owned keeps purchases distinct from membership and reflects refunds after refresh", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_THEME_BILLING_ENABLED !== "true", "Requires the billing-enabled build.");
  const state = account(true);
  state.purchasedThemeIds = ["midas-gold"];
  const f = await fixture(page, state);
  await page.goto("/");
  await page.getByRole("button", { name: "Watch as Alice", exact: true }).click();
  const open = async () => {
    await page.getByRole("button", { name: "Open theme library", exact: true }).click();
    return page.getByRole("dialog", { name: "Theme Library", exact: true });
  };
  let dialog = await open();
  await dialog.getByRole("group", { name: "Theme access" }).getByRole("button", { name: "Owned", exact: true }).click();
  await expect(dialog.locator(".theme-card")).toHaveCount(1);
  await expect(dialog.locator(".theme-card")).toHaveAttribute("data-theme-id", "midas-gold");
  await dialog.getByRole("group", { name: "Theme access" }).getByRole("button", { name: "Membership", exact: true }).click();
  await expect(dialog.locator(".theme-card")).toHaveCount(THEMES.filter(theme => theme.isPremium).length);
  await expect(dialog.locator('[data-theme-id="midas-gold"] .theme-card__status')).toHaveText("Owned");
  await expect(dialog.locator('[data-theme-id="obsidian-gold"] .theme-card__status')).toHaveText("Membership");
  await page.screenshot({ path: test.info().outputPath("theme-access-filters.png") });
  f.setState({ ...state, member: false, profileLimit: 5, ownedThemeIds: allowedThemeIds(["midas-gold"], false) });
  await page.reload();
  dialog = await open();
  await expect(dialog.getByRole("group", { name: "Theme access" }).getByRole("button", { name: "Membership", exact: true })).toHaveCount(0);
  await dialog.getByRole("group", { name: "Theme access" }).getByRole("button", { name: "Owned", exact: true }).click();
  await expect(dialog.locator(".theme-card")).toHaveCount(1);
  f.setState({ ...f.state(), purchasedThemeIds: [], ownedThemeIds: allowedThemeIds([], false) });
  await page.reload();
  dialog = await open();
  await dialog.getByRole("group", { name: "Theme access" }).getByRole("button", { name: "Owned", exact: true }).click();
  await expect(dialog.getByText("No purchased themes yet.")).toBeVisible();
});

test("membership plans show the upfront charge and send only the selected plan to checkout", async ({ page }) => {
  await fixture(page, account());
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/billing/checkout", route => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { error: "Test checkout unavailable" } });
  });
  await page.goto("/account");
  await expect(page.locator(".ttv-membership-plans article")).toHaveCount(3);
  for (const plan of MEMBERSHIP_PLANS) {
    const card = page.locator(`[data-membership-plan="${plan.id}"]`);
    await expect(card).toContainText(`Billed upfront ${plan.renewal}.`);
    const received = page.waitForResponse(response => response.url().endsWith("/api/billing/checkout"));
    await card.getByRole("button").click();
    await received;
    expect(requests.at(-1)).toMatchObject({ product: "membership", planId: plan.id });
    expect(requests.at(-1)).not.toHaveProperty("amount");
    await expect(page.locator("main").getByRole("alert")).toHaveText("Test checkout unavailable");
  }
  await expect(page.locator('[data-membership-plan="six-month"]')).toContainText("C$4.17/month");
  await expect(page.locator('[data-membership-plan="annual"]')).toContainText("C$3.75/month");
  await noOverflow(page);
});

test("paid members can request a show, recover from an error and see their saved status", async ({ page }) => {
  await fixture(page, account(true));
  let stored = false;
  let fail = true;
  await page.route("**/api/account/show-requests?*", route => route.fulfill({ json: {
    requests: stored ? [{ id: "request-1", title: "The Test Show", release_year: 1996, seasons: "Season 1", details: "The original version", status: "reviewing", member_reply: "We’re checking availability.", created_at: "2026-10-28T12:00:00Z", updated_at: "2026-10-28T12:00:00Z" }] : [], total: stored ? 1 : 0, page: 0,
  } }));
  await page.route("**/api/account/show-requests", async route => {
    expect(route.request().postDataJSON()).toEqual({ title: "The Test Show", releaseYear: "1996", seasons: "Season 1", details: "The original version" });
    if (fail) { fail = false; return route.fulfill({ status: 503, json: { error: "Please retry your request." } }); }
    const duplicate = stored;
    stored = true;
    await route.fulfill({ json: { ok: true, duplicate, id: "request-1" } });
  });
  await page.goto("/account#show-requests");
  const form = page.locator("#show-requests");
  await form.getByLabel("Show title").fill("The Test Show");
  await form.getByLabel("Release year (optional)").fill("1996");
  await form.getByLabel("Seasons or episodes (optional)").fill("Season 1");
  await form.getByLabel("Anything else? (optional)").fill("The original version");
  await form.getByRole("button", { name: "Send show request", exact: true }).click();
  await expect(form.getByRole("alert")).toHaveText("Please retry your request.");
  await expect(form.getByLabel("Show title")).toHaveValue("The Test Show");
  await form.getByRole("button", { name: "Send show request", exact: true }).click();
  await expect(form.getByRole("heading", { name: "The Test Show (1996)" })).toBeVisible();
  await expect(form.getByText("Under review", { exact: true })).toBeVisible();
  await expect(form.getByText("We’re checking availability.")).toBeVisible();
  await expect(form.getByLabel("Show title")).toHaveValue("");
  await noOverflow(page);
});

test("free accounts see the membership explanation without a show request form", async ({ page }) => {
  await fixture(page, account(false));
  await page.goto("/account#show-requests");
  await expect(page.getByText("A perk for paid members", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send show request", exact: true })).toHaveCount(0);
  await expect(page.locator("#show-requests").getByRole("link", { name: "View membership" })).toHaveAttribute("href", "#membership");
});
