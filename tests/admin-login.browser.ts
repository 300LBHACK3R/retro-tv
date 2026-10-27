import { test, expect } from "@playwright/test";

test("separate admin login submits credentials, rejects a parent, and opens only after staff authorization", async ({ page }) => {
  let isStaff = false;
  let submitted: Record<string, string> | null = null;
  await page.route("**/api/admin/session", route => route.fulfill({ json: { ok: true, isAdmin: false } }));
  await page.route("**/api/admin/login", async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: isStaff ? 200 : 401, json: isStaff ? { ok: true } : { ok: false, error: "Unable to sign in with these admin credentials." } });
  });
  await page.route("**/api/admin/programming", route => route.fulfill({ status: 503, json: { error: "Test unavailable" } }));
  await page.goto("/admin");
  await page.getByLabel("Admin email", { exact: true }).fill("staff@example.test");
  await page.getByLabel("Admin Password", { exact: true }).fill("a unique test password");
  await page.getByRole("button", { name: "Open Admin", exact: true }).click();
  await expect(page.getByText("Unable to sign in with these admin credentials.", { exact: true })).toBeVisible();
  expect(submitted).toEqual({ email: "staff@example.test", password: "a unique test password" });
  isStaff = true;
  await page.getByRole("button", { name: "Open Admin", exact: true }).click();
  await expect(page.getByLabel("Find an admin tool", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Admin email", { exact: true })).toHaveCount(0);
});
