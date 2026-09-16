import { test, expect } from "@playwright/test";
import { defaultChannels } from "../lib/store";
import { programming } from "./programming-fixture";
import type { ProgrammingSnapshot } from "../lib/programmingSnapshot";

test("admin reorders, saves and programmes separate Halloween channels", async ({ page }) => {
  let saved: ProgrammingSnapshot = {
    ...structuredClone(programming),
    channels: structuredClone(defaultChannels).map(channel => ({
      ...channel, mediaIds: channel.id === "3" ? [programming.media[0]!.id] : [], programmeBlocks: [],
    })),
    currentChannelId: "3",
  };
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/admin/session", route => route.fulfill({ json: { ok: true, isAdmin: true } }));
  await page.route("**/api/programming", route => route.fulfill({ json: { ok: true, programming: saved, source: "database" } }));
  await page.route("**/api/admin/programming", async route => {
    expect(route.request().method()).toBe("PUT");
    saved = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, programming: saved } });
  });
  await page.route("**/_vercel/**", route => route.fulfill({ status: 204 }));
  await page.goto("/admin");
  await expect(page.getByText(/Global loaded/)).toBeVisible();
  await page.getByRole("button", { name: "Channel Lineup", exact: true }).click();
  await expect(page.getByRole("list", { name: "Station channel order" })).toHaveCSS("display", "grid");
  const rowThree = page.locator('.ttv-lineup-list > [data-channel-id="3"]');
  const rowFour = page.locator('.ttv-lineup-list > [data-channel-id="4"]');
  await rowThree.getByRole("button", { name: /^Move .* down$/ }).click();
  await expect(rowThree.locator(".ttv-lineup-number")).toHaveText("CH 4");
  await expect(rowFour.locator(".ttv-lineup-number")).toHaveText("CH 3");
  await expect.poll(() => saved.channels.find(channel => channel.id === "3")?.number).toBe(4);
  await page.reload();
  await expect(page.getByText(/Global loaded/)).toBeVisible();
  await page.getByRole("button", { name: "Channel Lineup", exact: true }).click();
  await expect(rowThree.locator(".ttv-lineup-number")).toHaveText("CH 4");

  await page.getByRole("button", { name: "Add Halloween channels", exact: true }).click();
  const horror = page.locator('[data-channel-id="seasonal-friday-night-horror"]');
  const kids = page.locator('[data-channel-id="seasonal-halloween-kids"]');
  await expect(horror.getByRole("checkbox", { name: "Adults only", exact: true })).toBeChecked();
  await expect(horror.getByRole("checkbox", { name: "On air", exact: true })).toBeDisabled();
  await expect(kids.getByRole("checkbox", { name: "On air", exact: true })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Halloween channels added", exact: true })).toBeDisabled();

  await kids.getByRole("button", { name: "Add shows to Halloween Kids", exact: true }).click();
  const picker = page.getByRole("group", { name: "Add programmes to Halloween Kids", exact: true });
  await picker.getByRole("searchbox", { name: "Find a show or movie" }).fill("Studio Sessions S01E01");
  await picker.getByRole("checkbox", { name: /Studio Sessions S01E01/ }).check();
  await picker.getByRole("button", { name: "Add selected (1)", exact: true }).click();
  await kids.getByRole("checkbox", { name: "On air", exact: true }).check();
  await kids.getByRole("combobox", { name: "Move Halloween Kids to channel", exact: true }).selectOption("2");
  await expect(kids.locator(".ttv-lineup-number")).toHaveText("CH 2");
  await expect.poll(() => saved.channels.find(channel => channel.id === "seasonal-halloween-kids")?.number).toBe(2);
  expect(saved.channels.find(channel => channel.id === "3")?.mediaIds).toContain("qa-show-a");
  expect(saved.channels.find(channel => channel.id === "seasonal-halloween-kids")).toMatchObject({ isEnabled: true, kidsApproved: false, mediaIds: ["qa-show-a"] });
  expect(saved.channels.find(channel => channel.id === "seasonal-friday-night-horror")).toMatchObject({ adultOnly: true, kidsApproved: false, isEnabled: false });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});
