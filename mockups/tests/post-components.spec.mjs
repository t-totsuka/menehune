// Task 4.5: mk-post-card, mk-comment-tree, mk-like-button, mk-report-link (6.1, 6.4, 6.6, 6.7,
// 6.8, 8.3, 12.4).
// - mk-post-card: target date, status badge (mk-status-badge), excerpt and like count.
// - mk-comment-tree: nested comments; indentation up to 6 levels on PC and 3 below 600px, deeper
//   comments are not indented further and show whom they reply to; deleted comments show
//   moderation.comment-deleted instead of the body and keep their replies.
// - mk-like-button: count + pressed state for logged-in viewers, count only for guests.
// - mk-report-link: link to the report screen, nothing for guests.
import { test, expect } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const catalogUrl = pathToFileURL(join(root, 'components.html')).href;

const load = (/** @type {string[]} */ ...files) => {
  const window = /** @type {Record<string, any>} */ ({});
  const ctx = vm.createContext({ window });
  for (const f of files) vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });
  return window;
};
const w = load('assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js', 'data/sample-data.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;
/** @type {SampleDataSet} */
const sample = w.MockSample;
/** @param {Record<string, string>} dict @param {string} key @param {Record<string, string | number>} [args] */
const fill = (dict, key, args = {}) => String(dict[key]).replace(/\{([^{}]+)\}/g, (all, name) => (name in args ? String(args[name]) : all));
/** @param {string} id */
const post = (id) => /** @type {SamplePost} */ (sample.posts.find((p) => p.id === id));
/** @param {string} id */
const userName = (id) => /** @type {SampleUser} */ (sample.users.find((u) => u.id === id)).displayName;

/** @param {import('@playwright/test').Page} page */
const collectProblems = (page) => {
  /** @type {string[]} */
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  return problems;
};

/** @param {import('@playwright/test').Page} page @param {number} width @param {string} [query] */
const open = async (page, width, query = '') => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${catalogUrl}${query}`);
};

/** @param {import('@playwright/test').Page} page @param {string} date */
const longDate = (page, date) => page.evaluate((d) => window.MockI18n.formatDate(d, 'date-long'), date);

test.describe('mk-post-card', () => {
  test('target date, status badge, excerpt and like count', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440);
    const card = page.locator('#post-card-p-101');
    const p = post('p-101');
    await expect(card.locator('time')).toHaveAttribute('datetime', p.targetDate);
    await expect(card.locator('time')).toHaveText(await longDate(page, p.targetDate));
    await expect(card.locator('mk-status-badge')).toHaveAttribute('status', 'public');
    await expect(card.locator('mk-status-badge')).toContainText(ja['post.status.public']);
    await expect(card.locator('.mk-post-card__excerpt')).toHaveText(p.body);
    await expect(card.locator('.mk-post-card__likes')).toContainText(fill(ja, 'like.count', { count: 12 }));
    await expect(card.locator('.mk-post-card__date-label')).toHaveText(ja['post-card.target-date']);
    const link = card.getByRole('link', { name: await longDate(page, p.targetDate) });
    await expect(link).toHaveAttribute('href', /screens\/post-detail\.html/);
    expect(problems).toEqual([]);
  });

  test('every status of 6.6 is shown with the status badge', async ({ page }) => {
    await open(page, 1440, '?auth=member');
    for (const [id, status] of [['p-104', 'members-only'], ['p-108', 'hidden'], ['p-111', 'deleted']]) {
      const badge = page.locator(`#post-card-${id} mk-status-badge`);
      await expect(badge).toHaveAttribute('status', status);
      await expect(badge).toContainText(ja[`post.status.${status}`]);
    }
  });

  test('a long body is cut into an excerpt; compact is shorter', async ({ page }) => {
    await open(page, 1440);
    const long = (await page.locator('#post-card-p-103 .mk-post-card__excerpt').textContent()) ?? '';
    expect(long.endsWith('…')).toBe(true);
    expect(post('p-103').body.startsWith(long.slice(0, -1).trimEnd())).toBe(true);
    expect(long.length).toBeLessThan(post('p-103').body.length);
    const compact = (await page.locator('#post-card-compact .mk-post-card__excerpt').textContent()) ?? '';
    expect(compact.endsWith('…')).toBe(true);
    expect(compact.length).toBeLessThan(post('p-102').body.length);
    await expect(page.locator('#post-card-compact')).toHaveAttribute('variant', 'compact');
  });

  test('a missing post id renders the missing-sample message', async ({ page }) => {
    await open(page, 1440);
    await expect(page.locator('#post-card-missing [data-missing-sample="p-999"]')).toBeVisible();
  });

  test('?lang=en: English like count with the singular form for one like', async ({ page }) => {
    await open(page, 1440, '?lang=en');
    await expect(page.locator('#post-card-p-101 .mk-post-card__likes')).toContainText(fill(en, 'like.count', { count: 12 }));
    await expect(page.locator('#post-card-p-108 .mk-post-card__likes')).toContainText(fill(en, 'like.count-one', { count: 1 }));
    await expect(page.locator('#post-card-p-101 mk-status-badge')).toContainText(en['post.status.public']);
  });
});

