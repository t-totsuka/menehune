// Task 8.1 (my-posts review note "コメントにコメントがついたときに知る機能が欲しい"): reply notices,
// Requirements 6.9, 6.10 and 6.11.
// - 6.9: while logged in, mk-site-header shows the unread notices and their number as text
//   ("お知らせ（未読 2 件）"; not colour alone) in the header bar, visible at every width without
//   opening the menu. It links to the notices section of my-posts (#notices), carrying ?auth like
//   the other header links. With 0 unread it still shows "お知らせ" (no count). Guests see nothing.
//   It is on every screen.
// - 6.10: my-posts has a "お知らせ" section (id="notices") with mk-notice-list (after the post list
//   since the later review note 6 "「自分の投稿」を優先", beside it from 960px):
//   per notice the replier, an excerpt of my comment, the post, the datetime, unread / read as text
//   and a link to the reply (post-detail of that post, #post-comments: comments have no anchors).
//   The `empty` scenario empties the notices too; `fetch-error` shows a notices error.
// - 6.11: settings has a checkbox "コメントへの返信をお知らせで受け取る", checked by default.
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MOCKUPS_ROOT, listScreens, loadClassicScripts, watchConsole } from './helpers/e2e.mjs';

const w = loadClassicScripts('data/screens.js', 'data/sample-data.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;
const sample = /** @type {any} */ (w.MockSample);
const registry = /** @type {any[]} */ (w.MockScreens);

const urlOf = (/** @type {string} */ id, query = '') =>
  pathToFileURL(join(MOCKUPS_ROOT, 'screens', `${id}.html`)).href + query;
const galleryUrl = pathToFileURL(join(MOCKUPS_ROOT, 'components.html')).href;

/** @param {Record<string, string>} m @param {string} key @param {Record<string, string | number>} [args] */
const fmt = (m, key, args = {}) =>
  Object.entries(args).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), m[key] ?? `⟦${key}⟧`);

const member = sample.viewerIds.member;
/** @type {any[]} */
const myNotices = (sample.notices ?? []).filter((/** @type {any} */ n) => n.recipientId === member);
const unread = myNotices.filter((n) => !n.read).length;

/** @param {readonly any[]} nodes @returns {any[]} */
const flat = (nodes) => nodes.flatMap((n) => [n, ...flat(n.children)]);
/** @param {string} postId @param {string} id */
const commentOf = (postId, id) => flat(sample.posts.find((/** @type {any} */ p) => p.id === postId)?.comments ?? []).find((c) => c.id === id);
/** @param {string} id */
const userName = (id) => sample.users.find((/** @type {any} */ u) => u.id === id)?.displayName ?? id;
/** @param {string} postId @returns {string} */
const scenarioOf = (postId) => Object.entries(sample.postDetailScenarios).find(([, p]) => p === postId)?.[0] ?? '';

/** @param {import('@playwright/test').Page} page */
const headerNotices = (page) => page.locator('mk-site-header [data-header-notices]');
/** @param {import('@playwright/test').Page} page */
const noHorizontalScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('the sample gives the member viewer unread notices (the header count is not 0)', () => {
  expect(myNotices.length).toBeGreaterThanOrEqual(3);
  expect(unread).toBe(2);
});

