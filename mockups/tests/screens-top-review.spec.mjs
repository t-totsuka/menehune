// Task 8.1 (top only): the wireframe review notes recorded for `top` in data/screens.js
// (Requirements 1.3, 1.4, 4.7, 12.1, 12.2, 13.3, 13.4).
//   1. no visible "トップ" heading: the h1 stays for assistive technology (visually hidden)
//   2. posts are the main content: from 960px (--bp-md) two columns 1:3, posts in the wide one
//   3. the narrow column holds the guest notice, today's almanac and the upcoming events
//   4. the period / kind filters of the event list are folded into an accordion (<details>)
//   5. today's almanac shows a moon figure drawn from the moon age and a rise / set chart
//      (sun and moon above the horizon over 0-24h), with the basis place (Tokyo) labelled;
//      both figures are placeholders ([data-figure]) on the wireframe stage
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MOCKUPS_ROOT, loadClassicScripts, watchConsole } from './helpers/e2e.mjs';

const w = loadClassicScripts('data/sample-data.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;
const sample = w.MockSample;
const today = sample.almanac.find((/** @type {any} */ d) => d.date === sample.today);

const urlOf = (/** @type {string} */ id, query = '') =>
  pathToFileURL(join(MOCKUPS_ROOT, 'screens', `${id}.html`)).href + query;

/** Minutes after local (JST) midnight of an ISO date-time with +09:00. @param {string} at */
const minutesOf = (at) => Number(at.slice(11, 13)) * 60 + Number(at.slice(14, 16));

test.describe('top: review note 1 (no visible title heading)', () => {
  test('the h1 keeps the screen title for assistive technology but is visually hidden', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('top', '?lang=ja'));
    const h1 = page.locator('main h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(ja['screen.top.title']);
    await expect(page.getByRole('heading', { level: 1, name: ja['screen.top.title'] })).toHaveCount(1);
    const box = await h1.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { w: r.width, h: r.height, clip: cs.clipPath, overflow: cs.overflowX, position: cs.position };
    });
    expect(box.w).toBeLessThanOrEqual(1);
    expect(box.h).toBeLessThanOrEqual(1);
    expect(box.clip).not.toBe('none');
    expect(box.overflow).toBe('hidden');
    expect(box.position).toBe('absolute');
    expect(problems).toEqual([]);
  });
});

test.describe('top: review notes 2 and 3 (1:3 columns, posts in the wide one)', () => {
  for (const auth of ['guest', 'member']) {
    test(`PC width (${auth}): side column 1, posts column 3; side holds notice, today, events`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(urlOf('top', `?lang=ja&auth=${auth}`));
      const side = page.locator('main .screen-top-side');
      const posts = page.locator('main .screen-top-posts');
      await expect(posts).toHaveCount(1);
      await expect(posts.locator('mk-post-card')).toHaveCount(5);
      const layout = await page.evaluate(() => {
        const rect = (/** @type {string} */ sel) => {
          const el = document.querySelector(sel);
          return el ? el.getBoundingClientRect() : null;
        };
        return {
          notice: rect('main mk-guest-notice'),
          today: rect('main [aria-labelledby="top-today"]'),
          events: rect('main [aria-labelledby="top-events"]'),
          posts: rect('main [aria-labelledby="top-posts"]'),
        };
      });
      const { today: t, events: e, posts: p } = /** @type {Record<string, DOMRect>} */ (layout);
      // Side items share one column on the left; posts sit to the right of it.
      expect(Math.abs(t.left - e.left)).toBeLessThanOrEqual(1);
      expect(Math.abs(t.width - e.width)).toBeLessThanOrEqual(1);
      expect(p.left).toBeGreaterThan(t.right);
      expect(p.top).toBeLessThanOrEqual(t.top + 1);
      expect(e.top).toBeGreaterThan(t.top);
      // 1:3 (the column gap is shared, so compare with a tolerance)
      const ratio = p.width / t.width;
      expect(ratio).toBeGreaterThan(2.6);
      expect(ratio).toBeLessThan(3.4);
      if (auth === 'guest') {
        const n = /** @type {DOMRect} */ (layout.notice);
        expect(Math.abs(n.left - t.left)).toBeLessThanOrEqual(1);
        expect(n.bottom).toBeLessThanOrEqual(t.top + 1);
      }
      await expect(page.locator('main .screen-top-side:visible')).toHaveCount(auth === 'guest' ? 3 : 2);
      await expect(side).toHaveCount(3);
    });
  }

  test('phone width: one column in reading order notice, today, posts, events', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(urlOf('top', '?lang=ja'));
    const order = await page.evaluate(() => {
      const items = [
        ['notice', 'main mk-guest-notice'],
        ['today', 'main [aria-labelledby="top-today"]'],
        ['posts', 'main [aria-labelledby="top-posts"]'],
        ['events', 'main [aria-labelledby="top-events"]'],
      ];
      return items.map(([name, sel]) => {
        const r = /** @type {Element} */ (document.querySelector(/** @type {string} */ (sel))).getBoundingClientRect();
        return { name, top: r.top, left: r.left, width: r.width };
      });
    });
    const tops = order.map((o) => o.top);
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
    const lefts = new Set(order.map((o) => Math.round(o.left)));
    expect(lefts.size).toBe(1);
    // DOM order equals the visual order of the phone layout (reading and focus order)
    const domOrder = await page.evaluate(() => [...document.querySelectorAll('main > *')]
      .map((el) => el.getAttribute('aria-labelledby') ?? el.localName));
    expect(domOrder).toEqual(['h1', 'mk-guest-notice', 'top-today', 'top-posts', 'top-events']);
  });
});

