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
  // Existing viewer checks start with a normal selected Main profile; profile flows have a separate suite.
  await page.addInitScript(() => sessionStorage.setItem("ttv-profile-session-v1", JSON.stringify({ id: "main", pinHash: null })));
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

  await expect(dialog.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    currentChannel(page).getByRole("heading", {
      name: "Studio TV",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toHaveAttribute(
    "data-ttv-overlay-open",
    "true",
  );
  await noPageOverflow(page);
});

test("theme changes follow navigation during a visit, are not saved, and reset on reload", async ({
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
  // Client navigation keeps the in-memory selection without writing it to profiles.
  await page.locator('a[href="/library"]').filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", "obsidian-gold");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("retro-tv-programming-v1")!).state);
  expect(stored.themeId).toBeUndefined();
  expect(stored.themeRevision).toBeUndefined();
  await page.getByRole("link", { name: "Back to Live TV", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", "obsidian-gold");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-ttv-theme",
    "halloween-night",
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
}, testInfo) => {
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
    if (theme.id === "halloween-night" || theme.id === "halloween-haunted-arcade") {
      const afterDark = theme.id === "halloween-night";
      const world = page.locator(".ttv-seasonal-world");
      await expect(world).toHaveCount(1);
      await expect(world).toBeVisible();
      await expect(world).toHaveAttribute("aria-hidden", "true");
      const layout = await world.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const styles = getComputedStyle(element);
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
          viewportWidth: document.documentElement.clientWidth, viewportHeight: window.innerHeight,
          position: styles.position, pointerEvents: styles.pointerEvents };
      });
      expect(layout.position).toBe("fixed");
      expect(layout.pointerEvents).toBe("none");
      expect(layout.x).toBe(0);
      expect(layout.y).toBe(0);
      expect(Math.abs(layout.width - layout.viewportWidth)).toBeLessThanOrEqual(1);
      expect(Math.abs(layout.height - layout.viewportHeight)).toBeLessThanOrEqual(1);
      const portrait = await page.evaluate(() => matchMedia("(max-width: 760px) and (orientation: portrait)").matches);
      const imageName = `${afterDark ? "halloween-after-dark" : "haunted-arcade"}-${portrait ? "mobile" : "world"}`;
      await expect.poll(() => world.locator("img").evaluate((image: HTMLImageElement, name) =>
        image.complete && image.naturalWidth > 0 && image.currentSrc.includes(name), imageName,
      )).toBe(true);
      await expect(page.locator(".ttv-halloween-scene")).toHaveCount(0);
      expect(await page.locator(".ttv-library-shell").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const selector of afterDark
        ? [".ttv-afterdark-witch", ".ttv-afterdark-fog", ".ttv-afterdark-skeleton-wave"]
        : [".ttv-haunted-ghost", ".ttv-haunted-mist", ".ttv-haunted-cabinet-light"])
        expect(await world.locator(selector).first().evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
      await testInfo.attach(`${theme.id}-full-page`, { body: await page.screenshot(), contentType: "image/png" });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      if (!afterDark) {
        await page.getByRole("link", { name: "Back to Live TV", exact: true }).click();
        await expect(page.locator(".ttv-premium-viewer-shell")).toBeVisible();
        await expect(world).toHaveCount(1);
        await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", theme.id);
        expect(await page.locator(".ttv-app-shell").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
        await page.locator('a[href="/library"]').filter({ visible: true }).first().click();
        await expect(page.getByRole("heading", { name: "Your time. Your TV." })).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", theme.id);
      }
    } else {
      await expect(page.locator(".ttv-seasonal-world")).toHaveCount(0);
    }
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
    "halloween-night",
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
  await expect(currentChannel(page).getByRole("heading", { name: "Studio TV", exact: true })).toBeVisible();
  const desktop = page.getByRole("button", {
    name: "Open live guide",
    exact: true,
  });
  const mobile = page
    .getByRole("navigation", { name: "Mobile viewer navigation" })
    .getByRole("button", { name: "Guide", exact: true });
  await desktop.or(mobile).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "Live Guide", exact: true });
  // The dialog mounts before its dynamically loaded guide. Wait for a real
  // layout before deciding which controls should be visible.
  await expect(dialog.locator(".ttv-mobile-guide, .ttv-desktop-guide")).toBeVisible();
  const mobileGuide = (await dialog.locator('[data-mobile="true"]').count()) > 0;
  const channelCount = dialog
    .locator(".ttv-guide-tools")
    .getByText(/^\d+ channels? · Local time$/);
  if (!mobileGuide) await expect(channelCount).toBeVisible();
  const allChannelsText = await channelCount.textContent();
  await dialog.getByRole("button", { name: "Favourites", exact: true }).click();
  await expect(channelCount).toHaveText("1 channel · Local time");
  const search = dialog.getByRole("searchbox", {
    name: "Find a channel in the guide",
  });
  if (mobileGuide) await dialog.getByRole("button", { name: "Find", exact: true }).click();
  await search.fill("no-such-channel");
  await expect(channelCount).toHaveText("0 channels · Local time");
  await search.fill("24");
  await expect(channelCount).toHaveText("1 channel · Local time");
  const compact = dialog.getByRole("button", {
    name: "Compact rows",
    exact: true,
  });
  if (mobileGuide) {
    await expect(compact).toHaveCount(0);
  } else {
    await compact.click();
    await expect(compact).toHaveAttribute("aria-pressed", "true");
  }
  await dialog
    .getByRole("button", { name: "Show all channels", exact: true })
    .click();
  await expect(search).toHaveValue("");
  if (mobileGuide) {
    await expect(search).not.toBeFocused();
    await expect(dialog.getByRole("button", { name: "All channels", exact: true })).toBeFocused();
  } else {
    await expect(search).toBeFocused();
  }
  await expect(
    dialog.getByRole("button", { name: "Favourites", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(channelCount).toHaveText(allChannelsText!);
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
  await expect(currentChannel(page).getByRole("heading", { name: "Studio TV", exact: true })).toBeVisible();
  const open = page
    .getByRole("button", { name: "Open live guide", exact: true })
    .or(
      page
        .getByRole("navigation", { name: "Mobile viewer navigation" })
        .getByRole("button", { name: "Guide", exact: true }),
    );
  const video = page.locator(".ttv-player-shell video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveJSProperty("currentSrc", new URL("/qa-media.webm", page.url()).href);
  await video.evaluate((element) => element.setAttribute("data-test-player-identity", "original"));
  await open.filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "Live Guide", exact: true });
  await expect(dialog.locator(".ttv-mobile-guide")).toBeVisible();
  await expect(video).toHaveAttribute("data-test-player-identity", "original");
  const playerBounds = await video.boundingBox();
  const guideBounds = await dialog.locator(".ttv-guide-inline").boundingBox();
  expect(guideBounds!.y).toBeGreaterThanOrEqual(playerBounds!.y + playerBounds!.height - 1);
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
  await expect(video).toHaveAttribute("data-test-player-identity", "original");
  await expect(page.locator(".ttv-mobile-channel[data-current=true] .ttv-mobile-channel-name")).toHaveText("Studio TV");
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
  await expect(back).toBeInViewport();
  await back.click();
  await expect(schedule).toBeFocused();
  const afterScroll = await dialog
    .locator(".ttv-mobile-guide-scroll")
    .first()
    .evaluate((element) => element.scrollTop);
  expect(Math.abs(afterScroll - beforeScroll)).toBeLessThan(4);
  // Find and the current channel stay reachable after browsing down the list.
  await dialog.locator(".ttv-mobile-guide-scroll").first().evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(dialog.getByRole("button", { name: "Your channel", exact: true })).toBeInViewport();
  await dialog.getByRole("button", { name: "Your channel", exact: true }).click();
  await expect(list.getByRole("button", { name: "Watch Studio TV live", exact: true })).toBeFocused();
  await expect(schedule).toBeInViewport();
  await dialog.getByRole("button", { name: "Find", exact: true }).click();
  await expect(dialog.getByRole("searchbox", { name: "Find a channel in the guide" })).toBeFocused();
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
  await expect(dialog.locator(".ttv-guide-empty")).toContainText("No favourites yet");
  await dialog
    .getByRole("button", { name: "Show all channels", exact: true })
    .click();
  await list
    .getByRole("button", { name: "Watch Local Cinema live", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await expect(list.getByRole("button", { name: "Watch Local Cinema live", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(video).toHaveAttribute("data-test-player-identity", "original");
  await dialog.getByRole("button", { name: "Close live guide", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(video).toHaveAttribute("data-test-player-identity", "original");
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
  await dialog.getByRole("button", { name: "Find", exact: true }).click();
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
  await expect(dialog.locator(".ttv-guide-empty")).toContainText("No channels match");
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
  // Rotation expands playback. The player Guide control reopens the schedule.
  await expect(dialog).toHaveCount(0);
  await page.locator(".ttv-player-shell").click({ position: { x: 20, y: 20 } });
  await page.locator(".ttv-player-controls").getByRole("button", { name: "Guide", exact: true }).click();
  await dialog.getByRole("button", { name: "Schedule for Studio TV", exact: true }).click();
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
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close live guide", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("mobile themes are free, open without the keyboard, and remember reduced motion without saving a theme", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "television");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/library");
  const trigger = page.getByRole("button", { name: "Open theme library", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Theme Library", exact: true });
  const close = dialog.getByRole("button", { name: "Close Theme Library", exact: true });
  const search = dialog.getByRole("searchbox", { name: "Search Tate's TV themes" });
  await expect(close).toBeFocused();
  await expect(search).not.toBeFocused();
  await expect(dialog.getByText("All themes are free. Pick a look for this visit.", { exact: true })).toBeVisible();
  await expect(dialog.locator(".theme-card")).toHaveCount(THEMES.length);
  await expect(dialog.locator(".theme-card:disabled")).toHaveCount(0);
  await expect(dialog.locator(".theme-card__status").filter({ hasText: /^Free$/ })).toHaveCount(THEMES.length - 1);
  await expect(dialog.getByRole("group", { name: "Theme access filters" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Seasonal", exact: true }).click();
  await expect(dialog.locator(".theme-card")).toHaveCount(2);
  const cards = await dialog.locator(".theme-card").evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width };
  }));
  expect(Math.abs(cards[0]!.top - cards[1]!.top)).toBeLessThan(2);
  expect(cards[1]!.left).toBeGreaterThan(cards[0]!.left + cards[0]!.width);
  await search.fill("no-such-theme");
  await expect(dialog.getByRole("status")).toContainText("No themes match");
  await dialog.getByRole("button", { name: "Show all themes", exact: true }).click();
  await expect(dialog.locator(".theme-card")).toHaveCount(THEMES.length);
  await expect(close).toBeInViewport();
  await dialog.getByRole("button", { name: "Apply theme: Haunted Arcade", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", "halloween-haunted-arcade");
  const scene = page.locator(".ttv-haunted-world");
  await expect(scene).toBeVisible();
  await expect(scene).toHaveCSS("position", "fixed");
  await expect(scene).toHaveAttribute("aria-hidden", "true");
  await expect(scene.getByRole("button")).toHaveCount(0);
  await page.goto("/?ch=24");
  await openMore(page);
  await page.getByRole("button", { name: "Reduce motion Off", exact: true }).click();
  await page.getByRole("button", { name: "Close viewer controls", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-ttv-reduced-motion", "true");
  await page.goto("/library");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", "halloween-night");
  await expect(page.locator(".ttv-afterdark-witch")).toHaveCSS("animation-name", "none");
  await trigger.click();
  await page.setViewportSize({ width: 568, height: 320 });
  await expect(close).toBeInViewport();
  await expect(dialog.getByRole("button", { name: "Done", exact: true })).toBeInViewport();
  await noPageOverflow(page);
  await testInfo.attach("haunted-arcade-mobile-theme-picker", { body: await page.screenshot(), contentType: "image/png" });
  await close.click();
  await page.goto("/?ch=24");
  await expect(page.getByRole("region", { name: "Live Tate's TV player", exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-ttv-theme", "halloween-night");
  await expect(page.locator(".ttv-seasonal-world")).toHaveCSS("position", "fixed");
  await expect(page.locator(".ttv-premium-viewer-shell .ttv-halloween-scene")).toHaveCount(0);
});


test("phones use hardware volume, expand on rotation and preserve the floating mini player", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "television");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("retro-tv-player-controls-v1", JSON.stringify({ version: 3, state: { volume: 0, muted: true, remoteMinimized: false } })));
  await page.goto("/?ch=24");
  await expect(currentChannel(page).getByRole("heading", { name: "Studio TV", exact: true })).toBeVisible();
  const root = page.locator(".ttv-premium-viewer-shell");
  const stage = page.getByRole("region", { name: "Live Tate's TV player", exact: true });
  const frame = page.locator(".ttv-premium-player-frame");
  const video = frame.locator("video");
  await expect(root).toHaveAttribute("data-mobile-layout", "true");
  await expect(video).toHaveJSProperty("currentSrc", new URL("/qa-media.webm", page.url()).href);
  await expect(video).toHaveJSProperty("muted", false);
  await expect(video).toHaveJSProperty("volume", 1);
  await video.evaluate((element) => element.setAttribute("data-test-player-identity", "original"));
  await page.locator(".ttv-player-shell").click({ position: { x: 10, y: 10 } });
  await expect(page.locator(".ttv-remote-launcher, .ttv-remote-panel")).toHaveCount(0);
  await expect(frame.getByRole("slider", { name: "Volume", exact: true })).toHaveCount(0);
  await expect(frame.locator(".ttv-player-controls").getByRole("button", { name: "Full", exact: true })).toHaveCount(0);
  await openMore(page);
  const more = page.getByRole("dialog", { name: "More from Tate's TV", exact: true });
  await more.getByRole("button", { name: /^Mini\b/ }).click();
  await more.getByRole("button", { name: "Close viewer controls", exact: true }).click();
  await expect(root).toHaveAttribute("data-player-mode", "mini");
  await page.setViewportSize({ width: 568, height: 320 });
  await expect(root).toHaveAttribute("data-mobile-landscape", "true");
  await expect(page.locator(".ttv-remote-launcher, .ttv-remote-panel")).toHaveCount(0);
  await expect(frame).toHaveCSS("position", "fixed");
  expect((await frame.boundingBox())!.width).toBeLessThan(568);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("navigation", { name: "Mobile viewer navigation" }).getByRole("button", { name: "Guide", exact: true }).click();
  const guide = page.getByRole("dialog", { name: "Live Guide", exact: true });
  await expect(frame).toHaveCSS("position", "relative");
  await expect(video).toHaveAttribute("data-test-player-identity", "original");
  await page.locator(".ttv-player-shell").click({ position: { x: 10, y: 10 } });
  const castButton = frame.getByRole("button", { name: "Watch on TV", exact: true });
  await castButton.click();
  const castDialog = page.getByRole("dialog", { name: "Watch on TV", exact: true });
  await expect(castDialog).toBeVisible();
  await castDialog.getByRole("button", { name: "Close Watch on TV", exact: true }).click();
  await expect(castDialog).toHaveCount(0);
  await expect(castButton).toBeFocused();
  await expect(guide).toBeVisible();
  await guide.getByRole("button", { name: "Close live guide", exact: true }).click();
  await expect(frame).toHaveCSS("position", "fixed");
  await expect(root).toHaveAttribute("data-player-mode", "mini");
  await page.locator(".ttv-player-shell").click({ position: { x: 10, y: 10 } });
  await openMore(page);
  await more.getByRole("button", { name: /^Normal\b/ }).click();
  await more.getByRole("button", { name: "Close viewer controls", exact: true }).click();
  await page.setViewportSize({ width: 568, height: 320 });
  await expect(root).toHaveAttribute("data-mobile-landscape", "true");
  await expect(stage).toBeVisible();
  await expect(stage).toHaveCSS("position", "fixed");
  await expect(frame).toHaveCSS("position", "relative");
  const landscape = (await frame.boundingBox())!;
  expect(Math.abs(landscape.x) + Math.abs(landscape.y)).toBeLessThan(2);
  expect(Math.abs(landscape.width - 568)).toBeLessThan(2);
  expect(Math.abs(landscape.height - 320)).toBeLessThan(2);
  await expect(video).toHaveAttribute("data-test-player-identity", "original");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(stage).not.toHaveCSS("position", "fixed");
  await expect(frame).toHaveCSS("position", "relative");
  await expect(root).toHaveAttribute("data-player-mode", "normal");
  await expect(video).toHaveAttribute("data-test-player-identity", "original");
});

test("TV picker survives delayed Cast startup, opens on the first tap and treats cancellation normally", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "television");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    // Protocol fixture only: this checks app behavior, not physical TV discovery.
    Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => "Android Samsung Chrome/140.0" });
    Object.defineProperty(HTMLVideoElement.prototype, "webkitShowPlaybackTargetPicker", { configurable: true, value: undefined });
    Object.defineProperty(HTMLVideoElement.prototype, "remote", { configurable: true, get: () => undefined });
    const state = { requests: 0, loads: 0, connected: false, stop: 0, options: {} as Record<string, unknown> };
    Object.assign(window, { ttvCastTest: state });
    window.addEventListener("ttv-test-cast-ready", () => {
      const listeners = new Set<() => void>();
      class RemotePlayer {
        isConnected = false;
        isMediaLoaded = false;
        isPaused = false;
        isMuted = false;
        canPause = true;
        canSeek = true;
        canControlVolume = true;
        volumeLevel = 0.5;
        currentTime = 10;
        duration = 120;
        playerState = "IDLE";
        title = "Studio TV";
      }
      const player = new RemotePlayer();
      const emit = () => listeners.forEach((listener) => listener());
      const session = {
        getCastDevice: () => ({ friendlyName: "Living Room Google TV" }),
        getMediaSession: () => null,
        loadMedia: async () => {
          state.loads += 1;
          player.isMediaLoaded = true;
          player.playerState = "PLAYING";
          emit();
        },
      };
      const context = {
        setOptions: (options: Record<string, unknown>) => { state.options = options; },
        getCastState: () => state.connected ? "CONNECTED" : "NOT_CONNECTED",
        getSessionState: () => state.connected ? "SESSION_STARTED" : "NO_SESSION",
        getCurrentSession: () => state.connected ? session : null,
        addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
        removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
        requestSession: async () => {
          state.requests += 1;
          if (state.requests === 1) throw { code: "cancel" };
          state.connected = true;
          player.isConnected = true;
          emit();
        },
        endCurrentSession: () => {
          state.stop += 1;
          state.connected = false;
          player.isConnected = false;
          player.isMediaLoaded = false;
          emit();
        },
      };
      class MediaInfo { constructor(public contentId: string, public contentType: string) {} }
      class QueueItem { constructor(public media: MediaInfo) {} }
      class LoadRequest { constructor(public media: MediaInfo) {} }
      const framework = {
        CastContext: { getInstance: () => context },
        CastContextEventType: { CAST_STATE_CHANGED: "cast", SESSION_STATE_CHANGED: "session" },
        RemotePlayerEventType: { ANY_CHANGE: "remote" },
        RemotePlayer: class { constructor() { return player; } },
        RemotePlayerController: class {
          addEventListener(_type: string, listener: () => void) { listeners.add(listener); }
          removeEventListener(_type: string, listener: () => void) { listeners.delete(listener); }
          playOrPause() { player.isPaused = !player.isPaused; emit(); }
          muteOrUnmute() { player.isMuted = !player.isMuted; emit(); }
          setVolumeLevel() { emit(); }
        },
      };
      const chromeCast = {
        AutoJoinPolicy: { PAGE_SCOPED: "page_scoped" },
        media: { DEFAULT_MEDIA_RECEIVER_APP_ID: "default", StreamType: { BUFFERED: "BUFFERED" },
          QueueType: { LIVE_TV: "LIVE_TV" }, RepeatMode: { OFF: "OFF" }, MediaInfo, QueueItem, LoadRequest,
          GenericMediaMetadata: class {}, QueueData: class {} },
      };
      Object.assign(window, { cast: { framework } });
      const castWindow = window as typeof window & { chrome?: object; __onGCastApiAvailable?: (available: boolean) => void };
      if (!castWindow.chrome) Object.assign(window, { chrome: {} });
      Object.assign(castWindow.chrome!, { cast: chromeCast });
      castWindow.__onGCastApiAvailable?.(true);
    }, { once: true });
  });
  await page.goto("/?ch=24");
  await expect(currentChannel(page).getByRole("heading", { name: "Studio TV", exact: true })).toBeVisible();
  const frame = page.locator(".ttv-premium-player-frame");
  const revealAndOpen = async () => {
    await frame.locator(".ttv-player-shell").click({ position: { x: 10, y: 10 } });
    await frame.getByRole("button", { name: "Watch on TV", exact: true }).click();
  };
  await revealAndOpen();
  const dialog = page.getByRole("dialog", { name: "Watch on TV", exact: true });
  await expect(dialog.getByText("Roku / Samsung Smart View", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Smart View", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /AirPlay/ })).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("ttv-test-cast-ready")));
  await expect(dialog.getByRole("button", { name: "Choose TV — Google Cast", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Close Watch on TV", exact: true }).click();
  await revealAndOpen();
  const readState = () => page.evaluate(() => (window as typeof window & { ttvCastTest: { requests: number; loads: number; stop: number; options: { autoJoinPolicy?: string } } }).ttvCastTest);
  await expect.poll(async () => (await readState()).requests).toBe(1);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Choose TV — Google Cast", exact: true }).click();
  await expect(dialog.getByText("Connected to Living Room Google TV", { exact: true })).toBeVisible();
  await expect.poll(async () => (await readState()).loads).toBeGreaterThan(0);
  expect((await readState()).options.autoJoinPolicy).toBe("page_scoped");
  await expect(dialog.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "Stop casting", exact: true }).click();
  await expect.poll(async () => (await readState()).stop).toBe(1);
  await expect(dialog.getByRole("button", { name: "Choose TV — Google Cast", exact: true })).toBeVisible();
  await noPageOverflow(page);
});
