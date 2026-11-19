// Task 5.4: the post create / edit screen and the my-posts screen (3.4, 3.5, 6.2, 6.3, 6.6).
// - post-edit (members): target date (type=date, min = today, a visible hint that only today or
//   later can be chosen; ?date= from day-detail prefills it), body, visibility to guests, location
//   on / off with mk-precision-picker. ?post=ID (one of the viewer's own posts) prefills the form.
//   validation-error: a past date with the error next to the date field (aria-invalid,
//   aria-describedby) and an error summary that links to the field.
// - my-posts (members): cards of the viewer's own posts (SampleDataSet.viewerIds.member), newest
//   first, including the deleted one, with the visibility setting and a status badge that differs
//   by symbol, text and data-status; empty and fetch-error scenarios. Task 8.1 changed the order
//   to the target date, newest first, and the visibility to an icon on the card.
// - Guests get a login prompt instead of the form / list on both screens.
// - No console problems, valid heading hierarchy and no horizontal overflow at 375 / 1440 px in
//   wireframe / hifi x ja / en x guest / member for every scenario.
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
const w = load('data/sample-data.js', 'data/screens.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;
const sample = w.MockSample;
/** @param {string} id @returns {string[]} */
const scenariosOf = (id) => [...w.MockScreens.find((/** @type {any} */ s) => s.id === id).scenarios];

/** @param {string} id */
const postOf = (id) => sample.posts.find((/** @type {any} */ p) => p.id === id);
const me = sample.viewerIds.member;
const myPosts = sample.posts
  .filter((/** @type {any} */ p) => p.authorId === me)
  // target date (the date the card shows) newest first; task 8.1 review of my-posts
  .sort((/** @type {any} */ a, /** @type {any} */ b) => b.targetDate.localeCompare(a.targetDate) || Date.parse(b.postedAt) - Date.parse(a.postedAt));

const urlOf = (/** @type {string} */ id, query = '') => pathToFileURL(join(root, 'screens', `${id}.html`)).href + query;

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
    .filter((h) => h.getClientRects().length > 0)
    .map((h) => [Number(h.localName.slice(1)), (h.textContent ?? '').trim()]));

/** One h1 first, and no level is skipped going down. @param {[number, string][]} headings */
const expectValidHierarchy = (headings) => {
  expect(headings[0]?.[0]).toBe(1);
  expect(headings.filter(([level]) => level === 1)).toHaveLength(1);
  for (let i = 1; i < headings.length; i += 1) {
    const prev = /** @type {[number, string]} */ (headings[i - 1])[0];
    const level = /** @type {[number, string]} */ (headings[i])[0];
    expect(level, `heading ${headings[i]?.[1]} after h${prev}`).toBeLessThanOrEqual(prev + 1);
  }
};

/** The ids an element's aria-describedby points at. @param {import('@playwright/test').Locator} el */
const describedBy = async (el) => ((await el.getAttribute('aria-describedby')) ?? '').split(/\s+/).filter(Boolean);

for (const id of ['post-edit', 'my-posts']) {
  test.describe(`${id}: every scenario without console problems`, () => {
    for (const stage of ['wireframe', 'hifi']) {
      for (const lang of ['ja', 'en']) {
        for (const auth of ['guest', 'member']) {
          test(`${stage} ${lang} ${auth}`, async ({ page }) => {
            const problems = collectProblems(page);
            await page.goto(urlOf(id, `?stage=${stage}&lang=${lang}&auth=${auth}`));
            await expect(page.locator('html')).toHaveAttribute('data-auth', auth);
            for (const scenario of scenariosOf(id)) {
              await page.evaluate((s) => window.MockState.update({ scenario: /** @type {ScenarioId} */ (s) }), scenario);
              await expect(page.locator('html')).toHaveAttribute('data-scenario', scenario);
              // guests get the login prompt instead of the form / list
              await expect(page.locator('main [data-guest-prompt]:visible')).toHaveCount(auth === 'guest' ? 1 : 0);
              await expect(page.locator('main [data-member-content]:visible')).toHaveCount(auth === 'guest' ? 0 : 1);
              await expect(page.locator('main')).not.toContainText('⟦');
              await expect(page.locator('main [data-missing-sample]')).toHaveCount(0);
              for (const width of [375, 1440]) {
                await page.setViewportSize({ width, height: 900 });
                expectValidHierarchy(await headingsOf(page));
                const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
                expect(overflow, `${scenario} @${width}`).toBeLessThanOrEqual(0);
              }
            }
            expect(problems).toEqual([]);
          });
        }
      }
    }
  });
}

