import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { withHome } from "./helpers";

// Playwright runs from apps/web.
const fixture = (name: string) => join(process.cwd(), "test-fixtures", name);

test("first visit asks where home is, then shows conditions", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Where's home?" })).toBeVisible();
  await page.getByPlaceholder(/Kenora, Kamloops/).fill("Kamloops");
  await page.getByRole("button", { name: /Kamloops/ }).first().click();
  await expect(page.getByText("Official fire danger")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Air quality" })).toBeVisible();
  await expect(page.getByText(/adds to official alerts/)).toBeVisible();
});

test("map loads layers with counts", async ({ page }) => {
  await withHome(page);
  await page.goto("/map");
  await expect(page.locator('[aria-label="Map layers"] button', { hasText: /Fire areas\s*\d+/ })).toBeVisible();
});

test("Sprout flags Japanese barberry as invasive in Ontario, offers swaps, and saves to My plants", async ({ page }) => {
  await page.goto("/sprout");
  await page.getByRole("radio", { name: "Ontario" }).click();
  await page.locator("#sprout-photo").setInputFiles(fixture("barberry.jpg"));
  await expect(page.getByRole("heading", { name: "Japanese barberry" })).toBeVisible();
  await expect(page.getByText("Invasive in Ontario")).toBeVisible();
  await expect(page.getByText("Recommended swap")).toBeVisible();
  await expect(page.getByText(/fireproof/i)).toHaveCount(0);

  await page.getByRole("button", { name: "Save to My plants" }).click();
  await expect(page.getByRole("button", { name: "Saved to My plants" })).toBeVisible();
  await page.goto("/profile");
  const item = page.locator("li", { hasText: "Japanese barberry" });
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: /Remove/ }).click();
  await expect(item).toHaveCount(0);
});

test("Sprout says when a photo isn't a plant", async ({ page }) => {
  await page.goto("/sprout");
  await page.locator("#sprout-photo").setInputFiles(fixture("not-a-plant.jpg"));
  await expect(page.getByText("I don't see a plant in that photo.")).toBeVisible();
});

test("Replay walks from an unverified advisory to a relayed official order", async ({ page }) => {
  await withHome(page);
  await page.goto("/alerts");
  await page.getByRole("button", { name: "Start replay" }).click();
  for (let i = 0; i < 5; i++) {
    const next = page.getByRole("button", { name: "Next moment" });
    await expect(next).toBeEnabled();
    await next.click();
  }
  await expect(page.getByRole("button", { name: "Replay finished" })).toBeVisible();
  const history = page.locator("section", { has: page.getByRole("heading", { name: "Alert history" }) });
  await expect(history.getByText("Level 3 · Official order")).toBeVisible();
  await expect(history.getByText("Level 2 · Official alert")).toBeVisible();
  await expect(history.getByText("Level 1 · Advisory · Unverified")).toBeVisible();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText(/Removed 3 replay alerts/)).toBeVisible();
});

test("checklist saves and survives a reload", async ({ page }) => {
  await withHome(page);
  await page.goto("/profile");
  const box = page.getByLabel(/Roof and gutters are clear/);
  await box.check();
  await expect(page.getByText(/1 of 15 done · Saved/)).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/Roof and gutters are clear/)).toBeChecked();
  await page.getByLabel(/Roof and gutters are clear/).uncheck();
  await expect(page.getByText(/0 of 15 done · Saved/)).toBeVisible();
});

test("community page hides small groups and labels sample data", async ({ page }) => {
  await page.goto("/communities/central-okanagan");
  await expect(page.getByText(/Groups smaller than 5 are hidden/)).toBeVisible();
  await page.getByLabel("Show sample data (for demos)").check();
  await expect(page.getByText(/Sample data · made-up numbers/)).toBeVisible();
});
