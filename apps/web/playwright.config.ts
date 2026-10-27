import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against a running app: local dev by default, or set E2E_BASE_URL to test the live site.
// They call the real Azure services, so they're run by hand (`pnpm --filter web e2e`), not in CI.
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 60_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", ...devices["Pixel 7"] },
});
