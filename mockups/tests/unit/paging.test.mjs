// Task 8.1 (my-posts, 2026-11-20: "「自分の投稿」は暫定的に投稿・コメント欄は30件ごとにページングが
// できるように"): the pure paging logic of mk-pager (window.MockPaging in the foundation script assets/js/paging.js) and the extra
// sample items that make paging reviewable (window.MockSample.paging, used only by the my-posts
// scenario `many-items`; the shared lists MockSample.posts / notices do not change).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Loads paging.js: a foundation script without the DOM, so a bare `window` is enough. */
function loadPaging() {
  const window = {};
  vm.runInContext(readFileSync(join(root, 'assets/js/paging.js'), 'utf8'), vm.createContext({ window }), { filename: 'paging.js' });
  return window.MockPaging;
}

/** @param {string} file */
function loadSample(file) {
  const window = {};
  vm.runInContext(readFileSync(join(root, file), 'utf8'), vm.createContext({ window }), { filename: file });
  return window.MockSample;
}

const P = loadPaging();

test('MockPaging: a frozen object with the page size 30 (provisional)', () => {
  assert.ok(P, 'paging.js registers window.MockPaging');
  assert.ok(Object.isFrozen(P));
  assert.equal(P.PAGE_SIZE, 30);
});

test('pageCount: at least one page, rounded up', () => {
  assert.equal(P.pageCount(0, 30), 1);
  assert.equal(P.pageCount(1, 30), 1);
  assert.equal(P.pageCount(30, 30), 1);
  assert.equal(P.pageCount(31, 30), 2);
  assert.equal(P.pageCount(40, 30), 2);
  assert.equal(P.pageCount(75, 30), 3);
  assert.equal(P.pageCount(90, 30), 3);
});

test('clampPage: an integer page within 1..pageCount; anything else falls back', () => {
  assert.equal(P.clampPage(2, 75, 30), 2);
  assert.equal(P.clampPage(9, 75, 30), 3);
  assert.equal(P.clampPage(0, 75, 30), 1);
  assert.equal(P.clampPage(-3, 75, 30), 1);
  assert.equal(P.clampPage(Number.NaN, 75, 30), 1);
  assert.equal(P.clampPage(2.5, 75, 30), 2);
  assert.equal(P.clampPage(3, 10, 30), 1);
});

test('pageRange: 1-based first and last item numbers of a page', () => {
  assert.deepEqual({ ...P.pageRange(75, 1, 30) }, { from: 1, to: 30 });
  assert.deepEqual({ ...P.pageRange(75, 2, 30) }, { from: 31, to: 60 });
  assert.deepEqual({ ...P.pageRange(75, 3, 30) }, { from: 61, to: 75 });
  assert.deepEqual({ ...P.pageRange(40, 2, 30) }, { from: 31, to: 40 });
  assert.deepEqual({ ...P.pageRange(0, 1, 30) }, { from: 0, to: 0 });
  assert.deepEqual({ ...P.pageRange(75, 7, 30) }, { from: 61, to: 75 }, 'the page is clamped');
});

test('pageItems: the slice of a page, keeping the order', () => {
  const items = Array.from({ length: 75 }, (_, i) => i + 1);
  assert.deepEqual(P.pageItems(items, 1, 30), items.slice(0, 30));
  assert.deepEqual(P.pageItems(items, 2, 30), items.slice(30, 60));
  assert.deepEqual(P.pageItems(items, 3, 30), items.slice(60));
  assert.deepEqual(P.pageItems(items, 4, 30), items.slice(60), 'the page is clamped');
  assert.deepEqual(P.pageItems([1, 2], 1, 30), [1, 2]);
  assert.deepEqual(P.pageItems([], 1, 30), []);
});

// ---- the extra sample items of the scenario many-items --------------------------------------

const sample = loadSample('data/sample-data.js');
const member = sample.viewerIds.member;
const paging = sample.paging;

/** Flattens a comment forest. */
const walk = (nodes) => nodes.flatMap((n) => [n, ...walk(n.children)]);

test('paging sample: frozen, separate from the shared posts and notices', () => {
  assert.ok(paging, 'MockSample.paging exists');
  assert.ok(Object.isFrozen(paging) && Object.isFrozen(paging.posts) && Object.isFrozen(paging.notices));
  const ids = new Set(sample.posts.map((p) => p.id));
  for (const p of paging.posts) assert.ok(!ids.has(p.id), `${p.id} is not a shared post id`);
  assert.equal(new Set(paging.posts.map((p) => p.id)).size, paging.posts.length, 'unique post ids');
  const noticeIds = new Set(sample.notices.map((n) => n.id));
  for (const n of paging.notices) assert.ok(!noticeIds.has(n.id), `${n.id} is not a shared notice id`);
});

test('paging sample: 75 own posts with the shared ones, all older than the shared ones', () => {
  const own = sample.posts.filter((p) => p.authorId === member);
  assert.ok(paging.posts.every((p) => p.authorId === member), 'every extra post is the member viewer\'s');
  assert.equal(own.length + paging.posts.length, 75);
  const oldestShared = own.map((p) => p.targetDate).sort()[0];
  for (const p of paging.posts) {
    assert.ok(p.targetDate < oldestShared, `${p.id} (${p.targetDate}) is older than the shared own posts`);
    assert.match(p.targetDate, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(new Set(paging.posts.map((p) => p.targetDate)).size, paging.posts.length, 'one post per date (a strict order)');
});

test('paging sample: 40 notices for the member with the shared ones; all read; they follow the trees', () => {
  const postById = new Map(paging.posts.map((p) => [p.id, p]));
  assert.equal(sample.notices.filter((n) => n.recipientId === member).length + paging.notices.length, 40);
  for (const n of paging.notices) {
    assert.equal(n.recipientId, member);
    assert.equal(n.read, true, `${n.id}: read, so the header's unread count stays the same`);
    const post = postById.get(n.postId);
    assert.ok(post, `${n.id}: the post is an extra post`);
    const mine = walk(post.comments).find((c) => c.id === n.commentId);
    assert.ok(mine && mine.authorId === member && !mine.deleted, `${n.id}: my comment`);
    const reply = mine.children.find((c) => c.id === n.replyId);
    assert.ok(reply && reply.authorId !== member && !reply.deleted, `${n.id}: a live reply by someone else`);
    assert.ok(sample.users.some((u) => u.id === reply.authorId));
  }
});

test('paging sample: the shared and extra notices together are newest reply first', () => {
  const all = [...sample.posts, ...paging.posts];
  const replyAt = (n) => {
    const post = all.find((p) => p.id === n.postId);
    return Date.parse(walk(post?.comments ?? []).find((c) => c.id === n.replyId)?.at ?? '');
  };
  const list = [...sample.notices.filter((n) => n.recipientId === member), ...paging.notices];
  for (let i = 1; i < list.length; i += 1) {
    assert.ok(replyAt(list[i - 1]) > replyAt(list[i]), `${list[i - 1].id} is newer than ${list[i].id}`);
  }
});
