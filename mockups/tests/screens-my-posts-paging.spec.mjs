// Task 8.1 (my-posts review note 7, 2026-11-20): "「自分の投稿」は暫定的に投稿・コメント欄は30件ごとに
// ページングができるように". Read as: both columns of my-posts, the post list (left) and the reply
// notices (right, mk-notice-list), page by 30 items (provisional size). The pager is the shared,
// opt-in mk-pager: a <nav> named per list, previous / next buttons (disabled at the ends), page
// buttons with aria-current="page" on the current one and a range text ("31〜60件目 / 全75件").
// With 30 items or fewer it renders nothing. The default sample has 4 own posts and 3 notices, so
// the scenario `many-items` (my-posts only) adds MockSample.paging (71 posts, 37 notices) to make
// paging reviewable: 75 posts and 40 notices. After a page change the list's heading gets focus.
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MOCKUPS_ROOT, loadClassicScripts, watchConsole } from './helpers/e2e.mjs';
import { pageHorizontalOverflow } from './helpers/layout-checks.mjs';

const w = loadClassicScripts('data/sample-data.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;
const sample = /** @type {any} */ (w.MockSample);
const member = sample.viewerIds.member;

const urlOf = (query = '') => pathToFileURL(join(MOCKUPS_ROOT, 'screens', 'my-posts.html')).href + query;
const galleryUrl = pathToFileURL(join(MOCKUPS_ROOT, 'components.html')).href;

/** Own posts in the many-items scenario, target date newest first (then postedAt, then id). */
const ALL_POSTS = [...sample.posts, ...(sample.paging?.posts ?? [])]
  .filter((/** @type {any} */ p) => p.authorId === member)
  .sort((/** @type {any} */ a, /** @type {any} */ b) => b.targetDate.localeCompare(a.targetDate)
    || Date.parse(b.postedAt) - Date.parse(a.postedAt) || a.id.localeCompare(b.id))
  .map((/** @type {any} */ p) => p.id);
const ALL_NOTICES = [...sample.notices, ...(sample.paging?.notices ?? [])]
  .filter((/** @type {any} */ n) => n.recipientId === member).map((/** @type {any} */ n) => n.id);

/** @param {Record<string, string>} m @param {string} key @param {Record<string, string | number>} args */
const fmt = (m, key, args) => Object.entries(args).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), m[key] ?? `⟦${key}⟧`);

/** @param {import('@playwright/test').Page} page */
const postsSection = (page) => page.locator('main section[aria-labelledby="my-posts-posts-heading"]');
/** @param {import('@playwright/test').Page} page */
const noticesSection = (page) => page.locator('main #notices');
/** @param {import('@playwright/test').Page} page */
const postIds = (page) => postsSection(page).locator('ul[data-my-posts] > li[data-my-post]')
  .evaluateAll((els) => els.map((el) => el.getAttribute('data-my-post')));
/** @param {import('@playwright/test').Page} page */
const noticeIds = (page) => noticesSection(page).locator('li[data-notice-id]')
  .evaluateAll((els) => els.map((el) => el.getAttribute('data-notice-id')));

test('the expectation: 75 own posts and 40 notices in many-items', () => {
  expect(ALL_POSTS).toHaveLength(75);
  expect(ALL_NOTICES).toHaveLength(40);
});

