import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { withHome } from "./helpers";

// Every screen at phone size, in light and dark, against WCAG 2.1 A and AA.
const PAGES = ["/", "/map", "/sprout", "/alerts", "/profile", "/privacy", "/terms", "/communities/central-okanagan"];

for (const scheme of ["light", "dark"] as const) {
  for (const path of PAGES) {
    test(`${path} has no WCAG A/AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await withHome(page);
      await page.goto(path);
      if (path === "/map") {
        // Map tiles keep streaming, so wait for the layer counts instead of network idle.
        await page.locator('[aria-label="Map layers"] button', { hasText: /\d/ }).first().waitFor();
      } else {
        await page.waitForLoadState("networkidle");
      }
      await page.waitForTimeout(1500);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .exclude(".atlas-map") // third-party map canvas; its controls are Microsoft's
        .analyze();
      const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× e.g. ${v.nodes[0]?.target.join(" ")}`);
      expect(summary, summary.join("\n")).toEqual([]);
    });
  }
}
