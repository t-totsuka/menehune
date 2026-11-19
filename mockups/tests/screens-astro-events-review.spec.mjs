// Task 8.1 (astro-events; relative-days and mark-past also on top): the wireframe review note recorded for `astro-events` in
// data/screens.js (Requirements 4.4, 4.5, 13.3).
//   "過去の日付のものはわかるようにしたい": events dated before the sample's today
//   (SampleDataSet.today, not the real clock) are recognizable as past. mk-event-list gets the
//   opt-in attribute `mark-past`: each past item has data-past and a visible text label
//   (event-list.past, ja / en) placed before its datetime, so the state is not conveyed by colour
//   alone and is read out with the item. Today's and later events have no label. Lists without
//   the attribute (the gallery's other samples, top's upcoming events) are unchanged.
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MOCKUPS_ROOT, loadClassicScripts, watchConsole } from './helpers/e2e.mjs';

const w = /** @type {Record<string, any>} */ (loadClassicScripts('data/sample-data.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js'));
const sample = w.MockSample;
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;

/** @param {{ at: string }} e */
const dateOf = (e) => e.at.slice(0, 10);
/** Ids of the sample events dated before the sample's today, in time order. @type {string[]} */
const PAST_IDS = sample.events
  .filter((/** @type {any} */ e) => dateOf(e) < sample.today)
  .sort((/** @type {any} */ a, /** @type {any} */ b) => Date.parse(a.at) - Date.parse(b.at))
  .map((/** @type {any} */ e) => e.id);

const urlOf = (/** @type {string} */ file, /** @type {string} */ query = '') =>
  pathToFileURL(join(MOCKUPS_ROOT, file)).href + query;

test('the sample holds past events relative to the sample today', () => {
  expect(sample.today).toBe('2026-11-16');
  expect(PAST_IDS.length).toBeGreaterThan(0);
  expect(PAST_IDS.length).toBeLessThan(sample.events.length);
});

