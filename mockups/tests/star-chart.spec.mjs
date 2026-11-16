// Task 4.4: mk-star-chart (5.1, 5.2, 5.4, 5.5, 13.4).
// - Zenith-centred all-sky chart in stereographic projection (r = R * tan((90° - alt) / 2)),
//   seen from below: north up, east LEFT, south down, west right. Cardinal labels N/E/S/W.
// - Stars sized by magnitude, constellation lines and names, moon / planets; bodies below the
//   horizon (the sun, alt -41.7) are not drawn. Names come from the dictionaries (ja / en).
// - Colors via CSS classes that reference tokens (follow the theme); the chart scales with its
//   width (viewBox) and fits a 375px viewport. data-figure sits on the non-focusable wrapper.
// - role="img" + aria-label from describe(): date/time, place, visible bodies with directions,
//   main stars.
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
/** @type {StarChartSample} */
const chart = w.MockSample.starChart;
const visibleStars = chart.stars.filter((s) => s.alt >= 0);
const visibleLines = chart.constellationLines.filter(([a, b]) => chart.stars[a].alt >= 0 && chart.stars[b].alt >= 0);

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

const ID = '#star-chart-default';
/** @param {import('@playwright/test').Page} page */
const svgOf = (page) => page.locator(`${ID} svg.mk-star-chart__svg`);

/** Geometry of the chart in user units: centre, horizon radius and one star. */
/** @param {import('@playwright/test').Page} page @param {number} index */
const starGeometry = (page, index) => svgOf(page).evaluate((svg, i) => {
  const vb = svg.viewBox.baseVal;
  const horizon = svg.querySelector('.mk-star-chart__horizon');
  const star = svg.querySelector(`.mk-star-chart__star[data-star-index="${i}"]`);
  if (!horizon || !star) return null;
  return {
    cx: vb.x + vb.width / 2,
    cy: vb.y + vb.height / 2,
    R: Number(horizon.getAttribute('r')),
    x: Number(star.getAttribute('cx')),
    y: Number(star.getAttribute('cy')),
    r: Number(star.getAttribute('r')),
  };
}, index);

