import { test, expect } from "@playwright/test";

test("password-only admin login rejects incorrect credentials and opens after authorization", async ({ page }) => {
  let isStaff = false;
  let submitted: Record<string, string> | null = null;
  await page.route("**/api/admin/session", route => route.fulfill({ json: { ok: true, isAdmin: false } }));
  await page.route("**/api/admin/login", async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: isStaff ? 200 : 401, json: isStaff ? { ok: true } : { ok: false, error: "Unable to sign in with these admin credentials." } });
  });
  await page.route("**/api/admin/programming", route => route.fulfill({ status: 503, json: { error: "Test unavailable" } }));
  await page.route("**/api/programming", route => route.fulfill({ status: 503, json: { error: "Test unavailable" } }));
  await page.goto("/admin");
  await expect(page.getByLabel("Admin email", { exact: true })).toHaveCount(0);
  await expect(page.locator(".ttv-global-sync-status")).toHaveCount(0);
  await page.getByLabel("Admin Password", { exact: true }).fill("a unique test password");
  await page.getByRole("button", { name: "Open Admin", exact: true }).click();
  await expect(page.getByText("Unable to sign in with these admin credentials.", { exact: true })).toBeVisible();
  expect(submitted).toEqual({ password: "a unique test password" });
  isStaff = true;
  await page.getByRole("button", { name: "Open Admin", exact: true }).click();
  await expect(page.getByLabel("Find an admin tool", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Admin email", { exact: true })).toHaveCount(0);
});

test("admin request inbox filters suggestions and saves member replies separately from private notes", async ({ page }) => {
  const item = { id: "11111111-1111-4111-8111-111111111111", user_id: "22222222-2222-4222-8222-222222222222", title: "The Test Show", release_year: 1996, seasons: "Season 1", details: "Original version", status: "requested", member_reply: "", admin_notes: "", created_at: "2026-10-28T12:00:00Z", updated_at: "2026-10-28T12:00:00Z" };
  let saved = false;
  await page.route("**/api/admin/session", route => route.fulfill({ json: { ok: true, isAdmin: true } }));
  await page.route("**/api/admin/programming", route => route.fulfill({ status: 503, json: { error: "Test unavailable" } }));
  await page.route("**/api/programming", route => route.fulfill({ status: 503, json: { error: "Test unavailable" } }));
  await page.route("**/api/admin/show-requests?*", route => route.fulfill({ json: { requests: [item], total: 1, page: 0 } }));
  await page.route("**/api/admin/show-requests", async route => {
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().postDataJSON()).toMatchObject({ id: item.id, status: "reviewing", memberReply: "Checking availability", adminNotes: "Private follow-up" });
    saved = true;
    Object.assign(item, { status: "reviewing", member_reply: "Checking availability", admin_notes: "Private follow-up", updated_at: "2026-10-28T13:00:00Z" });
    await route.fulfill({ json: { request: item } });
  });
  await page.goto("/admin");
  await page.getByLabel("Find an admin tool", { exact: true }).fill("Show Requests");
  await page.getByRole("button", { name: "Show Requests", exact: true }).click();
  const panel = page.getByRole("region", { name: "Show Requests", exact: true });
  await expect(panel.getByRole("heading", { name: "The Test Show (1996)" })).toBeVisible();
  await panel.getByLabel("Search show titles").fill("Test");
  await panel.getByRole("button", { name: "Apply filters" }).click();
  await expect(panel.getByText("1 request in this view", { exact: true })).toBeVisible();
  await panel.getByText("Review request", { exact: true }).click();
  await panel.getByLabel("Status", { exact: true }).selectOption("reviewing");
  await panel.getByLabel("Reply visible to this member").fill("Checking availability");
  await panel.getByLabel("Private admin notes").fill("Private follow-up");
  await panel.getByRole("button", { name: "Save request update", exact: true }).click();
  await expect(panel.getByText("Saved. The member can now see the status and your reply in their account.")).toBeVisible();
  await expect(panel.getByText("Under review", { exact: true })).toBeVisible();
  expect(saved).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
