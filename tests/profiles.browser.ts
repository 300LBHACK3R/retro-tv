import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { programming } from "./programming-fixture";
const video = Buffer.from(
  readFileSync("tests/fixtures/test-video.webm.base64", "utf8"),
  "base64",
);
const fixture = {
  ...programming,
  media: programming.media.map((item) => ({
    ...item,
    kidsApproved: item.id !== "qa-movie",
  })),
  channels: [
    {
      ...programming.channels[0]!,
      id: "1",
      number: 1,
      name: "Welcome TV",
      branding: {
        ...programming.channels[0]!.branding,
        displayName: "Welcome TV",
      },
      kidsApproved: false,
    },
    {
      ...programming.channels[0]!,
      kidsApproved: true,
      category: "Kids & Family",
    },
    { ...programming.channels[1]!, kidsApproved: false, category: "Movies" },
  ],
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/programming", (route) =>
    route.fulfill({
      json: { ok: true, programming: fixture, source: "database" },
    }),
  );
  await page.route("https://www.gstatic.com/**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" }),
  );
  await page.route("**/api/engagement", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204 }));
  await page.route("**/qa-media.webm", (route) =>
    route.fulfill({ body: video, contentType: "video/webm" }),
  );
});
async function switchProfile(page: Page) {
  await page.getByRole("button", { name: /^Switch profile:/ }).click();
  await expect(
    page.getByRole("heading", { name: "Who’s watching?" }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.locator(".ttv-profile-screen")).toHaveCSS(
    "display",
    "flex",
  );
  await expect(page.locator(".ttv-profile-grid")).toHaveCSS("display", "flex");
  const avatar = page.locator(".ttv-profile-card [data-avatar]").first();
  await expect(avatar).toHaveCSS("display", "grid");
  await expect(avatar.locator("img")).toBeVisible();
  await expect.poll(() => avatar.locator("img").evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  const avatarBounds = await avatar.boundingBox();
  expect(avatarBounds!.width).toBeGreaterThanOrEqual(64);
  expect(avatarBounds!.width).toBeLessThanOrEqual(180);
  await expect(
    page.getByRole("region", { name: "Install Tate's TV", exact: true }),
  ).toHaveCount(0);
}

for (const storageFailure of ["quota", "blocked"] as const) {
  test(`viewing starts when browser storage is ${storageFailure}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript((failure) => {
      if (failure === "blocked") {
        for (const key of ["localStorage", "sessionStorage"]) Object.defineProperty(window, key, {
          configurable: true, get() { throw new DOMException("Unavailable", "SecurityError"); },
        });
      } else {
        Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
      }
    }, storageFailure);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Who’s watching?" })).toBeVisible();
    await page.getByRole("button", { name: "Watch as Main", exact: true }).click();
    const current = page.getByRole("region", { name: "Current Tate's TV channel", exact: true });
    await expect(current.getByRole("heading", { name: "Welcome TV", exact: true })).toBeVisible();
    await switchProfile(page);
    expect(errors).toEqual([]);
  });
}
function parentPinInput(page: Page) {
  // The PIN screen's landmarks share the input's name; target the labelled
  // input so this also works when Show PIN changes its type to text.
  return page
    .locator("input")
    .and(page.getByLabel("Parent PIN", { exact: true }));
}
async function chooseKids(page: Page) {
  await page
    .getByRole("button", { name: "Watch as Kids", exact: true })
    .click();
  await parentPinInput(page).fill("4826");
  await page.getByLabel("Confirm PIN", { exact: true }).fill("4826");
  const pinBounds = await parentPinInput(page).boundingBox();
  const continueBounds = await page
    .getByRole("button", { name: "Save PIN & continue" })
    .boundingBox();
  expect(pinBounds!.height).toBeGreaterThanOrEqual(44);
  expect(continueBounds!.height).toBeGreaterThanOrEqual(44);
  await page.getByRole("button", { name: "Save PIN & continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to your TV", exact: true }),
  ).toBeVisible();
}
test("profiles start on Channel 1, support names and avatars, and fit every configured viewport", async ({
  page,
}) => {
  const errors: string[] = [];
  let documentLoads = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame())
      documentLoads += 1;
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Who’s watching?" }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Watch as Main", exact: true })
    .click();
  const current = page.getByRole("region", {
    name: "Current Tate's TV channel",
    exact: true,
  });
  await expect(
    current.getByRole("heading", { name: "Welcome TV", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Browse all", exact: true }).click();
  const directory = page.getByRole("dialog", {
    name: "Channel directory",
    exact: true,
  });
  await directory
    .getByLabel("Browse category", { exact: true })
    .selectOption("Movies");
  await directory.getByRole("searchbox", { name: "Find a channel" }).fill("25");
  await directory
    .getByRole("button", { name: "Tune to CH 25 Local Cinema", exact: true })
    .click();
  await expect(
    current.getByRole("heading", { name: "Local Cinema", exact: true }),
  ).toBeVisible();
  // Cache migration finishes without a second navigation on a fresh device.
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("ttv-cache-schema-version")),
    )
    .toBe("20260909-premium-viewer-v3");
  expect(documentLoads).toBe(1);
  await page.reload();
  await expect(
    current.getByRole("heading", { name: "Welcome TV", exact: true }),
  ).toBeVisible();
  await switchProfile(page);
  await page
    .getByRole("button", { name: "Manage profiles", exact: true })
    .click();
  await page.getByRole("button", { name: /Add profile/ }).click();
  const name = page.getByLabel("Profile name", { exact: true });
  await name.pressSequentially("Alex");
  await expect(name).toHaveValue("Alex");
  await expect(name).toBeFocused();
  await page.getByRole("button", { name: "Space explorer avatar", exact: true }).click();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Watch as Alex", exact: true })
    .click();
  await expect(
    current.getByRole("heading", { name: "Welcome TV", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("Kids blocks unapproved deep links, directory and library titles, and requires the PIN to leave", async ({
  page,
}) => {
  await page.goto("/?ch=25");
  await chooseKids(page);
  await expect(page.locator("video")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Browse Kids channels", exact: true })
    .click();
  const directory = page.getByRole("dialog", {
    name: "Channel directory",
    exact: true,
  });
  await expect(
    directory.getByRole("button", { name: /Local Cinema/ }),
  ).toHaveCount(0);
  await directory
    .getByRole("button", { name: "Tune to CH 24 Studio TV", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Current Tate's TV channel", exact: true })
      .getByRole("heading", { name: "Studio TV", exact: true }),
  ).toBeVisible();
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Your time. Your TV.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("A Calgary Evening", { exact: true }),
  ).toHaveCount(0);
  await switchProfile(page);
  await page
    .getByRole("button", { name: "Watch as Main", exact: true })
    .click();
  await parentPinInput(page).fill("1111");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "wasn't right",
  );
  await expect(page.locator("video")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Who’s watching?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Watch as Main", exact: true })
    .click();
  await parentPinInput(page).fill("4826");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your time. Your TV.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("A Calgary Evening", { exact: true }).first(),
  ).toBeVisible();
});
test("profile switching isolates watchlists and cancelling a PIN change preserves the existing lock", async ({
  page,
}) => {
  await page.goto("/");
  await chooseKids(page);
  await page.goto("/library");
  const save = page
    .getByRole("button", { name: /Save Studio Sessions/ })
    .first();
  await save.click();
  await switchProfile(page);
  await page
    .getByRole("button", { name: "Manage profiles", exact: true })
    .click();
  await parentPinInput(page).fill("4826");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Change parent PIN", exact: true })
    .click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Watch as Main", exact: true })
    .click();
  await expect(parentPinInput(page)).toBeVisible();
  await parentPinInput(page).fill("4826");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(save).toBeVisible();
  await switchProfile(page);
  await page
    .getByRole("button", { name: "Watch as Kids", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Remove Studio Sessions/ }).first(),
  ).toBeVisible();
});

test("the chooser adds profiles directly, restores focus, and makes deletion reversible until confirmed", async ({
  page,
}) => {
  await page.goto("/");
  const add = page.getByRole("button", { name: "Add profile", exact: true });
  await add.click();
  await page.getByLabel("Profile name", { exact: true }).fill("Unfinished");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(add).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Watch as Unfinished", exact: true }),
  ).toHaveCount(0);
  await add.click();
  await page.getByLabel("Profile name", { exact: true }).fill("   ");
  await expect(
    page.getByRole("button", { name: "Save profile", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Profile name", { exact: true }).fill("Morgan");
  await page.getByRole("button", { name: "Robot avatar", exact: true }).click();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Watch as Morgan", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Manage profiles", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit Morgan", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Robot avatar", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Delete profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Delete profile", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Edit Morgan", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Edit Morgan", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete profile", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Yes, delete profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Watch as Morgan", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);
});

test("PIN setup can be corrected or cancelled and the direct Add shortcut cannot bypass the parent lock", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Watch as Kids", exact: true })
    .click();
  const pin = parentPinInput(page);
  const confirmation = page.getByLabel("Confirm PIN", { exact: true });
  await pin.fill("4826");
  await confirmation.fill("4827");
  await page
    .getByRole("button", { name: "Save PIN & continue", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "don't match",
  );
  await expect(confirmation).toBeFocused();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Watch as Kids", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("ttv-profiles-v1")!).pin,
    ),
  ).toBeNull();
  await chooseKids(page);
  await switchProfile(page);
  const add = page.getByRole("button", { name: "Add profile", exact: true });
  await add.click();
  await expect(page.getByLabel("Profile name", { exact: true })).toHaveCount(0);
  await pin.fill("1111");
  await page.getByRole("button", { name: "Show PIN", exact: true }).click();
  await expect(pin).toHaveAttribute("type", "text");
  await expect(pin).toHaveValue("1111");
  await page.getByRole("button", { name: "Hide PIN", exact: true }).click();
  await expect(pin).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "wasn't right",
  );
  await expect(pin).toBeFocused();
  await expect(page.locator("video")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(add).toBeFocused();
  await add.click();
  await pin.fill("4826");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Profile name", { exact: true }).fill("Taylor");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Watch as Taylor", exact: true })
    .click();
  await expect(pin).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
});

test("five profiles and the editor fit a narrow phone and remain reachable with large text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.addInitScript(() => {
    localStorage.setItem(
      "ttv-profiles-v1",
      JSON.stringify({
        profiles: [
          {
            id: "main",
            name: "A long household name",
            avatar: "sun",
            kids: false,
          },
          { id: "kids", name: "Kids", avatar: "star", kids: true },
          { id: "one", name: "Morgan", avatar: "moon", kids: false },
          { id: "two", name: "Taylor", avatar: "bolt", kids: false },
          { id: "three", name: "Alex", avatar: "flower", kids: false },
        ],
      }),
    );
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Watch as / })).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "Add profile", exact: true }),
  ).toHaveCount(0);
  await page.addStyleTag({ content: "html { font-size: 24px !important; }" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Manage profiles", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit Taylor", exact: true }).click();
  await page.getByLabel("Profile name", { exact: true }).fill("Taylor updated");
  const avatarOptions = page.locator(".ttv-avatar-options");
  await expect(avatarOptions.getByRole("button")).toHaveCount(8);
  await expect(avatarOptions).toHaveCSS("display", "grid");
  const newAvatar = avatarOptions.getByRole("button", { name: "Jesus for Kids avatar", exact: true });
  await newAvatar.click();
  await expect(newAvatar).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => newAvatar.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole("checkbox", { name: /Kids profile/ })).not.toBeChecked();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Taylor updated", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("button", { name: "Edit Taylor updated", exact: true }).locator("[data-avatar]")).toHaveAttribute("data-avatar", "kidsjesus");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("After Dark entrance fills the viewport, remembers accessibility and resets temporary themes", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("ttv-profiles-v1")) return;
    // A returning household from before the seasonal release.
    localStorage.setItem("ttv-profiles-v1", JSON.stringify({ profiles: [
      { id: "main", name: "Main", kids: false, avatar: "sun", theme: "obsidian-gold" },
      { id: "kids", name: "Kids", kids: true, avatar: "star", theme: "shaw-2006" },
    ] }));
    localStorage.setItem("retro-tv-programming-v1", JSON.stringify({ version: 6, state: { themeId: "obsidian-gold" } }));
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Who’s watching?" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", "halloween-night");
  const scene = page.locator(".ttv-afterdark-world");
  await expect(scene).toBeVisible();
  await expect(scene).toHaveCSS("position", "fixed");
  await expect(scene).toHaveCSS("pointer-events", "none");
  await expect(scene).toHaveAttribute("aria-hidden", "true");
  const backdrop = scene.locator(".ttv-afterdark-art");
  await expect.poll(() => backdrop.evaluate((item: HTMLImageElement) => item.complete && item.naturalWidth > 0)).toBe(true);
  const bounds = await scene.boundingBox();
  const viewport = await page.evaluate(() => ({ width: document.documentElement.clientWidth, height: innerHeight }));
  expect(bounds!.x).toBe(0);
  expect(bounds!.y).toBe(0);
  expect(Math.abs(bounds!.width - viewport.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(bounds!.height - viewport.height)).toBeLessThanOrEqual(1);
  expect(await page.locator(".ttv-profile-screen").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  const witch = scene.locator(".ttv-afterdark-witch");
  await expect(witch).toHaveCSS("animation-name", "ttv-afterdark-flight");
  await page.locator(".ttv-profile-footer").scrollIntoViewIfNeeded();
  expect((await scene.boundingBox())!.y).toBe(0);
  await expect(scene.getByRole("button")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(witch).toHaveCSS("animation-name", "none");
  await page.reload();
  await expect(witch).toHaveCSS("animation-name", "none");
  await expect(scene.getByRole("button")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(witch).toHaveCSS("animation-name", "ttv-afterdark-flight");
  const portraits = page.locator(".ttv-profile-grid .ttv-profile-portrait");
  await expect(portraits).toHaveCount(2);
  await expect.poll(() => portraits.evaluateAll((items: HTMLImageElement[]) => items.every((item) => item.complete && item.naturalWidth > 0))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await testInfo.attach("after-dark-profile-entrance", { body: await page.screenshot(), contentType: "image/png" });
  await page.getByRole("button", { name: "Watch as Main", exact: true }).click();
  await page.goto("/library");
  await page.getByRole("button", { name: "Open theme library", exact: true }).click();
  await page.locator('.theme-card[data-theme-id="obsidian-gold"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", "obsidian-gold");
  await expect(scene).toHaveCount(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", "halloween-night");
  const savedProfiles = await page.evaluate(() => JSON.parse(localStorage.getItem("ttv-profiles-v1")!).profiles);
  expect(savedProfiles.every((profile: Record<string, unknown>) => !("theme" in profile))).toBe(true);
  await page.getByRole("button", { name: "Open theme library", exact: true }).click();
  await page.locator('.theme-card[data-theme-id="obsidian-gold"]').click();
  await switchProfile(page);
  await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", "halloween-night");
  await expect(scene).toBeVisible();
  await page.getByRole("button", { name: "Watch as Main", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", "halloween-night");
});