test.describe('my-posts paging: the post list', () => {
  test('page 1 shows exactly the first 30 posts and the pager; prev disabled, page 1 current', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('?lang=ja&auth=member&scenario=many-items'));
    expect(await postIds(page)).toEqual(ALL_POSTS.slice(0, 30));
    const nav = postsSection(page).getByRole('navigation', { name: ja['pager.posts-label'] });
    await expect(nav).toBeVisible();
    await expect(nav.locator('[data-pager-range]')).toHaveText(fmt(ja, 'pager.range', { from: 1, to: 30, total: 75 }));
    const prev = nav.getByRole('button', { name: ja['pager.prev'] });
    const next = nav.getByRole('button', { name: ja['pager.next'] });
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();
    await expect(nav.locator('[data-pager-page]')).toHaveCount(3);
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('data-pager-page', '1');
    await expect(nav.getByRole('button', { name: fmt(ja, 'pager.page-label', { page: 2 }) })).toBeVisible();
    // keep comment counts, icons and the legend
    await expect(postsSection(page).locator('[data-icon-legend]')).toBeVisible();
    await expect(postsSection(page).locator('li[data-my-post] mk-post-card [data-meta-icons]')).toHaveCount(30);
    await expect(postsSection(page).locator('li[data-my-post] [data-comment-count]').first()).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('next goes to page 2 with the next 30 in order, focuses the heading; last page has the rest', async ({ page }) => {
    await page.goto(urlOf('?lang=ja&auth=member&scenario=many-items'));
    const nav = postsSection(page).getByRole('navigation', { name: ja['pager.posts-label'] });
    await nav.getByRole('button', { name: ja['pager.next'] }).click();
    expect(await postIds(page)).toEqual(ALL_POSTS.slice(30, 60));
    await expect(nav.locator('[data-pager-range]')).toHaveText(fmt(ja, 'pager.range', { from: 31, to: 60, total: 75 }));
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('data-pager-page', '2');
    await expect(nav.getByRole('button', { name: ja['pager.prev'] })).toBeEnabled();
    await expect(page.locator('#my-posts-posts-heading')).toBeFocused();

    await nav.getByRole('button', { name: fmt(ja, 'pager.page-label', { page: 3 }) }).click();
    expect(await postIds(page)).toEqual(ALL_POSTS.slice(60));
    await expect(nav.locator('[data-pager-range]')).toHaveText(fmt(ja, 'pager.range', { from: 61, to: 75, total: 75 }));
    await expect(nav.getByRole('button', { name: ja['pager.next'] })).toBeDisabled();
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('data-pager-page', '3');

    await nav.getByRole('button', { name: ja['pager.prev'] }).click();
    expect(await postIds(page)).toEqual(ALL_POSTS.slice(30, 60));
  });

  test('keyboard: Tab reaches the pager buttons, Enter changes the page, focus is visible', async ({ page }) => {
    await page.goto(urlOf('?lang=ja&auth=member&scenario=many-items'));
    const nav = postsSection(page).getByRole('navigation', { name: ja['pager.posts-label'] });
    const next = nav.getByRole('button', { name: ja['pager.next'] });
    await next.focus();
    await page.keyboard.press('Enter');
    expect(await postIds(page)).toEqual(ALL_POSTS.slice(30, 60));
    await expect(page.locator('#my-posts-posts-heading')).toBeFocused();
    // back on page 1, the disabled previous button is not in the tab order
    await nav.getByRole('button', { name: fmt(ja, 'pager.page-label', { page: 1 }) }).click();
    const prev = nav.getByRole('button', { name: ja['pager.prev'] });
    await expect(prev).toBeDisabled();
    await nav.getByRole('button', { name: fmt(ja, 'pager.page-label', { page: 1 }) }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(prev).not.toBeFocused();
    await nav.getByRole('button', { name: fmt(ja, 'pager.page-label', { page: 2 }) }).focus();
    const outline = await page.evaluate(() => getComputedStyle(/** @type {Element} */ (document.activeElement)).outlineStyle);
    expect(outline).not.toBe('none');
  });

  test('the page is kept when the language changes; English texts', async ({ page }) => {
    await page.goto(urlOf('?lang=ja&auth=member&scenario=many-items'));
    const navJa = postsSection(page).getByRole('navigation', { name: ja['pager.posts-label'] });
    await navJa.getByRole('button', { name: ja['pager.next'] }).click();
    await page.evaluate(() => window.MockState.update({ lang: 'en' }));
    const nav = postsSection(page).getByRole('navigation', { name: en['pager.posts-label'] });
    await expect(nav.locator('[data-pager-range]')).toHaveText(fmt(en, 'pager.range', { from: 31, to: 60, total: 75 }));
    await expect(nav.getByRole('button', { name: en['pager.next'] })).toBeVisible();
    await expect(nav.getByRole('button', { name: fmt(en, 'pager.page-label', { page: 3 }) })).toBeVisible();
    expect(await postIds(page)).toEqual(ALL_POSTS.slice(30, 60));
  });

  test('the edit link of a generated post opens post-edit filled with it, without warnings', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('?lang=ja&auth=member&scenario=many-items'));
    const id = ALL_POSTS.find((p) => p.startsWith('p-m')) ?? '';
    const post = sample.paging.posts.find((/** @type {any} */ p) => p.id === id);
    await postsSection(page).locator(`li[data-my-post="${id}"] a[data-edit-date]`).click();
    await expect(page).toHaveURL(new RegExp(`post-edit\\.html\\?.*post=${id}`));
    await expect(page.locator('#post-body')).toHaveValue(post.body);
    await expect(page.locator('#post-target-date')).toHaveValue(post.targetDate);
    await expect(page.locator('#post-guest-visible')).toBeChecked({ checked: post.guestVisible });
    expect(problems).toEqual([]);
  });

  test('default data (4 posts) shows no pager; switching to many-items and back works', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('?lang=ja&auth=member'));
    expect(await postIds(page)).toEqual(ALL_POSTS.filter((id) => sample.posts.some((/** @type {any} */ p) => p.id === id)));
    await expect(page.locator('main nav.mk-pager')).toHaveCount(0);
    await page.evaluate(() => window.MockState.update({ scenario: 'many-items' }));
    expect(await postIds(page)).toEqual(ALL_POSTS.slice(0, 30));
    await expect(page.locator('main nav.mk-pager')).toHaveCount(2);
    await page.evaluate(() => window.MockState.update({ scenario: 'default' }));
    expect(await postIds(page)).toHaveLength(4);
    await expect(page.locator('main nav.mk-pager')).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});

