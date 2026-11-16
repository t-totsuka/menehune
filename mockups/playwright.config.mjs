// Minimal Playwright config (task 1.2). Task 7.1 owns the final configuration.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.mjs',
  use: { ...devices['Desktop Chrome'] },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
