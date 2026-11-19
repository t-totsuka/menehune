// Task 8.1 (day-detail only): the wireframe review note recorded for `day-detail` in
// data/screens.js (Requirements 4.3, 12.1, 12.2).
//   "Topに同じく、投稿がメインなので左右１：２で表示": as on the top page, the posts are the main
//   content. From 960px (--bp-md) the page has two columns 1:2; the narrow left one holds the
//   day's almanac and the rise / set times, the wide right one the day's posts. The title and the
//   back link stay above both columns. On narrow screens one column keeps the DOM order
//   (almanac, rise / set, posts), which is also the reading and focus order on PC (left column
//   top to bottom, then the right one).
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MOCKUPS_ROOT, loadClassicScripts, watchConsole } from './helpers/e2e.mjs';

const w = loadClassicScripts('data/sample-data.js');
const sample = w.MockSample;

const urlOf = (/** @type {string} */ query = '') =>
  pathToFileURL(join(MOCKUPS_ROOT, 'screens', 'day-detail.html')).href + query;

/** Bounding boxes of the page parts. @param {import('@playwright/test').Page} page */
const layoutOf = (page) => page.evaluate(() => {
  const rect = (/** @type {string} */ sel) => {
    const el = document.querySelector(sel);
    if (el === null) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width };
  };
  return {
    band: rect('body > mk-guest-notice[band]'),
    h1: rect('main h1'),
    back: rect('main > p:has(a[data-calendar-link])'),
    almanac: rect('main [aria-labelledby="day-almanac"]'),
    riseSet: rect('main [aria-labelledby="day-rise-set"]'),
    posts: rect('main [aria-labelledby="day-posts"]'),
  };
});

/** @typedef {{ top: number, bottom: number, left: number, right: number, width: number }} Box */

test.describe('day-detail: review note (1:2 columns, posts in the wide one)', () => {
  for (const [width, auth] of /** @type {const} */ ([[1440, 'guest'], [1440, 'member'], [960, 'guest']])) {
    test(`${width}px (${auth}): left column 1 (almanac, rise / set), right column 2 (posts)`, async ({ page }) => {
      const problems = watchConsole(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(urlOf(`?lang=ja&auth=${auth}&date=${sample.today}`));
      await expect(page.locator('main mk-post-card:visible').first()).toBeVisible();
      const l = await layoutOf(page);
      const a = /** @type {Box} */ (l.almanac);
      const r = /** @type {Box} */ (l.riseSet);
      const p = /** @type {Box} */ (l.posts);
      // almanac and rise / set share the left column, stacked
      expect(Math.abs(a.left - r.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.width - r.width)).toBeLessThanOrEqual(1);
      expect(r.top).toBeGreaterThan(a.top);
      // the posts sit to the right, starting at the top of the columns
      expect(p.left).toBeGreaterThan(a.right);
      expect(Math.abs(p.top - a.top)).toBeLessThanOrEqual(1);
      // 1:2 (the column gap is shared, so compare with a tolerance)
      const ratio = p.width / a.width;
      expect(ratio).toBeGreaterThan(1.7);
      expect(ratio).toBeLessThan(2.3);
      // the title and the back link stay above both columns
      for (const above of [/** @type {Box} */ (l.h1), /** @type {Box} */ (l.back)]) {
        expect(above.bottom).toBeLessThanOrEqual(a.top + 1);
        expect(above.bottom).toBeLessThanOrEqual(p.top + 1);
        expect(Math.abs(above.left - a.left)).toBeLessThanOrEqual(1);
      }
      if (auth === 'guest') {
        expect(/** @type {Box} */ (l.band).bottom).toBeLessThanOrEqual(/** @type {Box} */ (l.h1).top + 1);
      } else {
        await expect(page.locator('main [aria-labelledby="day-posts"] [data-day-new-post] a')).toBeVisible();
      }
      // nothing in the narrow column spills out of it
      const spill = await page.evaluate(() => [...document.querySelectorAll('main [aria-labelledby="day-almanac"], main [aria-labelledby="day-rise-set"]')]
        .map((el) => el.scrollWidth - el.clientWidth));
      for (const s of spill) expect(s).toBeLessThanOrEqual(1);
      expect(problems).toEqual([]);
    });
  }

  test('959px: still one column', async ({ page }) => {
    await page.setViewportSize({ width: 959, height: 900 });
    await page.goto(urlOf(`?lang=ja&date=${sample.today}`));
    const l = await layoutOf(page);
    const a = /** @type {Box} */ (l.almanac);
    const p = /** @type {Box} */ (l.posts);
    expect(Math.abs(p.left - a.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(p.width - a.width)).toBeLessThanOrEqual(1);
    expect(p.top).toBeGreaterThan(a.bottom);
  });

  for (const lang of ['ja', 'en']) {
    test(`375px (${lang}): one column in reading order, no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(urlOf(`?lang=${lang}&auth=member&date=${sample.today}`));
      const l = await layoutOf(page);
      const order = /** @type {const} */ (['h1', 'back', 'almanac', 'riseSet', 'posts']).map((k) => /** @type {Box} */ (l[k]));
      const tops = order.map((o) => o.top);
      expect([...tops].sort((x, y) => x - y)).toEqual(tops);
      for (let i = 1; i < order.length; i += 1) expect(order[i].top).toBeGreaterThanOrEqual(order[i - 1].bottom - 1);
      const lefts = new Set(order.map((o) => Math.round(o.left)));
      expect(lefts.size).toBe(1);
      // DOM order equals the visual order (reading and focus order)
      const domOrder = await page.evaluate(() => [...document.querySelectorAll('main > *')]
        .map((el) => el.getAttribute('aria-labelledby') ?? el.localName));
      expect(domOrder).toEqual(['h1', 'p', 'day-almanac', 'day-rise-set', 'day-posts']);
      const overflow = await page.evaluate(() => {
        const s = /** @type {Element} */ (document.scrollingElement);
        return s.scrollWidth - s.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