test.describe('mk-like-button', () => {
  test('guest: count only, no button', async ({ page }) => {
    await open(page, 1440, '?auth=guest');
    const like = page.locator('#like-p-101');
    await expect(like.getByRole('button')).toHaveCount(0);
    await expect(like).toContainText(fill(ja, 'like.count', { count: 12 }));
  });

  test('member: a pressed / unpressed button with the count; clicking toggles both', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440, '?auth=member');
    const liked = page.locator('#like-p-101').getByRole('button');
    await expect(liked).toHaveAttribute('aria-pressed', 'true');
    await expect(liked).toContainText(fill(ja, 'like.count', { count: 12 }));
    await expect(page.locator('#like-p-102').getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    await liked.click();
    await expect(liked).toHaveAttribute('aria-pressed', 'false');
    await expect(liked).toContainText(fill(ja, 'like.count', { count: 11 }));
    await expect(liked).toBeFocused();
    await liked.click();
    await expect(liked).toHaveAttribute('aria-pressed', 'true');
    await expect(liked).toContainText(fill(ja, 'like.count', { count: 12 }));
    expect(problems).toEqual([]);
  });

  test('missing post id', async ({ page }) => {
    await open(page, 1440, '?auth=member');
    await expect(page.locator('#like-missing [data-missing-sample="p-999"]')).toBeVisible();
  });
});

test.describe('mk-report-link', () => {
  test('guest: nothing is shown', async ({ page }) => {
    await open(page, 1440, '?auth=guest');
    await expect(page.locator('#report-p-101 a')).toHaveCount(0);
    await expect(page.locator('#report-c-101-1 a')).toHaveCount(0);
  });

  test('member: links to the report screen for a post and a comment', async ({ page }) => {
    await open(page, 1440, '?auth=member');
    const postLink = page.locator('#report-p-101').getByRole('link', { name: ja['report-link.post'] });
    await expect(postLink).toHaveAttribute('href', /screens\/report\.html\?.*target=p-101/);
    await expect(postLink).toContainText(ja['button.report']);
    const name = fill(ja, 'report-link.comment', { name: userName('u-hoshizora') });
    const commentLink = page.locator('#report-c-101-1').getByRole('link', { name });
    await expect(commentLink).toHaveAttribute('href', /target=c-101-1/);
    await expect(commentLink).toHaveAttribute('href', /auth=member/);
  });

  test('unknown target id', async ({ page }) => {
    await open(page, 1440, '?auth=member');
    await expect(page.locator('#report-missing [data-missing-sample="x-999"]')).toBeVisible();
  });
});

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} commentId
 */
// Task 6.4: the gallery also shows p-120 in its phone-width frame (#comments-narrow); these tests
// check the PC samples.
const comment = (page, commentId) => page.locator(`mk-comment-tree:not(#comments-narrow) [data-comment-id="${commentId}"]`);
/**
 * Left edge of a comment's own box (not its replies).
 * @param {import('@playwright/test').Page} page
 * @param {string} commentId
 */
const boxOf = (page, commentId) => comment(page, commentId).locator(':scope > .mk-comment__box');

/** Ids on the depth-7 chain of p-120, depth 1..7. */
const CHAIN = ['c-120-01', 'c-120-02', 'c-120-03', 'c-120-04', 'c-120-05', 'c-120-06', 'c-120-07'];

