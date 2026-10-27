import { test as base, expect, type Page } from "@playwright/test";
import { EMPTY_ACCOUNT, allowedThemeIds, sanitizeHousehold, type AccountView } from "../lib/accountModel";
import { defaults } from "../lib/profiles";
export { expect, type Page } from "@playwright/test";

export async function waitForHouseholdSave(page: Page) {
  // The app blocks navigation while a household write is dirty. Wait for that
  // real guard to clear instead of reloading during its debounce window.
  await expect.poll(() => page.evaluate(() =>
    window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
  )).toBe(true);
}

// Viewer suites exercise an authenticated free household. Auth entry and
// sign-out cases use their own explicit signed-out fixtures in accounts.browser.
export const test = base.extend<{ householdSession: void }>({
  householdSession: [async ({ context }, use) => {
    let state: AccountView | null = null;
    await context.route("**/api/account", async route => {
      if (!state) {
        const device = await route.request().frame().evaluate(() => {
          try { return JSON.parse(localStorage.getItem("ttv-profiles-v1") || "null"); }
          catch { return null; }
        });
        state = {
          ...structuredClone(EMPTY_ACCOUNT), enabled: true,
          user: { id: "qa-parent", email: "parent@example.test" },
          ownedThemeIds: allowedThemeIds([], false),
          household: sanitizeHousehold({ profiles: defaults, ...device }),
        };
      }
      await route.fulfill({ json: state });
    });
    await context.route("**/api/account/household", async route => {
      const input = route.request().postDataJSON();
      if (!state || input.revision !== state.revision)
        return route.fulfill({ status: 409, json: { error: "Preference conflict" } });
      state = { ...state, household: input.household, revision: state.revision + 1 };
      await route.fulfill({ json: { revision: state.revision } });
    });
    await use();
  }, { auto: true }],
});
