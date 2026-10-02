import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8790",
    reducedMotion: "reduce",
    headless: true,
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/test-server.mjs",
    url: "http://localhost:8790/api/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