test.describe('mk-star-chart', () => {
  test('svg has role=img and an aria-label describing the visible bodies, directions and stars', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440);
    const svg = svgOf(page);
    await expect(svg).toHaveAttribute('role', 'img');
    const label = (await svg.getAttribute('aria-label')) ?? '';
    expect(label).toContain(ja['astro.body.moon']);
    expect(label).toContain(ja['astro.body.saturn']);
    expect(label).toContain(ja['sky.compass.sw']); // moon az 226.3
    expect(label).toContain(ja['sky.compass.s']); // saturn az 161.7
    expect(label).toContain(ja['astro.star.vega']);
    expect(label).toContain('2026年11月16日(月) 20:00');
    expect(label).toContain(chart.placeLabel);
    expect(label).not.toContain(ja['astro.body.sun']);
    expect(label).not.toContain('⟦');
    expect(problems).toEqual([]);
  });

  test('aria-label follows the language', async ({ page }) => {
    await open(page, 1440, '?lang=en');
    const label = (await svgOf(page).getAttribute('aria-label')) ?? '';
    expect(label).toContain(en['astro.body.moon']);
    expect(label).toContain(en['sky.compass.sw']);
    expect(label).toContain(en['astro.star.vega']);
    expect(label).not.toContain(ja['astro.body.moon']);
  });

  test('one star circle per star above the horizon, sized by magnitude', async ({ page }) => {
    await open(page, 1440);
    await expect(page.locator(`${ID} .mk-star-chart__star`)).toHaveCount(visibleStars.length);
    const vega = await starGeometry(page, 26); // mag 0.03
    const faint = await starGeometry(page, 1); // mag 4.35
    expect(vega && faint).toBeTruthy();
    expect(/** @type {{r:number}} */ (vega).r).toBeGreaterThan(/** @type {{r:number}} */ (faint).r);
  });

  test('constellation lines and labels; star labels only for stars with nameKey', async ({ page }) => {
    await open(page, 1440);
    await expect(page.locator(`${ID} .mk-star-chart__line`)).toHaveCount(visibleLines.length);
    // Constellation names may be shifted or omitted by the label layout, never invented.
    const labels = page.locator(`${ID} .mk-star-chart__constellation`);
    const constellationKeys = await labels.evaluateAll((els) => els.map((el) => [el.getAttribute('data-name-key'), el.textContent]));
    expect(constellationKeys.length).toBeGreaterThan(0);
    for (const [key, text] of constellationKeys) {
      expect(chart.constellationLabels.some((l) => l.nameKey === key)).toBe(true);
      expect(text).toBe(ja[/** @type {string} */ (key)]);
    }
    // Star names only for stars with nameKey (dim ones may be omitted when they cannot be placed).
    const starLabels = await page.locator(`${ID} .mk-star-chart__star-label`).evaluateAll((els) =>
      els.map((el) => [Number(el.getAttribute('data-star-index')), el.textContent]));
    expect(starLabels.length).toBeGreaterThan(0);
    for (const [index, text] of starLabels) {
      const star = chart.stars[/** @type {number} */ (index)];
      expect(star.nameKey).toBeTruthy();
      expect(text).toBe(ja[/** @type {string} */ (star.nameKey)]);
    }
  });

  for (const lang of /** @type {const} */ (['ja', 'en'])) {
    for (const width of [1440, 375]) {
      test(`labels do not overlap (${lang}, ${width}px); Vega, Deneb, Fomalhaut and Hamal are named and readable`, async ({ page }) => {
        await open(page, width, `?lang=${lang}`);
        const dict = lang === 'ja' ? ja : en;
        const boxes = await svgOf(page).evaluate((svg) => [...svg.querySelectorAll('text')].map((el) => {
          const r = el.getBoundingClientRect();
          return { text: el.textContent ?? '', x: r.x, y: r.y, w: r.width, h: r.height };
        }));
        const TOL = 0.5;
        const overlaps = (/** @type {typeof boxes[number]} */ a, /** @type {typeof boxes[number]} */ b) =>
          Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > TOL && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > TOL;
        for (const key of ['astro.star.vega', 'astro.star.deneb', 'astro.star.fomalhaut', 'astro.star.hamal']) {
          const own = boxes.filter((b) => b.text === dict[key]);
          expect(own, key).toHaveLength(1);
          const hits = boxes.filter((b) => b !== own[0] && overlaps(own[0], b)).map((b) => b.text);
          expect(hits, key).toEqual([]);
        }
        /** @type {string[]} */
        const pairs = [];
        boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => { if (overlaps(a, b)) pairs.push(`${a.text} / ${b.text}`); }));
        expect(pairs).toEqual([]);
      });
    }
  }

  test('stereographic projection: north up, east left, west right', async ({ page }) => {
    await open(page, 1440);
    const polaris = await starGeometry(page, 0); // az 0.5, alt 36.1
    const mirach = await starGeometry(page, 19); // az 84.6 (east)
    const altair = await starGeometry(page, 31); // az 260.7 (west)
    const fomalhaut = await starGeometry(page, 50); // az 194.5 (south)
    if (!polaris || !mirach || !altair || !fomalhaut) throw new Error('stars missing');
    expect(polaris.y).toBeLessThan(polaris.cy);
    expect(mirach.x).toBeLessThan(mirach.cx);
    expect(altair.x).toBeGreaterThan(altair.cx);
    expect(fomalhaut.y).toBeGreaterThan(fomalhaut.cy);
    // Distance from the zenith follows R * tan((90 - alt) / 2), not a linear scale.
    const dist = Math.hypot(polaris.x - polaris.cx, polaris.y - polaris.cy);
    const expected = polaris.R * Math.tan(((90 - 36.1) / 2) * (Math.PI / 180));
    expect(Math.abs(dist - expected)).toBeLessThan(0.5);
  });

  test('cardinal labels: N/E/S/W in each language, east on the left and west on the right', async ({ page }) => {
    await open(page, 1440);
    const dir = (/** @type {string} */ d) => page.locator(`${ID} .mk-star-chart__cardinal[data-direction="${d}"]`);
    for (const d of ['n', 'e', 's', 'w']) await expect(dir(d)).toHaveText(ja[`sky.direction.${d}`]);
    const svgBox = await svgOf(page).boundingBox();
    const east = await dir('e').boundingBox();
    const west = await dir('w').boundingBox();
    const north = await dir('n').boundingBox();
    const south = await dir('s').boundingBox();
    if (!svgBox || !east || !west || !north || !south) throw new Error('boxes missing');
    const midX = svgBox.x + svgBox.width / 2;
    const midY = svgBox.y + svgBox.height / 2;
    expect(east.x + east.width).toBeLessThan(midX);
    expect(west.x).toBeGreaterThan(midX);
    expect(north.y + north.height).toBeLessThan(midY);
    expect(south.y).toBeGreaterThan(midY);

    await open(page, 1440, '?lang=en');
    for (const d of ['n', 'e', 's', 'w']) await expect(dir(d)).toHaveText(en[`sky.direction.${d}`]);
  });

  test('bodies: moon and planet drawn with names and distinct shapes; the sun below the horizon is not drawn', async ({ page }) => {
    await open(page, 1440);
    const moon = page.locator(`${ID} [data-body="moon"]`);
    const saturn = page.locator(`${ID} [data-body="saturn"]`);
    await expect(moon).toHaveCount(1);
    await expect(saturn).toHaveCount(1);
    await expect(page.locator(`${ID} [data-body="sun"]`)).toHaveCount(0);
    await expect(moon.locator('text')).toHaveText(ja['astro.body.moon']);
    await expect(saturn.locator('text')).toHaveText(ja['astro.body.saturn']);
    await expect(moon).toHaveAttribute('data-kind', 'moon');
    await expect(saturn).toHaveAttribute('data-kind', 'planet');
    const moonShape = await moon.locator('.mk-star-chart__body-mark').evaluate((el) => el.tagName);
    const planetShape = await saturn.locator('.mk-star-chart__body-mark').evaluate((el) => el.tagName);
    expect(moonShape).not.toBe(planetShape);
  });

  test('language switch changes constellation and body names', async ({ page }) => {
    await open(page, 1440);
    const first = page.locator(`${ID} .mk-star-chart__constellation`).first();
    const key = /** @type {string} */ (await first.getAttribute('data-name-key'));
    await expect(first).toHaveText(ja[key]);
    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    await expect(first).toHaveText(en[key]);
    await expect(page.locator(`${ID} [data-body="moon"] text`)).toHaveText(en['astro.body.moon']);
  });

  test('theme switch changes the sky and star colors', async ({ page }) => {
    await open(page, 1440, '?theme=light');
    const colors = () => page.locator(ID).evaluate((host) => {
      const sky = host.querySelector('.mk-star-chart__sky');
      const star = host.querySelector('.mk-star-chart__star');
      return { sky: sky ? getComputedStyle(sky).fill : '', star: star ? getComputedStyle(star).fill : '' };
    });
    const light = await colors();
    expect(light.sky).not.toBe('');
    await page.evaluate(() => window.MockState.update({ theme: 'dark' }));
    const dark = await colors();
    expect(dark.sky).not.toBe(light.sky);
    expect(dark.star).not.toBe(light.star);
  });

  for (const width of [360, 375]) {
    test(`${width}px: the chart fits inside the viewport and the page does not scroll sideways`, async ({ page }) => {
      await open(page, width);
      const box = await svgOf(page).boundingBox();
      if (!box) throw new Error('chart missing');
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.width).toBeGreaterThan(200);
      expect(Math.abs(box.width - box.height)).toBeLessThan(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('wireframe: placeholder on the non-focusable wrapper with the same box as hi-fi', async ({ page }) => {
    await open(page, 1440, '?stage=hifi');
    const figure = page.locator(`${ID} [data-figure]`);
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

  test('unknown sample id shows the missing-sample error', async ({ page }) => {
    await open(page, 1440);
    await expect(page.locator('#star-chart-missing [data-missing-sample="unknown"]')).toHaveCount(1);
  });
});
