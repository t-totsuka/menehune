// Task 8.1 (star-chart only): the wireframe review note recorded for `star-chart` in
// data/screens.js (Requirements 5.1, 5.3, 5.5, 7.2, 12.1, 12.2, 13.4).
//   "星図の全天図右に４：１くらいのサイズ感で地図を表示したい": a map of the observing location (the
//   sample place the chart is drawn for, SampleDataSet.starChart.placeLabel, also the initial value
//   of the place input) sits to the right of the all-sky chart. From 960px (--bp-md, as on the
//   other reviewed screens) the drawn chart and the map form one group: the map is attached to the
//   chart's right edge, the chart keeping its size rule (square, min(column, 80vh)).
//   Follow-up "全天図と地図を両端において３：１から４：１の範囲に収まるようにしてみて", refined by
//   "全天図の幅が固定なので、地図のほうを可変として両端に寄せた状態で互いのマージンは固定して、地図の上下の比率は保ってほしい":
//   from 960px the chart keeps its size rule and sits at the left edge of the content; the map
//   takes all the remaining width up to the right edge, with a fixed gap (--space-lg) between
//   them, and keeps its 8:5 aspect ratio (height follows width). The map never gets narrower than
//   15rem (240px); where the width is tight (960px, very tall screens) the chart column gives way
//   instead, still min(column, 80vh). On narrow screens the map follows the chart.
//   The map is the existing mk-map-sample (municipality precision, the place name as `region`)
//   with the opt-in subject="observer": its caption and alt text say it shows the observing
//   location (観測地点).
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MOCKUPS_ROOT, loadClassicScripts, watchConsole } from './helpers/e2e.mjs';

