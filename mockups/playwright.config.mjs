// Playwright config (task 7.1). The mockups are opened directly via file:// — no web server.
// baseURL is the mockups directory as a file:// URL, so tests can call page.goto('screens/top.html').
// Shared helpers (registry enumeration, request blocking, screenshots) are in tests/helpers/e2e.mjs.
// Run from a C:\ path (PowerShell / cmd): from Git Bash (/c/...) the drive-letter case differs and
// some file:// URL comparisons fail.
import { defineConfig, devices } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests',
  // Browser specs only; tests/unit/*.test.mjs run with node --test, helpers have no .spec suffix.
  testMatch: '*.spec.mjs',
  outputDir: './test-results',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: pathToFileURL(`${root}/`).href,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
