import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { programming } from "./programming-fixture";

const clip = Buffer.from(readFileSync("tests/fixtures/test-video.webm.base64", "utf8"), "base64");
type PlaybackProbe = { loads: string[]; calls: { muted: boolean; readyState: number }[] };

async function prepare(page: Page, policy: "sound" | "all" = "sound") {
  await page.clock.setFixedTime(new Date("2026-10-18T12:01:03Z"));
  await page.addInitScript((policy) => {
    sessionStorage.setItem("ttv-profile-session-v1", JSON.stringify({ id: "main", pinHash: null }));
    const probe = { loads: [] as string[], calls: [] as { muted: boolean; readyState: number }[] };
    Object.assign(window, { playbackProbe: probe });
    let touched = false;
    document.addEventListener("pointerdown", () => { touched = true; }, { once: true });
    const originalPlay = HTMLMediaElement.prototype.play;
    const originalLoad = HTMLMediaElement.prototype.load;
    HTMLMediaElement.prototype.play = function () {
      probe.calls.push({ muted: this.muted, readyState: this.readyState });
      if (!touched && (policy === "all" || !this.muted)) {
        // Model the native autoplay attribute obeying the same browser policy.
        this.autoplay = false;
        return Promise.reject(new DOMException("Autoplay policy", "NotAllowedError"));
      }
      return originalPlay.call(this);
    };
    HTMLMediaElement.prototype.load = function () {
      const src = this.getAttribute("src");
      if (src) probe.loads.push(src);
      return originalLoad.call(this);
    };
  }, policy);
  await page.route("**/api/programming", (route) => route.fulfill({ json: {
    ok: true, source: "database", programming: {
      ...programming,
      media: programming.media.map((item) => ({ ...item, file: item.type === "movie" ? "/qa-b.webm" : item.id === "qa-show-b" ? "/qa-c.webm" : "/qa-a.webm" })),
      channels: [...programming.channels, { ...programming.channels[1], id: "26", number: 26, name: "Cinema Encore", branding: { ...programming.channels[1]!.branding, displayName: "Cinema Encore" } }],
    },
  } }));
  await page.route("https://www.gstatic.com/**", (route) => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.route("**/api/engagement", (route) => route.fulfill({ json: { ok: true } }));
  await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204 }));
  await page.route(/\/qa-[abc]\.webm$/, (route) => route.fulfill({ body: clip, contentType: "video/webm" }));
}

async function playing(page: Page) {
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) =>
    !video.paused && video.readyState >= 2 && video.currentTime > 0,
  )).toBe(true);
  await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(0);
  await expect(page.getByText("Loading channel...", { exact: true })).toHaveCount(0);
}

async function tune(page: Page, channel: string) {
  await page.getByRole("button", { name: "Browse all", exact: true }).click();
  await page.getByRole("dialog", { name: "Channel directory", exact: true })
    .getByRole("button", { name: channel, exact: true }).click();
}

test("starts without a playback tap, enables sound, and keeps the buffer across shared-file channels", async ({ page }) => {
  await prepare(page);
  await page.goto("/?ch=24");
  await playing(page);
  await expect(page.locator("video")).toHaveJSProperty("muted", true);
  const probe = await page.evaluate(() => (window as typeof window & { playbackProbe: PlaybackProbe }).playbackProbe);
  expect(probe.loads).toEqual(["/qa-c.webm"]);
  expect(probe.calls[0]).toEqual({ muted: false, readyState: 0 });
  await page.getByRole("button", { name: "Turn on sound", exact: true }).click();
  await expect(page.locator("video")).toHaveJSProperty("muted", false);
  await playing(page);
  await page.locator("video").evaluate((video) => { video.dataset.originalPlayer = "yes"; });
  await tune(page, "Tune to CH 25 Local Cinema");
  await expect(page.locator("video")).toHaveAttribute("src", "/qa-b.webm");
  await playing(page);
  await tune(page, "Tune to CH 26 Cinema Encore");
  await playing(page);
  await expect(page.locator("video")).toHaveAttribute("data-original-player", "yes");
  expect(await page.evaluate(() => (window as typeof window & { playbackProbe: PlaybackProbe }).playbackProbe.loads))
    .toEqual(["/qa-c.webm", "/qa-b.webm"]);
});

test("a device blocking all autoplay retains a working manual permission fallback", async ({ page }) => {
  await prepare(page, "all");
  await page.goto("/?ch=24");
  await expect(page.getByText("Your browser needs permission to play this channel.")).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await playing(page);
  await expect(page.locator("video")).toHaveJSProperty("muted", false);
});