test.describe('mk-comment-tree', () => {
  test('nested comments: author, time, body and depth (6.1)', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 1440);
    const tree = page.locator('#comments-p-120');
    await expect(tree.locator('[data-comment-id]')).toHaveCount(10);
    for (const [i, id] of CHAIN.entries()) {
      await expect(comment(page, id)).toHaveAttribute('data-depth', String(i + 1));
    }
    // Nesting is structural: each chain comment is inside its parent.
    await expect(comment(page, 'c-120-01').locator('[data-comment-id="c-120-07"]')).toHaveCount(1);
    const first = boxOf(page, 'c-120-01');
    await expect(first.locator('.mk-comment__author')).toHaveText(userName('u-tsukimi'));
    await expect(first.locator('time')).toHaveAttribute('datetime', '2026-11-15T19:48+09:00');
    await expect(first.locator('.mk-comment__body')).toHaveText(post('p-120').comments[0].body);
    expect(problems).toEqual([]);
  });

  test('a deleted comment shows the deleted message and keeps its replies (6.4)', async ({ page }) => {
    await open(page, 1440);
    for (const [deleted, child] of [['c-120-03', 'c-120-04'], ['c-120-08', 'c-120-09']]) {
      const node = comment(page, deleted);
      await expect(node).toHaveAttribute('data-deleted', '');
      await expect(boxOf(page, deleted).locator('.mk-comment__deleted')).toHaveText(ja['moderation.comment-deleted']);
      await expect(boxOf(page, deleted).locator('.mk-comment__body')).toHaveCount(0);
      await expect(node.locator(`[data-comment-id="${child}"]`)).toHaveCount(1);
      await expect(boxOf(page, child).locator('.mk-comment__body')).toBeVisible();
    }
  });

  test('PC: indented for every level up to 6; no reply-to label', async ({ page }) => {
    await open(page, 1440);
    /** @type {number[]} */
    const lefts = [];
    for (const id of CHAIN) lefts.push(/** @type {{ x: number }} */ (await boxOf(page, id).boundingBox()).x);
    for (let i = 1; i < lefts.length; i += 1) expect(lefts[i]).toBeGreaterThan(lefts[i - 1]);
    for (const id of CHAIN) await expect(boxOf(page, id).locator('.mk-comment__reply-to')).toBeHidden();
  });

  test('375px: indented up to 3 levels, deeper comments stay readable and show whom they reply to (12.4)', async ({ page }) => {
    const problems = collectProblems(page);
    await open(page, 375);
    /** @type {{ x: number, width: number }[]} */
    const boxes = [];
    for (const id of CHAIN) boxes.push(/** @type {{ x: number, width: number }} */ (await boxOf(page, id).boundingBox()));
    for (let i = 1; i <= 3; i += 1) expect(boxes[i].x).toBeGreaterThan(boxes[i - 1].x);
    for (let i = 4; i < CHAIN.length; i += 1) expect(Math.abs(boxes[i].x - boxes[3].x)).toBeLessThan(0.5);
    const treeBox = /** @type {{ width: number }} */ (await page.locator('#comments-p-120').boundingBox());
    // The deepest comment keeps most of the tree width for its body.
    expect(boxes[6].width).toBeGreaterThan(treeBox.width * 0.7);
    for (const id of CHAIN.slice(0, 4)) await expect(boxOf(page, id).locator('.mk-comment__reply-to')).toBeHidden();
    // c-120-05 replies to c-120-04 (u-kumo); c-120-07 replies to c-120-06 (u-hoshizora).
    await expect(boxOf(page, 'c-120-05').locator('.mk-comment__reply-to')).toBeVisible();
    await expect(boxOf(page, 'c-120-05').locator('.mk-comment__reply-to')).toContainText(fill(ja, 'comment.reply-to', { name: userName('u-kumo') }));
    await expect(boxOf(page, 'c-120-07').locator('.mk-comment__reply-to')).toContainText(fill(ja, 'comment.reply-to', { name: userName('u-hoshizora') }));
    // Body text of the deepest comment is not clipped.
    const clipped = await boxOf(page, 'c-120-07').locator('.mk-comment__body').evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(clipped).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(problems).toEqual([]);
  });

  test('guest: no report links; member: a report link on every comment that is not deleted', async ({ page }) => {
    await open(page, 1440, '?auth=guest');
    await expect(page.locator('#comments-p-120 mk-report-link a')).toHaveCount(0);
    await open(page, 1440, '?auth=member');
    await expect(page.locator('#comments-p-120 mk-report-link a')).toHaveCount(8);
    await expect(boxOf(page, 'c-120-03').locator('mk-report-link')).toHaveCount(0);
    await expect(boxOf(page, 'c-120-01').locator('mk-report-link a')).toHaveAttribute('href', /target=c-120-01/);
  });

  test('a post without comments shows the empty state; a missing post id the missing-sample message', async ({ page }) => {
    await open(page, 1440);
    await expect(page.locator('#comments-empty')).toHaveText(ja['empty.comments']);
    await expect(page.locator('#comments-missing [data-missing-sample="p-999"]')).toBeVisible();
  });

  test('?lang=en: deleted message, reply-to label and tree label in English', async ({ page }) => {
    await open(page, 375, '?lang=en');
    await expect(boxOf(page, 'c-120-03').locator('.mk-comment__deleted')).toHaveText(en['moderation.comment-deleted']);
    await expect(boxOf(page, 'c-120-05').locator('.mk-comment__reply-to')).toContainText(fill(en, 'comment.reply-to', { name: userName('u-kumo') }));
    await expect(page.locator('#comments-p-120 [aria-label]').first()).toHaveAttribute('aria-label', en['comment.tree-label']);
  });
});

test.describe('layout', () => {
  for (const width of [360, 375, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await open(page, width, '?auth=member');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      const fits = await page.locator('mk-post-card, mk-comment-tree, mk-like-button, mk-report-link').evaluateAll((els) => els.map((el) => {
        const r = el.getBoundingClientRect();
        return r.right <= document.documentElement.clientWidth + 0.5;
      }));
      // 29 PC samples, plus the phone-width tree of p-120 and its 8 report links (task 6.4), plus
      // the two meta="icons" cards (task 8.1, my-posts review).
      expect(fits.length).toBe(40);
      expect(fits.every(Boolean)).toBe(true);
    });
  }
});
