import { test, expect, type Page, waitForHouseholdSave } from "./viewer-fixture";
import { readFileSync } from "node:fs";
import { programming } from "./programming-fixture";
import type { ProgrammingSnapshot } from "../lib/programmingSnapshot";

const video = Buffer.from(readFileSync("tests/fixtures/test-video.webm.base64", "utf8"), "base64");
async function fixture(page: Page, stocked = true, kids = false) {
  let saved: ProgrammingSnapshot = structuredClone(programming);
  saved.media = saved.media.map(item => ({ ...item, rewindRoom: stocked && item.type === "movie" }));
  await page.addInitScript(isKids => {
    const hash = isKids ? "0".repeat(64) : null;
    if (isKids) localStorage.setItem("ttv-profiles-v1", JSON.stringify({ pin: { salt: "0".repeat(32), hash } }));
    sessionStorage.setItem("ttv-profile-session-v1", JSON.stringify({ id: isKids ? "kids" : "main", pinHash: hash }));
  }, kids);
  await page.route("**/api/programming", route => route.fulfill({ json: { ok: true, programming: saved, source: "database" } }));
  await page.route("**/api/admin/session", route => route.fulfill({ json: { ok: true, isAdmin: true } }));
  await page.route("**/api/admin/programming", async route => { saved = route.request().postDataJSON(); await route.fulfill({ json: { ok: true, programming: saved } }); });
  await page.route("**/qa-media.webm", route => route.fulfill({ contentType: "video/webm", body: video }));
  await page.route("**/api/engagement", route => route.fulfill({ json: { ok: true } }));
  await page.route("**/_vercel/**", route => route.fulfill({ status: 204 }));
  await page.route("https://www.gstatic.com/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
  return () => saved;
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
}

test("Rewind Room has a finished empty shelf and a working route to the library", async ({ page }, testInfo) => {
  await fixture(page, false);
  await page.goto("/rewind-room");
  await expect(page.getByRole("heading", { name: /The Rewind\s*Room\./ })).toBeVisible();
  await expect(page.getByText("The first tapes are on their way.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open tape:/ })).toHaveCount(0);
  await noOverflow(page);
  await testInfo.attach("rewind-empty-shelf", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await page.getByRole("link", { name: "Browse the library" }).click();
  await expect(page.getByRole("heading", { name: "Your time. Your TV." })).toBeVisible();
  await page.getByRole("link", { name: "Rewind Room", exact: true }).click();
  await expect(page.getByText("The first tapes are on their way.")).toBeVisible();
});

test("the tape shelf supports search, saved movies and reload persistence", async ({ page }, testInfo) => {
  await fixture(page);
  await page.goto("/rewind-room");
  const card = page.getByRole("button", { name: "Open tape: A Calgary Evening", exact: true });
  await expect(card).toBeVisible();
  await page.getByRole("searchbox", { name: "Find a movie", exact: true }).fill("not-here");
  await expect(card).toHaveCount(0);
  await page.getByRole("button", { name: "Show all tapes", exact: true }).click();
  await page.getByRole("button", { name: "Save A Calgary Evening to watchlist", exact: true }).click();
  await page.getByRole("button", { name: "My watchlist", exact: true }).click();
  await expect(card).toBeVisible();
  await noOverflow(page);
  await testInfo.attach("rewind-stocked-shelf", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  await waitForHouseholdSave(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Remove A Calgary Evening from watchlist", exact: true })).toBeVisible();
});

test("the tape player pauses, seeks, resumes and starts over with focus restored on eject", async ({ page }, testInfo) => {
  await fixture(page);
  await page.goto("/rewind-room");
  const card = page.getByRole("button", { name: "Open tape: A Calgary Evening", exact: true });
  await card.click();
  const dialog = page.getByRole("dialog", { name: "A Calgary Evening", exact: true });
  await dialog.getByRole("button", { name: "▶ Play tape", exact: true }).click();
  const player = dialog.locator("video");
  await expect.poll(() => player.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThanOrEqual(1);
  // Toggle from the actual media state, including browsers that deny autoplay.
  if (await player.evaluate((element: HTMLVideoElement) => element.paused)) await dialog.getByRole("button", { name: "Play tape", exact: true }).click();
  await expect.poll(() => player.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);
  await dialog.getByRole("button", { name: "Pause tape", exact: true }).click();
  await expect.poll(() => player.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await player.evaluate((element: HTMLVideoElement) => { element.currentTime = Math.min(15, element.duration / 2); });
  await dialog.getByRole("button", { name: "Rewind to the beginning", exact: true }).click();
  await expect.poll(() => player.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeLessThan(1);
  await dialog.getByRole("button", { name: "Forward 10 seconds", exact: true }).click();
  await expect.poll(() => player.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
  await dialog.getByRole("button", { name: "Rewind 10 seconds", exact: true }).click();
  await expect.poll(() => player.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeLessThan(1);
  await expect(player).toHaveAttribute("controls", "");
  await expect(dialog.getByRole("button", { name: "Fullscreen movie", exact: true })).toBeVisible();
  await noOverflow(page);
  await testInfo.attach("rewind-tape-player", { body: await page.screenshot(), contentType: "image/png" });
  await player.evaluate((element: HTMLVideoElement) => { element.currentTime = 24; });
  await expect.poll(() => player.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(23);
  await dialog.getByRole("button", { name: "Eject tape ✕", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeFocused();
  await waitForHouseholdSave(page);
  await page.reload();
  await page.getByRole("button", { name: "Pick up where you paused", exact: true }).click();
  await card.click();
  await dialog.getByRole("button", { name: "▶ Resume tape", exact: true }).click();
  await expect.poll(() => player.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(23);
  if (!(await player.evaluate((element: HTMLVideoElement) => element.paused))) await dialog.getByRole("button", { name: "Pause tape", exact: true }).click();
  await dialog.getByRole("button", { name: "Rewind to the beginning", exact: true }).click();
  await dialog.getByRole("button", { name: "Eject tape ✕", exact: true }).click();
  await expect(page.getByText("No tapes match.")).toBeVisible();
});

test("Kids can only search and play reviewed tapes, with private parent progress isolated", async ({ page }) => {
  const saved = await fixture(page, true, true);
  saved().media.push({ ...saved().media[2]!, id: "family-tape", title: "Family Movie Night", kidsApproved: true });
  await page.addInitScript(() => localStorage.setItem("ttv-library-progress-v1:account:qa-parent:main", JSON.stringify({ "family-tape": { position: 30, duration: 60, updatedAt: Date.now() } })));
  await page.goto("/rewind-room");
  await expect(page.getByRole("button", { name: "Open tape: Family Movie Night", exact: true })).toBeVisible();
  await expect(page.getByText("A Calgary Evening", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Pick up where you paused", exact: true }).click();
  await expect(page.getByText("No tapes match.")).toBeVisible();
  await page.getByRole("button", { name: "Show all tapes", exact: true }).click();
  await page.getByRole("searchbox", { name: "Find a movie", exact: true }).fill("Calgary");
  await expect(page.getByText("No tapes match.")).toBeVisible();
});

test("admin stocks and removes existing movies without changing channels or granting Kids approval", async ({ page }) => {
  const saved = await fixture(page, false);
  await page.goto("/admin");
  await page.getByRole("button", { name: "Rewind Room", exact: true }).click();
  const checkbox = page.getByRole("checkbox", { name: "Show A Calgary Evening in Rewind Room", exact: true });
  await checkbox.check();
  await expect.poll(() => saved().media.find(item => item.id === "qa-movie")?.rewindRoom).toBe(true);
  expect(saved().media.find(item => item.id === "qa-movie")?.kidsApproved).not.toBe(true);
  expect(saved().channels.map(channel => channel.mediaIds)).toEqual(programming.channels.map(channel => channel.mediaIds));
  await page.reload();
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await expect.poll(() => saved().media.find(item => item.id === "qa-movie")?.rewindRoom).toBe(false);
});

test("new movie upload saves to the Rewind Room without a channel or automatic Kids approval", async ({ page }) => {
  const saved = await fixture(page, false);
  let uploaded = false;
  await page.route("**/api/admin/uploads/sign", route => route.fulfill({ json: { ok: true, uploadUrl: "https://storage.example/tape", publicUrl: "https://media.example/tape.webm", objectKey: "Rewind-Room/tape.webm" } }));
  await page.route("https://storage.example/tape", route => { uploaded = route.request().method() === "PUT"; return route.fulfill({ status: 200 }); });
  await page.route("https://media.example/tape.webm", route => route.fulfill({ contentType: "video/webm", body: video }));
  await page.goto("/admin");
  await page.getByRole("button", { name: "Rewind Room", exact: true }).click();
  await page.getByRole("button", { name: "Upload a movie", exact: true }).click();
  const form = page.getByRole("region", { name: "Upload a Rewind Room movie", exact: true });
  await form.locator('input[type="file"]').first().setInputFiles({ name: "tape.webm", mimeType: "video/webm", buffer: video });
  await form.getByRole("button", { name: "Upload to R2", exact: true }).click();
  await expect(form.getByLabel("Movie video URL", { exact: true })).toHaveValue("https://media.example/tape.webm");
  expect(uploaded).toBe(true);
  await form.getByLabel("Movie title", { exact: true }).fill("Friday Night Tape");
  await form.getByLabel("Runtime (seconds or HH:MM:SS)", { exact: true }).fill("01:30:00");
  await form.getByRole("button", { name: "Add movie to shelf", exact: true }).click();
  await expect.poll(() => saved().media.find(item => item.title === "Friday Night Tape")?.rewindRoom).toBe(true);
  const item = saved().media.find(item => item.title === "Friday Night Tape")!;
  expect(item).toMatchObject({ type: "movie", duration: 5400, kidsApproved: false });
  expect(saved().channels.every(channel => !channel.mediaIds.includes(item.id))).toBe(true);
});