test.describe('my-posts paging: the notices', () => {
  test('page 1 shows the first 30 notices; next shows the remaining 10; disabled ends', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('?lang=ja&auth=member&scenario=many-items'));
    expect(await noticeIds(page)).toEqual(ALL_NOTICES.slice(0, 30));
    const nav = noticesSection(page).getByRole('navigation', { name: ja['pager.notices-label'] });
    await expect(nav.locator('[data-pager-range]')).toHaveText(fmt(ja, 'pager.range', { from: 1, to: 30, total: 40 }));
    await expect(nav.getByRole('button', { name: ja['pager.prev'] })).toBeDisabled();
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('data-pager-page', '1');
    await nav.getByRole('button', { name: ja['pager.next'] }).click();
    expect(await noticeIds(page)).toEqual(ALL_NOTICES.slice(30));
    await expect(nav.locator('[data-pager-range]')).toHaveText(fmt(ja, 'pager.range', { from: 31, to: 40, total: 40 }));
    await expect(nav.getByRole('button', { name: ja['pager.next'] })).toBeDisabled();
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('data-pager-page', '2');
    await expect(page.locator('#my-posts-notices-heading')).toBeFocused();
    // the post list stays on its own page
    expect(await postIds(page)).toEqual(ALL_POSTS.slice(0, 30));
    expect(problems).toEqual([]);
  });

  test('a scenario change through fetch-error brings the notices back to page 1', async ({ page }) => {
    await page.goto(urlOf('?lang=ja&auth=member&scenario=many-items'));
    const nav = noticesSection(page).getByRole('navigation', { name: ja['pager.notices-label'] });
    await nav.getByRole('button', { name: ja['pager.next'] }).click();
    expect(await noticeIds(page)).toEqual(ALL_NOTICES.slice(30));
    await page.evaluate(() => window.MockState.update({ scenario: 'fetch-error' }));
    await expect(noticesSection(page).locator('mk-notice-list [role="alert"]')).toHaveText(ja['error.notices']);
    await page.evaluate(() => window.MockState.update({ scenario: 'many-items' }));
    expect(await noticeIds(page)).toEqual(ALL_NOTICES.slice(0, 30));
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('data-pager-page', '1');
  });

  test('default data (3 notices) shows no pager; the header link and unread count stay', async ({ page }) => {
    await page.goto(urlOf('?lang=ja&auth=member&scenario=many-items'));
    const link = page.locator('mk-site-header a[href*="#notices"]');
    await expect(link).toHaveText(fmt(ja, 'notice.header-unread', { count: 2 }));
    await page.goto(urlOf('?lang=ja&auth=member'));
    expect(await noticeIds(page)).toHaveLength(3);
    await expect(noticesSection(page).locator('nav')).toHaveCount(0);
  });

  test('the gallery notice list has no page-size, so it never pages (opt-in)', async ({ page }) => {
    await page.goto(`${galleryUrl}?scenario=many-items`);
    await expect(page.locator('#notice-list-member nav')).toHaveCount(0);
    await expect(page.locator('#sec-pager')).toHaveCount(1);
  });
});

test.describe('my-posts paging: narrow widths', () => {
  for (const lang of /** @type {const} */ (['ja', 'en'])) {
    for (const width of [320, 375]) {
      test(`${width}px (${lang}): both pagers fit without page-level horizontal scroll`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(urlOf(`?lang=${lang}&auth=member&scenario=many-items`));
        await expect(page.locator('main nav.mk-pager')).toHaveCount(2);
        expect(await page.evaluate(pageHorizontalOverflow)).toBe(0);
        for (const nav of await page.locator('main nav.mk-pager').all()) {
          const box = await nav.boundingBox();
          expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
        }
      });
    }
  }
});
