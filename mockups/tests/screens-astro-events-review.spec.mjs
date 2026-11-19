// Task 8.1 (astro-events only): the wireframe review note recorded for `astro-events` in
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

test.describe('mk-event-list without mark-past is unchanged', () => {
  test('top: the upcoming events (from the sample today) have no markers', async ({ page }) => {
    await page.goto(urlOf('screens/top.html', '?lang=ja'));
    const list = page.locator('main mk-event-list');
    await expect(list).not.toHaveAttribute('mark-past', /.*/);
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
