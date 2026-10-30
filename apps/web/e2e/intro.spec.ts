import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("first launch shows the intro once, and Skip gets straight to the app", async ({ page }) => {
  await page.goto("/");
  const skip = page.getByRole("button", { name: "Skip intro" });
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(skip).toBeHidden();
  await expect(page.getByRole("heading", { name: "Where's home?" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Where's home?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeHidden();
});

test("the intro plays through on its own and reveals the app", async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeHidden({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Where's home?" })).toBeVisible();
});
