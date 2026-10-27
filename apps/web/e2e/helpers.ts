import type { Page } from "@playwright/test";

export const KAMLOOPS = { name: "Kamloops, BC", lat: 50.67, lon: -120.33, regionCode: "CA-BC" };

/** Sets the saved home place (and a fresh device) before the app loads. */
export async function withHome(page: Page, place = KAMLOOPS) {
  await page.addInitScript((p) => {
    localStorage.setItem("sylvia.place", JSON.stringify(p));
    localStorage.setItem("sylvia.region", JSON.stringify(p.regionCode));
  }, place);
}