test.describe('post-edit (6.2, 6.3)', () => {
  // Task 8.1: the login link is in the band above <main>; the prompt only says why the form is missing.
  test('guest: a login prompt instead of the form', async ({ page }) => {
    await page.goto(urlOf('post-edit', '?lang=ja'));
    const prompt = page.locator('main [data-guest-prompt]');
    await expect(prompt).toBeVisible();
    await expect(prompt).toHaveText(ja['screen.post-edit.login-required']);
    await expect(prompt.locator('a, mk-guest-notice')).toHaveCount(0);
    await expect(page.locator('body > mk-guest-notice[band]').locator('a[href*="login.html"]')).toBeVisible();
    await expect(page.locator('main #post-target-date')).toBeHidden();
  });

  test('member: the four inputs with labels; the date allows today or later only', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('post-edit', '?lang=ja&auth=member'));
    const date = page.getByLabel(ja['screen.post-edit.target-date'], { exact: true });
    await expect(date).toBeVisible();
    await expect(date).toHaveAttribute('type', 'date');
    await expect(date).toHaveAttribute('min', sample.today);
    await expect(date).toHaveValue(sample.today);
    await expect(date).not.toHaveAttribute('aria-invalid', 'true');
    // the hint says that only today or later can be chosen, and is tied to the field
    const hint = page.locator('main #post-target-date-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toHaveText(ja['screen.post-edit.target-date-hint'].replace('{date}', '2026年11月16日(月)'));
    expect(await describedBy(date)).toContain('post-target-date-hint');
    await expect(page.locator('main #post-target-date-error')).toBeHidden();
    await expect(page.locator('main [data-error-summary]')).toBeHidden();

    await expect(page.getByLabel(ja['screen.post-edit.body'], { exact: true })).toBeVisible();
    const guest = page.getByLabel(ja['screen.post-edit.guest-visible'], { exact: true });
    await expect(guest).toHaveAttribute('type', 'checkbox');
    await expect(guest).toBeChecked();
    const location = page.getByLabel(ja['screen.post-edit.location-on'], { exact: true });
    await expect(location).toHaveAttribute('type', 'checkbox');
    await expect(location).toBeChecked();
    const picker = page.locator('main mk-precision-picker');
    await expect(picker).toBeVisible();
    await expect(picker.locator('input[type="radio"]')).toHaveCount(5);
    await expect(picker.locator('input[type="radio"]:checked')).toHaveCount(1);
    await expect(page.locator('main button', { hasText: ja['button.post'] })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('turning location off hides the precision picker', async ({ page }) => {
    await page.goto(urlOf('post-edit', '?auth=member'));
    const location = page.getByLabel(ja['screen.post-edit.location-on'], { exact: true });
    await location.uncheck();
    await expect(page.locator('main mk-precision-picker')).toBeHidden();
    await location.check();
    await expect(page.locator('main mk-precision-picker')).toBeVisible();
  });

  test('?date= from day-detail prefills the date; an invalid or past one falls back to today', async ({ page }) => {
    await page.goto(urlOf('day-detail', '?date=2026-11-20&auth=member'));
    await page.locator('main a[href*="post-edit.html"]:visible').click();
    await expect(page.locator('main #post-target-date')).toHaveValue('2026-11-20');

    const problems = collectProblems(page);
    await page.goto(urlOf('post-edit', '?date=2026-11-10&auth=member'));
    await expect(page.locator('main #post-target-date')).toHaveValue(sample.today);
    await expect(page.locator('main #post-target-date')).not.toHaveAttribute('aria-invalid', 'true');
    expect(problems.some((p) => p.includes('date=2026-11-10'))).toBe(true);
  });

  test('?post= of an own post prefills the form for editing', async ({ page }) => {
    const post = postOf('p-104');
    expect(post.authorId).toBe(me);
    await page.goto(urlOf('post-edit', '?post=p-104&auth=member'));
    await expect(page.locator('main #post-target-date')).toHaveValue(post.targetDate);
    await expect(page.locator('main #post-body')).toHaveValue(post.body);
    await expect(page.locator('main #post-guest-visible')).not.toBeChecked();
    await expect(page.locator('main #post-location-on')).toBeChecked();
    await expect(page.locator('main mk-precision-picker')).toHaveAttribute('value', post.location.precision);
    await expect(page.locator(`main mk-precision-picker input[value="${post.location.precision}"]`)).toBeChecked();
  });

  test('validation-error: the past-date error sits next to the date field (6.3, 3.5)', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('post-edit', '?lang=ja&auth=member&scenario=validation-error'));
    const date = page.locator('main #post-target-date');
    await expect(date).toHaveValue('2026-11-10');
    await expect(date).toHaveAttribute('aria-invalid', 'true');
    const error = page.locator('main #post-target-date-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText(ja['screen.post-edit.target-date-error']);
    expect(await describedBy(date)).toEqual(expect.arrayContaining(['post-target-date-hint', 'post-target-date-error']));
    // adjacent: in the same field group as the input, directly below it
    expect(await error.evaluate((el) => el.closest('.field')?.contains(document.getElementById('post-target-date')))).toBe(true);
    const inputBox = await date.boundingBox();
    const errorBox = await error.boundingBox();
    expect(errorBox && inputBox && errorBox.y - (inputBox.y + inputBox.height)).toBeLessThan(80);
    expect(errorBox && inputBox && errorBox.y).toBeGreaterThan(inputBox?.y ?? 0);
    // other fields are not marked invalid
    await expect(page.locator('main [aria-invalid="true"]')).toHaveCount(1);
    // the summary names the problem and links to the field
    const summary = page.locator('main [data-error-summary]');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(ja['error.validation']);
    await expect(summary.locator('a[href="#post-target-date"]')).toHaveText(ja['screen.post-edit.target-date-error']);
    expect(problems).toEqual([]);
  });

  test('validation-error in English, and switching the scenario at run time', async ({ page }) => {
    await page.goto(urlOf('post-edit', '?lang=en&auth=member&scenario=validation-error'));
    await expect(page.locator('main #post-target-date-error')).toHaveText(en['screen.post-edit.target-date-error']);
    await expect(page.locator('main #post-target-date-hint')).toHaveText(en['screen.post-edit.target-date-hint'].replace('{date}', 'Mon, Nov 16, 2026'));
    await page.evaluate(() => window.MockState.update({ scenario: 'default' }));
    const date = page.locator('main #post-target-date');
    await expect(date).not.toHaveAttribute('aria-invalid', 'true');
    await expect(date).toHaveValue(sample.today);
    expect(await describedBy(date)).not.toContain('post-target-date-error');
    await expect(page.locator('main #post-target-date-error')).toBeHidden();
    await page.evaluate(() => window.MockState.update({ scenario: 'validation-error' }));
    await expect(date).toHaveAttribute('aria-invalid', 'true');
    await expect(date).toHaveValue('2026-11-10');
  });
});

test.describe('my-posts (6.6, 3.4, 3.5)', () => {
  test('sample data: the viewer has a post in every status', () => {
    expect(new Set(myPosts.map((/** @type {any} */ p) => p.status))).toEqual(new Set(['public', 'members-only', 'hidden', 'deleted']));
  });

  test('guest: a login prompt instead of the list', async ({ page }) => {
    await page.goto(urlOf('my-posts', '?lang=en'));
    const prompt = page.locator('main [data-guest-prompt]');
    await expect(prompt).toBeVisible();
    await expect(prompt).toHaveText(en['screen.my-posts.login-required']);
    await expect(prompt.locator('a')).toHaveCount(0);
    await expect(page.locator('body > mk-guest-notice[band]').locator('a[href*="login.html"]')).toHaveText(en['guest-notice.login']);
    await expect(page.locator('main mk-post-card:visible')).toHaveCount(0);
  });

  test('member: own posts newest first, with visibility and distinguishable status badges', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('my-posts', '?lang=ja&auth=member'));
    const cards = page.locator('main mk-post-card:visible');
    expect(await cards.evaluateAll((els) => els.map((el) => el.getAttribute('post-id')))).toEqual(myPosts.map((/** @type {any} */ p) => p.id));

    const badges = await page.locator('main [data-my-post] .mk-status-badge').evaluateAll((els) => els.map((el) => ({
      status: el.getAttribute('data-status'),
      symbol: el.querySelector('[data-status-symbol]')?.textContent ?? '',
      text: el.querySelector('.mk-status-badge__text')?.textContent ?? '',
      color: getComputedStyle(el).color,
      border: getComputedStyle(el).borderStyle,
    })));
    expect(badges.map((b) => b.status)).toEqual(myPosts.map((/** @type {any} */ p) => p.status));
    for (const b of badges) expect(b.text).toBe(ja[`post.status.${b.status}`]);
    expect(new Set(badges.map((b) => b.symbol)).size).toBe(4);
    expect(new Set(badges.map((b) => b.text)).size).toBe(4);
    expect(new Set(badges.map((b) => `${b.color} ${b.border}`)).size).toBe(4);

    for (const post of myPosts) {
      const item = page.locator(`main [data-my-post="${post.id}"]`);
      // task 8.1: the visibility is an icon on the card (mk-post-card meta="icons")
      await expect(item.locator('[data-meta-icon="visibility"]')).toHaveAttribute('aria-label',
        ja[post.guestVisible ? 'post-card.visibility.guests' : 'post-card.visibility.members']);
      const edit = item.locator('a[href*="post-edit.html"]');
      if (post.status === 'deleted') {
        await expect(edit).toHaveCount(0);
      } else {
        await expect(edit).toHaveText(ja['button.edit']);
        await expect(edit).toHaveAttribute('href', new RegExp(`post=${post.id}`));
        await expect(edit).toHaveAttribute('href', /auth=member/);
      }
    }
    await expect(page.locator('main a.button[href*="post-edit.html"]:visible')).toHaveCount(1);
    expect(problems).toEqual([]);
  });

  test('empty: the empty state with the create-post entry point (3.4)', async ({ page }) => {
    await page.goto(urlOf('my-posts', '?lang=en&auth=member&scenario=empty'));
    await expect(page.locator('main mk-post-card:visible')).toHaveCount(0);
    await expect(page.locator('main [data-my-posts-empty]')).toBeVisible();
    await expect(page.locator('main [data-my-posts-empty]')).toContainText(en['screen.my-posts.empty']);
    await expect(page.locator('main a.button[href*="post-edit.html"]:visible')).toHaveCount(1);
  });

  test('fetch-error: an alert instead of the list (3.5)', async ({ page }) => {
    await page.goto(urlOf('my-posts', '?lang=ja&auth=member&scenario=fetch-error'));
    await expect(page.locator('main mk-post-card:visible')).toHaveCount(0);
    const alert = page.locator('main [role="alert"]:visible');
    await expect(alert).toHaveCount(1);
    await expect(alert).toHaveText(ja['error.fetch']);
    await expect(page.locator('main [data-my-posts-empty]')).toBeHidden();
  });
});
