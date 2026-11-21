// Final-validation remediation (requirement 5.2, also 5.3, 5.4, 5.5, 13.3, 13.4): how the sun is
// drawn on the star chart.
// - The sun has its own mark (a disc with short rays), distinct from the planets' diamond and the
//   moon's plain circle, and its name (太陽 / Sun) next to it.
// - The daytime sample (MockSample.starChartDaytime, 2026-11-16 12:00 JST, the same observer) is
//   shown by mk-star-chart sample="daytime" and, on the star-chart screen, by the scenario
//   `daytime`. In daytime the stars stay as a pale reference with a visible note (also in the alt
//   text). The default view (20:00, the approved wireframe) still draws no sun.
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const catalogUrl = pathToFileURL(join(root, 'components.html')).href;
const screenUrl = pathToFileURL(join(root, 'screens', 'star-chart.html')).href;

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
/** @type {StarChartSample} */
const day = w.MockSample.starChartDaytime;
/** @type {StarChartSample} */
const night = w.MockSample.starChart;

/** @param {import('@playwright/test').Page} page */
const collectProblems = (page) => {
  /** @type {string[]} */
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  return problems;
};

/** @param {import('@playwright/test').Page} page */
const blockExternal = async (page) => {
  /** @type {string[]} */
  const external = [];
  await page.route(/^(?!file:|data:|blob:|about:).*/, (route) => { external.push(route.request().url()); return route.abort(); });
  return external;
};

/** @param {import('@playwright/test').Page} page @param {string} url @param {number} [width] */
const open = async (page, url, width = 1440) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url);
};

/**
 * Shape of the sun mark inside `scope`: the disc, the rays and whether a diamond path is used.
 * @param {import('@playwright/test').Locator} scope
 */
const sunShape = (scope) => scope.locator('[data-body="sun"]').evaluate((g) => ({
  kind: g.getAttribute('data-kind'),
  disc: g.querySelectorAll('circle.mk-star-chart__body-mark').length,
  rays: g.querySelectorAll('.mk-star-chart__sun-rays').length,
  rayCount: (g.querySelector('.mk-star-chart__sun-rays')?.getAttribute('d')?.match(/M/g) ?? []).length,
  diamond: [...g.querySelectorAll('path.mk-star-chart__body-mark')].length,
  label: g.querySelector('.mk-star-chart__body-label')?.textContent ?? '',
}));

const DAY = '#star-chart-daytime';
const NIGHT = '#star-chart-default';

