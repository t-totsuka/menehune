// Task 7.1: E2E smoke suite. Opens every screen from the registry via file:// (baseURL in
// playwright.config.mjs), blocks and records every non-file request, treats console errors and
// warnings as failures, and saves a screenshot per screen to mockups/.review/screenshots/.
// Tasks 7.2 and 7.3 build on the shared helpers in tests/helpers/e2e.mjs.
import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import {
  listScreens, screenPath, blockExternalRequests, watchConsole, saveScreenshot,
} from './helpers/e2e.mjs';

const screens = listScreens();

test('the registry enumerates all 15 screens', () => {
  expect(screens.map((s) => s.id)).toHaveLength(15);
  expect(new Set(screens.map((s) => s.id)).size).toBe(15);
});

test('the request guard aborts and records non-file requests', async ({ page }) => {
  const external = await blockExternalRequests(page);
  await page.goto(screenPath('top'));
  const loaded = await page.evaluate(() => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = 'https://example.invalid/probe.png';
  }));
  expect(loaded).toBe(false);
  expect(external).toEqual(['https://example.invalid/probe.png']);
});

for (const { id } of screens) {
  test(`screens/${id}.html opens and renders offline`, async ({ page }, testInfo) => {
    const external = await blockExternalRequests(page);
    const consoleIssues = watchConsole(page);

    await page.goto(screenPath(id));
    await expect(page.locator('body')).toHaveAttribute('data-screen-id', id);
    await expect(page.locator('main h1')).toBeVisible();

    const file = await saveScreenshot(page, testInfo, `smoke-${id}`);
    expect(existsSync(file)).toBe(true);

    expect(external).toEqual([]);
    expect(consoleIssues).toEqual([]);
  });
}