test.describe('6.9: the header shows the unread notices on every screen', () => {
  for (const { id } of listScreens()) {
    test(`${id}: member sees the count and the link, guest sees nothing`, async ({ page }) => {
      const problems = watchConsole(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(urlOf(id, '?lang=ja&auth=member'));
      const link = page.locator('mk-site-header').getByRole('link', { name: fmt(ja, 'notice.header-unread', { count: unread }), exact: true });
      await expect(link).toHaveCount(1);
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('data-header-notices', '');
      await expect(link).toHaveAttribute('data-unread', String(unread));
      const href = new URL(String(await link.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)));
      expect(href.pathname).toMatch(/\/screens\/my-posts\.html$/);
      expect(href.hash).toBe('#notices');
      expect(href.searchParams.get('auth')).toBe('member');
      // the visible text is the accessible name (text, not colour alone)
      await expect(link).toHaveText(fmt(ja, 'notice.header-unread', { count: unread }));

      await page.goto(urlOf(id, '?lang=ja&auth=guest'));
      await expect(page.locator('mk-site-header .mk-header__logo')).toBeVisible();
      await expect(headerNotices(page)).toHaveCount(0);
      expect(problems).toEqual([]);
    });
  }

  test('admin with no notices: "お知らせ" without a count, still a link to the notices', async ({ page }) => {
    expect((sample.notices ?? []).filter((/** @type {any} */ n) => n.recipientId === sample.viewerIds.admin)).toHaveLength(0);
    await page.goto(urlOf('admin', '?lang=ja&auth=admin'));
    const link = headerNotices(page);
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('data-unread', '0');
    await expect(link).toHaveText(ja['notice.label']);
    await expect(page.locator('mk-site-header').getByRole('link', { name: ja['notice.label'], exact: true })).toHaveCount(1);
    const href = new URL(String(await link.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)));
    expect(href.pathname).toMatch(/\/screens\/my-posts\.html$/);
    expect(href.hash).toBe('#notices');
    // my-posts does not offer the admin login state, so the link drops ?auth like the nav link
    expect(href.searchParams.get('auth')).toBeNull();
  });

  test('English copy', async ({ page }) => {
    await page.goto(urlOf('top', '?lang=en&auth=member'));
    await expect(headerNotices(page)).toHaveText(fmt(en, 'notice.header-unread', { count: unread }));
    await expect(headerNotices(page)).toHaveText(/unread/);
  });

  for (const lang of ['ja', 'en']) {
    test(`375px (${lang}): visible in the bar without opening the menu, no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      for (const id of ['top', 'my-posts', 'post-detail', 'admin']) {
        await page.goto(urlOf(id, `?lang=${lang}&auth=member`));
        const link = headerNotices(page);
        await expect(link).toBeVisible();
        await expect(page.locator('mk-site-header .mk-header__menu')).toBeHidden();
        expect(await link.evaluate((el) => el.closest('.mk-header__bar') !== null)).toBe(true);
        const box = await link.boundingBox();
        expect(box && box.x >= 0 && box.x + box.width <= 375).toBe(true);
        expect(await noHorizontalScroll(page), id).toBe(true);
      }
    });
  }

  test('following the header link lands on the notices section of my-posts', async ({ page }) => {
    await page.goto(urlOf('top', '?lang=ja&auth=member'));
    await headerNotices(page).click();
    await expect(page).toHaveURL(/\/screens\/my-posts\.html\?auth=member#notices$/);
    const section = page.locator('main section#notices');
    await expect(section).toBeVisible();
    await expect(section).toBeInViewport();
  });
});

test.describe('6.10: the notices on my-posts', () => {
  test('member: a "お知らせ" section after the post list with every notice', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('my-posts', '?lang=ja&auth=member'));
    const section = page.getByRole('region', { name: ja['notice.label'], exact: true });
    await expect(section).toBeVisible();
    await expect(section).toHaveAttribute('id', 'notices');
    await expect(section.getByRole('heading', { level: 2, name: ja['notice.label'], exact: true })).toBeVisible();
    // after the post list (DOM order = reading order; review note 6 puts the own posts first)
    const after = await page.evaluate(() => {
      const s = document.getElementById('notices');
      const list = document.querySelector('main [data-my-posts]');
      return s !== null && list !== null && Boolean(s.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_PRECEDING);
    });
    expect(after).toBe(true);
    // the post list keeps a heading of its own, so it is not under "お知らせ"
    await expect(page.locator('main').getByRole('heading', { level: 2, name: ja['screen.my-posts.posts-heading'], exact: true })).toBeVisible();

    const items = section.locator('mk-notice-list li[data-notice-id]');
    await expect(items).toHaveCount(myNotices.length);
    expect(await items.evaluateAll((els) => els.map((el) => el.getAttribute('data-notice-id')))).toEqual(myNotices.map((n) => n.id));
    for (const [i, n] of myNotices.entries()) {
      const item = items.nth(i);
      const reply = commentOf(n.postId, n.replyId);
      const mine = commentOf(n.postId, n.commentId);
      const post = sample.posts.find((/** @type {any} */ p) => p.id === n.postId);
      // unread / read as text
      await expect(item).toHaveAttribute('data-read', String(n.read));
      await expect(item.locator('[data-notice-state]')).toHaveText(ja[n.read ? 'notice.read' : 'notice.unread']);
      // who replied
      await expect(item.locator('.mk-notice__summary')).toHaveText(fmt(ja, 'notice.summary', { name: userName(reply.authorId) }));
      // which of my comments, as an excerpt
      const excerpt = item.locator('[data-notice-comment]');
      await expect(excerpt).toContainText(ja['notice.my-comment']);
      expect(mine.body.startsWith(String(await excerpt.locator('q').textContent()).replace(/…$/, ''))).toBe(true);
      // the reply itself, as an excerpt
      expect(reply.body.startsWith(String(await item.locator('[data-notice-reply] q').textContent()).replace(/…$/, ''))).toBe(true);
      // which post
      await expect(item.locator('[data-notice-post]')).toContainText(userName(post.authorId));
      // when
      const time = item.locator('time');
      await expect(time).toHaveAttribute('datetime', reply.at);
      await expect(time).toHaveText(await page.evaluate((at) => window.MockI18n.formatDate(at, 'datetime'), reply.at));
      // the link to the reply: post-detail of that post, its comments section, auth kept
      const link = item.getByRole('link', { name: new RegExp(`^${ja['notice.open']}`) });
      await expect(link).toHaveCount(1);
      await expect(link).toHaveText(ja['notice.open']);
      const label = String(await link.getAttribute('aria-label'));
      expect(label).toContain(userName(reply.authorId));
      const href = new URL(String(await link.evaluate((a) => /** @type {HTMLAnchorElement} */ (a).href)));
      expect(href.pathname).toMatch(/\/screens\/post-detail\.html$/);
      expect(href.hash).toBe('#post-comments');
      expect(href.searchParams.get('auth')).toBe('member');
      const scenario = scenarioOf(n.postId);
      expect(href.searchParams.get('scenario')).toBe(scenario === 'default' ? null : scenario);
    }
    // the header count equals the unread items
    await expect(section.locator('li[data-read="false"]')).toHaveCount(unread);
    await expect(headerNotices(page)).toHaveAttribute('data-unread', String(unread));
    expect(problems).toEqual([]);
  });

  test('each reply link opens the post with that reply in its comments', async ({ page }) => {
    for (const n of myNotices) {
      await page.goto(urlOf('my-posts', '?lang=ja&auth=member'));
      await page.locator(`#notices li[data-notice-id="${n.id}"] a`).click();
      await expect(page).toHaveURL(/post-detail\.html.*#post-comments$/);
      await expect(page.locator('#post-comments')).toBeVisible();
      await expect(page.locator(`main mk-comment-tree [data-comment-id="${n.replyId}"]`)).toBeVisible();
      await expect(page.locator(`main mk-comment-tree [data-comment-id="${n.commentId}"]`)).toBeVisible();
    }
  });

  test('empty scenario: the notices section shows its empty state (and the posts theirs)', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('my-posts', '?lang=ja&auth=member&scenario=empty'));
    const section = page.locator('main section#notices');
    await expect(section).toBeVisible();
    await expect(section.locator('li[data-notice-id]')).toHaveCount(0);
    await expect(section.locator('mk-notice-list')).toHaveText(ja['empty.notices']);
    await expect(page.locator('main [data-my-posts-empty]')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('fetch-error scenario: the notices section says the notices could not be loaded', async ({ page }) => {
    await page.goto(urlOf('my-posts', '?lang=ja&auth=member&scenario=fetch-error'));
    const section = page.locator('main section#notices');
    await expect(section).toBeVisible();
    await expect(section.locator('li[data-notice-id]')).toHaveCount(0);
    await expect(section.getByRole('alert')).toHaveText(ja['error.notices']);
  });

  test('guest: no notices section', async ({ page }) => {
    await page.goto(urlOf('my-posts', '?lang=ja&auth=guest'));
    await expect(page.locator('main section#notices')).toBeHidden();
  });

  test('English and 375px: the notices fit without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(urlOf('my-posts', '?lang=en&auth=member'));
    const section = page.getByRole('region', { name: en['notice.label'], exact: true });
    await expect(section).toBeVisible();
    await expect(section.locator('[data-notice-state]').first()).toHaveText(en['notice.unread']);
    const fits = await section.locator('li[data-notice-id]').evaluateAll((els) => els.every((el) => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= window.innerWidth;
    }));
    expect(fits).toBe(true);
    expect(await noHorizontalScroll(page)).toBe(true);
  });
});

