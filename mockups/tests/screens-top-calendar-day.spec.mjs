// Task 5.1: the top, monthly calendar and day detail screens (3.2, 3.3, 4.1, 4.2, 4.3, 4.6, 4.7).
// - top: today's almanac summary (brief), today's and upcoming events, new posts.
// - calendar-month: 2026-11 by default, 2027-03 in the provisional-holiday scenario.
// - day-detail: ?date=YYYY-MM-DD (default: the sample "today"); full almanac incl. the day's
//   events, rise / set, and the posts tied to that day (members-only ones for members only).
// - all three: guest notice for guests and create-post entry points for members only,
//   decoration marked with data-decor, a valid heading hierarchy, and no console errors or
//   warnings in wireframe / hifi x ja / en x guest / member.
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

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
const sample = w.MockSample;

const urlOf = (/** @type {string} */ id, query = '') =>
  pathToFileURL(join(root, 'screens', `${id}.html`)).href + query;

/** @param {import('@playwright/test').Page} page */
const collectProblems = (page) => {
  /** @type {string[]} */
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  return problems;
};

/** Visible headings of <main> as [level, text]. @param {import('@playwright/test').Page} page */
const headingsOf = (page) => page.evaluate(() =>
  [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')]
    .filter((h) => /** @type {HTMLElement} */ (h).offsetParent !== null || h.getClientRects().length > 0)
    .map((h) => [Number(h.localName.slice(1)), (h.textContent ?? '').trim()]));

/** One h1 first, and no level is skipped going down. @param {[number, string][]} headings */
const expectValidHierarchy = (headings) => {
  expect(headings.length).toBeGreaterThan(1);
  expect(headings[0]?.[0]).toBe(1);
  expect(headings.filter(([level]) => level === 1)).toHaveLength(1);
  for (let i = 1; i < headings.length; i += 1) {
    const prev = /** @type {[number, string]} */ (headings[i - 1])[0];
    const level = /** @type {[number, string]} */ (headings[i])[0];
    expect(level, `heading ${headings[i]?.[1]} after h${prev}`).toBeLessThanOrEqual(prev + 1);
  }
};

/** Public / members-only posts of a date, newest first. @param {string} date */
const postsOn = (date) => sample.posts
  .filter((/** @type {any} */ p) => p.targetDate === date && (p.status === 'public' || p.status === 'members-only'))
  .sort((/** @type {any} */ a, /** @type {any} */ b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));

const SCREENS = ['top', 'calendar-month', 'day-detail'];

test.describe('task 5.1 screens: switching without console problems', () => {
  for (const id of SCREENS) {
    for (const stage of ['wireframe', 'hifi']) {
      for (const lang of ['ja', 'en']) {
        for (const auth of ['guest', 'member']) {
          test(`${id} ${stage} ${lang} ${auth}`, async ({ page }) => {
            const problems = collectProblems(page);
            await page.goto(urlOf(id, `?stage=${stage}&lang=${lang}&auth=${auth}`));
            await expect(page.locator('html')).toHaveAttribute('data-auth', auth);
            await expect(page.locator('main h2').first()).toBeVisible();
            await expect(page.locator('main')).not.toContainText('⟦');
            await expect(page.locator('main [data-missing-sample]')).toHaveCount(0);
            // guest notice for guests, create-post entry points for members only
            await expect(page.locator('main mk-guest-notice:visible')).toHaveCount(auth === 'guest' && id !== 'calendar-month' ? 1 : 0);
            const create = page.locator('main a[href*="post-edit.html"]:visible');
            if (auth === 'member') {
              await expect(create).toHaveCount(1);
              await expect(create).toHaveAttribute('href', /auth=member/);
            } else {
              await expect(create).toHaveCount(0);
            }
            // decoration is marked and hidden on the wireframe stage
            const decor = page.locator('main [data-decor]');
            expect(await decor.count()).toBeGreaterThan(0);
            const visibility = await decor.first().evaluate((el) => getComputedStyle(el).visibility);
            expect(visibility).toBe(stage === 'wireframe' ? 'hidden' : 'visible');
            for (const width of [375, 1440]) {
              await page.setViewportSize({ width, height: 900 });
              expectValidHierarchy(await headingsOf(page));
              const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
              expect(overflow).toBeLessThanOrEqual(0);
            }
            expect(problems).toEqual([]);
          });
        }
      }
    }
  }
});

test.describe('top', () => {
  test('today brief summary, today and upcoming events, new posts', async ({ page }) => {
    await page.goto(urlOf('top', '?lang=ja'));
    const headings = page.locator('main h2 > [data-i18n]');
    // Reading order after the wireframe review (task 8.1): today, posts, events.
    await expect(headings).toHaveText([ja['screen.top.today'], ja['screen.top.posts'], ja['screen.top.events']]);

    const summary = page.locator('main mk-almanac-summary');
    await expect(summary).toHaveAttribute('date', sample.today);
    await expect(summary).toHaveAttribute('variant', 'brief');
    await expect(summary.locator('.mk-almanac-summary[data-variant="brief"]')).toContainText('2026年11月16日(月)');
    await expect(page.locator(`main a[href*="day-detail.html?date=${sample.today}"]:visible`)).toHaveCount(1);

    const upcoming = sample.events.filter((/** @type {any} */ e) => e.at.slice(0, 10) >= '2026-11-16' && e.at.slice(0, 10) <= '2026-11-30');
    const list = page.locator('main mk-event-list');
    await expect(list).toHaveAttribute('from', sample.today);
    await expect(list.locator('.mk-event')).toHaveCount(upcoming.length);
    await expect(list.locator('.mk-event').first()).toHaveAttribute('data-event-id', 'ev-2026-11-17-first-quarter');
    await expect(page.locator('main a[href*="astro-events.html"]:visible')).toHaveCount(1);

    const cards = page.locator('main mk-post-card');
    await expect(cards).toHaveCount(5);
    const newest = sample.posts
      .filter((/** @type {any} */ p) => p.status === 'public')
      .sort((/** @type {any} */ a, /** @type {any} */ b) => Date.parse(b.postedAt) - Date.parse(a.postedAt))
      .slice(0, 5)
      .map((/** @type {any} */ p) => p.id);
    expect(await cards.evaluateAll((els) => els.map((el) => el.getAttribute('post-id')))).toEqual(newest);
  });

  test('English copy and member links keep the auth state', async ({ page }) => {
    await page.goto(urlOf('top', '?lang=en&auth=member'));
    await expect(page.locator('main h2 > [data-i18n]')).toHaveText([en['screen.top.today'], en['screen.top.posts'], en['screen.top.events']]);
    await expect(page.locator('main a[href*="day-detail.html"]:visible')).toHaveAttribute('href', /auth=member/);
    await expect(page.locator('main a[href*="astro-events.html"]:visible')).toHaveAttribute('href', /auth=member/);
  });
});

test.describe('calendar-month', () => {
  test('2026-11 by default with the month heading', async ({ page }) => {
    await page.goto(urlOf('calendar-month', '?lang=ja'));
    await expect(page.locator('main mk-month-calendar:visible')).toHaveCount(1);
    await expect(page.locator('main mk-month-calendar:visible')).toHaveAttribute('month', '2026-11');
    await expect(page.locator('main h2:visible > [data-i18n-date]')).toHaveText(['2026年11月']);
  });

  test('2027-03 with the provisional label in the provisional-holiday scenario', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('calendar-month', '?lang=ja&scenario=provisional-holiday'));
    const calendar = page.locator('main mk-month-calendar:visible');
    await expect(calendar).toHaveCount(1);
    await expect(calendar).toHaveAttribute('month', '2027-03');
    await expect(page.locator('main h2:visible > [data-i18n-date]')).toHaveText(['2027年3月']);
    await expect(calendar.locator('[data-layout="full"] mk-day-cell[date="2027-03-21"]')).toContainText(ja['holiday.provisional']);
    expect(problems).toEqual([]);
  });

  test('phone width: the summary panel h3 sits under the month h2', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(urlOf('calendar-month', '?lang=en'));
    const headings = await headingsOf(page);
    expect(headings.map(([level]) => level)).toEqual([1, 2, 3]);
    expect(headings[1]?.[1]).toContain('November 2026');
  });
});