test.describe('top: review note 4 (filters folded into an accordion)', () => {
  test('the period and kind filters start closed in a <details> and still filter when opened', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('top', '?lang=ja'));
    const list = page.locator('main mk-event-list');
    await expect(list).toHaveAttribute('filters', 'collapsed');
    const details = list.locator('details.mk-event-list__filter-toggle');
    await expect(details).toHaveCount(1);
    await expect(details).not.toHaveAttribute('open', '');
    const summary = details.locator('summary');
    await expect(summary).toHaveText(ja['event-list.filters']);
    await expect(list.locator('input[type="checkbox"]').first()).toBeHidden();
    const upcoming = sample.events.filter((/** @type {any} */ e) => e.at.slice(0, 10) >= '2026-11-16' && e.at.slice(0, 10) <= '2026-11-30');
    await expect(list.locator('.mk-event')).toHaveCount(upcoming.length);

    await summary.click();
    await expect(details).toHaveAttribute('open', '');
    const moonPhase = list.locator('input[type="checkbox"][value="moon-phase"]');
    await expect(moonPhase).toBeVisible();
    await moonPhase.uncheck();
    const rest = upcoming.filter((/** @type {any} */ e) => e.kind !== 'moon-phase');
    await expect(list.locator('.mk-event')).toHaveCount(rest.length);

    // The open state and the filter survive a language switch (re-render).
    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    await expect(details.locator('summary')).toHaveText(en['event-list.filters']);
    await expect(list.locator('details.mk-event-list__filter-toggle')).toHaveAttribute('open', '');
    await expect(list.locator('.mk-event')).toHaveCount(rest.length);
    expect(problems).toEqual([]);
  });

  test('the astro-events screen keeps its filters open without an accordion', async ({ page }) => {
    await page.goto(urlOf('astro-events', '?lang=ja'));
    const list = page.locator('main mk-event-list');
    await expect(list.locator('details')).toHaveCount(0);
    await expect(list.locator('input[type="checkbox"]').first()).toBeVisible();
  });
});

