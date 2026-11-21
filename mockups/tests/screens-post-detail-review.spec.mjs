// Task 8.1 (post-detail only): the wireframe review note recorded for `post-detail` in
// data/screens.js (Requirements 6.1, 6.4, 6.5, 7.2〜7.6, 12.1, 12.2, 12.4).
//   "左右１：１で「投稿」と「コメント」は近くに寄せたい": from 960px (--bp-md, as on the top page and
//   the day detail) the post and its comments sit side by side in two columns at the top of
//   the page (post on the left, comments on the right). The location panel (region, map, rise /
//   set, weather) follows below both columns at full width. On narrow screens one column keeps
//   the DOM order (post, comments, location), which is also the reading and focus order at every
//   width. Views that replace the post (private-blocked, hidden-other) keep one full-width notice.
//   Follow-up "投稿の詳細でコメントと投稿が１：１になっているがコメントの幅を減らして": the columns are
//   now post:comments = 2:1, with a floor on the comments column (15rem, as the narrow column of
//   the top page and the day detail) so the deep comment tree and the member form stay usable.
//   In that column the reply step is narrowed so the deepest indented comment stays >= 200px.
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MOCKUPS_ROOT, watchConsole } from './helpers/e2e.mjs';

const urlOf = (/** @type {string} */ query = '') =>
  pathToFileURL(join(MOCKUPS_ROOT, 'screens', 'post-detail.html')).href + query;

/** @typedef {{ top: number, bottom: number, left: number, right: number, width: number }} Box */

/** Bounding boxes of the page parts (null when absent or not rendered). @param {import('@playwright/test').Page} page */
const layoutOf = (page) => page.evaluate(() => {
  const rect = (/** @type {string} */ sel) => {
    const el = document.querySelector(sel);
    if (el === null || el.getClientRects().length === 0) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width };
  };
  return {
    band: rect('body > mk-guest-notice[band]'),
    h1: rect('main h1'),
    blocked: rect('main [data-post-view="blocked"]'),
    hidden: rect('main [data-post-view="hidden"]'),
    post: rect('main [data-post-view="content"] article[aria-labelledby="post-heading"]'),
    comments: rect('main [data-post-view="content"] [aria-labelledby="post-comments"]'),
    form: rect('main [data-post-view="content"] [data-comment-form]'),
    location: rect('main [data-post-view="content"] [data-location-section]'),
  };
});

/** @param {Box | null} b @returns {Box} */
const box = (b) => {
  expect(b).not.toBeNull();
  return /** @type {Box} */ (b);
};

