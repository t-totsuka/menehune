// Task 1.6: I18nRuntime applied to the DOM on components.html: ?lang=en, switching via
// MockState.update without reload, data-i18n-attr, data-i18n-date, and the missing-key marker
// on a test fixture (11.1, 11.2, 11.7).
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const catalogUrl = pathToFileURL(join(here, '..', 'components.html')).href;
const fixtureUrl = pathToFileURL(join(here, 'fixtures', 'i18n-fixture.html')).href;

test('?lang=en shows English copy, aria-label and dates on the catalog page', async ({ page }) => {
  await page.goto(`${catalogUrl}?lang=en`);
  await expect(page.locator('#i18n-title')).toHaveText('Monthly Calendar');
  await expect(page.locator('#i18n-count')).toHaveText('3 items');
  await expect(page.locator('#i18n-close')).toHaveAttribute('aria-label', 'Close');
  await expect(page.locator('#i18n-close')).toHaveAttribute('title', 'Close');
  await expect(page.locator('#i18n-date-long')).toHaveText('Mon, Nov 16, 2026');
  await expect(page.locator('#i18n-time')).toHaveText('18:42');
  await expect(page.locator('#i18n-datetime')).toHaveText('Mon, Nov 16, 2026, 18:42');
  await expect(page.locator('#i18n-month-year')).toHaveText('November 2026');
});

test('default (ja) shows Japanese copy and Japanese date formats', async ({ page }) => {
  await page.goto(catalogUrl);
  await expect(page.locator('#i18n-title')).toHaveText('月のカレンダー');
  await expect(page.locator('#i18n-count')).toHaveText('3件');
  await expect(page.locator('#i18n-close')).toHaveAttribute('aria-label', '閉じる');
  await expect(page.locator('#i18n-date-long')).toHaveText('2026年11月16日(月)');
  await expect(page.locator('#i18n-date-short')).toHaveText('11月16日(月)');
  await expect(page.locator('#i18n-weekday')).toHaveText('月');
  await expect(page.locator('#i18n-datetime')).toHaveText('2026年11月16日(月) 18:42');
});

test('MockState.update({lang}) switches copy, attributes and dates without reload', async ({ page }) => {
  await page.goto(`${catalogUrl}?lang=en`);
  await expect(page.locator('#i18n-title')).toHaveText('Monthly Calendar');
  await page.evaluate(() => { window.__marker = 'same-document'; });
  await page.evaluate(() => window.MockState.update({ lang: 'ja' }));
  await expect(page.locator('#i18n-title')).toHaveText('月のカレンダー');
  await expect(page.locator('#i18n-close')).toHaveAttribute('aria-label', '閉じる');
  await expect(page.locator('#i18n-date-long')).toHaveText('2026年11月16日(月)');
  expect(await page.evaluate(() => window.__marker)).toBe('same-document');
  await page.evaluate(() => window.MockState.update({ lang: 'en' }));
  await expect(page.locator('#i18n-close')).toHaveAttribute('aria-label', 'Close');
  await expect(page.locator('#i18n-weekday')).toHaveText('Mon');
});

test('catalog page contains no missing-key marker in either language', async ({ page }) => {
  for (const lang of ['ja', 'en']) {
    await page.goto(`${catalogUrl}?lang=${lang}`);
    await expect(page.locator('#i18n-title')).not.toBeEmpty();
    expect(await page.evaluate(() => document.body.innerHTML.includes('⟦'))).toBe(false);
  }
});

test('fixture: a missing key renders ⟦key⟧ (text and attribute) and warns on the console', async ({ page }) => {
  const warnings = [];
  page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
  await page.goto(fixtureUrl);
  await expect(page.locator('#missing')).toHaveText('⟦missing.key⟧');
  await expect(page.locator('#missing-attr')).toHaveAttribute('aria-label', '⟦missing.attr-key⟧');
  await expect(page.locator('#known')).toHaveText('閉じる');
  expect(warnings.some((w) => w.includes('missing.key'))).toBe(true);
});
