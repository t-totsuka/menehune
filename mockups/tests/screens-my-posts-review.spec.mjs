// Task 8.1 (my-posts only): the wireframe review notes recorded for `my-posts` in data/screens.js
// (Requirements 6.6, 12.1, 12.2, 13.3, 13.5).
//   1. "投稿の時系列がわからないので1列にすること": the list of own posts is one column at every
//      width (.screen-my-posts-list; top and day-detail keep the shared .screen-post-list grid).
//   2. "新しい日付が上に来るように": sorted by the date the card shows prominently, the target date
//      (対象日), newest first; ties (none in the sample) fall back to postedAt, newest first, then id.
//   3. "公開範囲などはアイコン化する（マウスホバーで説明が出ればよい）": mk-post-card `meta="icons"`
//      (opt-in) shows the visibility setting (guestVisible) as an icon (role="img", aria-label and
//      title), and the status badge of public / members-only as its symbol only (text visually
//      hidden, title on hover). Hidden and deleted keep the full text badge (moderation states).
//      A <details> legend on the page explains every icon for keyboard and touch users. Icons
//      differ by shape and symbol, not by colour alone. 375px keeps the icons.
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MOCKUPS_ROOT, loadClassicScripts, watchConsole } from './helpers/e2e.mjs';

const w = loadClassicScripts('data/sample-data.js', 'assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js');
/** @type {Record<string, string>} */
const ja = w.MockMessages.ja;
/** @type {Record<string, string>} */
const en = w.MockMessages.en;
const sample = /** @type {any} */ (w.MockSample);

const urlOf = (/** @type {string} */ id, query = '') =>
  pathToFileURL(join(MOCKUPS_ROOT, 'screens', `${id}.html`)).href + query;
const galleryUrl = pathToFileURL(join(MOCKUPS_ROOT, 'components.html')).href;

/** The viewer's own posts, target date newest first (explicit expectation of the sample). */
const EXPECTED_ORDER = ['p-111', 'p-104', 'p-108', 'p-102'];
/** @type {any[]} */
const myPosts = EXPECTED_ORDER.map((id) => sample.posts.find((/** @type {any} */ p) => p.id === id));
const ICON_STATUSES = ['public', 'members-only'];

/** @param {Record<string, string>} m @param {any} post */
const visibilityText = (m, post) => m[post.guestVisible ? 'post-card.visibility.guests' : 'post-card.visibility.members'] ?? '';
/** @param {Record<string, string>} m @param {string} status */
const statusTitle = (m, status) => (m['post-card.status-label'] ?? '⟦post-card.status-label⟧').replace('{status}', m[`post.status.${status}`] ?? '');

/** Shape of an inline SVG: child tag names with their geometry attributes. @param {import('@playwright/test').Locator} svg */
const shapeOf = (svg) => svg.evaluate((el) => [...el.children].map((c) =>
  [c.localName, ...[...c.attributes].map((a) => `${a.name}=${a.value}`).sort()].join(' ')));

