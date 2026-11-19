// Task 4.6: mk-precision-picker and mk-map-sample (6.2, 7.1, 7.2, 8.2, 13.4).
// - mk-precision-picker: a real radio group (fieldset + legend) with the five LocationPrecision
//   levels in order; each radio has a label and an aria-describedby description of how others
//   see the post. `value` sets the initial choice (none checked without it). The choice lives in
//   the component and survives re-renders (language switch). Keyboard focus is visible in both
//   themes.
// - mk-map-sample: schematic inline SVG map. exact -> pin; fuzzed-1km -> 1 km radius circle (no
//   pin); municipality / prefecture / country -> shaded area with a different zoom. data-figure
//   sits on the non-focusable wrapper; the <svg> has role="img" and an aria-label (describe())
//   naming the region (Japanese free text, also in English). `region` overrides the region name;
//   without it the first sample post with that precision gives it.
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const catalogUrl = pathToFileURL(join(root, 'components.html')).href;

const load = (/** @type {string[]} */ ...files) => {
  const window = /** @type {Record<string, any>} */ ({});
  const ctx = vm.createContext({ window });
  for (const f of files) vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });
  return window;
};
const w = load('data/sample-data.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;
/** @type {SamplePost[]} */
const posts = w.MockSample.posts;

const PRECISIONS = /** @type {const} */ (['exact', 'fuzzed-1km', 'municipality', 'prefecture', 'country']);
const ZOOMS = { exact: 'street', 'fuzzed-1km': 'district', municipality: 'city', prefecture: 'prefecture', country: 'country' };
/** @param {string} precision */
const regionOf = (precision) => /** @type {string} */ (posts.find((p) => p.location?.precision === precision)?.location?.regionLabel);

/** @param {import('@playwright/test').Page} page */
const collectProblems = (page) => {
  /** @type {string[]} */
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  return problems;
};

/** @param {import('@playwright/test').Page} page @param {number} width @param {string} [query] */
const open = async (page, width, query = '') => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${catalogUrl}${query}`);
};

test.describe('mk-precision-picker', () => {
  test('a fieldset radio group with a legend and the five levels in order, each with a description', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440);
    const picker = page.locator('#precision-default');
    const fieldset = picker.locator('fieldset');
    await expect(fieldset).toHaveCount(1);
    await expect(fieldset.locator('> legend')).toHaveText(ja['location.label']);
    const group = page.getByRole('group', { name: ja['location.label'] }).filter({ has: page.locator('[value="exact"]') }).first();
    await expect(group).toBeVisible();
    const radios = picker.locator('input[type="radio"]');
    await expect(radios).toHaveCount(5);
    expect(await radios.evaluateAll((els) => els.map((e) => /** @type {HTMLInputElement} */ (e).value))).toEqual([...PRECISIONS]);
    const names = await radios.evaluateAll((els) => [...new Set(els.map((e) => /** @type {HTMLInputElement} */ (e).name))]);
    expect(names).toHaveLength(1);
    expect(names[0]).not.toBe('');
    for (const p of PRECISIONS) {
      const radio = picker.getByRole('radio', { name: ja[`location.precision.${p}`], exact: true });
      await expect(radio).toHaveCount(1);
      await expect(radio).toHaveAccessibleDescription(ja[`location.precision.${p}.description`]);
      await expect(picker.locator(`[data-precision="${p}"]`)).toContainText(ja[`location.precision.${p}.description`]);
    }
    expect(problems).toEqual([]);
  });

  test('without value nothing is checked; value checks that level', async ({ page }) => {
    await open(page, 1440);
    await expect(page.locator('#precision-default input:checked')).toHaveCount(0);
    await expect(page.locator('#precision-municipality input:checked')).toHaveValue('municipality');
  });

  test('two pickers use distinct radio names and ids', async ({ page }) => {
    await open(page, 1440);
    const nameA = await page.locator('#precision-default input[type="radio"]').first().getAttribute('name');
    const nameB = await page.locator('#precision-municipality input[type="radio"]').first().getAttribute('name');
    expect(nameA).not.toBe(nameB);
    const ids = await page.locator('mk-precision-picker [id]').evaluateAll((els) => els.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('keyboard selection works and the choice survives a language switch', async ({ page }) => {
    await open(page, 1440);
    const picker = page.locator('#precision-municipality');
    await picker.locator('input[value="municipality"]').focus();
    await page.keyboard.press('ArrowDown');
    await expect(picker.locator('input:checked')).toHaveValue('prefecture');
    await expect(picker.locator('input[value="prefecture"]')).toBeFocused();
    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    await expect(picker.locator('legend')).toHaveText(en['location.label']);
    await expect(picker.locator('input:checked')).toHaveValue('prefecture');
    await expect(picker.locator('input[value="prefecture"]')).toBeFocused();
    await expect(picker.getByRole('radio', { name: en['location.precision.prefecture'], exact: true }))
      .toHaveAccessibleDescription(en['location.precision.prefecture.description']);
  });

  test('changing the value attribute resets the choice', async ({ page }) => {
    await open(page, 1440);
    const picker = page.locator('#precision-municipality');
    await picker.locator('input[value="country"]').check();
    await picker.evaluate((el) => el.setAttribute('value', 'exact'));
    await expect(picker.locator('input:checked')).toHaveValue('exact');
  });

  for (const theme of ['light', 'dark']) {
    test(`keyboard focus is visible on a radio (${theme})`, async ({ page }) => {
      await open(page, 1440, `?theme=${theme}`);
      const radio = page.locator('#precision-default input[value="exact"]');
      await radio.focus();
      await page.keyboard.press('ArrowDown');
      const focused = page.locator('#precision-default input[value="fuzzed-1km"]');
      await expect(focused).toBeFocused();
      const style = await focused.evaluate((el) => {
        const s = getComputedStyle(el);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
      });
      expect(style.style).toBe('solid');
      expect(style.width).toBeGreaterThan(0);
    });
  }
});

test.describe('mk-map-sample', () => {
  test('each precision draws a different map: pin, 1 km circle or a shaded area, with its zoom', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440);
    /** @type {string[]} */
    const drawings = [];
    for (const p of PRECISIONS) {
      const map = page.locator(`#map-${p}`);
      const svg = map.locator('svg.mk-map__svg');
      await expect(svg).toHaveCount(1);
      await expect(svg).toHaveAttribute('data-zoom', ZOOMS[p]);
      await expect(svg.locator('[data-mark="pin"]')).toHaveCount(p === 'exact' ? 1 : 0);
      await expect(svg.locator('[data-mark="radius"]')).toHaveCount(p === 'fuzzed-1km' ? 1 : 0);
      const shaded = ['municipality', 'prefecture', 'country'].includes(p);
      expect(await svg.locator('[data-mark="region"]').count() > 0).toBe(shaded);
      drawings.push(await svg.evaluate((el) => el.innerHTML));
    }
    expect(new Set(drawings).size).toBe(PRECISIONS.length);
    expect(problems).toEqual([]);
  });

  test('the 1 km circle radius equals the 1 km scale bar', async ({ page }) => {
    await open(page, 1440);
    const svg = page.locator('#map-fuzzed-1km svg');
    const r = Number(await svg.locator('[data-mark="radius"]').getAttribute('r'));
    const bar = await svg.locator('.mk-map__scale-bar').evaluate((el) => {
      const l = /** @type {SVGLineElement} */ (el);
      return Math.abs(l.x2.baseVal.value - l.x1.baseVal.value);
    });
    expect(r).toBeGreaterThan(0);
    expect(bar).toBeCloseTo(r, 5);
    await expect(svg.locator('.mk-map__scale-label')).toHaveText('1 km');
  });

  test('svg has role=img and an aria-label naming the region; the caption shows region and precision', async ({ page }) => {
    await open(page, 1440);
    for (const p of PRECISIONS) {
      const svg = page.locator(`#map-${p} svg`);
      await expect(svg).toHaveAttribute('role', 'img');
      const label = /** @type {string} */ (await svg.getAttribute('aria-label'));
      expect(label).toBe(ja[`map.describe.${p}`].replaceAll('{region}', regionOf(p)));
      await expect(page.locator(`#map-${p} .mk-map__caption`)).toContainText(regionOf(p));
      await expect(page.locator(`#map-${p} .mk-map__caption`)).toContainText(ja[`location.precision.${p}`]);
    }
  });

  test('aria-label follows the language; the region name stays Japanese', async ({ page }) => {
    await open(page, 1440, '?lang=en');
    const label = await page.locator('#map-exact svg').getAttribute('aria-label');
    expect(label).toBe(en['map.describe.exact'].replaceAll('{region}', regionOf('exact')));
    await page.evaluate(() => window.MockState.update({ lang: 'ja' }));
    await expect(page.locator('#map-exact svg')).toHaveAttribute('aria-label', ja['map.describe.exact'].replaceAll('{region}', regionOf('exact')));
  });

  test('region overrides the region name', async ({ page }) => {
    await open(page, 1440);
    const svg = page.locator('#map-region svg');
    await expect(svg).toHaveAttribute('aria-label', ja['map.describe.municipality'].replaceAll('{region}', '千葉県 船橋市'));
  });

  // Task 8.1 (star chart): subject="observer" says the map shows the observing location of the
  // star chart (caption and alt text); without it the map is unchanged (the posted place).
  test('subject="observer" names the observing location in the caption and the alt text', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440, '?lang=ja');
    const map = page.locator('#map-observer');
    const base = ja['map.describe.municipality'].replaceAll('{region}', '東京都 三鷹市');
    await expect(map.locator('svg')).toHaveAttribute('aria-label', ja['map.describe.observer'].replace('{map}', base));
    await expect(map.locator('.mk-map__caption')).toHaveText(ja['map.caption.observer'].replace('{region}', '東京都 三鷹市'));
    await expect(map.locator('svg')).toHaveAttribute('data-zoom', 'city');
    // exact: the pin marks the observing location, not a posted spot
    await map.evaluate((el) => el.setAttribute('precision', 'exact'));
    await expect(map.locator('svg')).toHaveAttribute('aria-label',
      ja['map.describe.observer'].replace('{map}', ja['map.describe.observer.exact'].replaceAll('{region}', '東京都 三鷹市')));
    await expect(map.locator('[data-mark="pin"]')).toHaveCount(1);
    // without the attribute: the default caption and alt text
    await map.evaluate((el) => el.removeAttribute('subject'));
    await expect(map.locator('svg')).toHaveAttribute('aria-label', ja['map.describe.exact'].replaceAll('{region}', '東京都 三鷹市'));
    await expect(map.locator('.mk-map__caption')).toHaveText(ja['map.caption'].replace('{region}', '東京都 三鷹市').replace('{precision}', ja['location.precision.exact']));
    expect(problems).toEqual([]);
  });

  test('changing precision re-renders the map', async ({ page }) => {
    await open(page, 1440);
    const map = page.locator('#map-region');
    await map.evaluate((el) => el.setAttribute('precision', 'exact'));
    await expect(map.locator('svg')).toHaveAttribute('data-zoom', 'street');
    await expect(map.locator('[data-mark="pin"]')).toHaveCount(1);
  });

  test('theme switch changes the map colors', async ({ page }) => {
    await open(page, 1440, '?theme=light');
    const colors = () => page.locator('#map-municipality svg').evaluate((svg) => {
      const land = svg.querySelector('.mk-map__land');
      const region = svg.querySelector('[data-mark="region"]');
      return { land: land ? getComputedStyle(land).fill : '', region: region ? getComputedStyle(region).stroke : '' };
    });
    const light = await colors();
    expect(light.land).not.toBe('');
    expect(light.region).not.toBe('');
    await open(page, 1440, '?theme=dark');
    const dark = await colors();
    expect(dark.land).not.toBe(light.land);
    expect(dark.region).not.toBe(light.region);
  });

  test('wireframe: placeholder on the non-focusable wrapper with the same box as hi-fi', async ({ page }) => {
    await open(page, 1440, '?stage=hifi');
    const figure = page.locator('#map-exact [data-figure]');
    await expect(figure).toHaveCount(1);
    expect(await figure.evaluate((el) => el.tabIndex < 0 && !el.matches('a, button, input, select, textarea, [tabindex]'))).toBe(true);
    const hifiBox = await figure.boundingBox();
    await open(page, 1440, '?stage=wireframe');
    expect(await figure.boundingBox()).toEqual(hifiBox);
    const visibleChildren = await figure.evaluate((el) =>
      [...el.querySelectorAll('*')].filter((c) => getComputedStyle(c).visibility !== 'hidden').length);
    expect(visibleChildren).toBe(0);
    expect(await figure.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');
  });

  for (const width of [375, 1440]) {
    test(`${width}px: maps and pickers fit and the page does not scroll sideways`, async ({ page }) => {
      await open(page, width);
      for (const p of PRECISIONS) {
        const box = await page.locator(`#map-${p} svg`).boundingBox();
        expect(box).not.toBeNull();
        expect(/** @type {{ x: number, width: number }} */ (box).x).toBeGreaterThanOrEqual(0);
        expect(/** @type {{ x: number, width: number }} */ (box).x + /** @type {{ width: number }} */ (box).width).toBeLessThanOrEqual(width);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('unknown precision shows the missing-sample error', async ({ page }) => {
    await open(page, 1440);
    await expect(page.locator('#map-missing [data-missing-sample="unknown"]')).toHaveCount(1);
  });
});
