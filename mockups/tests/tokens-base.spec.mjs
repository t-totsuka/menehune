// Task 1.2: theme tokens follow the OS appearance / data-theme, and keyboard focus is visible (9.2, 9.3, 13.5).
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const page_url = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'components.html')).href;

/** @param {import('@playwright/test').Page} page */
const bg = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim());
/** @param {import('@playwright/test').Page} page */
const bodyBg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function open(page, scheme, theme) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(page_url);
  if (theme) await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
}

test('OS dark appearance gives dark tokens; data-theme overrides it', async ({ page }) => {
  await open(page, 'light');
  const light = await bg(page);
  const lightBody = await bodyBg(page);
  expect(light).not.toBe('');

  await open(page, 'dark');
  const dark = await bg(page);
  expect(dark).not.toBe('');
  expect(dark).not.toBe(light);
  expect(await bodyBg(page)).not.toBe(lightBody);

  await open(page, 'dark', 'light');
  expect(await bg(page)).toBe(light);

  await open(page, 'light', 'dark');
  expect(await bg(page)).toBe(dark);
});

for (const scheme of /** @type {const} */ (['light', 'dark'])) {
  test(`Tab focus shows an outline (${scheme})`, async ({ page }) => {
    await open(page, scheme);
    // Task 6.1: the catalog nav (review chrome with its own literal focus ring, see
    // catalog-nav.spec.mjs) comes first; tab past it to the first product control.
    await page.keyboard.press('Tab');
    for (let i = 0; i < 20 && await page.evaluate(() => !!document.activeElement?.closest('.mk-catalog-nav')); i++) {
      await page.keyboard.press('Tab');
    }
    const outline = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const probe = document.createElement('span');
      probe.style.color = 'var(--color-focus)';
      document.body.append(probe);
      const focus = getComputedStyle(probe).color;
      probe.remove();
      return { width: parseFloat(s.outlineWidth), style: s.outlineStyle, color: s.outlineColor, focus };
    });
    expect(outline).not.toBeNull();
    expect(outline?.width ?? 0).toBeGreaterThan(0);
    expect(outline?.style).not.toBe('none');
    // The ring must come from base.css (--color-focus), not the browser default.
    expect(outline?.focus).not.toBe('');
    expect(outline?.color).toBe(outline?.focus);
  });
}
