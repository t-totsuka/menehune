// Task 1.7: wireframe stage skin (1.1, 1.2, 1.4).
// With stage=wireframe every main element is grayscale (R=G=B), shadows are gone, [data-decor]
// is invisible, [data-figure] keeps its box but hides its content, and no element moves or resizes
// compared with stage=hifi.
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const pageUrl = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'components.html')).href;

/** OS appearance x explicit theme: covers the light block, both dark blocks and the light override. */
const THEMES = /** @type {const} */ ([
  { scheme: 'light', theme: 'system', label: 'light (OS)' },
  { scheme: 'dark', theme: 'system', label: 'dark (OS media query)' },
  { scheme: 'light', theme: 'dark', label: 'dark (data-theme)' },
  { scheme: 'dark', theme: 'light', label: 'light (data-theme over OS dark)' },
]);

const COLOR_TARGETS = [
  'body',
  'h1',
  'h2',
  'h3',
  'p',
  'a:not(.button)',
  '.button',
  'button',
  'button[data-variant="secondary"]',
  'button:disabled',
  'input[type="text"]',
  'select',
  'textarea',
  '.field-error',
  '.text-muted',
  '.l-surface',
  'fieldset',
];

/**
 * @param {import('@playwright/test').Page} page
 * @param {'light' | 'dark'} scheme
 * @param {string} stage
 * @param {string} theme
 */
async function open(page, scheme, stage, theme) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.goto(`${pageUrl}?stage=${stage}&theme=${theme}`);
  await expect(page.locator('html')).toHaveAttribute('data-stage', stage);
}

/** @param {import('@playwright/test').Page} page @param {string[]} selectors */
const computedColors = (page, selectors) => page.evaluate((sels) => {
  /** @type {{ selector: string, prop: string, value: string }[]} */
  const out = [];
  for (const sel of sels) {
    const els = document.querySelectorAll(sel);
    if (els.length === 0) out.push({ selector: sel, prop: 'missing', value: 'missing' });
    for (const el of els) {
      const s = getComputedStyle(el);
      for (const prop of ['color', 'background-color', 'border-top-color', 'border-right-color',
        'border-bottom-color', 'border-left-color', 'outline-color', 'accent-color', 'text-decoration-color']) {
        out.push({ selector: sel, prop, value: s.getPropertyValue(prop) });
      }
      out.push({ selector: sel, prop: 'box-shadow', value: s.boxShadow });
      out.push({ selector: sel, prop: 'background-image', value: s.backgroundImage });
    }
  }
  return out;
}, selectors);

/** @param {string} value */
function isGray(value) {
  if (value === 'auto') return true; // accent-color: auto follows the UA default.
  const m = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/);
  if (!m) return false;
  return m[1] === m[2] && m[2] === m[3];
}

/** @param {import('@playwright/test').Page} page */
const boxes = (page) => page.evaluate(() => [...document.querySelectorAll('body *')]
  .filter((el) => !(el instanceof HTMLScriptElement))
  .map((el, i) => {
    const r = el.getBoundingClientRect();
    return { i, tag: el.tagName, x: r.x, y: r.y, w: r.width, h: r.height };
  }));

for (const { scheme, theme, label } of THEMES) {
  test(`wireframe: main elements are grayscale with no shadows — ${label}`, async ({ page }) => {
    await open(page, scheme, 'wireframe', theme);
    const values = await computedColors(page, COLOR_TARGETS);
    const missing = values.filter((v) => v.prop === 'missing').map((v) => v.selector);
    expect(missing).toEqual([]);
    const colorViolations = values
      .filter((v) => v.prop !== 'box-shadow' && v.prop !== 'background-image' && !isGray(v.value))
      .map((v) => `${v.selector} ${v.prop}: ${v.value}`);
    expect(colorViolations).toEqual([]);
    const shadowViolations = values
      .filter((v) => (v.prop === 'box-shadow' || v.prop === 'background-image') && v.value !== 'none')
      .map((v) => `${v.selector} ${v.prop}: ${v.value}`);
    expect(shadowViolations).toEqual([]);
  });

  test(`wireframe: [data-decor] hidden, [data-figure] shows only a placeholder — ${label}`, async ({ page }) => {
    await open(page, scheme, 'hifi', theme);
    const decor = page.locator('[data-decor]');
    const figure = page.locator('[data-figure]');
    expect(await decor.count()).toBeGreaterThan(0);
    expect(await figure.count()).toBeGreaterThan(0);
    await expect(decor.first()).toBeVisible();
    const hifiFigureBox = await figure.first().boundingBox();
    const hifiContentVisible = await figure.first().evaluate((el) =>
      [...el.querySelectorAll('*')].some((c) => getComputedStyle(c).visibility === 'visible'));
    expect(hifiContentVisible).toBe(true);

    await open(page, scheme, 'wireframe', theme);
    for (const el of await decor.all()) await expect(el).toBeHidden();
    const fig = figure.first();
    expect(await fig.boundingBox()).toEqual(hifiFigureBox);
    const placeholder = await fig.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        visibility: s.visibility,
        contentVisible: [...el.querySelectorAll('*')].filter((c) => getComputedStyle(c).visibility !== 'hidden').length,
        outlineStyle: s.outlineStyle,
        outlineColor: s.outlineColor,
        backgroundColor: s.backgroundColor,
        diagonals: s.backgroundImage,
      };
    });
    expect(placeholder.visibility).toBe('visible');
    expect(placeholder.contentVisible).toBe(0);
    expect(placeholder.outlineStyle).toBe('solid');
    expect(isGray(placeholder.outlineColor)).toBe(true);
    expect(isGray(placeholder.backgroundColor)).toBe(true);
    // Two diagonal lines drawn as gradients in grayscale.
    expect((placeholder.diagonals.match(/linear-gradient/g) ?? []).length).toBe(2);
    const gradientColors = placeholder.diagonals.match(/rgba?\([^)]*\)/g) ?? [];
    expect(gradientColors.length).toBeGreaterThan(0);
    expect(gradientColors.filter((c) => !isGray(c))).toEqual([]);
  });

  test(`wireframe: element positions and sizes equal hifi — ${label}`, async ({ page }) => {
    await open(page, scheme, 'hifi', theme);
    const hifi = await boxes(page);
    await open(page, scheme, 'wireframe', theme);
    const wire = await boxes(page);
    expect(wire.length).toBe(hifi.length);
    expect(wire).toEqual(hifi);
  });
}

test('wireframe grays follow the theme (dark blocks are not overridden by the light grays)', async ({ page }) => {
  /** @type {string[]} */
  const bodies = [];
  for (const { scheme, theme } of THEMES) {
    await open(page, scheme, 'wireframe', theme);
    bodies.push(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));
  }
  const [lightOs, darkOs, darkManual, lightManual] = bodies;
  expect(darkOs).toBe(darkManual);
  expect(lightOs).toBe(lightManual);
  expect(darkOs).not.toBe(lightOs);
});

test('hifi stage keeps the colored tokens (wireframe skin is scoped)', async ({ page }) => {
  await open(page, 'light', 'hifi', 'system');
  const values = await computedColors(page, ['button:not([data-variant]):not(:disabled)']);
  const bg = values.find((v) => v.prop === 'background-color');
  expect(bg && isGray(bg.value)).toBe(false);
});
