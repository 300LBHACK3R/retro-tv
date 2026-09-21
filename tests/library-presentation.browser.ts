import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { programming } from "./programming-fixture";
import type { ProgrammingSnapshot } from "../lib/programmingSnapshot";
const video = Buffer.from(
  readFileSync("tests/fixtures/test-video.webm.base64", "utf8"),
  "base64",
);
async function fixture(page: Page, kids = false) {
  await page.addInitScript((isKids) => {
    const hash = isKids ? "0".repeat(64) : null;
    if (isKids)
      localStorage.setItem(
        "ttv-profiles-v1",
        JSON.stringify({ pin: { salt: "0".repeat(32), hash } }),
      );
    sessionStorage.setItem(
      "ttv-profile-session-v1",
      JSON.stringify({ id: isKids ? "kids" : "main", pinHash: hash }),
    );
  }, kids);
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
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
}
test("poster library keeps filters, restores focus, groups seasons and plays a selected episode", async ({
  page,
}, testInfo) => {
  await fixture(page);
  const source = {
    ...structuredClone(programming),
    libraryArtwork: {
      "show:studio-sessions": {
        poster: "/avatars/boyrobot.png",
        kidsApproved: true,
      },
    },
  };
  source.media.push({
    ...source.media[0]!,
    id: "qa-season-two",
    title: "Studio Sessions S02E01",
  });
  await page.route("**/api/programming", (route) =>
    route.fulfill({
      json: { ok: true, programming: source, source: "database" },
    }),
  );
  await page.goto("/library");
  const search = page.getByRole("searchbox", {
    name: "Search the Tate's TV library",
  });
  await expect(page.locator(".ttv-profile-switch .ttv-profile-avatar")).toBeVisible();
  await search.fill("Studio");
  const card = page.getByRole("button", {
    name: "Open Studio Sessions",
    exact: true,
  });
  await expect(card.locator("img")).toHaveAttribute(
    "src",
    /\/avatars\/boyrobot\.png$/,
  );
  await card.click();
  const dialog = page.getByRole("dialog", {
    name: "Studio Sessions",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await dialog.getByRole("combobox", { name: "Season" }).selectOption("2");
  await expect(dialog.getByRole("button", { name: /S02E01/ })).toBeVisible();
  await testInfo.attach("library-title", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
  await dialog.getByRole("button", { name: /S02E01/ }).click();
  await expect(dialog.locator("video")).toHaveAttribute(
    "src",
    /\/qa-media\.webm$/,
  );
  await dialog.getByRole("button", { name: "Close title ✕" }).click();
  await expect(card).toBeFocused();
  await expect(search).toHaveValue("Studio");
  await noOverflow(page);
});
test("Kids library blocks unapproved deep links, inherits reviewed channels and hides unreviewed artwork and announcements", async ({
  page,
}) => {
  await fixture(page, true);
  let source: ProgrammingSnapshot = structuredClone(programming);
  await page.route("**/api/programming", (route) =>
    route.fulfill({
      json: { ok: true, programming: source, source: "database" },
    }),
  );
  await page.goto("/library?watch=qa-movie");
  await expect(
    page.getByRole("heading", { name: "Your Kids library is being prepared" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open A Calgary Evening" }),
  ).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);
  source = {
    ...source,
    media: source.media.map((item) => ({
      ...item,
      kidsApproved: item.type === "show",
    })),
    channels: source.channels.map((channel) => ({
      ...channel,
      kidsApproved: channel.id === "24",
    })),
    libraryArtwork: {
      "show:studio-sessions": {
        poster: "/avatars/boyrobot.png",
        kidsApproved: false,
      },
    },
    upcomingTitles: [
      {
        id: "adult",
        title: "Adult announcement",
        description: "",
        poster: "/avatars/boyrobot.png",
        type: "movie",
        releaseLabel: "Soon",
        published: true,
        kidsApproved: false,
      },
    ],
  };
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Open Studio Sessions" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open Studio Sessions" }).locator("img"),
  ).toHaveCount(0);
  await expect(page.getByText("Adult announcement")).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "A Calgary Evening" }),
  ).toHaveCount(0);
  source.media = source.media.map((item) => ({ ...item, kidsApproved: false }));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your Kids library is being prepared" }),
  ).toBeVisible();
});
test("admin uploads shared artwork, reviews Kids access and publishes Coming Soon through station sync", async ({
  page,
}) => {
  await fixture(page);
  let saved: ProgrammingSnapshot = {
    ...structuredClone(programming),
    libraryArtwork: {},
    upcomingTitles: [],
  };
  await page.route("**/api/admin/session", (route) =>
    route.fulfill({ json: { ok: true, isAdmin: true } }),
  );
  await page.route("**/api/programming", (route) =>
    route.fulfill({
      json: { ok: true, programming: saved, source: "database" },
    }),
  );
  await page.route("**/api/admin/programming", async (route) => {
    saved = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, programming: saved } });
  });
  let uploaded = false;
  await page.route("**/api/admin/artwork/sign", (route) => {
    expect(route.request().postDataJSON().contentType).toMatch(
      /^image\/(webp|png|jpeg)$/,
    );
    return route.fulfill({
      json: {
        ok: true,
        uploadUrl: "https://storage.example/poster",
        publicUrl: "/avatars/boyrobot.png",
      },
    });
  });
  await page.route("https://storage.example/poster", (route) => {
    uploaded = route.request().method() === "PUT";
    return route.fulfill({ status: 200 });
  });
  await page.goto("/admin");
  await expect(page.getByText(/Global loaded/)).toBeVisible();
  await page
    .getByRole("button", { name: "Artwork & Coming Soon", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Choose title", exact: true })
    .selectOption("show:studio-sessions");
  await page
    .getByLabel("Upload poster", { exact: true })
    .setInputFiles("public/avatars/boyrobot.png");
  await expect(
    page.getByText("Poster ready. Save your artwork changes below."),
  ).toBeVisible();
  expect(uploaded).toBe(true);
  await page
    .getByRole("checkbox", { name: "I reviewed this poster for Kids profiles" })
    .check();
  await page
    .getByRole("button", { name: "Save title artwork", exact: true })
    .click();
  await expect
    .poll(() => saved.libraryArtwork?.["show:studio-sessions"]?.poster)
    .toBe("/avatars/boyrobot.png");
  await page.getByRole("checkbox", { name: "S01E01", exact: true }).check();
  await expect.poll(() => saved.media[0]?.kidsApproved).toBe(true);
  await page
    .getByRole("button", { name: "Add upcoming title", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Upcoming title", exact: true })
    .fill("Saturday Morning Rewind");
  const form = page.locator("form").filter({
    has: page.getByRole("textbox", { name: "Upcoming title", exact: true }),
  });
  await form
    .getByRole("textbox", { name: "Artwork URL", exact: true })
    .fill("/avatars/boyrobot.png");
  await form
    .getByRole("button", { name: "Use artwork URL", exact: true })
    .click();
  await form
    .getByRole("button", { name: "Save announcement", exact: true })
    .click();
  await expect.poll(() => saved.upcomingTitles?.length).toBe(1);
  expect(saved.upcomingTitles?.[0]?.published).toBe(false);
  await page
    .getByRole("button", { name: "Edit Saturday Morning Rewind", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Publish in Coming Soon", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Save announcement", exact: true })
    .click();
  await expect.poll(() => saved.upcomingTitles?.[0]?.published).toBe(true);
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Saturday Morning Rewind", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Coming soon to Tate’s TV",
      exact: true,
    }),
  ).toBeVisible();
});
