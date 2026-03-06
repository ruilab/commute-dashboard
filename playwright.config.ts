import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined // Use existing server (production testing)
    : {
        command: "bun run dev",
        port: 3000,
        reuseExistingServer: true,
        timeout: 30000,
      },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
