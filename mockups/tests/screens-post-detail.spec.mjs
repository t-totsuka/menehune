// Task 5.3: the post detail screen (6.1, 6.4, 6.5, 6.7, 6.8, 7.2〜7.6, 8.3, 8.4).
// - The post shown follows the scenario (SampleDataSet.postDetailScenarios), also when the
//   scenario or auth is switched at run time through MockState.update / the review shell.
// - Content view: body, author, target date, status badge, like (mk-like-button), report link
//   (mk-report-link, not for the viewer's own post), location panel under an h2, comment tree.
//   Guests get the read-only notice instead of the actions; members get a mock comment form.
// - guest + a post that guests cannot see (private-blocked): the private-post notice replaces it.
// - hidden posts: the author (member, hidden-own) sees the post with its hidden status and a link
//   to the appeal screen; everybody else (hidden-other, and guest + hidden-own) sees a notice.
// - deleted-comment / no-location / weather-failed: the matching displays.
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
const w = load('data/sample-data.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;
const sample = w.MockSample;
/** @type {Record<string, string>} */
const scenarioPosts = sample.postDetailScenarios;
const SCENARIOS = Object.keys(scenarioPosts);

/** @param {string} id */
const postOf = (id) => sample.posts.find((/** @type {any} */ p) => p.id === id);
/** @param {string} id */
const userName = (id) => sample.users.find((/** @type {any} */ u) => u.id === id).displayName;

const urlOf = (query = '') => pathToFileURL(join(root, 'screens', 'post-detail.html')).href + query;

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

const view = (/** @type {import('@playwright/test').Page} */ page, /** @type {string} */ name) =>
  page.locator(`main [data-post-view="${name}"]`);

test.describe('post-detail: every scenario without console problems', () => {
  for (const stage of ['wireframe', 'hifi']) {
    for (const lang of ['ja', 'en']) {
      for (const auth of ['guest', 'member']) {
        test(`${stage} ${lang} ${auth}`, async ({ page }) => {
          const problems = collectProblems(page);
          await page.goto(urlOf(`?stage=${stage}&lang=${lang}&auth=${auth}`));
          await expect(page.locator('html')).toHaveAttribute('data-auth', auth);
          for (const scenario of SCENARIOS) {
            await page.evaluate((s) => window.MockState.update({ scenario: /** @type {ScenarioId} */ (s) }), scenario);
            await expect(page.locator('html')).toHaveAttribute('data-scenario', scenario);
            // exactly one of the three views is shown
            const shown = await page.locator('main [data-post-view]').evaluateAll((els) =>
              els.filter((el) => el.getClientRects().length > 0).map((el) => el.getAttribute('data-post-view')));
            expect(shown, scenario).toHaveLength(1);
            await expect(page.locator('main')).not.toContainText('⟦');
            await expect(page.locator('main [data-missing-sample]')).toHaveCount(0);
            for (const width of [375, 1440]) {
              await page.setViewportSize({ width, height: 900 });
              expectValidHierarchy(await headingsOf(page));
              const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
              expect(overflow, `${scenario} @${width}`).toBeLessThanOrEqual(0);
            }
          }
          // decoration is marked and hidden on the wireframe stage
          await page.evaluate(() => window.MockState.update({ scenario: 'default' }));
          const decor = page.locator('main [data-decor]').first();
          expect(await decor.evaluate((el) => getComputedStyle(el).visibility)).toBe(stage === 'wireframe' ? 'hidden' : 'visible');
          expect(problems).toEqual([]);
        });
      }
    }
  }
});

test.describe('post-detail: default post (6.1, 6.7, 6.8, 7.2〜7.4, 8.3)', () => {
  const post = postOf(scenarioPosts['default']);

  test('guest: body, author, dates, badge, location under an h2, comment tree, read-only notice', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('?lang=ja'));
    const content = view(page, 'content');
    await expect(content).toBeVisible();
    await expect(content.locator('[data-post-body]')).toHaveText(post.body);
    await expect(content.locator('[data-post-author]')).toHaveText(userName(post.authorId));
    await expect(content.locator('[data-post-target-date]')).toHaveText('2026年11月17日(火)');
    await expect(content.locator('[data-post-target-date]')).toHaveAttribute('datetime', post.targetDate);
    await expect(content.locator('[data-post-posted-at]')).toHaveText('2026年11月16日(月) 18:42');
    await expect(content.locator('mk-status-badge')).toHaveAttribute('status', 'public');
    await expect(content.locator('mk-status-badge')).toContainText(ja['post.status.public']);

    // location panel (h3 fixed) sits under the location h2
    const headings = await headingsOf(page);
    const panelIndex = headings.findIndex(([l, t]) => l === 3 && t === ja['location.panel.title']);
    expect(panelIndex).toBeGreaterThan(0);
    expect(headings[panelIndex - 1]?.[0]).toBe(2);
    expect(headings[panelIndex - 1]?.[1]).toContain(ja['screen.post-detail.location']);
    await expect(content.locator('mk-location-panel')).toHaveAttribute('post-id', post.id);
    await expect(content.locator('mk-map-sample')).toHaveCount(1);
    await expect(content.locator('mk-weather')).toContainText('11.8');

    // likes: count only; no report link; the read-only notice stands in for the actions
    await expect(content.locator('mk-like-button button')).toHaveCount(0);
    await expect(content.locator('mk-like-button')).toContainText(ja['like.count'].replace('{count}', '12'));
    await expect(content.locator('a.mk-report-link')).toHaveCount(0);
    const notice = content.locator('mk-guest-notice:visible');
    await expect(notice).toHaveCount(1);
    await expect(notice).toContainText(ja['guest-notice.read-only']);
    await expect(notice.getByRole('link', { name: ja['guest-notice.login'] })).toHaveAttribute('href', /login\.html/);
    await expect(content.locator('[data-comment-form]')).toBeHidden();

    // comment tree
    await expect(content.locator('mk-comment-tree')).toHaveAttribute('post-id', post.id);
    await expect(content.locator('mk-comment-tree [data-comment-id="c-101-1"]')).toBeVisible();
    await expect(view(page, 'blocked')).toBeHidden();
    await expect(view(page, 'hidden')).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('member: like toggle, report link, comment form, no read-only notice', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('?lang=ja&auth=member'));
    const content = view(page, 'content');
    await expect(content.locator('mk-like-button button')).toHaveAttribute('aria-pressed', 'true');
    const report = content.locator('[data-post-actions] a.mk-report-link');
    await expect(report).toHaveCount(1);
    await expect(report).toHaveAttribute('href', /report\.html\?.*target=p-101/);
    await expect(report).toHaveAttribute('href', /auth=member/);
    await expect(content.locator('mk-guest-notice:visible')).toHaveCount(0);
    const form = content.locator('[data-comment-form]');
    await expect(form).toBeVisible();
    await expect(form.getByLabel(ja['screen.post-detail.comment-label'])).toBeVisible();
    await expect(form.getByRole('button', { name: ja['button.submit'] })).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('English copy', async ({ page }) => {
    await page.goto(urlOf('?lang=en'));
    const content = view(page, 'content');
    await expect(page.locator('main h2 > [data-i18n]')).toHaveText([
      en['screen.post-detail.post'], en['screen.post-detail.location'], en['screen.post-detail.comments'],
    ]);
    await expect(content.locator('[data-post-target-date]')).toHaveText('Tue, Nov 17, 2026');
    await expect(content.locator('[data-post-posted-at]')).toHaveText('Mon, Nov 16, 2026, 18:42');
    // the author's display name stays as written (sample data note 3.3)
    await expect(content.locator('[data-post-author]')).toHaveText(userName(post.authorId));
  });
});

test.describe('post-detail: scenarios (6.4, 6.5, 7.5, 7.6, 8.4)', () => {
  test('private-blocked as guest: the private-post notice replaces the post (6.5)', async ({ page }) => {
    const problems = collectProblems(page);
    const post = postOf(scenarioPosts['private-blocked']);
    await page.goto(urlOf('?lang=ja&scenario=private-blocked'));
    const blocked = view(page, 'blocked');
    await expect(blocked).toBeVisible();
    await expect(blocked.locator('mk-guest-notice')).toHaveAttribute('variant', 'private-post');
    await expect(blocked).toContainText(ja['guest-notice.private-post']);
    await expect(blocked.getByRole('link', { name: ja['guest-notice.login'] })).toBeVisible();
    await expect(view(page, 'content')).toBeHidden();
    await expect(page.getByText(post.body)).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('private-blocked as member: the members-only post is shown', async ({ page }) => {
    const post = postOf(scenarioPosts['private-blocked']);
    await page.goto(urlOf('?lang=ja&scenario=private-blocked&auth=member'));
    await expect(view(page, 'content').locator('[data-post-body]')).toHaveText(post.body);
    await expect(view(page, 'content').locator('mk-status-badge')).toHaveAttribute('status', 'members-only');
  });

  test('hidden-own as member: the post with its hidden status and the appeal link (8.4)', async ({ page }) => {
    const problems = collectProblems(page);
    const post = postOf(scenarioPosts['hidden-own']);
    expect(post.authorId).toBe(sample.viewerIds.member);
    await page.goto(urlOf('?lang=ja&scenario=hidden-own&auth=member'));
    const content = view(page, 'content');
    await expect(content.locator('[data-post-body]')).toHaveText(post.body);
    await expect(content.locator('mk-status-badge')).toHaveAttribute('status', 'hidden');
    await expect(content.locator('mk-status-badge')).toContainText(ja['post.status.hidden']);
    const own = content.locator('[data-own-hidden]');
    await expect(own).toBeVisible();
    await expect(own).toContainText(ja['screen.post-detail.own-hidden']);
    const appeal = own.getByRole('link', { name: ja['screen.post-detail.appeal'] });
    await expect(appeal).toHaveAttribute('href', /appeal\.html\?/);
    await expect(appeal).toHaveAttribute('href', /auth=member/);
    await expect(appeal).toHaveAttribute('href', new RegExp(`target=${post.id}`));
    // no reporting of one's own post, no comments on a hidden post
    await expect(content.locator('[data-post-actions] a.mk-report-link')).toHaveCount(0);
    await expect(content.locator('[data-comment-form]')).toBeHidden();
    expect(problems).toEqual([]);
  });

  test('hidden-own as guest: a non-owner sees the hidden notice (decision of task 5.3)', async ({ page }) => {
    const post = postOf(scenarioPosts['hidden-own']);
    await page.goto(urlOf('?lang=ja&scenario=hidden-own'));
    await expect(view(page, 'hidden')).toBeVisible();
    await expect(view(page, 'hidden')).toContainText(ja['screen.post-detail.hidden']);
    await expect(view(page, 'content')).toBeHidden();
    await expect(page.getByText(post.body)).toHaveCount(0);
  });

  for (const auth of ['guest', 'member']) {
    test(`hidden-other as ${auth}: a notice instead of the post (8.4)`, async ({ page }) => {
      const problems = collectProblems(page);
      const post = postOf(scenarioPosts['hidden-other']);
      await page.goto(urlOf(`?lang=ja&scenario=hidden-other&auth=${auth}`));
      const hidden = view(page, 'hidden');
      await expect(hidden).toBeVisible();
      await expect(hidden).toContainText(ja['screen.post-detail.hidden']);
      await expect(hidden.getByRole('link', { name: ja['screen.post-detail.back-to-top'] })).toHaveAttribute('href', /top\.html/);
      await expect(view(page, 'content')).toBeHidden();
      await expect(page.getByText(post.body)).toHaveCount(0);
      expect(problems).toEqual([]);
    });
  }

  test('deleted-comment: deleted comments keep their place in the tree (6.4)', async ({ page }) => {
    await page.goto(urlOf('?lang=ja&scenario=deleted-comment'));
    const tree = view(page, 'content').locator('mk-comment-tree');
    await expect(tree).toHaveAttribute('post-id', scenarioPosts['deleted-comment']);
    const deleted = tree.locator('[data-deleted]');
    expect(await deleted.count()).toBeGreaterThan(0);
    await expect(deleted.first().locator('.mk-comment__deleted').first()).toHaveText(ja['moderation.comment-deleted']);
    await expect(deleted.first().locator('.mk-comment__replies').first()).toBeVisible();
  });

  test('no-location: no location section, map, rise/set or weather (7.6)', async ({ page }) => {
    await page.goto(urlOf('?lang=ja&scenario=no-location'));
    await expect(view(page, 'content').locator('[data-post-body]')).toHaveText(postOf(scenarioPosts['no-location']).body);
    await expect(page.locator('main [data-location-section]')).toBeHidden();
    await expect(page.locator('main h2', { hasText: ja['screen.post-detail.location'] })).toBeHidden();
    await expect(page.locator('main mk-map-sample')).toHaveCount(0);
    await expect(page.locator('main mk-weather')).toHaveCount(0);
  });

  test('weather-failed: the weather block reports the failure (7.5)', async ({ page }) => {
    await page.goto(urlOf('?lang=ja&scenario=weather-failed'));
    await expect(page.locator('main [data-location-section]')).toBeVisible();
    await expect(page.locator('main mk-weather [role="alert"]')).toHaveText(ja['weather.unavailable']);
    await expect(page.locator('main mk-map-sample')).toHaveCount(1);
  });
});

test.describe('post-detail: switching at run time', () => {
  test('the review shell switches scenario and auth without reload', async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(urlOf('?lang=ja'));
    const scenario = page.locator('select[data-review-control="scenario"]');
    const auth = page.locator('select[data-review-control="auth"]');

    await scenario.selectOption('hidden-other');
    await expect(view(page, 'hidden')).toBeVisible();
    await expect(view(page, 'content')).toBeHidden();

    await scenario.selectOption('weather-failed');
    await expect(view(page, 'content')).toBeVisible();
    await expect(view(page, 'content').locator('[data-post-body]')).toHaveText(postOf(scenarioPosts['weather-failed']).body);
    await expect(page.locator('main mk-weather [role="alert"]')).toBeVisible();

    await scenario.selectOption('hidden-own');
    await expect(view(page, 'hidden')).toBeVisible();
    await auth.selectOption('member');
    await expect(view(page, 'content').locator('[data-own-hidden]')).toBeVisible();

    await scenario.selectOption('no-location');
    await expect(view(page, 'content').locator('[data-own-hidden]')).toBeHidden();
    await expect(page.locator('main [data-location-section]')).toBeHidden();
    await expect(view(page, 'content').locator('[data-comment-form]')).toBeVisible();

    await auth.selectOption('guest');
    await scenario.selectOption('private-blocked');
    await expect(view(page, 'blocked')).toBeVisible();
    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    await expect(view(page, 'blocked')).toContainText(en['guest-notice.private-post']);
    expect(problems).toEqual([]);
  });

  test('a post card link with ?scenario opens the matching post', async ({ page }) => {
    const problems = collectProblems(page);
    const post = postOf(scenarioPosts['weather-failed']);
    await page.goto(pathToFileURL(join(root, 'screens', 'day-detail.html')).href + `?lang=ja&date=${post.targetDate}`);
    const link = page.locator('mk-post-card a.mk-post-card__link[href*="scenario=weather-failed"]');
    await expect(link).toHaveCount(1);
    await link.click();
    await expect(page.locator('html')).toHaveAttribute('data-scenario', 'weather-failed');
    await expect(view(page, 'content').locator('[data-post-body]')).toHaveText(post.body);
    expect(problems).toEqual([]);
  });
});