test.describe('6.11: the reply notice setting', () => {
  test('member: a checkbox, checked by default, in a "お知らせ" section of the settings form', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('settings', '?lang=ja&auth=member'));
    const section = page.locator('main form').getByRole('region', { name: ja['notice.label'], exact: true });
    await expect(section).toBeVisible();
    const box = section.getByRole('checkbox', { name: ja['screen.settings.reply-notices'], exact: true });
    await expect(box).toBeVisible();
    await expect(box).toBeChecked();
    await expect(box).toHaveAccessibleDescription(ja['screen.settings.reply-notices-hint']);
    await box.uncheck();
    await expect(box).not.toBeChecked();
    expect(problems).toEqual([]);
  });

  test('English copy', async ({ page }) => {
    await page.goto(urlOf('settings', '?lang=en&auth=member'));
    await expect(page.getByRole('checkbox', { name: en['screen.settings.reply-notices'], exact: true })).toBeChecked();
  });
});

test.describe('mk-notice-list in the gallery', () => {
  test('a sample with notices and one with none', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(galleryUrl);
    const list = page.locator('#notice-list-member');
    await expect(list).toHaveAttribute('user-id', member);
    await expect(list.locator('li[data-notice-id]')).toHaveCount(myNotices.length);
    const none = page.locator('#notice-list-empty');
    await expect(none.locator('li[data-notice-id]')).toHaveCount(0);
    await expect(none).toHaveText(ja['empty.notices']);
    await expect(page.locator('tr[data-element="mk-notice-list"]')).toHaveCount(1);
    expect(problems).toEqual([]);
  });

  test('the gallery header with ?auth=member shows the count', async ({ page }) => {
    await page.goto(`${galleryUrl}?auth=member`);
    await expect(headerNotices(page).first()).toHaveText(fmt(ja, 'notice.header-unread', { count: unread }));
  });
});

test('registry: my-posts keeps its scenarios (empty also empties the notices)', () => {
  expect(registry.find((s) => s.id === 'my-posts')?.scenarios).toEqual(['default', 'empty', 'fetch-error']);
});