test.describe('star chart: the sun', () => {
  test('gallery: sample="daytime" draws the sun with its own disc-and-rays mark, labelled in ja', async ({ page }) => {
    const problems = collectProblems(page);
    const external = await blockExternal(page);
    await open(page, catalogUrl);
    const chart = page.locator(DAY);
    await expect(chart).toHaveAttribute('sample', 'daytime');
    const shape = await sunShape(chart);
    expect(shape).toEqual({ kind: 'sun', disc: 1, rays: 1, rayCount: 8, diamond: 0, label: ja['astro.body.sun'] });
    // The planets keep the diamond and the moon the plain circle (the sun differs from both by shape).
    const moon = await chart.locator('[data-body="moon"]').evaluate((g) => ({
      circle: g.querySelectorAll('circle.mk-star-chart__body-mark').length,
      rays: g.querySelectorAll('.mk-star-chart__sun-rays').length,
    }));
    expect(moon).toEqual({ circle: 1, rays: 0 });
    const label = (await chart.locator('svg.mk-star-chart__svg').getAttribute('aria-label')) ?? '';
    expect(label).toContain(ja['astro.body.sun']);
    expect(label).toContain(`${ja['sky.compass.s']}の空に${ja['astro.body.sun']}`);
    expect(label).toContain(ja['sky.daytime-note']);
    expect(label).toContain('2026年11月16日(月) 12:00');
    await expect(chart.locator('.mk-star-chart__note')).toHaveText(ja['sky.daytime-note']);
    expect(problems).toEqual([]);
    expect(external).toEqual([]);
  });

  test('gallery: the sun is labelled Sun in English and the alt text follows', async ({ page }) => {
    await open(page, `${catalogUrl}?lang=en`);
    const chart = page.locator(DAY);
    expect((await sunShape(chart)).label).toBe(en['astro.body.sun']);
    const label = (await chart.locator('svg.mk-star-chart__svg').getAttribute('aria-label')) ?? '';
    expect(label).toContain(`${en['astro.body.sun']} in the ${en['sky.compass.s']}`);
    expect(label).toContain(en['sky.daytime-note']);
    expect(label).not.toContain(ja['astro.body.sun']);
    await expect(chart.locator('.mk-star-chart__note')).toHaveText(en['sky.daytime-note']);
  });

  test('daytime stars are a pale reference (drawn in the muted text color, unlike the night chart)', async ({ page }) => {
    await open(page, catalogUrl);
    const fill = (/** @type {string} */ id) => page.locator(`${id} .mk-star-chart__star`).first().evaluate((el) => getComputedStyle(el).fill);
    const muted = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--color-text-muted)';
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });
    expect(await fill(DAY)).toBe(muted);
    expect(await fill(NIGHT)).not.toBe(muted);
    await expect(page.locator(`${DAY} .mk-star-chart__star`)).toHaveCount(day.stars.filter((s) => s.alt >= 0).length);
    await expect(page.locator(`${NIGHT} .mk-star-chart__note`)).toHaveCount(0);
  });

  for (const lang of /** @type {const} */ (['ja', 'en'])) {
    test(`gallery: daytime labels do not overlap (${lang}, 375px)`, async ({ page }) => {
      await open(page, `${catalogUrl}?lang=${lang}`, 375);
      const boxes = await page.locator(`${DAY} svg.mk-star-chart__svg`).evaluate((svg) => [...svg.querySelectorAll('text')].map((el) => {
        const r = el.getBoundingClientRect();
        return { text: el.textContent ?? '', x: r.x, y: r.y, w: r.width, h: r.height };
      }));
      const TOL = 0.5;
      /** @type {string[]} */
      const pairs = [];
      boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => {
        if (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > TOL && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > TOL) pairs.push(`${a.text} / ${b.text}`);
      }));
      expect(pairs).toEqual([]);
      expect(boxes.map((b) => b.text)).toContain((lang === 'ja' ? ja : en)['astro.body.sun']);
    });
  }

  test('the default views still draw no sun (gallery default chart and the star-chart screen)', async ({ page }) => {
    await open(page, catalogUrl);
    await expect(page.locator(`${NIGHT} [data-body="sun"]`)).toHaveCount(0);
    await open(page, screenUrl);
    await expect(page.locator('main mk-star-chart [data-body="sun"]')).toHaveCount(0);
    await expect(page.locator('main mk-star-chart .mk-star-chart__note')).toHaveCount(0);
    await expect(page.locator('[data-chart-datetime]')).toHaveValue(night.observedAt.slice(0, 16));
  });

  test('screen: the scenario daytime shows the daytime sample; switching back restores the evening chart', async ({ page }) => {
    const problems = collectProblems(page);
    const external = await blockExternal(page);
    await open(page, `${screenUrl}?scenario=daytime`);
    const chart = page.locator('main mk-star-chart');
    expect((await sunShape(chart)).label).toBe(ja['astro.body.sun']);
    await expect(page.locator('[data-chart-datetime]')).toHaveValue(day.observedAt.slice(0, 16));
    await expect(page.locator('[data-chart-place]')).toHaveValue(day.placeLabel);
    const label = (await chart.locator('svg').getAttribute('aria-label')) ?? '';
    expect(label).toContain(ja['astro.body.sun']);
    expect(label).toContain(ja['sky.daytime-note']);
    await expect(chart.locator('.mk-star-chart__caption')).toContainText('12:00');

    await page.evaluate(() => window.MockState.update({ scenario: 'default' }));
    await expect(chart.locator('[data-body="sun"]')).toHaveCount(0);
    await expect(page.locator('[data-chart-datetime]')).toHaveValue(night.observedAt.slice(0, 16));
    await page.evaluate(() => window.MockState.update({ scenario: 'daytime' }));
    await expect(chart.locator('[data-body="sun"]')).toHaveCount(1);
    await expect(page.locator('[data-chart-datetime]')).toHaveValue(day.observedAt.slice(0, 16));
    expect(problems).toEqual([]);
    expect(external).toEqual([]);
  });

  test('screen: the review toolbar offers the daytime scenario on the star chart', async ({ page }) => {
    await open(page, screenUrl);
    const values = await page.locator('[data-review-control="scenario"]').evaluate(
      (el) => [...(/** @type {HTMLSelectElement} */ (el)).options].map((o) => o.value));
    expect(values).toEqual(['default', 'daytime']);
  });

  for (const lang of /** @type {const} */ (['ja', 'en'])) {
    test(`screen daytime at 375px (${lang}): the chart fits, the sun is named, no sideways scroll`, async ({ page }) => {
      const problems = collectProblems(page);
      await open(page, `${screenUrl}?scenario=daytime&lang=${lang}`, 375);
      const svg = page.locator('main mk-star-chart svg');
      const box = await svg.boundingBox();
      if (!box) throw new Error('chart missing');
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
      expect((await sunShape(page.locator('main mk-star-chart'))).label).toBe((lang === 'ja' ? ja : en)['astro.body.sun']);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      expect(problems).toEqual([]);
    });
  }

  test('wireframe: the sun uses the wireframe gray like the other bodies', async ({ page }) => {
    await open(page, `${catalogUrl}?stage=wireframe`);
    // In the wireframe the drawing is hidden behind the placeholder; the token still maps to gray.
    const colors = await page.evaluate(() => {
      const probe = (/** @type {string} */ v) => {
        const el = document.createElement('span');
        el.style.color = `var(${v})`;
        document.body.append(el);
        const c = getComputedStyle(el).color;
        el.remove();
        return c;
      };
      return { sun: probe('--color-event-sun'), planet: probe('--color-event-planet') };
    });
    expect(colors.sun).toBe(colors.planet);
  });
});
