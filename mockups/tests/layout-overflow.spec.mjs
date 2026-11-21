// Task 7.2: overflow and missing-message E2E (Requirements 11.1, 11.6, 12.2).
//
// Matrix: every screen in the registry x ja/en x light/dark x widths 360, 375, 768, 1440, 1920.
// One test per screen x lang x theme (60 tests, run in parallel); each test opens the screen
// fresh at each width (as a device of that width would) and checks, with soft assertions:
//   1. no page-level horizontal scroll (documentElement.scrollWidth <= clientWidth),
//   2. no text element overflows (detector in tests/helpers/layout-checks.mjs),
//   3. no missing-key marker ⟦key⟧ in text, attributes or the title, and no missing-key warning.
// A failing width saves a screenshot named after screen/lang/theme/width and attaches it, and
// the assertion message lists the offending elements.
//
// The detector itself is proved against tests/fixtures/overflow-fixture.html (cases it must and
// must not flag) and tests/fixtures/i18n-fixture.html (the only page with a missing key, 1.6).
import { test, expect } from '@playwright/test';
import { listScreens, screenPath, watchConsole, saveScreenshot } from './helpers/e2e.mjs';
import {
  collectLayoutIssues, collectMissingKeyMarkers, pageHorizontalOverflow,
} from './helpers/layout-checks.mjs';

const WIDTHS = [360, 375, 768, 1440, 1920];
const LANGS = ['ja', 'en'];
const THEMES = ['light', 'dark'];
const HEIGHT = 900;

/** @param {import('@playwright/test').Page} page */
const settle = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
}));

test.describe('detector (fixtures)', () => {
  test('flags every intentional overflow case and none of the look-alikes', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('tests/fixtures/overflow-fixture.html');
    const issues = await page.evaluate(collectLayoutIssues);
    const flagged = [...new Set(issues.map((i) => i.id || i.selector))].sort();
    expect(flagged).toEqual([
      'bad-ancestor-clip', 'bad-clip', 'bad-ellipsis', 'bad-escape', 'bad-svg',
    ]);
    const kinds = Object.fromEntries(issues.map((i) => [i.id, i.kind]));
    expect(kinds['bad-escape']).toBe('escapes-own-box');
    expect(kinds['bad-clip']).toBe('clipped-by-self');
    expect(kinds['bad-ellipsis']).toBe('clipped-by-self');
    expect(kinds['bad-ancestor-clip']).toBe('clipped-by-ancestor');
    expect(kinds['bad-svg']).toBe('outside-svg');
    // Each issue names the element and quotes its text so a failure report is actionable.
    expect(issues.find((i) => i.id === 'bad-ancestor-clip')?.selector)
      .toBe('div.narrow > span#bad-ancestor-clip');
    for (const i of issues) {
      expect(i.selector).not.toBe('');
      expect(i.text).not.toBe('');
    }
  });

  test('flags page-level horizontal scroll and text outside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 600 });
    await page.goto('tests/fixtures/overflow-fixture.html');
    expect(await page.evaluate(pageHorizontalOverflow)).toBe(0);
    await page.evaluate(() => {
      const p = document.createElement('p');
      p.id = 'bad-wide';
      p.style.width = '500px';
      p.textContent = 'A paragraph that is wider than the narrow viewport and spills to the right';
      document.body.append(p);
    });
    expect(await page.evaluate(pageHorizontalOverflow)).toBeGreaterThan(0);
    const issues = await page.evaluate(collectLayoutIssues);
    expect(issues.filter((i) => i.id === 'bad-wide').map((i) => i.kind)).toEqual(['outside-viewport']);
  });

  test('finds the missing-key markers in text and attributes', async ({ page }) => {
    await page.goto('tests/fixtures/i18n-fixture.html');
    const markers = await page.evaluate(collectMissingKeyMarkers);
    expect(markers).toEqual(expect.arrayContaining([
      expect.stringContaining('⟦missing.key⟧'),
      expect.stringContaining('aria-label="⟦missing.attr-key⟧"'),
    ]));
    expect(markers).toHaveLength(2);
  });
});

test.describe('screen matrix', () => {
  test.describe.configure({ mode: 'parallel' });

  for (const { id } of listScreens()) {
    for (const lang of LANGS) {
      for (const theme of THEMES) {
        test(`${id} ${lang} ${theme} @ ${WIDTHS.join('/')}px: no horizontal scroll, overflow or missing key`, async ({ page }, testInfo) => {
          const consoleIssues = watchConsole(page);
          for (const width of WIDTHS) {
            const label = `${id} ${lang} ${theme} ${width}px`;
            await test.step(label, async () => {
              consoleIssues.length = 0;
              await page.setViewportSize({ width, height: HEIGHT });
              await page.goto(screenPath(id, { lang, theme }));
              await expect(page.locator('html')).toHaveAttribute('lang', lang);
              await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
              await page.evaluate(() => document.fonts.ready);
              await settle(page);

              const scroll = await page.evaluate(pageHorizontalOverflow);
              const layout = await page.evaluate(collectLayoutIssues);
              const markers = await page.evaluate(collectMissingKeyMarkers);
              const missingWarnings = consoleIssues.filter((m) => m.includes('missing message key'));

              const failed = scroll > 0 || layout.length > 0 || markers.length > 0
                || missingWarnings.length > 0;
              if (failed) {
                await saveScreenshot(page, testInfo, `overflow-${id}-${lang}-${theme}-${width}`);
              }
              expect.soft(scroll, `${label}: page scrolls horizontally by ${scroll}px`).toBe(0);
              expect.soft(layout, `${label}: text elements overflow`).toEqual([]);
              expect.soft(markers, `${label}: missing-key markers`).toEqual([]);
              expect.soft(missingWarnings, `${label}: missing-key warnings`).toEqual([]);
            });
          }
        });
      }
    }
  }
});
