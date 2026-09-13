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
}
async function chooseKids(page: Page) {
  await page
    .getByRole("button", { name: "Watch as Kids", exact: true })
    .click();
  await page.getByLabel("Parent PIN", { exact: true }).fill("4826");
  await page.getByLabel("Confirm PIN", { exact: true }).fill("4826");
  await page.getByRole("button", { name: "Save PIN & continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to your TV", exact: true }),
  ).toBeVisible();
}
test("profiles start on Channel 1, support names and avatars, and fit every configured viewport", async ({
  page,
}) => {
  const errors: string[] = [];
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
  await page.getByRole("button", { name: "moon avatar", exact: true }).click();
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
  await page.getByLabel("Parent PIN", { exact: true }).fill("1111");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("wasn't right");
  await expect(page.locator("video")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Who’s watching?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Watch as Main", exact: true })
    .click();
  await page.getByLabel("Parent PIN", { exact: true }).fill("4826");
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
  await page.getByLabel("Parent PIN", { exact: true }).fill("4826");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Change parent PIN", exact: true })
    .click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Watch as Main", exact: true })
    .click();
  await expect(page.getByLabel("Parent PIN", { exact: true })).toBeVisible();
  await page.getByLabel("Parent PIN", { exact: true }).fill("4826");
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
