import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { programming } from "./programming-fixture";
import type { ProgrammingSnapshot } from "../lib/programmingSnapshot";

const video = Buffer.from(readFileSync("tests/fixtures/test-video.webm.base64", "utf8"), "base64");
async function fixture(page: Page) {
  let saved: ProgrammingSnapshot = structuredClone(programming);
  saved.media.push({ id: "sponsor", title: "Local sponsor", type: "commercial", duration: 30, file: "/qa-media.webm", adChannelIds: [], adPlacements: ["filler"], allowCommercialSlicing: false });
  await page.route("**/api/admin/session", route => route.fulfill({ json: { ok: true, isAdmin: true } }));
  await page.route("**/api/programming", route => route.fulfill({ json: { ok: true, programming: saved, source: "database" } }));
  await page.route("**/api/admin/programming", async route => {
    saved = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, programming: saved } });
  });
  await page.route("**/qa-media.webm", route => route.fulfill({ contentType: "video/webm", body: video }));
  await page.route("**/api/engagement", route => route.fulfill({ json: { ok: true } }));
  await page.route("**/_vercel/**", route => route.fulfill({ status: 204 }));
  await page.route("https://www.gstatic.com/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.goto("/admin");
  await expect(page.getByText(/Global loaded/)).toBeVisible();
  await page.getByRole("button", { name: "Commercials", exact: true }).click();
  return () => saved;
}

test("commercial campaign saves, configures breaks, previews and pauses without changing other channels", async ({ page }, testInfo) => {
  const saved = await fixture(page);
  const workspace = page.getByRole("region", { name: "Commercials workspace", exact: true });
  await workspace.getByRole("checkbox", { name: /CH 24/ }).check();
  await workspace.getByLabel("Advertiser", { exact: true }).fill("Local business");
  await workspace.getByRole("button", { name: "Save campaign", exact: true }).click();
  await expect.poll(() => saved().media.find(item => item.id === "sponsor")?.adChannelIds).toEqual(["24"]);
  expect(saved().media.find(item => item.id === "sponsor")?.kidsApproved).not.toBe(true);
  await workspace.getByRole("combobox", { name: "Commercial channel", exact: true }).selectOption("24");
  await workspace.getByRole("button", { name: "Apply end breaks & enable targeted ads", exact: true }).click();
  await expect.poll(() => saved().media[0]?.slotLengthSeconds).toBe(120);
  expect(saved().media[2]?.slotLengthSeconds).toBeUndefined();
  await workspace.getByRole("button", { name: "Generate schedule preview", exact: true }).click();
  await expect(workspace.locator('[data-commercial="true"]')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await testInfo.attach("commercials-workspace", { body: await page.screenshot({ path: testInfo.outputPath("commercials.png"), fullPage: true }), contentType: "image/png" });
  await page.reload();
  await expect(page.getByText(/Global loaded/)).toBeVisible();
  await page.getByRole("button", { name: "Commercials", exact: true }).click();
  await expect(workspace.getByLabel("Advertiser", { exact: true })).toHaveValue("Local business");
  await workspace.getByRole("checkbox", { name: /CH 24/ }).uncheck();
  await workspace.getByRole("button", { name: "Save campaign", exact: true }).click();
  await expect.poll(() => saved().media.find(item => item.id === "sponsor")?.adChannelIds).toEqual([]);
  await workspace.getByRole("combobox", { name: "Commercial channel", exact: true }).selectOption("24");
  await workspace.getByRole("button", { name: "Generate schedule preview", exact: true }).click();
  await expect(workspace.getByText(/^No commercials scheduled/)).toBeVisible();
  await page.getByLabel("Find an admin tool", { exact: true }).fill("backup");
  await page.getByRole("button", { name: "Backups & Restore", exact: true }).click();
  await expect(page.getByRole("button", { name: "Commercials", exact: true })).toHaveCount(0);
});

test("guided commercial upload registers the uploaded file in ad inventory, never a programme playlist", async ({ page }) => {
  const saved = await fixture(page);
  let uploaded = false;
  await page.route("**/api/admin/uploads/sign", route => route.fulfill({ json: { ok: true, uploadUrl: "https://storage.example/commercial", publicUrl: "https://media.example/commercial.webm", objectKey: "Commercials/commercial.webm" } }));
  await page.route("https://storage.example/commercial", route => { uploaded = route.request().method() === "PUT"; return route.fulfill({ status: 200 }); });
  await page.route("https://media.example/commercial.webm", route => route.fulfill({ contentType: "video/webm", body: video }));
  await page.getByRole("button", { name: "Upload a commercial", exact: true }).click();
  const workspace = page.getByRole("region", { name: "Commercials workspace", exact: true });
  await expect(workspace.getByRole("combobox", { name: "Media Type", exact: true })).toHaveValue("commercial");
  await workspace.locator('input[type="file"]').setInputFiles({ name: "sponsor.webm", mimeType: "video/webm", buffer: video });
  await workspace.getByRole("button", { name: "Upload to R2", exact: true }).click();
  await expect(workspace.getByText(/Upload complete. The public R2 URL/)).toBeVisible();
  expect(uploaded).toBe(true);
  await workspace.getByRole("textbox", { name: /^Display Title/ }).fill("Uploaded sponsor");
  await workspace.getByRole("button", { name: "Add Media", exact: true }).click();
  await expect.poll(() => saved().media.find(item => item.title === "Uploaded sponsor")?.file).toBe("https://media.example/commercial.webm");
  const item = saved().media.find(item => item.title === "Uploaded sponsor")!;
  expect(item.type).toBe("commercial");
  expect(item.duration).toBeGreaterThan(0);
  expect(saved().channels.every(channel => !channel.mediaIds.includes(item.id))).toBe(true);
  await expect(workspace.getByRole("combobox", { name: "Media Type", exact: true })).toHaveValue("commercial");
});