test.describe('astro-events: review note (past events are marked)', () => {
  for (const [lang, dict] of /** @type {const} */ ([['ja', ja], ['en', en]])) {
    test(`${lang}: past events carry a text label and data-past; the rest do not`, async ({ page }) => {
      const problems = watchConsole(page);
      await page.goto(urlOf('screens/astro-events.html', `?lang=${lang}`));
      const list = page.locator('main mk-event-list');
      await expect(list).toHaveAttribute('mark-past', '');
      const items = list.locator('.mk-event-list__items > li');
      await expect(items).toHaveCount(sample.events.length);

      expect(dict['event-list.past']).toBeTruthy();
      const past = list.locator('.mk-event-list__items > li[data-past]');
      const pastIds = await past.evaluateAll((els) => els.map((el) => el.getAttribute('data-event-id')));
      expect(pastIds).toEqual(PAST_IDS);

      // each past item shows the label as visible text (not colour only), before its datetime
      const labels = past.locator('.mk-event__past');
      await expect(labels).toHaveCount(PAST_IDS.length);
      for (let i = 0; i < PAST_IDS.length; i += 1) {
        const item = past.nth(i);
        await expect(item.locator('.mk-event__past')).toHaveText(dict['event-list.past']);
        await expect(item.locator('.mk-event__past')).toBeVisible();
        // the datetime itself is unchanged
        await expect(item.locator('time')).toHaveAttribute('datetime', /^2026-/);
        const order = await item.evaluate((li) => {
          const label = /** @type {Element} */ (li.querySelector('.mk-event__past'));
          const time = /** @type {Element} */ (li.querySelector('time'));
          return label.compareDocumentPosition(time) & Node.DOCUMENT_POSITION_FOLLOWING;
        });
        expect(order).toBeTruthy();
      }

      // conveyed to screen readers: the label is part of the item's text and not hidden
      const hidden = await labels.evaluateAll((els) => els.filter((el) => el.closest('[aria-hidden="true"]') !== null).length);
      expect(hidden).toBe(0);
      const firstText = await past.first().evaluate((el) => /** @type {HTMLElement} */ (el).innerText);
      expect(firstText.startsWith(dict['event-list.past'])).toBe(true);

      // events on or after the sample today have no marker
      const upcoming = list.locator('.mk-event-list__items > li:not([data-past])');
      await expect(upcoming).toHaveCount(sample.events.length - PAST_IDS.length);
      await expect(upcoming.locator('.mk-event__past')).toHaveCount(0);
      const upcomingDates = await upcoming.locator('time').evaluateAll((els) => els.map((el) => (el.getAttribute('datetime') ?? '').slice(0, 10)));
      expect(upcomingDates.every((d) => d >= sample.today)).toBe(true);
      expect(problems).toEqual([]);
    });
  }

  test('the markers survive filtering and a language switch', async ({ page }) => {
    await page.goto(urlOf('screens/astro-events.html', '?lang=ja'));
    const list = page.locator('main mk-event-list');
    await list.getByLabel(ja['astro.kind.moon-phase']).uncheck();
    const pastNonPhase = sample.events.filter((/** @type {any} */ e) => dateOf(e) < sample.today && e.kind !== 'moon-phase').length;
    await expect(list.locator('li[data-past]')).toHaveCount(pastNonPhase);
    await expect(list.locator('li[data-past] .mk-event__past')).toHaveCount(pastNonPhase);
    await list.getByLabel(ja['astro.kind.moon-phase']).check();
    await page.evaluate(() => /** @type {any} */ (window).MockState.update({ lang: 'en' }));
    await expect(list.locator('li[data-past] .mk-event__past').first()).toHaveText(en['event-list.past']);
    await expect(list.locator('li[data-past]')).toHaveCount(PAST_IDS.length);
  });

  for (const lang of ['ja', 'en']) {
    test(`375px (${lang}): the label fits, no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(urlOf('screens/astro-events.html', `?lang=${lang}`));
      await expect(page.locator('main li[data-past] .mk-event__past').first()).toBeVisible();
      const overflow = await page.evaluate(() => {
        const s = /** @type {Element} */ (document.scrollingElement);
        return s.scrollWidth - s.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(0);
      const spill = await page.locator('main li[data-past]').evaluateAll((els) => els.map((el) => el.scrollWidth - el.clientWidth));
      for (const s of spill) expect(s).toBeLessThanOrEqual(1);
    });
  }

  for (const scenario of ['empty', 'fetch-error']) {
    test(`scenario=${scenario}: no markers`, async ({ page }) => {
      await page.goto(urlOf('screens/astro-events.html', `?lang=ja&scenario=${scenario}`));
      const list = page.locator('main mk-event-list');
      await expect(list.locator(scenario === 'empty' ? '.mk-event-list__empty' : '[role="alert"]')).toBeVisible();
      await expect(list.locator('.mk-event__past')).toHaveCount(0);
    });
  }
});

test.describe('mk-event-list: mark-past elsewhere', () => {
  // Task 8.1 (top, 「トップにも出すようにしたい。」): top also has mark-past (with relative-days), but its
  // default period starts at the sample today, so no past event is shown until the filter moves.
  test('top: the upcoming events (from the sample today) have no markers by default', async ({ page }) => {
    await page.goto(urlOf('screens/top.html', '?lang=ja'));
    const list = page.locator('main mk-event-list');
    await expect(list).toHaveAttribute('mark-past', '');
    await expect(list.locator('.mk-event').first()).toBeAttached();
    await expect(list.locator('li[data-past], .mk-event__past')).toHaveCount(0);
  });

  test('gallery: only the mark-past sample shows markers', async ({ page }) => {
    await page.goto(urlOf('components.html', '?lang=ja'));
    await expect(page.locator('main mk-event-list[mark-past]')).toHaveCount(1);
    await expect(page.locator('main mk-event-list[mark-past] li[data-past] .mk-event__past').first()).toHaveText(ja['event-list.past']);
    await expect(page.locator('#events-2026-11 .mk-event__past')).toHaveCount(0);
    await expect(page.locator('main mk-event-list:not([mark-past]) .mk-event__past')).toHaveCount(0);
  });
});

// Task 8.1 (astro-events, second note): "天文現象の一覧で「何日後」なのか知りたい". mk-event-list gets
// the opt-in attribute `relative-days`: each item shows, right after its datetime and inside the
// same grid cell, how far its date is from the sample's today, counted by calendar dates (not
// times): event-list.days-later(-one) / event-list.today. Third note "過去の現象では何日前は出さなくてOK":
// a past item keeps only its 「過去」 label before the datetime and shows no distance (no 「n日前」).
// astro-events and top; the gallery's other samples are unchanged.
/** The expected distance text; null for a past date (no text). @param {Record<string, string>} dict @param {number} days */
const relativeText = (dict, days) => {
  if (days < 0) return null;
  if (days === 0) return dict['event-list.today'];
  return days === 1 ? dict['event-list.days-later-one'] : dict['event-list.days-later'].replace('{count}', String(days));
};
const FUTURE_COUNT = sample.events.filter((/** @type {any} */ e) => dateOf(e) >= sample.today).length;
/** @param {string} a @param {string} b */
const daysFrom = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Replaces MockSample.today before the page's scripts run (the sample itself is frozen). */
const withToday = (/** @type {import('@playwright/test').Page} */ page, /** @type {string} */ today) =>
  page.addInitScript((t) => {
    /** @type {any} */
    let value;
    Object.defineProperty(window, 'MockSample', {
      configurable: true,
      get: () => value,
      set: (v) => { value = Object.freeze({ ...v, today: t }); },
    });
  }, today);

test.describe('astro-events: review note (days from today)', () => {
  test('dictionaries: ja and en wording', () => {
    expect(ja['event-list.days-later']).toBe('{count}日後');
    expect(ja['event-list.days-later-one']).toBe('1日後');
    expect(ja['event-list.today']).toBe('今日');
    expect(en['event-list.days-later']).toBe('in {count} days');
    expect(en['event-list.days-later-one']).toBe('in 1 day');
    expect(en['event-list.today']).toBe('today');
    // past events show no distance, so the 「n日前」 wording is gone from both dictionaries
    for (const dict of [ja, en]) {
      expect(dict['event-list.days-ago']).toBeUndefined();
      expect(dict['event-list.days-ago-one']).toBeUndefined();
    }
  });

  for (const [lang, dict] of /** @type {const} */ ([['ja', ja], ['en', en]])) {
    test(`${lang}: items from the sample today on show their distance after the datetime; past items only 「過去」`, async ({ page }) => {
      const problems = watchConsole(page);
      await page.goto(urlOf('screens/astro-events.html', `?lang=${lang}`));
      const list = page.locator('main mk-event-list');
      await expect(list).toHaveAttribute('relative-days', '');
      const items = list.locator('.mk-event-list__items > li');
      await expect(items).toHaveCount(sample.events.length);
      const rows = await items.evaluateAll((els) => els.map((li) => {
        const rel = li.querySelector('.mk-event__relative');
        const time = li.querySelector('time');
        const past = li.querySelector('.mk-event__past');
        return {
          date: (time?.getAttribute('datetime') ?? '').slice(0, 10),
          text: rel?.textContent ?? null,
          days: rel?.getAttribute('data-days') ?? null,
          // after the datetime, in the same cell (the grid keeps three cells)
          afterTime: !!(rel && time && (time.compareDocumentPosition(rel) & Node.DOCUMENT_POSITION_FOLLOWING)),
          sameCell: !!(rel && time && rel.parentElement === time.parentElement && rel.parentElement !== li),
          pastFirst: past === null || !!(time && (past.compareDocumentPosition(time) & Node.DOCUMENT_POSITION_FOLLOWING)),
          hidden: rel?.closest('[aria-hidden="true"]') != null,
          cells: li.children.length,
          spoken: /** @type {HTMLElement} */ (li).innerText,
        };
      }));
      for (const r of rows) {
        const d = daysFrom(sample.today, r.date);
        const expected = relativeText(dict, d);
        expect(r.cells).toBe(3);
        expect(r.pastFirst).toBe(true);
        expect(r.text).toBe(expected);
        if (expected === null) {
          // past: only the 「過去」 label, no distance
          expect(r.days).toBeNull();
          expect(r.spoken.startsWith(dict['event-list.past'])).toBe(true);
          continue;
        }
        expect(r.days).toBe(String(d));
        expect(r.afterTime).toBe(true);
        expect(r.sameCell).toBe(true);
        expect(r.hidden).toBe(false);
        expect(r.spoken).toContain(expected);
      }
      // the sample has both sides of today
      expect(rows.some((r) => r.date < sample.today)).toBe(true);
      expect(rows.some((r) => r.date > sample.today)).toBe(true);
      await expect(list.locator('li[data-past] .mk-event__relative')).toHaveCount(0);
      await expect(list.locator('.mk-event__relative')).toHaveCount(FUTURE_COUNT);
      expect(problems).toEqual([]);
    });
  }

  test('counted by calendar dates: today, singular and plural (sample today moved)', async ({ page }) => {
    const at = (/** @type {string} */ datetime) => page.locator(`main .mk-event:has(time[datetime="${datetime}"]) .mk-event__relative`);
    await withToday(page, '2026-11-12');
    await page.goto(urlOf('screens/astro-events.html', '?lang=en'));
    await expect(at('2026-11-13T01:07+09:00')).toHaveText('in 1 day');
    await expect(at('2026-11-11T09:14+09:00')).toHaveCount(0);
    await expect(at('2026-11-09T16:02+09:00')).toHaveCount(0);
    await expect(at('2026-11-17T20:48+09:00')).toHaveText('in 5 days');
    await page.goto(urlOf('screens/astro-events.html', '?lang=ja'));
    await expect(at('2026-11-13T01:07+09:00')).toHaveText('1日後');
    await expect(at('2026-11-11T09:14+09:00')).toHaveCount(0);
  });

  test('an event later on the sample today is 「今日」 / today, not past', async ({ page }) => {
    const at = (/** @type {string} */ datetime) => page.locator(`main .mk-event:has(time[datetime="${datetime}"])`);
    await withToday(page, '2026-11-17');
    await page.goto(urlOf('screens/astro-events.html', '?lang=ja'));
    await expect(at('2026-11-17T20:48+09:00').locator('.mk-event__relative')).toHaveText('今日');
    await expect(at('2026-11-17T20:48+09:00')).not.toHaveAttribute('data-past', /.*/);
    // 23:53 on the 24th is 7 days later by date, though more than 7 x 24 hours away
    await expect(at('2026-11-24T23:53+09:00').locator('.mk-event__relative')).toHaveText('7日後');
    await expect(at('2026-11-13T01:07+09:00')).toHaveAttribute('data-past', '');
    await expect(at('2026-11-13T01:07+09:00').locator('.mk-event__relative')).toHaveCount(0);
    await page.evaluate(() => /** @type {any} */ (window).MockState.update({ lang: 'en' }));
    await expect(at('2026-11-17T20:48+09:00').locator('.mk-event__relative')).toHaveText('today');
  });

  test('the distances survive filtering and a language switch', async ({ page }) => {
    await page.goto(urlOf('screens/astro-events.html', '?lang=ja'));
    const list = page.locator('main mk-event-list');
    await list.getByLabel(ja['astro.kind.moon-phase']).uncheck();
    const nonPhase = sample.events.filter((/** @type {any} */ e) => e.kind !== 'moon-phase');
    await expect(list.locator('.mk-event')).toHaveCount(nonPhase.length);
    await expect(list.locator('.mk-event .mk-event__relative')).toHaveCount(nonPhase.filter((/** @type {any} */ e) => dateOf(e) >= sample.today).length);
    await list.getByLabel(ja['astro.kind.moon-phase']).check();
    await page.evaluate(() => /** @type {any} */ (window).MockState.update({ lang: 'en' }));
    const first = [...sample.events].filter((/** @type {any} */ e) => dateOf(e) >= sample.today)
      .sort((/** @type {any} */ a, /** @type {any} */ b) => Date.parse(a.at) - Date.parse(b.at))[0];
    await expect(list.locator('.mk-event__relative').first()).toHaveText(/** @type {string} */ (relativeText(en, daysFrom(sample.today, dateOf(first)))));
    await expect(list.locator('.mk-event__relative')).toHaveCount(FUTURE_COUNT);
  });

  for (const lang of ['ja', 'en']) {
    test(`375px (${lang}): the distance fits, no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(urlOf('screens/astro-events.html', `?lang=${lang}`));
      await expect(page.locator('main .mk-event__relative').first()).toBeVisible();
      const overflow = await page.evaluate(() => {
        const s = /** @type {Element} */ (document.scrollingElement);
        return s.scrollWidth - s.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(0);
      const spill = await page.locator('main .mk-event').evaluateAll((els) => els.map((el) => el.scrollWidth - el.clientWidth));
      for (const s of spill) expect(s).toBeLessThanOrEqual(1);
    });

    test(`600px+ (${lang}): the three cells stay side by side on one row`, async ({ page }) => {
      for (const width of [600, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(urlOf('screens/astro-events.html', `?lang=${lang}`));
        await expect(page.locator('main .mk-event__relative').first()).toBeVisible();
        const rows = await page.locator('main .mk-event').evaluateAll((els) => els.map((li) => {
          const [a, b, c] = [...li.children].map((el) => el.getBoundingClientRect());
          return { ordered: a.right <= b.left + 0.5 && b.right <= c.left + 0.5, sameRow: a.top < b.bottom && b.top < c.bottom && c.top < a.bottom };
        }));
        expect(rows.length).toBe(sample.events.length);
        for (const r of rows) expect(r).toEqual({ ordered: true, sameRow: true });
      }
    });
  }

  for (const scenario of ['empty', 'fetch-error']) {
    test(`scenario=${scenario}: no distances`, async ({ page }) => {
      await page.goto(urlOf('screens/astro-events.html', `?lang=ja&scenario=${scenario}`));
      await expect(page.locator('main mk-event-list')).toBeAttached();
      await expect(page.locator(scenario === 'empty' ? 'main .mk-event-list__empty' : 'main mk-event-list [role="alert"]')).toBeVisible();
      await expect(page.locator('main mk-event-list .mk-event__relative')).toHaveCount(0);
    });
  }

  test('the gallery samples without relative-days show no distances', async ({ page }) => {
    await page.goto(urlOf('components.html', '?lang=ja'));
    await expect(page.locator('main mk-event-list[relative-days]')).toHaveCount(1);
    await expect(page.locator('main mk-event-list[relative-days] .mk-event__relative').first()).toBeVisible();
    await expect(page.locator('main mk-event-list:not([relative-days]) .mk-event__relative')).toHaveCount(0);
  });
});