test.describe('top: review note 5 (moon figure and rise / set chart)', () => {
  test('the moon figure is drawn from the moon age, with alt text', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('top', '?lang=ja&stage=hifi'));
    const figure = page.locator('main [aria-labelledby="top-today"] .mk-moon-figure');
    await expect(figure).toHaveCount(1);
    await expect(figure).toHaveAttribute('data-figure', '');
    const img = figure.locator('svg[role="img"]');
    await expect(img).toHaveCount(1);
    const percent = Math.round(((1 - Math.cos((2 * Math.PI * today.moonAge) / 29.53)) / 2) * 100);
    await expect(img).toHaveAttribute('aria-label', ja['almanac.moon-figure.waxing']
      .replace('{age}', today.moonAge.toFixed(1)).replace('{percent}', String(percent)));
    // Age 7.2 (just before the first quarter): the right half is lit, the left half is dark.
    const hits = await img.evaluate((svg) => {
      const lit = /** @type {SVGGeometryElement} */ (svg.querySelector('.mk-moon__lit'));
      const at = (/** @type {number} */ x, /** @type {number} */ y) => lit.isPointInFill(new DOMPoint(x, y));
      return { right: at(75, 50), left: at(25, 50), farRight: at(92, 50), farLeft: at(8, 50) };
    });
    expect(hits).toEqual({ right: true, left: false, farRight: true, farLeft: false });

    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    await expect(img).toHaveAttribute('aria-label', en['almanac.moon-figure.waxing']
      .replace('{age}', today.moonAge.toFixed(1)).replace('{percent}', String(percent)));
    expect(problems).toEqual([]);
  });

  test('a waning crescent (age 27.8) is lit on the left only', async ({ page }) => {
    await page.goto(pathToFileURL(join(MOCKUPS_ROOT, 'components.html')).href + '?lang=ja&stage=hifi');
    const img = page.locator('#summary-brief-2026-11-07 .mk-moon-figure svg[role="img"]');
    await expect(img).toHaveCount(1);
    const hits = await img.evaluate((svg) => {
      const lit = /** @type {SVGGeometryElement} */ (svg.querySelector('.mk-moon__lit'));
      const at = (/** @type {number} */ x, /** @type {number} */ y) => lit.isPointInFill(new DOMPoint(x, y));
      return { farLeft: at(7, 50), center: at(50, 50), right: at(75, 50) };
    });
    expect(hits).toEqual({ farLeft: true, center: false, right: false });
    await expect(img).toHaveAttribute('aria-label', /^月齢 27\.8 /);
    await expect(img).toHaveAttribute('aria-label', /左側/);
  });

  test('the rise / set chart shows when the sun and the moon are up, with the basis place', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('top', '?lang=ja&stage=hifi'));
    const section = page.locator('main [aria-labelledby="top-today"]');
    await expect(section.locator('h3')).toHaveText(ja['screen.top.rise-set']);
    await expect(section.locator('.screen-top-basis')).toHaveText(ja['screen.top.rise-set-basis']);
    const riseSet = section.locator('mk-rise-set');
    await expect(riseSet).toHaveAttribute('date', sample.today);
    await expect(riseSet).toHaveAttribute('chart', '');
    const chart = riseSet.locator('.mk-rise-set-chart');
    await expect(chart).toHaveAttribute('data-figure', '');
    const img = chart.locator('svg[role="img"]');
    await expect(img).toHaveCount(1);
    const label = await img.getAttribute('aria-label');
    expect(label).toContain('06:14');
    expect(label).toContain('16:37');
    expect(label).toContain('11:59');
    expect(label).toContain(`${ja['astro.riseset.moonset']} ${ja['almanac.riseset-none']}`);
    // Spans in minutes after midnight: the sun from sunrise to sunset; the moon rises at 11:59
    // and sets after midnight (no moonset today), so it stays up until 24:00.
    const spans = await img.evaluate((svg) => [...svg.querySelectorAll('.mk-rise-set-chart__span')]
      .map((r) => [r.getAttribute('data-body'), Number(r.getAttribute('data-from')), Number(r.getAttribute('data-to'))]));
    expect(spans).toEqual([
      ['sun', minutesOf(today.riseSet.sunrise), minutesOf(today.riseSet.sunset)],
      ['moon', minutesOf(today.riseSet.moonrise), 1440],
    ]);
    // Geometry follows the minutes on the 24h track.
    const geo = await img.evaluate((svg) => {
      const track = /** @type {SVGGraphicsElement} */ (svg.querySelector('.mk-rise-set-chart__track')).getBBox();
      return [...svg.querySelectorAll('.mk-rise-set-chart__span')].map((r) => {
        const b = /** @type {SVGGraphicsElement} */ (r).getBBox();
        return [(b.x - track.x) / track.width * 1440, (b.x + b.width - track.x) / track.width * 1440];
      });
    });
    expect(Math.abs(geo[0][0] - minutesOf(today.riseSet.sunrise))).toBeLessThan(2);
    expect(Math.abs(geo[0][1] - minutesOf(today.riseSet.sunset))).toBeLessThan(2);
    expect(Math.abs(geo[1][1] - 1440)).toBeLessThan(2);
    // Sun and moon rows are told apart by text labels, not only by color (13.3).
    await expect(img.locator('text')).toContainText([ja['astro.body.sun'], ja['astro.body.moon']]);
    // The times stay readable as text next to the chart.
    await expect(riseSet.locator('.mk-rise-set__item[data-item="sunrise"] time')).toHaveText('06:14');
    expect(problems).toEqual([]);
  });

  test('wireframe: both figures are placeholders, the text values stay', async ({ page }) => {
    await page.goto(urlOf('top', '?lang=ja&stage=wireframe'));
    for (const sel of ['.mk-moon-figure', '.mk-rise-set-chart']) {
      const fig = page.locator(`main ${sel}`);
      await expect(fig).toHaveCount(1);
      const s = await fig.evaluate((el) => ({
        tag: el.localName,
        tabindex: el.getAttribute('tabindex'),
        outline: getComputedStyle(el).outlineStyle,
        svg: getComputedStyle(/** @type {Element} */ (el.querySelector('svg'))).visibility,
      }));
      expect(s.tag).toBe('div');
      expect(s.tabindex).toBeNull();
      expect(s.outline).toBe('solid');
      expect(s.svg).toBe('hidden');
    }
    await expect(page.locator('main mk-rise-set .mk-rise-set__item[data-item="sunrise"] time')).toBeVisible();
    await expect(page.locator('main .mk-almanac-summary__item[data-item="moon"]')).toBeVisible();
  });
});
