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

// Task 8.1 (day-detail, second round of 2026-11-19), the four notes recorded in data/screens.js:
// 1. "「この日」が多用されている…": the h1 is the date itself (date-long, follows ?date= and the
//    language); the section headings say 「暦」, the posts heading is visually hidden (「投稿」, still
//    the region's name) and the button says 「投稿する」. No 「この日」 / "this day" is shown.
// 2. "七十二候は期間なので「ＸＸＸＸ（ｎ日目）」": the 候 of the day with its day count (day 1 is
//    the first day of the 候), on every sample day (kou="period" on mk-almanac-summary).
// 3. "「なし」の項目は非表示": almanac items without a value are left out (hide-empty on
//    mk-almanac-summary), so no plain 「なし」 is shown.
// 5. "月の出・月の入りは「なし」ではなかったが消えてしまった。": the rise / set rows always stay; a
//    time that does not occur keeps its text 「なし（この日は起こりません）」 (it states a fact).
// 4. "二十四節気は…同じ形にする必要はない": the 節気 keeps its form (name only, on its day).
// The gallery samples without the opt-ins are unchanged (tests/almanac-summary-events.spec.mjs).
const w2 = loadClassicScripts('assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = /** @type {any} */ (w2.MockMessages).ja;
/** @type {Record<string, string>} */
const en = /** @type {any} */ (w2.MockMessages).en;
/** @param {Record<string, string>} dict @param {string} key @param {Record<string, string | number>} args */
const fill = (dict, key, args) => String(dict[key]).replace(/\{([^{}]+)\}/g, (all, name) => (name in args ? String(args[name]) : all));

test.describe('day-detail: second-round notes (date heading, 候 day count, no "none" rows)', () => {
  test('the h1 is the date (ja and en), the title stays; headings and the button lose 「この日」', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('?lang=ja&auth=member&date=2026-11-20'));
    await expect(page.locator('main h1')).toHaveText('2026年11月20日(金)');
    await expect(page).toHaveTitle(ja['screen.day-detail.title']);
    await expect(page.locator('#day-almanac [data-i18n]')).toHaveText('暦');
    await expect(page.locator('#day-rise-set [data-i18n]')).toHaveText(ja['screen.day-detail.rise-set']);
    // the posts heading stays (outline and region name) but is not shown
    const postsHeading = page.locator('#day-posts');
    await expect(postsHeading).toHaveText('投稿');
    await expect(postsHeading).toHaveClass(/(^|\s)visually-hidden(\s|$)/);
    await expect(page.getByRole('region', { name: '投稿', exact: true })).toHaveCount(1);
    await expect(page.locator('main [data-day-new-post] a')).toHaveText('投稿する');
    // the summary does not repeat the date shown by the h1
    await expect(page.locator('main .mk-almanac-summary__date')).toHaveCount(0);
    const text = await page.locator('main').innerText();
    expect(text).not.toContain('この日');

    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    await expect(page.locator('main h1')).toHaveText('Fri, Nov 20, 2026');
    await expect(page).toHaveTitle(en['screen.day-detail.title']);
    await expect(page.locator('#day-almanac [data-i18n]')).toHaveText('Almanac');
    await expect(postsHeading).toHaveText('Posts');
    await expect(page.locator('main [data-day-new-post] a')).toHaveText('Write a post');
    expect((await page.locator('main').innerText()).toLowerCase()).not.toContain('this day');
    expect(problems).toEqual([]);
  });

  test('the h1 follows ?date= and falls back to today with the date', async ({ page }) => {
    await page.goto(urlOf('?lang=ja'));
    await expect(page.locator('main h1')).toHaveText('2026年11月16日(月)');
    await page.goto(urlOf('?lang=ja&date=2027-03-21'));
    await expect(page.locator('main h1')).toHaveText('2027年3月21日(日)');
  });

  for (const [date, key, n] of /** @type {const} */ ([
    ['2026-11-16', 'kou.k56', 5], ['2026-11-12', 'kou.k56', 1], ['2026-11-01', 'kou.k53', 5],
    ['2026-11-30', 'kou.k59', 4], ['2027-03-21', 'kou.k10', 1], ['2025-07-25', 'kou.k34', 4],
  ])) {
    test(`${date}: 七十二候 is ${key} with day ${n}`, async ({ page }) => {
      await page.goto(urlOf(`?lang=ja&date=${date}`));
      const kou = page.locator('main [data-item="kou"] dd');
      await expect(kou).toHaveText(fill(ja, 'almanac.kou-period-day', { name: ja[key], day: n }));
      await expect(kou).toHaveText(`${ja[key]}（${n}日目）`);
      await page.evaluate(() => window.MockState.update({ lang: 'en' }));
      await expect(kou).toHaveText(`${en[key]} (day ${n})`);
    });
  }

  test('二十四節気 keeps its form: the name on its day, no day count', async ({ page }) => {
    await page.goto(urlOf('?lang=ja&date=2026-11-22'));
    await expect(page.locator('main [data-item="sekki"] dd')).toHaveText(ja['sekki.shosetsu']);
    await expect(page.locator('main [data-item="kou"] dd')).toHaveText(`${ja['kou.k58']}（1日目）`);
  });

  test('almanac items without a value are not shown; the four rise / set rows stay', async ({ page }) => {
    const problems = watchConsole(page);
    // 2026-11-16: no sekki, zassetsu, holiday or events (and no moonset)
    await page.goto(urlOf('?lang=ja&date=2026-11-16'));
    const items = page.locator('main mk-almanac-summary [data-item]');
    expect(await items.evaluateAll((els) => els.map((el) => el.getAttribute('data-item')))).toEqual(['rokuyo', 'lunar', 'moon', 'kou']);
    await expect(page.locator('main .mk-almanac-summary__none')).toHaveCount(0);
    await expect(page.locator('main mk-almanac-summary')).not.toContainText(ja['almanac.none']);
    // items with a value stay: the events of 2026-11-20, the sekki and holiday of 2027-03-21
    await page.goto(urlOf('?lang=ja&date=2026-11-20'));
    expect(await items.evaluateAll((els) => els.map((el) => el.getAttribute('data-item')))).toEqual(['rokuyo', 'lunar', 'moon', 'kou', 'events']);
    await page.goto(urlOf('?lang=en&date=2027-03-21'));
    expect(await items.evaluateAll((els) => els.map((el) => el.getAttribute('data-item')))).toEqual(['rokuyo', 'lunar', 'moon', 'sekki', 'kou', 'holiday']);
    await expect(page.locator('main mk-almanac-summary')).not.toContainText(en['almanac.none']);
    expect(problems).toEqual([]);
  });

  // Regression for note 5: on every sample day the moonrise and moonset rows are visible, with
  // their time when the sample has one and with 「なし（この日は起こりません）」 otherwise.
  test('every sample day: the moonrise and moonset rows are visible (time, or the "does not occur" text)', async ({ page }) => {
    const problems = watchConsole(page);
    for (const day of /** @type {{ date: string, riseSet: Record<string, string | undefined> }[]} */ (sample.almanac)) {
      await page.goto(urlOf(`?lang=ja&date=${day.date}`));
      for (const item of ['sunrise', 'sunset', 'moonrise', 'moonset']) {
        const row = page.locator(`main mk-rise-set [data-item="${item}"]`);
        await expect(row, `${day.date} ${item}`).toBeVisible();
        const at = day.riseSet[item];
        if (at === undefined) await expect(row.locator('dd')).toHaveText(ja['almanac.riseset-none']);
        else await expect(row.locator('dd time')).toHaveAttribute('datetime', at);
      }
    }
    // the default date (2026-11-16): moonrise 11:59, no moonset
    await page.goto(urlOf('?lang=ja'));
    await expect(page.locator('main [data-item="moonrise"] time')).toHaveText('11:59');
    await expect(page.locator('main [data-item="moonset"] dd')).toHaveText(ja['almanac.riseset-none']);
    // with both moon times (2026-11-24)
    await page.goto(urlOf('?lang=ja&date=2026-11-24'));
    await expect(page.locator('main [data-item="moonrise"] time')).toHaveText('18:43');
    await expect(page.locator('main [data-item="moonset"] time')).toHaveText('06:27');
    expect(problems).toEqual([]);
  });

  test('the 0-24h chart (top page) still draws the moon band', async ({ page }) => {
    await page.goto(pathToFileURL(join(MOCKUPS_ROOT, 'screens', 'top.html')).href + '?lang=ja');
    const moon = page.locator('main mk-rise-set[chart] .mk-rise-set-chart__span[data-body="moon"]');
    expect(await moon.count()).toBeGreaterThan(0);
    // 2026-11-16: the moon rises at 11:59 and stays up until midnight
    await expect(moon.first()).toHaveAttribute('data-from', String(11 * 60 + 59));
    await expect(moon.first()).toHaveAttribute('data-to', String(24 * 60));
  });
});
