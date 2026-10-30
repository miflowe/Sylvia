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

test("the head script applies a saved theme and hides the seen intro before the app loads", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem("sylvia.theme", "dark");
    localStorage.setItem("sylvia.welcomed", "1");
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const root = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, welcomed: document.documentElement.classList.contains("welcomed") }));
  expect(root).toEqual({ theme: "dark", welcomed: true });
  expect(errors).toEqual([]);
});
