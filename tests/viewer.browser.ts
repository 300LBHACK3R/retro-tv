import { test, expect, type Page } from "@playwright/test";
import { programming } from "./programming-fixture";
import { THEMES } from "../lib/themes";
import { readFileSync } from "node:fs";

const testVideo = Buffer.from(
  readFileSync("tests/fixtures/test-video.webm.base64", "utf8"),
  "base64",
);

async function openDirectory(page: Page) {
  await page.getByRole("button", { name: "Browse all", exact: true }).click();
  const directory = page.getByRole("dialog", {
    name: "Channel directory",
    exact: true,
  });
  await expect(directory).toBeVisible();
  return directory;
}
function currentChannel(page: Page) {
  return page.getByRole("region", {
    name: "Current Tate's TV channel",
    exact: true,
  });
}
async function openMore(page: Page) {
  const desktop = page.getByRole("button", {
    name: "Open viewer settings and more options",
    exact: true,
  });
  const mobile = page
    .getByRole("navigation", { name: "Mobile viewer navigation" })
    .getByRole("button", { name: "More", exact: true });
  // Keep resolving both controls while hydration/layout settles. isVisible()
  // is an immediate snapshot and can choose the hidden navigation permanently.
  await desktop.or(mobile).filter({ visible: true }).click();
  await expect(
    page.getByRole("dialog", { name: "More from Tate's TV" }),
  ).toBeVisible();
}
async function noPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
}

