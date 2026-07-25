import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against the production build served by `next start`, never the dev
 * server. A parent arrives on the prerendered, optimised page — a bug that only shows up
 * after `next build` (a prerender failure, a missing env at build time) must be catchable
 * here, so the test exercises the same artefact Netlify publishes.
 *
 * `next start` needs a build to exist. CI runs `npm run build` as its own step before the
 * e2e step; locally, run `npm run build` first (or `npm run test:e2e` after a build).
 *
 * The server runs on 3100, not the default 3000, so it never reuses a `next dev` from
 * another project that happens to be squatting on 3000 — which would silently test the
 * wrong app.
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],

  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