test.describe('my-posts: review note 1 (one column)', () => {
  for (const width of [375, 960, 1440]) {
    test(`the list is a single column at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(urlOf('my-posts', '?lang=ja&auth=member'));
      const list = page.locator('main ul[data-my-posts]');
      await expect(list).toHaveClass(/\bscreen-my-posts-list\b/);
      const boxes = await list.locator('> li').evaluateAll((els) => els.map((el) => {
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), width: Math.round(r.width) };
      }));
      const listWidth = await list.evaluate((el) => Math.round(el.getBoundingClientRect().width));
      expect(boxes).toHaveLength(EXPECTED_ORDER.length);
      for (const b of boxes) {
        expect(b.left).toBe(boxes[0]?.left);
        expect(b.width).toBe(listWidth);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test('day-detail keeps the shared two-column post grid at 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(urlOf('day-detail', '?lang=ja&date=2026-11-24'));
    const list = page.locator('main ul.screen-post-list');
    await expect(list).not.toHaveClass(/\bscreen-my-posts-list\b/);
    const columns = await list.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(2);
  });
});

test.describe('my-posts: review note 2 (newest target date first)', () => {
  test('the sample gives distinct target dates for the order to show', () => {
    expect(new Set(myPosts.map((p) => p.targetDate)).size).toBe(EXPECTED_ORDER.length);
  });

  test('cards are ordered by target date, newest first (the date the card shows)', async ({ page }) => {
    await page.goto(urlOf('my-posts', '?lang=ja&auth=member'));
    const cards = page.locator('main [data-my-posts] mk-post-card');
    expect(await cards.evaluateAll((els) => els.map((el) => el.getAttribute('post-id')))).toEqual(EXPECTED_ORDER);
    const shown = await page.locator('main [data-my-posts] .mk-post-card__date time').evaluateAll((els) =>
      els.map((el) => el.getAttribute('datetime') ?? ''));
    expect(shown).toEqual(myPosts.map((p) => p.targetDate));
    expect([...shown].sort().reverse()).toEqual(shown);
  });
});

test.describe('my-posts: review note 3 (visibility and status as icons)', () => {
  test('each card shows the visibility icon with an accessible name and a hover title', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('my-posts', '?lang=ja&auth=member'));
    for (const post of myPosts) {
      const card = page.locator(`main [data-my-post="${post.id}"] mk-post-card`);
      await expect(card).toHaveAttribute('meta', 'icons');
      const icon = card.locator('[data-meta-icons] [data-meta-icon="visibility"]');
      await expect(icon).toHaveCount(1);
      await expect(icon).toBeVisible();
      await expect(icon).toHaveAttribute('role', 'img');
      await expect(icon).toHaveAttribute('data-value', post.guestVisible ? 'guests' : 'members');
      await expect(icon).toHaveAttribute('aria-label', visibilityText(ja, post));
      await expect(icon).toHaveAttribute('title', visibilityText(ja, post));
      await expect(card.getByRole('img', { name: visibilityText(ja, post), exact: true })).toHaveCount(1);
      await expect(icon.locator('svg')).toHaveAttribute('aria-hidden', 'true');
      // the visibility is no longer a separate line of text below the card
      await expect(page.locator(`main [data-my-post="${post.id}"] [data-visibility]`)).toHaveCount(0);
    }
    // guests and members differ by shape, not by colour alone
    const guests = card0(page, 'guests');
    const members = card0(page, 'members');
    expect(await shapeOf(guests)).not.toEqual(await shapeOf(members));
    expect(problems).toEqual([]);
  });

  test('public / members-only badges become symbols with a title; hidden / deleted keep their text', async ({ page }) => {
    await page.goto(urlOf('my-posts', '?lang=ja&auth=member'));
    for (const post of myPosts) {
      const badge = page.locator(`main [data-my-post="${post.id}"] [data-meta-icons] mk-status-badge`);
      await expect(badge).toHaveCount(1);
      const text = badge.locator('.mk-status-badge__text');
      // the label stays in the accessibility tree either way
      await expect(text).toHaveText(ja[`post.status.${post.status}`] ?? '');
      await expect(badge.locator('[data-status-symbol]')).toBeVisible();
      const width = await text.evaluate((el) => el.getBoundingClientRect().width);
      if (ICON_STATUSES.includes(post.status)) {
        await expect(badge).toHaveAttribute('data-icon', '');
        await expect(badge).toHaveAttribute('title', statusTitle(ja, post.status));
        expect(width, `${post.status} text is visually hidden`).toBeLessThanOrEqual(1);
      } else {
        await expect(badge).not.toHaveAttribute('data-icon', '');
        expect(width, `${post.status} text stays visible`).toBeGreaterThan(1);
      }
    }
  });

  test('a legend in <details> explains every icon for keyboard and touch users', async ({ page }) => {
    await page.goto(urlOf('my-posts', '?lang=ja&auth=member'));
    const legend = page.locator('main details[data-icon-legend]');
    await expect(legend).toHaveCount(1);
    await expect(legend).not.toHaveAttribute('open', '');
    const summary = legend.locator('> summary');
    await expect(summary).toHaveText(ja['screen.my-posts.icon-legend'] ?? '');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(legend).toHaveAttribute('open', '');
    const guestsItem = legend.locator('[data-legend-icon="visibility-guests"]');
    const membersItem = legend.locator('[data-legend-icon="visibility-members"]');
    await expect(guestsItem).toHaveText(ja['post-card.visibility.guests'] ?? '');
    await expect(membersItem).toHaveText(ja['post-card.visibility.members'] ?? '');
    expect(await shapeOf(guestsItem.locator('svg'))).toEqual(await shapeOf(card0(page, 'guests')));
    expect(await shapeOf(membersItem.locator('svg'))).toEqual(await shapeOf(card0(page, 'members')));
    for (const status of ICON_STATUSES) {
      const item = legend.locator(`[data-legend-icon="status-${status}"]`);
      await expect(item).toContainText(ja[`post.status.${status}`] ?? '');
      const symbol = await page.locator(`main mk-status-badge[status="${status}"] [data-status-symbol]`).first().textContent();
      await expect(item.locator('[data-legend-symbol]')).toHaveText(symbol ?? '');
    }
    await expect(legend).toContainText(ja['screen.my-posts.icon-legend-note'] ?? '');
  });

  test('the legend is hidden with the list in the empty and fetch-error scenarios', async ({ page }) => {
    for (const scenario of ['empty', 'fetch-error']) {
      await page.goto(urlOf('my-posts', `?lang=ja&auth=member&scenario=${scenario}`));
      await expect(page.locator('main details[data-icon-legend]'), scenario).toBeHidden();
    }
  });

  test('English: the icon names, titles and legend follow the language', async ({ page }) => {
    await page.goto(urlOf('my-posts', '?lang=en&auth=member'));
    for (const post of myPosts) {
      const icon = page.locator(`main [data-my-post="${post.id}"] [data-meta-icon="visibility"]`);
      await expect(icon).toHaveAttribute('aria-label', visibilityText(en, post));
      await expect(icon).toHaveAttribute('title', visibilityText(en, post));
    }
    await expect(page.locator('main [data-my-post="p-102"] mk-status-badge')).toHaveAttribute('title', statusTitle(en, 'public'));
    await expect(page.locator('main details[data-icon-legend] > summary')).toHaveText(en['screen.my-posts.icon-legend'] ?? '');
  });

  test('375px keeps the icons on one card row without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(urlOf('my-posts', '?lang=en&auth=member'));
    await expect(page.locator('main [data-meta-icon="visibility"]:visible')).toHaveCount(EXPECTED_ORDER.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('other screens and the default card keep the text badges (opt-in)', async ({ page }) => {
    await page.goto(urlOf('top', '?lang=ja&auth=member'));
    await expect(page.locator('main mk-post-card').first()).toBeVisible();
    await expect(page.locator('main mk-post-card[meta]')).toHaveCount(0);
    await expect(page.locator('main [data-meta-icons]')).toHaveCount(0);
    await page.goto(urlOf('day-detail', '?lang=ja&date=2026-11-24'));
    await expect(page.locator('main mk-post-card').first()).toBeVisible();
    await expect(page.locator('main [data-meta-icons]')).toHaveCount(0);
  });

  test('the component gallery has a meta="icons" sample next to the default cards', async ({ page }) => {
    await page.goto(galleryUrl);
    const sampleCard = page.locator('#post-card-icons');
    await expect(sampleCard).toHaveAttribute('meta', 'icons');
    await expect(sampleCard.locator('[data-meta-icon="visibility"]')).toHaveCount(1);
    await expect(page.locator('#post-card-p-101 [data-meta-icons]')).toHaveCount(0);
  });
});

/** The SVG of the first card's visibility icon with the given value. @param {import('@playwright/test').Page} page @param {string} value */
function card0(page, value) {
  return page.locator(`main [data-my-posts] [data-meta-icon="visibility"][data-value="${value}"] svg`).first();
}

// Task 8.1 (my-posts, note 4): "自分の投稿で投稿にぶら下がるコメントが何件あるか出してください".
// mk-post-card `comment-count` (opt-in) shows the number of comments in the post's whole tree
// (replies included) as text in the meta row with the icons. Deleted comments (6.4: kept in the
// tree, shown as deleted) are not counted. Deleted posts show no count; hidden posts do (their
// author still sees the post and its comments). Counts come from SamplePost.comments, the same
// data post-detail renders.

/** Comments in a tree that are not deleted, replies included. @param {readonly any[]} nodes @returns {number} */
const liveComments = (nodes) => nodes.reduce((n, c) => n + (c.deleted ? 0 : 1) + liveComments(c.children), 0);
/** @param {Record<string, string>} m @param {number} count */
const commentText = (m, count) =>
  (m[count === 1 ? 'post-card.comment-count-one' : 'post-card.comment-count'] ?? '⟦post-card.comment-count⟧')
    .replace('{count}', String(count));
/** @param {string} id */
const postById = (id) => sample.posts.find((/** @type {any} */ p) => p.id === id);

test.describe('my-posts: review note 4 (comment count)', () => {
  test('the expected counts follow the sample comment trees (replies in, deleted out)', () => {
    expect(myPosts.map((p) => [p.id, liveComments(p.comments)])).toEqual([
      ['p-111', 0], ['p-104', 1], ['p-108', 0], ['p-102', 1],
    ]);
    // the gallery sample p-120: 10 comments in a deep tree, 2 of them deleted
    expect(liveComments(postById('p-120').comments)).toBe(8);
  });

  test('each card that is not deleted shows the count as text in the meta row', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('my-posts', '?lang=ja&auth=member'));
    for (const post of myPosts) {
      const card = page.locator(`main [data-my-post="${post.id}"] mk-post-card`);
      await expect(card).toHaveAttribute('comment-count', '');
      const count = card.locator('[data-comment-count]');
      if (post.status === 'deleted') {
        await expect(count, `${post.id} (deleted) has no count`).toHaveCount(0);
        continue;
      }
      const n = liveComments(post.comments);
      await expect(count).toHaveCount(1);
      await expect(count).toBeVisible();
      await expect(count).toHaveAttribute('data-comment-count', String(n));
      await expect(count).toHaveText(commentText(ja, n));
      // it sits with the icons, and it is plain text (no aria-hidden on the way)
      await expect(card.locator('[data-meta-icons] [data-comment-count]')).toHaveCount(1);
      await expect(count.locator('xpath=ancestor-or-self::*[@aria-hidden="true"]')).toHaveCount(0);
    }
    expect(problems).toEqual([]);
  });

  test('English: singular and plural follow the count', async ({ page }) => {
    await page.goto(urlOf('my-posts', '?lang=en&auth=member'));
    await expect(page.locator('main [data-my-post="p-102"] [data-comment-count]')).toHaveText(commentText(en, 1));
    await expect(page.locator('main [data-my-post="p-108"] [data-comment-count]')).toHaveText(commentText(en, 0));
    expect(commentText(en, 1)).not.toEqual(commentText(en, 0).replace('0', '1'));
  });

  test('375px keeps the count in the card head without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(urlOf('my-posts', '?lang=en&auth=member'));
    const counts = page.locator('main .mk-post-card__head [data-comment-count]:visible');
    await expect(counts).toHaveCount(myPosts.filter((p) => p.status !== 'deleted').length);
    const fits = await counts.evaluateAll((els) => els.every((el) => {
      const r = el.getBoundingClientRect();
      const card = el.closest('.mk-post-card')?.getBoundingClientRect();
      return card !== undefined && r.left >= card.left && r.right <= card.right;
    }));
    expect(fits).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('top, day-detail and the default gallery cards show no count (opt-in)', async ({ page }) => {
    await page.goto(urlOf('top', '?lang=ja&auth=member'));
    await expect(page.locator('main mk-post-card').first()).toBeVisible();
    await expect(page.locator('main [data-comment-count]')).toHaveCount(0);
    await page.goto(urlOf('day-detail', '?lang=ja&date=2026-11-24'));
    await expect(page.locator('main mk-post-card').first()).toBeVisible();
    await expect(page.locator('main [data-comment-count]')).toHaveCount(0);
    await page.goto(galleryUrl);
    await expect(page.locator('#post-card-p-101 [data-comment-count]')).toHaveCount(0);
  });

  test('the gallery sample counts replies and leaves deleted comments out', async ({ page }) => {
    await page.goto(galleryUrl);
    const plain = page.locator('#post-card-comment-count');
    await expect(plain).toHaveAttribute('post-id', 'p-120');
    await expect(plain).toHaveAttribute('comment-count', '');
    await expect(plain.locator('[data-comment-count]')).toHaveText(commentText(ja, 8));
    // without meta="icons" the status badge keeps its text next to the count
    await expect(plain.locator('mk-status-badge')).not.toHaveAttribute('data-icon', '');
    const icons = page.locator('#post-card-icons-comments');
    await expect(icons).toHaveAttribute('post-id', 'p-101');
    await expect(icons).toHaveAttribute('meta', 'icons');
    await expect(icons.locator('[data-meta-icons] [data-comment-count]'))
      .toHaveText(commentText(ja, liveComments(postById('p-101').comments)));
  });
});

// Task 8.1 (my-posts review note 6, 2026-11-20): "自分の投稿は「自分の投稿」を優先とする、PC画面の
// 場合は左右に配置して２：１から３：１のサイズで収まるように変更". The posts part (heading
// 「投稿の一覧」 through the list, its own region .screen-my-posts-posts) comes before the notices
// section (#notices) in DOM / reading order; from 960px (the PC breakpoint of the other two-column
// screens) they sit side by side, posts on the left, and posts width / notices width stays within
// [2, 3] at every PC width (main is at most 1280px wide). Narrower widths stack them, posts above.
test.describe('my-posts: review note 6 (own posts first, side by side on PC at 2:1 to 3:1)', () => {
  /** @param {import('@playwright/test').Page} page */
  const boxes = (page) => page.evaluate(() => {
    const posts = document.querySelector('main [data-member-content] > section.screen-my-posts-posts');
    const notices = document.getElementById('notices');
    if (posts === null || notices === null) return null;
    const p = posts.getBoundingClientRect();
    const n = notices.getBoundingClientRect();
    return {
      posts: { left: p.left, right: p.right, top: p.top, bottom: p.bottom, width: p.width },
      notices: { left: n.left, right: n.right, top: n.top, bottom: n.bottom, width: n.width },
    };
  });

  test('the posts part is a region of its own, before the notices in DOM order', async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(urlOf('my-posts', '?lang=ja&auth=member'));
    const region = page.getByRole('region', { name: ja['screen.my-posts.posts-heading'], exact: true });
    await expect(region).toBeVisible();
    await expect(region).toHaveClass(/\bscreen-my-posts-posts\b/);
    await expect(region).toHaveAttribute('aria-labelledby', 'my-posts-posts-heading');
    // the heading, the create button, the legend and the list live in the posts region
    await expect(region.getByRole('heading', { level: 2, name: ja['screen.my-posts.posts-heading'], exact: true })).toBeVisible();
    await expect(region.locator('[data-icon-legend]')).toHaveCount(1);
    await expect(region.locator('ul[data-my-posts] > li')).toHaveCount(EXPECTED_ORDER.length);
    await expect(region.getByRole('link', { name: ja['screen.my-posts.new-post'], exact: true })).toBeVisible();
    const order = await page.evaluate(() => {
      const container = document.querySelector('main [data-member-content]');
      return [...(container?.children ?? [])]
        .map((el) => el.id || (el.classList.contains('screen-my-posts-posts') ? 'screen-my-posts-posts' : el.className));
    });
    expect(order).toEqual(['screen-my-posts-posts', 'notices']);
    await expect(page.locator('main [data-member-content]')).toHaveClass(/\bscreen-my-posts\b/);
    expect(problems).toEqual([]);
  });

  for (const width of [960, 1280, 1440, 1920]) {
    test(`at ${width}px the posts are on the left and the notices on the right, posts : notices in [2, 3]`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(urlOf('my-posts', '?lang=ja&auth=member'));
      await expect(page.locator('main ul[data-my-posts] > li')).toHaveCount(EXPECTED_ORDER.length);
      const b = await boxes(page);
      expect(b).not.toBeNull();
      if (b === null) return;
      expect(b.posts.right).toBeLessThanOrEqual(b.notices.left);
      expect(Math.abs(b.posts.top - b.notices.top)).toBeLessThanOrEqual(1);
      const ratio = b.posts.width / b.notices.width;
      expect(ratio, `ratio ${ratio}`).toBeGreaterThanOrEqual(2);
      expect(ratio, `ratio ${ratio}`).toBeLessThanOrEqual(3);
      // the notices content stays inside its column
      const fits = await page.evaluate(() => {
        const n = document.getElementById('notices');
        if (n === null) return false;
        const r = n.getBoundingClientRect();
        return [...n.querySelectorAll('*')].every((el) => {
          const e = el.getBoundingClientRect();
          return e.width === 0 || (e.left >= r.left - 0.5 && e.right <= r.right + 0.5);
        });
      });
      expect(fits).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  for (const lang of ['ja', 'en']) {
    test(`375px (${lang}): stacked, posts above the notices, no horizontal scroll`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto(urlOf('my-posts', `?lang=${lang}&auth=member`));
      await expect(page.locator('main ul[data-my-posts] > li')).toHaveCount(EXPECTED_ORDER.length);
      const b = await boxes(page);
      expect(b).not.toBeNull();
      if (b === null) return;
      expect(b.posts.bottom).toBeLessThanOrEqual(b.notices.top);
      expect(Math.abs(b.posts.width - b.notices.width)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test('empty and fetch-error keep both parts in the same order', async ({ page }) => {
    for (const scenario of ['empty', 'fetch-error']) {
      await page.goto(urlOf('my-posts', `?lang=ja&auth=member&scenario=${scenario}`));
      const region = page.locator('main section.screen-my-posts-posts');
      await expect(region).toBeVisible();
      if (scenario === 'empty') await expect(region.locator('[data-my-posts-empty]')).toBeVisible();
      else await expect(region.getByRole('alert')).toHaveText(ja['error.fetch']);
      const before = await page.evaluate(() => {
        const posts = document.querySelector('main section.screen-my-posts-posts');
        const notices = document.getElementById('notices');
        return posts !== null && notices !== null
          && Boolean(posts.compareDocumentPosition(notices) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      expect(before, scenario).toBe(true);
    }
  });
});