test.beforeEach(async ({ page }) => {
  // Isolate viewer behavior from live Supabase, tracking, and physical Cast devices.
  await page.route("**/api/programming", (route) =>
    route.fulfill({ json: { ok: true, programming, source: "database" } }),
  );
  await page.route("https://www.gstatic.com/**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: "" }),
  );
  await page.route("**/api/engagement", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  await page.route("**/_vercel/**", (route) => route.fulfill({ status: 204 }));
  await page.route("**/qa-media.webm", (route) =>
    route.fulfill({ body: testVideo, contentType: "video/webm" }),
  );
});

test("load programming, search channels, tune, and retain an uncluttered player", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/?ch=24");
  expect(response?.headers()["content-security-policy"]).toContain(
    "upgrade-insecure-requests",
  );
  await expect(
    currentChannel(page).getByRole("heading", {
      name: "Studio TV",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "On-screen remote" }),
  ).toHaveCount(0);
  const directory = await openDirectory(page);
  await directory.getByRole("searchbox", { name: "Find a channel" }).fill("25");
  await directory
    .getByRole("button", { name: "Tune to CH 25 Local Cinema", exact: true })
    .click();
  await expect(directory).toHaveCount(0);
  await expect(
    currentChannel(page).getByRole("heading", {
      name: "Local Cinema",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Now and next programming" }),
  ).toContainText("A Calgary Evening");
  await noPageOverflow(page);
  expect(errors).toEqual([]);
  await testInfo.attach("live-viewer", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("unavailable station insights do not interrupt tuning", async ({
  page,
}) => {
  // This failure is deliberate. WebKit also reports failed network loads through
  // pageerror; assert real unhandled rejections and viewer behavior separately.
  await page.addInitScript(() => {
    const errors: string[] = [];
    Object.assign(window, { telemetryRejections: errors });
    window.addEventListener("unhandledrejection", (event) =>
      errors.push(String(event.reason)),
    );
  });
  await page.route("**/api/engagement", (route) =>
    route.fulfill({ status: 503, json: { ok: false } }),
  );
  let unavailableResponses = 0;
  page.on("response", (response) => {
    if (response.url().endsWith("/api/engagement") && response.status() === 503)
      unavailableResponses += 1;
  });
  await page.goto("/?ch=24");
  await expect(
    currentChannel(page).getByRole("heading", {
      name: "Studio TV",
      exact: true,
    }),
  ).toBeVisible();
  const directory = await openDirectory(page);
  // Wait for the monitor to attach, then exercise its media-event/flush path.
  // Observe responses before navigation so an earlier flush cannot be missed.
  await expect
    .poll(async () => {
      await page.locator("video").first().dispatchEvent("playing");
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      return unavailableResponses;
    })
    .toBeGreaterThan(0);
  await directory
    .getByRole("button", { name: "Tune to CH 25 Local Cinema", exact: true })
    .click();
  await expect(
    currentChannel(page).getByRole("heading", {
      name: "Local Cinema",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as Window & { telemetryRejections?: string[] })
          .telemetryRejections,
    ),
  ).toEqual([]);
});

test("guide stays readable and keyboard input stays inside the dialog", async ({
  page,
}) => {
  await page.goto("/?ch=24");
  await expect(
    currentChannel(page).getByRole("heading", {
      name: "Studio TV",
      exact: true,
    }),
  ).toBeVisible();
  const desktop = page.getByRole("button", {
    name: "Open live guide",
    exact: true,
  });
  const mobile = page
    .getByRole("navigation", { name: "Mobile viewer navigation" })
    .getByRole("button", { name: "Guide", exact: true });
  await desktop.or(mobile).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "Live Guide", exact: true });
  await expect(dialog).toBeVisible();
  if ((page.viewportSize()?.width ?? 1440) <= 1024)
    await expect(
      page.getByRole("region", { name: "Mobile live TV guide" }),
    ).toBeVisible();
  await page
    .getByRole("button", { name: "Close live guide", exact: true })
    .press("ArrowDown");
  await expect(
    currentChannel(page).getByRole("heading", {
      name: "Studio TV",
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveAttribute(
    "data-ttv-overlay-open",
    "true",
  );
  await noPageOverflow(page);
});

test("theme changes preserve layout and survive reloading cloud programming", async ({
  page,
}) => {
  await page.goto("/?ch=24");
  await expect(
    currentChannel(page).getByRole("heading", {
      name: "Studio TV",
      exact: true,
    }),
  ).toBeVisible();
  await openMore(page);
  await page
    .getByRole("button", { name: "Theme library Open", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: /Theme Library/i }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Apply theme: Obsidian Gold", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-ttv-theme",
    "obsidian-gold",
  );
  await expect(
    page.getByRole("region", { name: "Live Tate's TV player" }),
  ).toBeVisible();
  await noPageOverflow(page);
  await page.reload();
  await expect(
    currentChannel(page).getByRole("heading", {
      name: "Studio TV",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute(
    "data-ttv-theme",
    "obsidian-gold",
  );
});

test("Library filters and selects an on-demand title", async ({
  page,
}, testInfo) => {
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Your time. Your TV." }),
  ).toBeVisible();
  const search = page.getByRole("textbox", {
    name: "Search the Tate's TV library",
  });
  await search.fill("A Calgary Evening");
  await expect(
    page.getByRole("heading", {
      name: "A Calgary Evening",
      exact: true,
      level: 2,
    }),
  ).toBeVisible();
  await search.fill("no-such-title-123");
  await expect(
    page.getByText("No matching library titles", { exact: true }),
  ).toBeVisible();
  await noPageOverflow(page);
  await testInfo.attach("library", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});

test("TV mode keeps channel navigation available and hides station management", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "television");
  await page.goto("/tv?ch=25");
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  await expect(page.locator('[aria-label="Live on CH 25"]')).toBeVisible();
  await openMore(page);
  await expect(page.getByText("Station admin", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Submit a clip/ })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Close viewer controls", exact: true })
    .click();
  await noPageOverflow(page);
});

test("every theme applies, keeps readable surfaces and respects reduced motion", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/library");
  await expect(
    page.getByRole("heading", { name: "Your time. Your TV." }),
  ).toBeVisible();
  for (const theme of THEMES) {
    await page
      .getByRole("button", { name: "Open theme library", exact: true })
      .click();
    await page.locator(`.theme-card[data-theme-id="${theme.id}"]`).click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-ttv-theme",
      theme.id,
    );
    await expect(
      page.getByRole("dialog", { name: /Theme Library/i }),
    ).toHaveCount(0);
    await noPageOverflow(page);
    expect(
      await page
        .locator(".ttv-library-shell")
        .evaluate((element) => getComputedStyle(element).color),
    ).not.toBe("rgba(0, 0, 0, 0)");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".ttv-library-shell")
      .evaluate(
        (element) => getComputedStyle(element, "::before").animationName,
      ),
  ).toBe("none");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-ttv-theme",
    "electric-blue-live",
  );
});

test("favourite channels and guide filtering persist without accounts", async ({
  page,
}) => {
  await page.goto("/?ch=24");
  await expect(
    currentChannel(page).getByRole("heading", {
      name: "Studio TV",
      exact: true,
    }),
  ).toBeVisible();
  const directory = await openDirectory(page);
  await directory
    .getByRole("button", { name: "Save Studio TV to favourites", exact: true })
    .click();
  await directory
    .getByRole("button", { name: "Favourites only", exact: true })
    .click();
  await expect(
    directory.getByRole("button", {
      name: "Tune to CH 25 Local Cinema",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.reload();
  const desktop = page.getByRole("button", {
    name: "Open live guide",
    exact: true,
  });
  const mobile = page
    .getByRole("navigation", { name: "Mobile viewer navigation" })
    .getByRole("button", { name: "Guide", exact: true });
  await desktop.or(mobile).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "Live Guide", exact: true });
  const channelCount = dialog
    .locator(".ttv-guide-tools")
    .getByText(/^\d+ channels? · Local time$/);
  await expect(channelCount).toBeVisible();
  const allChannelsText = await channelCount.innerText();
  await dialog.getByRole("button", { name: "Favourites", exact: true }).click();
  await expect(
    dialog.getByText("1 channel · Local time", { exact: true }),
  ).toBeVisible();
  const search = dialog.getByRole("searchbox", {
    name: "Find a channel in the guide",
  });
  await search.fill("no-such-channel");
  await expect(
    dialog.getByText("0 channels · Local time", { exact: true }),
  ).toBeVisible();
  await search.fill("24");
  await expect(
    dialog.getByText("1 channel · Local time", { exact: true }),
  ).toBeVisible();
  const compact = dialog.getByRole("button", {
    name: "Compact rows",
    exact: true,
  });
  if (await dialog.locator('[data-mobile="true"]').count()) {
    await expect(compact).toHaveCount(0);
  } else {
    await compact.click();
    await expect(compact).toHaveAttribute("aria-pressed", "true");
  }
  await dialog
    .getByRole("button", { name: "Show all channels", exact: true })
    .click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(
    dialog.getByRole("button", { name: "Favourites", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(channelCount).toHaveText(allChannelsText);
  await noPageOverflow(page);
});

test("watchlist groups episodes, persists and opens linked titles", async ({
  page,
}) => {
  await page.goto("/library?watch=qa-movie");
  await expect(
    page.getByRole("heading", {
      name: "A Calgary Evening",
      exact: true,
      level: 2,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Save A Calgary Evening to watchlist",
      exact: true,
    })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "My watchlist (1)", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "A Calgary Evening",
      exact: true,
      level: 2,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Remove A Calgary Evening from watchlist",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Your watchlist is empty", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Browse all titles", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "My watchlist (0)", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("textbox", { name: "Search the Tate's TV library" }),
  ).toBeFocused();
  await expect(page.getByText("Browse Titles", { exact: true })).toBeVisible();
});

test("guide renders a bounded window after a long schedule scroll", async ({
  page,
}, testInfo) => {
  test.skip(
    ![
      "chromium-desktop",
      "firefox-desktop",
      "webkit-desktop",
      "television",
    ].includes(testInfo.project.name),
  );
  await page.goto("/?ch=24");
  await page
    .getByRole("button", { name: "Open live guide", exact: true })
    .click();
  const guide = page.locator('[data-ttv-guide-scroll="true"]');
  await expect(guide.locator(".ttv-guide-cell").first()).toBeVisible();
  const before = await guide.locator(".ttv-guide-cell").count();
  expect(before).toBeLessThan(1500);
  await guide.evaluate((element) => {
    element.scrollLeft = 10000;
  });
  await expect
    .poll(() => guide.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(9000);
  await expect
    .poll(() => guide.locator(".ttv-guide-cell").count())
    .toBeGreaterThan(0);
  expect(await guide.locator(".ttv-guide-cell").count()).toBeLessThan(1500);
  await noPageOverflow(page);
});

test("mobile guide compares channels, browses without tuning and restores your place", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "television");
  if ((page.viewportSize()?.width ?? 1440) > 1024)
    await page.setViewportSize({ width: 390, height: 844 });
  const fixedNow = new Date("2026-09-12T05:58:25Z");
  await page.clock.setFixedTime(fixedNow);
  await page.goto("/?ch=24");
  const open = page
    .getByRole("button", { name: "Open live guide", exact: true })
    .or(
      page
        .getByRole("navigation", { name: "Mobile viewer navigation" })
        .getByRole("button", { name: "Guide", exact: true }),
    );
  await open.filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "Live Guide", exact: true });
  const list = dialog.getByRole("list", { name: "Channels on now" });
  await expect(
    list.getByRole("button", { name: "Watch Studio TV live", exact: true }),
  ).toBeEnabled();
  await expect(
    list.getByRole("button", { name: "Watch Local Cinema live", exact: true }),
  ).toBeEnabled();
  const schedule = list.getByRole("button", {
    name: "Schedule for Studio TV",
    exact: true,
  });
  await schedule.scrollIntoViewIfNeeded();
  const beforeScroll = await dialog
    .locator(".ttv-mobile-guide-scroll")
    .first()
    .evaluate((element) => element.scrollTop);
  await testInfo.attach("mobile-guide-on-now", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await schedule.click();
  const back = dialog.getByRole("button", { name: "On now", exact: true });
  await expect(back).toBeFocused();
  const listings = dialog.getByRole("list", { name: "Upcoming on Studio TV" });
  await expect(listings.locator(":scope > li")).toHaveCount(12);
  await expect(
    listings.getByRole("heading", { name: "Tomorrow", exact: true }),
  ).toBeVisible();
  await expect(listings.locator("li").first()).toHaveAttribute(
    "data-live",
    "true",
  );
  // Upcoming programmes are information, not misleading live-tuning buttons.
  await listings.locator(".ttv-mobile-listing").nth(1).click();
  await expect(dialog).toBeVisible();
  await expect(
    currentChannel(page).getByRole("heading", {
      name: "Studio TV",
      exact: true,
    }),
  ).toBeVisible();
  await expect(listings.getByRole("button")).toHaveCount(0);
  await dialog.getByRole("button", { name: "+3 hr", exact: true }).click();
  const start = await listings.locator("time").first().getAttribute("datetime");
  const delta = fixedNow.getTime() + 3 * 3600_000 - Date.parse(start!);
  expect(delta).toBeGreaterThanOrEqual(0);
  expect(delta).toBeLessThan(60_000);
  await dialog.getByRole("button", { name: "Now", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Show more programmes", exact: true })
    .click();
  await expect(listings.locator(":scope > li")).toHaveCount(24);
  await expect(
    listings.getByRole("heading", { level: 4 }).nth(12),
  ).toBeFocused();
  await dialog
    .getByRole("combobox", { name: "Browse channel schedule" })
    .selectOption("25");
  await expect(
    dialog
      .getByRole("list", { name: "Upcoming on Local Cinema" })
      .locator(":scope > li"),
  ).toHaveCount(12);
  await testInfo.attach("mobile-guide-schedule", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await back.click();
  await expect(schedule).toBeFocused();
  const afterScroll = await dialog
    .locator(".ttv-mobile-guide-scroll")
    .first()
    .evaluate((element) => element.scrollTop);
  expect(Math.abs(afterScroll - beforeScroll)).toBeLessThan(4);
  await list
    .getByRole("button", { name: "Save Studio TV to favourites", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Favourites", exact: true }).click();
  await schedule.click();
  await dialog
    .getByRole("button", {
      name: "Remove Studio TV from favourites",
      exact: true,
    })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "On now", exact: true }),
  ).toBeFocused();
  await expect(dialog.getByRole("status")).toContainText("No favourites yet");
  await dialog
    .getByRole("button", { name: "Show all channels", exact: true })
    .click();
  await list
    .getByRole("button", { name: "Watch Local Cinema live", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    currentChannel(page).getByRole("heading", {
      name: "Local Cinema",
      exact: true,
    }),
  ).toBeVisible();
  await noPageOverflow(page);
});

test("mobile guide fits narrow screens, landscape and larger text with reachable controls", async ({
  page,
}, testInfo) => {
  test.skip(
    !["chromium-desktop", "firefox-desktop", "webkit-desktop"].includes(
      testInfo.project.name,
    ),
  );
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?ch=24");
  await page
    .getByRole("navigation", { name: "Mobile viewer navigation" })
    .getByRole("button", { name: "Guide", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Live Guide", exact: true });
  const search = dialog.getByRole("searchbox", {
    name: "Find a channel in the guide",
  });
  await search.fill("Studio");
  await expect(search).toBeFocused();
  await expect(
    dialog.getByRole("button", { name: "Watch Studio TV live", exact: true }),
  ).toBeEnabled();
  await noPageOverflow(page);
  const smallTargets = await dialog.locator("button").evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          (rect.width < 44 || rect.height < 44)
        );
      })
      .map((button) => button.textContent),
  );
  expect(smallTargets).toEqual([]);
  expect(
    await search.evaluate((element) =>
      parseFloat(getComputedStyle(element).fontSize),
    ),
  ).toBeGreaterThanOrEqual(16);
  await search.fill("missing-channel-123");
  await expect(search).toBeFocused();
  await expect(dialog.getByRole("status")).toContainText("No channels match");
  await search.fill("Studio");
  await dialog
    .getByRole("button", { name: "Schedule for Studio TV", exact: true })
    .click();
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  expect(
    await dialog
      .locator(".ttv-mobile-schedule")
      .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  await page.evaluate(() =>
    document.documentElement.style.removeProperty("font-size"),
  );
  await page.setViewportSize({ width: 568, height: 320 });
  const watch = dialog.getByRole("button", { name: "Watch live", exact: true });
  await watch.scrollIntoViewIfNeeded();
  await expect(watch).toBeInViewport();
  await expect(
    dialog.getByRole("button", { name: "Close live guide" }),
  ).toBeInViewport();
  await noPageOverflow(page);
  await testInfo.attach("mobile-guide-landscape", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await watch.click();
  await expect(dialog).toHaveCount(0);
});
