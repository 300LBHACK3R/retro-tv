import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { programming } from "./programming-fixture";

test("channel branding yields to the sound prompt and returns after sound is enabled", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-18T12:01:03Z"));
  await page.addInitScript(() => {
    sessionStorage.setItem("ttv-profile-session-v1", JSON.stringify({ id: "main", pinHash: null }));
    let touched = false;
    document.addEventListener("pointerdown", () => { touched = true; }, { once: true });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!touched && !this.muted) {
        this.autoplay = false;
        return Promise.reject(new DOMException("Autoplay policy", "NotAllowedError"));
      }
      return play.call(this);
    };
  });
  await page.route("**/api/programming", route => route.fulfill({ json: {
    ok: true, source: "database", programming: {
      ...programming,
      media: programming.media.map(item => ({ ...item, file: "/qa-overlap.webm" })),
    },
  } }));
  await page.route("**/qa-overlap.webm", route => route.fulfill({
    contentType: "video/webm",
    body: Buffer.from(readFileSync("tests/fixtures/test-video.webm.base64", "utf8"), "base64"),
  }));
  await page.route("https://www.gstatic.com/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.route("**/api/engagement", route => route.fulfill({ json: { ok: true } }));
  await page.route("**/_vercel/**", route => route.fulfill({ status: 204 }));
  await page.goto("/?ch=24");
  const sound = page.getByRole("button", { name: "Turn on sound", exact: true });
  await expect(sound).toBeVisible();
  await expect(page.locator(".ttv-channel-overlay")).toBeHidden();
  await testInfo.attach("unobstructed-sound-prompt", { body: await page.screenshot(), contentType: "image/png" });
  await sound.click();
  await expect(page.locator("video")).toHaveJSProperty("muted", false);
  await expect(page.locator(".ttv-channel-overlay")).toHaveCSS("visibility", "visible");
});

test("support and recovery routes remain available in the production build", async ({ request }) => {
  for (const path of ["/admin", "/backup", "/compat", "/health", "/help", "/install", "/launch", "/offline", "/privacy", "/readiness", "/recovery", "/submit"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toContain("text/html");
  }
});

test("admin tools load their separate panels without changing saved programming", async ({ page }) => {
  const errors: string[] = [];
  const writes: unknown[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/admin/session", route => route.fulfill({ json: { ok: true, isAdmin: true } }));
  await page.route("**/api/programming", route => route.fulfill({ json: { ok: true, programming, source: "database" } }));
  await page.route("**/api/admin/programming", route => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true, programming } });
  });
  await page.route("**/api/admin/submissions", route => route.fulfill({ json: { ok: true, submissions: [] } }));
  await page.route("**/api/admin/station", route => route.fulfill({ status: 503, json: { ok: false, error: "Insights temporarily unavailable" } }));
  await page.route("**/api/engagement", route => route.fulfill({ json: { ok: true } }));
  await page.route("**/_vercel/**", route => route.fulfill({ status: 204 }));
  await page.route("https://www.gstatic.com/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
  await page.goto("/admin");
  await expect(page.getByText(/Global loaded/)).toBeVisible();

  const panels = [
    ["Quick Edit", "Media Library"],
    ["Add Media", "Add Media to Tate's TV"],
    ["Playlist", "Channel Programming"],
    ["Branding", "Channel Branding"],
    ["Library", "Media Manager"],
    ["Programme Blocks", "Signature programming"],
    ["Submissions", "Submissions Inbox"],
    ["Station Insights", "Station insights"],
    ["Launch Check", "Station Preflight"],
    ["Backups & Restore", "Station Config"],
  ] as const;
  for (const [label, heading] of panels) {
    const button = page.getByRole("button", { name: label, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
  expect(writes).toEqual([]);
});