test.describe('day-detail', () => {
  test('defaults to the sample today', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('day-detail', '?lang=ja'));
    await expect(page.locator('main h2 > [data-i18n]')).toHaveText([
      ja['screen.day-detail.almanac'], ja['screen.day-detail.rise-set'], ja['screen.day-detail.posts'],
    ]);
    await expect(page.locator('main mk-almanac-summary')).toHaveAttribute('date', sample.today);
    await expect(page.locator('main mk-almanac-summary')).toHaveAttribute('variant', 'full');
    await expect(page.locator('main .mk-almanac-summary__date')).toHaveText('2026年11月16日(月)');
    await expect(page.locator('main mk-rise-set')).toHaveAttribute('date', sample.today);
    const ids = await page.locator('main mk-post-card:visible').evaluateAll((els) => els.map((el) => el.getAttribute('post-id')));
    expect(ids).toEqual(postsOn(sample.today).map((/** @type {any} */ p) => p.id));
    expect(problems).toEqual([]);
  });

  test('?date= on a day with astronomical events: full items, events, rise / set, posts', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('day-detail', '?lang=ja&date=2026-11-20'));
    const summary = page.locator('main .mk-almanac-summary[data-variant="full"]');
    await expect(summary.locator('.mk-almanac-summary__date')).toHaveText('2026年11月20日(金)');
    for (const item of ['rokuyo', 'lunar', 'moon', 'sekki', 'kou', 'zassetsu', 'holiday', 'events']) {
      await expect(summary.locator(`[data-item="${item}"]`)).toHaveCount(1);
    }
    const events = summary.locator('.mk-almanac-summary__events li');
    await expect(events).toHaveCount(2);
    await expect(events.nth(0)).toContainText('18:30');
    await expect(events.nth(0)).toContainText('月と土星が接近');
    await expect(events.nth(1)).toContainText('水星が内合');
    await expect(page.locator('main mk-rise-set')).toHaveAttribute('date', '2026-11-20');
    await expect(page.locator('main .mk-rise-set__item')).toHaveCount(4);
    const ids = await page.locator('main mk-post-card:visible').evaluateAll((els) => els.map((el) => el.getAttribute('post-id')));
    expect(ids).toEqual(['p-103']);
    await expect(page.locator('main [data-day-posts-empty]:visible')).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('members-only posts of the day are listed for members only', async ({ page }) => {
    const date = '2026-11-24';
    const all = postsOn(date).map((/** @type {any} */ p) => p.id);
    const open = postsOn(date).filter((/** @type {any} */ p) => p.status === 'public').map((/** @type {any} */ p) => p.id);
    expect(all.length).toBeGreaterThan(open.length);
    await page.goto(urlOf('day-detail', `?date=${date}&auth=guest`));
    const visibleIds = () => page.locator('main mk-post-card:visible').evaluateAll((els) => els.map((el) => el.getAttribute('post-id')));
    expect(await visibleIds()).toEqual(open);
    await page.goto(urlOf('day-detail', `?date=${date}&auth=member`));
    expect(await visibleIds()).toEqual(all);
    await expect(page.locator('main a[href*="post-edit.html"]:visible')).toHaveAttribute('href', new RegExp(`date=${date}`));
  });

  test('a day without posts shows the empty state', async ({ page }) => {
    await page.goto(urlOf('day-detail', '?lang=en&date=2026-11-30'));
    await expect(page.locator('main mk-post-card')).toHaveCount(0);
    await expect(page.locator('main [data-day-posts-empty]:visible')).toHaveText(en['empty.posts']);
  });

  test('a past day has no create-post entry point; 2027-03 links back to the provisional calendar', async ({ page }) => {
    await page.goto(urlOf('day-detail', '?date=2026-11-10&auth=member'));
    await expect(page.locator('main a[href*="post-edit.html"]')).toHaveCount(0);
    await page.goto(urlOf('day-detail', '?date=2027-03-21&auth=member'));
    await expect(page.locator('main .mk-almanac-summary__provisional')).toHaveText(ja['holiday.provisional']);
    const back = page.locator('main a[href*="calendar-month.html"]:visible');
    await expect(back).toHaveAttribute('href', /scenario=provisional-holiday/);
    await expect(back).toHaveAttribute('href', /auth=member/);
  });

  test('an unknown ?date= falls back to today with a warning', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('day-detail', '?date=2030-01-01'));
    await expect(page.locator('main mk-almanac-summary')).toHaveAttribute('date', sample.today);
    expect(problems.some((p) => p.includes('2030-01-01'))).toBe(true);
  });

  test('calendar cells lead to the day detail of that date', async ({ page }) => {
    await page.goto(urlOf('calendar-month', '?lang=ja&auth=member'));
    await page.locator('main [data-layout="full"] mk-day-cell[date="2026-11-20"] a').first().click();
    await expect(page).toHaveURL(/day-detail\.html\?date=2026-11-20/);
    await expect(page.locator('main .mk-almanac-summary__date')).toHaveText('2026年11月20日(金)');
    await expect(page.locator('html')).toHaveAttribute('data-auth', 'member');
  });
});