const w = loadClassicScripts('data/sample-data.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;
/** @type {string} */
const place = w.MockSample.starChart.placeLabel;

const urlOf = (/** @type {string} */ query = '') =>
  pathToFileURL(join(MOCKUPS_ROOT, 'screens', 'star-chart.html')).href + query;

/** @typedef {{ top: number, bottom: number, left: number, right: number, width: number, height: number }} Box */

/** Bounding boxes of the page parts. @param {import('@playwright/test').Page} page */
const layoutOf = (page) => page.evaluate(() => {
  const rect = (/** @type {string} */ sel) => {
    const el = document.querySelector(sel);
    if (el === null) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
  };
  return {
    h2: rect('main #chart-sky'),
    chart: rect('main mk-star-chart'),
    chartFigure: rect('main mk-star-chart .mk-star-chart__figure'),
    map: rect('main mk-map-sample'),
    mapFigure: rect('main mk-map-sample .mk-map__figure'),
    pageWidth: document.documentElement.scrollWidth,
    viewWidth: document.documentElement.clientWidth,
    viewHeight: window.innerHeight,
    // --space-lg in px (the fixed gap between the chart and the map)
    spaceLg: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-lg'))
      * parseFloat(getComputedStyle(document.documentElement).fontSize),
  };
});

const box = (/** @type {Box | null} */ b) => {
  expect(b).not.toBeNull();
  return /** @type {Box} */ (b);
};

/** The chart keeps its own size rule: a square of min(its column, 80vh). */
const expectChartKeepsSize = (/** @type {Awaited<ReturnType<typeof layoutOf>>} */ l) => {
  const c = box(l.chart);
  const f = box(l.chartFigure);
  expect(Math.abs(f.width - f.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(f.width - Math.min(c.width, l.viewHeight * 0.8))).toBeLessThanOrEqual(1);
};

test.describe('star-chart: review note (a map of the observing location right of the chart, about 4:1)', () => {
  // Measured on the drawn figure (the square), not on the mk-star-chart box.
  for (const [width, height, auth] of /** @type {const} */ ([
    [960, 900, 'guest'], [1280, 800, 'guest'], [1366, 768, 'guest'], [1440, 900, 'guest'],
    [1440, 900, 'member'], [1920, 1080, 'guest'], [2560, 1440, 'guest'],
  ])) {
    test(`${width}x${height} (${auth}): chart at the left edge, the map takes the rest up to the right edge, fixed gap`, async ({ page }) => {
      const problems = watchConsole(page);
      await page.setViewportSize({ width, height });
      await page.goto(urlOf(`?lang=ja&auth=${auth}`));
      await expect(page.locator('main mk-map-sample svg[role="img"]')).toHaveCount(1);
      const l = await layoutOf(page);
      const h2 = box(l.h2);
      const f = box(l.chartFigure);
      const m = box(l.map);
      const mf = box(l.mapFigure);
      // under the section heading, tops aligned
      expect(h2.bottom).toBeLessThanOrEqual(f.top + 1);
      expect(Math.abs(m.top - f.top)).toBeLessThanOrEqual(1);
      // both ends of the content width (両端)
      expect(Math.abs(f.left - h2.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.right - h2.right)).toBeLessThanOrEqual(1);
      expect(Math.abs(mf.right - h2.right)).toBeLessThanOrEqual(1);
      // the gap between them is fixed: --space-lg
      expect(Math.abs(m.left - f.right - l.spaceLg)).toBeLessThanOrEqual(1);
      // the map keeps its 8:5 aspect ratio (height follows its width), within 1%
      expect(Math.abs((mf.height / mf.width) / (5 / 8) - 1)).toBeLessThanOrEqual(0.01);
      // never absurdly narrow: at least 15rem (240px)
      expect(m.width).toBeGreaterThanOrEqual(240 - 1);
      // the chart keeps its size rule: min(its column, 80vh), the column leaving room for the gap and the map's 15rem
      expect(Math.abs(f.width - Math.min(l.viewHeight * 0.8, h2.width - l.spaceLg - 240))).toBeLessThanOrEqual(1.5);
      expectChartKeepsSize(l);
      expect(l.pageWidth).toBeLessThanOrEqual(l.viewWidth);
      expect(problems).toEqual([]);
    });
  }

  for (const width of [375, 600]) {
    test(`${width}px: the map follows the chart in one column, nothing overflows`, async ({ page }) => {
      const problems = watchConsole(page);
      await page.setViewportSize({ width, height: 800 });
      await page.goto(urlOf('?lang=ja'));
      await expect(page.locator('main mk-map-sample svg[role="img"]')).toHaveCount(1);
      const l = await layoutOf(page);
      const c = box(l.chart);
      const m = box(l.map);
      expect(m.top).toBeGreaterThanOrEqual(c.bottom - 1);
      expect(m.left).toBeGreaterThanOrEqual(0);
      expect(m.right).toBeLessThanOrEqual(width);
      expectChartKeepsSize(l);
      // the chart still fills its column at phone width (5.5)
      if (width === 375) expect(Math.abs(box(l.chartFigure).width - c.width)).toBeLessThanOrEqual(1);
      expect(l.pageWidth).toBeLessThanOrEqual(l.viewWidth);
      expect(problems).toEqual([]);
    });
  }

  test('the map shows the sample place and says it is the observing location (ja / en)', async ({ page }) => {
    await page.goto(urlOf('?lang=ja'));
    const map = page.locator('main mk-map-sample');
    await expect(map).toHaveAttribute('subject', 'observer');
    await expect(map).toHaveAttribute('precision', 'municipality');
    await expect(map).toHaveAttribute('region', place);
    // the same place as the chart's caption and the place input
    await expect(page.getByLabel(ja['screen.star-chart.place'], { exact: true })).toHaveValue(place);
    await expect(page.locator('main mk-star-chart .mk-star-chart__caption')).toContainText(place);
    const jaAlt = ja['map.describe.observer'].replace('{map}', ja['map.describe.municipality'].replaceAll('{region}', place));
    await expect(map.locator('svg')).toHaveAttribute('role', 'img');
    await expect(map.locator('svg')).toHaveAttribute('aria-label', jaAlt);
    expect(jaAlt).toContain('観測地点');
    await expect(map.locator('.mk-map__caption')).toHaveText(ja['map.caption.observer'].replace('{region}', place));
    await expect(map.locator('.mk-map__caption')).toContainText('観測地点');
    await expect(map.locator('[data-figure]')).toHaveCount(1);

    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    const enAlt = en['map.describe.observer'].replace('{map}', en['map.describe.municipality'].replaceAll('{region}', place));
    await expect(map.locator('svg')).toHaveAttribute('aria-label', enAlt);
    await expect(map.locator('.mk-map__caption')).toHaveText(en['map.caption.observer'].replace('{region}', place));
  });
});

// Task 8.1 (approval, 2026-11-19): a person approved the star-chart wireframe (「星図OK」), so the
// hifi stage no longer carries the "未確定" banner (1.3); hifi itself stays draft.
test('star-chart: approved wireframe, so hifi shows no "未確定" banner', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto(urlOf('?stage=hifi&lang=ja'));
  await expect(page.locator('html')).toHaveAttribute('data-stage', 'hifi');
  await expect(page.locator('[data-review-status]')).toContainText('ワイヤーフレーム 承認済み');
  await expect(page.locator('[data-review-status]')).toContainText('ハイフィ 下書き');
  await expect(page.locator('[data-review-banner="provisional"]')).toBeHidden();
  expect(problems).toEqual([]);
});
