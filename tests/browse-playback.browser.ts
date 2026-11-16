import { readFileSync } from "node:fs";
import { test, expect, type Page } from "./viewer-fixture";
import { programming } from "./programming-fixture";

const media = Buffer.from(readFileSync("tests/fixtures/test-video.webm.base64", "utf8"), "base64");

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-16T18:00:05Z"));
  await page.addInitScript(() => {
    sessionStorage.setItem("ttv-profile-session-v1", JSON.stringify({ id: "main", pinHash: null }));
    // Exercise the normal muted-autoplay fallback without replacing playback.
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!this.muted) {
        this.autoplay = false;
        return Promise.reject(new DOMException("Autoplay policy", "NotAllowedError"));
      }
      return play.call(this);
    };
  });
  await page.route("**/api/programming", route => route.fulfill({ json: { ok: true, programming, source: "database" } }));
  await page.route("**/api/engagement", route => route.fulfill({ json: { ok: true } }));
  await page.route("**/_vercel/**", route => route.fulfill({ status: 204 }));
  await page.route("https://www.gstatic.com/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.route("https://*.r2.dev/**", route => route.abort());
  await page.route("**/qa-media.webm", route => route.fulfill({ body: media, contentType: "video/webm" }));
});

async function startLive(page: Page) {
  await page.goto("/?ch=25");
  const video = page.locator(".ttv-player-shell video");
  await expect(video).toHaveAttribute("src", "/qa-media.webm");
  await video.scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => !element.paused && !element.seeking && element.readyState >= 2)).toBe(true);
  await video.evaluate((element: HTMLVideoElement) => {
    element.dataset.testIdentity = "original-live-video";
    element.dataset.testReloads = "0";
    element.addEventListener("emptied", () => { element.dataset.testReloads = String(Number(element.dataset.testReloads) + 1); });
  });
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);
  return video;
}

async function openLibrary(page: Page) {
  await page.getByRole("link", { name: /^(Open on-demand Library|Library)$/ }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("heading", { name: "Your time. Your TV." })).toBeVisible();
}

async function samePlayingVideo(page: Page, preview = true) {
  const video = page.locator(".ttv-player-shell video");
  await expect(video).toHaveCount(1);
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute("data-test-identity", "original-live-video");
  await expect(video).toHaveAttribute("data-test-reloads", "0");
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  if (!preview) return video;
  const bounds = (await video.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.y).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
  return video;
}

test("live playback survives Library, browser history and Guide without replacing the video", async ({ page }, testInfo) => {
  const video = await startLive(page);
  const startedAt = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
  await openLibrary(page);
  await samePlayingVideo(page);
  await expect(page.locator(".ttv-browse-playing-heading")).toContainText("Local Cinema");
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(startedAt + .1);
  await testInfo.attach("library-live-preview", { body: await page.screenshot({ path: testInfo.outputPath("library-live-preview.png") }), contentType: "image/png" });
  await page.getByRole("searchbox", { name: "Search the Tate's TV library" }).fill("Studio");
  await samePlayingVideo(page);
  await page.getByRole("button", { name: "TV Guide", exact: true }).click();
  const guide = page.getByRole("dialog", { name: "Live Guide", exact: true });
  await expect(guide).toBeVisible();
  await expect(page.locator(".ttv-library-shell")).not.toBeVisible();
  await expect(guide.locator(".ttv-mobile-guide, .ttv-desktop-guide").filter({ visible: true })).toBeVisible();
  await samePlayingVideo(page);
  expect(await guide.locator("video").count()).toBe(1);
  await testInfo.attach("guide-live-preview", { body: await page.screenshot({ path: testInfo.outputPath("guide-live-preview.png") }), contentType: "image/png" });
  await guide.getByRole("button", { name: "Close live guide", exact: true }).click();
  await samePlayingVideo(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/?\?ch=25$/);
  await samePlayingVideo(page, false);
  await page.goForward();
  await expect(page).toHaveURL(/\/library$/);
  await samePlayingVideo(page);
});

test("on-demand playback takes audio from live TV and closing the title restores it", async ({ page }) => {
  const live = await startLive(page);
  await openLibrary(page);
  await page.getByRole("button", { name: "Open A Calgary Evening", exact: true }).click();
  const title = page.getByRole("dialog", { name: "A Calgary Evening", exact: true });
  // Reading title details does not stop the current programme.
  await expect.poll(() => live.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);
  await title.getByRole("button", { name: /Watch now/ }).click();
  const movie = title.locator("video");
  await expect(movie).toBeVisible();
  await movie.evaluate((element: HTMLVideoElement) => { element.muted = true; void element.play().catch(() => {}); });
  await expect.poll(() => movie.evaluate((element: HTMLVideoElement) => !element.paused && element.readyState >= 2)).toBe(true);
  await expect.poll(() => live.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  // A late autoplay/ended event from live TV must not steal audio back.
  await live.dispatchEvent("ended");
  await expect.poll(() => page.locator("video").evaluateAll(elements => elements.filter(element => !(element as HTMLVideoElement).paused).length)).toBe(1);
  await title.getByRole("button", { name: "Close title ✕" }).click();
  await samePlayingVideo(page);
  await expect(page.locator("video")).toHaveCount(1);
});

test("direct Library visits stay silent until a live channel is requested", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "Your time. Your TV." })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await page.getByRole("button", { name: "TV Guide", exact: true }).click();
  const guide = page.getByRole("dialog", { name: "Live Guide", exact: true });
  await expect(guide).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await expect(guide.locator(".ttv-mobile-guide, .ttv-desktop-guide").filter({ visible: true })).toBeVisible();
  if (await guide.locator(".ttv-mobile-guide").isVisible()) {
    await guide.getByRole("button", { name: "Schedule for Local Cinema", exact: true }).click();
    await guide.getByRole("button", { name: "Watch live", exact: true }).click();
    await guide.getByRole("button", { name: "Close live guide", exact: true }).click();
  } else {
    await guide.locator(".ttv-guide-station").filter({ hasText: "Local Cinema" }).click();
  }
  await expect(page.locator(".ttv-player-shell video")).toHaveAttribute("src", "/qa-media.webm");
  await expect(page.locator(".ttv-player-shell video")).toBeVisible();
});

test("stopping the live preview pauses it and switching profile removes playback", async ({ page }) => {
  const live = await startLive(page);
  await openLibrary(page);
  await page.getByRole("button", { name: "Stop live preview", exact: true }).click();
  await expect(live).not.toBeVisible();
  await expect.poll(() => live.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
  await page.getByRole("link", { name: "Live TV", exact: true }).click();
  await samePlayingVideo(page, false);
  await openLibrary(page);
  await page.getByRole("button", { name: /^Switch profile:/ }).click();
  await expect(page.getByRole("heading", { name: "Who’s watching?" })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
});