/** Post and comments side by side 2:1, the location (when given) below both at full width. */
const expectTwoColumns = (/** @type {Awaited<ReturnType<typeof layoutOf>>} */ l) => {
  const p = box(l.post);
  const c = box(l.comments);
  const h1 = box(l.h1);
  // side by side, starting at the same top, below the title
  expect(c.left).toBeGreaterThan(p.right);
  expect(Math.abs(c.top - p.top)).toBeLessThanOrEqual(1);
  expect(h1.bottom).toBeLessThanOrEqual(p.top + 1);
  // 2:1 (post twice the comments, within a tolerance), comments never below 15rem (240px)
  const ratio = p.width / c.width;
  expect(ratio).toBeGreaterThanOrEqual(1.7);
  expect(ratio).toBeLessThanOrEqual(2.3);
  expect(c.width).toBeGreaterThanOrEqual(240 - 1);
  // the two columns fill the page width under the title
  expect(Math.abs(p.left - h1.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(c.right - h1.right)).toBeLessThanOrEqual(1);
  if (l.location !== null) {
    const loc = l.location;
    expect(loc.top).toBeGreaterThanOrEqual(Math.max(p.bottom, c.bottom) - 1);
    expect(Math.abs(loc.left - p.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(loc.right - c.right)).toBeLessThanOrEqual(1);
  }
};

test.describe('post-detail: review note (post and comments side by side 2:1)', () => {
  for (const [width, auth] of /** @type {const} */ ([[1440, 'guest'], [1440, 'member'], [960, 'guest'], [960, 'member']])) {
    test(`${width}px (${auth}): post left, comments right, location below at full width`, async ({ page }) => {
      const problems = watchConsole(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(urlOf(`?lang=ja&auth=${auth}`));
      await expect(page.locator('main mk-comment-tree .mk-comment').first()).toBeVisible();
      const l = await layoutOf(page);
      expectTwoColumns(l);
      expect(l.location).not.toBeNull();
      if (auth === 'guest') {
        expect(box(l.band).bottom).toBeLessThanOrEqual(box(l.h1).top + 1);
        expect(l.form).toBeNull();
      } else {
        // the mock comment form sits in the comments column and stays usable in it
        const f = box(l.form);
        const c = box(l.comments);
        expect(f.left).toBeGreaterThanOrEqual(c.left - 1);
        expect(f.right).toBeLessThanOrEqual(c.right + 1);
        const parts = await page.evaluate(() => {
          const r = (/** @type {string} */ sel) => {
            const b = /** @type {Element} */ (document.querySelector(sel)).getBoundingClientRect();
            return { left: b.left, right: b.right, width: b.width };
          };
          return { text: r('#post-comment-body'), submit: r('main [data-comment-form] button') };
        });
        expect(parts.text.width).toBeGreaterThanOrEqual(200);
        expect(parts.text.right).toBeLessThanOrEqual(c.right + 1);
        expect(parts.submit.right).toBeLessThanOrEqual(c.right + 1);
      }
      expect(problems).toEqual([]);
    });
  }

  test('1440px member, hidden-own: the own hidden notice stays in the post column, no form', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlOf('?lang=ja&auth=member&scenario=hidden-own'));
    await expect(page.locator('main [data-own-hidden]')).toBeVisible();
    const l = await layoutOf(page);
    expectTwoColumns(l);
    expect(l.form).toBeNull();
    const own = await page.locator('main [data-own-hidden]').boundingBox();
    const p = box(l.post);
    expect(own?.x ?? 0).toBeGreaterThanOrEqual(p.left - 1);
    expect((own?.x ?? 0) + (own?.width ?? 0)).toBeLessThanOrEqual(p.right + 1);
  });

  test('1440px, no-location: two columns and no location row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlOf('?lang=ja&scenario=no-location'));
    await expect(page.locator('main [data-post-body]')).not.toBeEmpty();
    const l = await layoutOf(page);
    expect(l.location).toBeNull();
    expectTwoColumns(l);
  });

  test('1440px, weather-failed: the weather failure shows in the full-width location row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlOf('?lang=ja&scenario=weather-failed'));
    await expect(page.locator('main [data-location-section] [role="alert"]')).toBeVisible();
    const l = await layoutOf(page);
    expect(l.location).not.toBeNull();
    expectTwoColumns(l);
  });

  test('960px, deleted-comment: the deep tree keeps a readable width in the comments column (12.4)', async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 900 });
    await page.goto(urlOf('?lang=ja&scenario=deleted-comment'));
    await expect(page.locator('main mk-comment-tree .mk-comment').first()).toBeVisible();
    expectTwoColumns(await layoutOf(page));
    const widths = await page.evaluate(() => [...document.querySelectorAll('main mk-comment-tree .mk-comment')]
      .map((el) => el.getBoundingClientRect().width));
    expect(widths.length).toBeGreaterThan(6);
    for (const w of widths) expect(w).toBeGreaterThanOrEqual(200);
    const spill = await page.evaluate(() => {
      const el = /** @type {Element} */ (document.querySelector('main [aria-labelledby="post-comments"]'));
      return el.scrollWidth - el.clientWidth;
    });
    expect(spill).toBeLessThanOrEqual(1);
  });

  for (const [scenario, auth, view] of /** @type {const} */ ([
    ['private-blocked', 'guest', 'blocked'], ['hidden-other', 'member', 'hidden'], ['hidden-own', 'guest', 'hidden'],
  ])) {
    test(`1440px, ${scenario} (${auth}): one notice at the full width, no columns`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(urlOf(`?lang=ja&auth=${auth}&scenario=${scenario}`));
      await expect(page.locator(`main [data-post-view="${view}"]`)).toBeVisible();
      const l = await layoutOf(page);
      expect(l.post).toBeNull();
      expect(l.comments).toBeNull();
      const n = box(l[view]);
      const h1 = box(l.h1);
      expect(Math.abs(n.left - h1.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(n.width - h1.width)).toBeLessThanOrEqual(1);
    });
  }

  test('959px: still one column, comments right after the post', async ({ page }) => {
    await page.setViewportSize({ width: 959, height: 900 });
    await page.goto(urlOf('?lang=ja'));
    const l = await layoutOf(page);
    const p = box(l.post);
    const c = box(l.comments);
    const loc = box(l.location);
    expect(Math.abs(c.left - p.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(c.width - p.width)).toBeLessThanOrEqual(1);
    expect(c.top).toBeGreaterThan(p.bottom);
    expect(loc.top).toBeGreaterThan(c.bottom);
  });

  for (const lang of ['ja', 'en']) {
    test(`375px (${lang}): one column in reading order (post, comments, location), no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(urlOf(`?lang=${lang}&auth=member`));
      const l = await layoutOf(page);
      const order = [box(l.h1), box(l.post), box(l.comments), box(l.location)];
      for (let i = 1; i < order.length; i += 1) expect(order[i].top).toBeGreaterThanOrEqual(order[i - 1].bottom - 1);
      const lefts = new Set(order.map((o) => Math.round(o.left)));
      expect(lefts.size).toBe(1);
      // DOM order equals the visual order (reading and focus order)
      const domOrder = await page.evaluate(() => [...document.querySelectorAll('main [data-post-view="content"] > * > *')]
        .map((el) => el.getAttribute('aria-labelledby') ?? (el.hasAttribute('data-location-section') ? 'location' : el.localName)));
      expect(domOrder).toEqual(['post-heading', 'post-comments', 'location']);
      const overflow = await page.evaluate(() => {
        const s = /** @type {Element} */ (document.scrollingElement);
        return s.scrollWidth - s.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
