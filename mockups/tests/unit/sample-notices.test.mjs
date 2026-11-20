// Task 8.1 (6.9, 6.10): reply notices in the sample data (data/sample-data.js ->
// window.MockSample.notices). A notice tells the author of a comment that someone replied to it.
// The notices are derived from the comment trees, so they must agree with them:
// - the comment replied to (commentId) is in the post's tree and was written by the recipient
// - the reply (replyId) is a direct child of that comment, not deleted, by someone else
// - every live reply by someone else to a comment of the member viewer has exactly one notice
//   (a deleted reply gives none: its author and body are gone)
// - newest reply first; the member viewer has unread and read notices, the admin viewer none
//   (the 0-unread header and the empty list)
// - each notice's post opens in post-detail through a scenario (post-detail has no ?post= param)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Loads classic scripts in order into one fake browser global and returns its `window`. */
function load(...files) {
  const window = {};
  const ctx = vm.createContext({ window });
  for (const f of files) vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });
  return window;
}

const sample = load('data/sample-data.js').MockSample;
const notices = sample.notices ?? [];
const postById = new Map(sample.posts.map((p) => [p.id, p]));
const member = sample.viewerIds.member;
const admin = sample.viewerIds.admin;

/** Flattens a comment forest into [{ node, parent }]. */
const walk = (nodes, parent = undefined) =>
  nodes.flatMap((node) => [{ node, parent }, ...walk(node.children, node)]);
/** @param {string} postId @param {string} id */
const commentIn = (postId, id) => walk(postById.get(postId)?.comments ?? []).find((c) => c.node.id === id);

test('notices: a frozen array with unique ids', () => {
  assert.ok(Array.isArray(notices), 'MockSample.notices is an array');
  assert.ok(Object.isFrozen(notices), 'frozen like the rest of the sample');
  assert.equal(new Set(notices.map((n) => n.id)).size, notices.length, 'unique notice ids');
  for (const n of notices) {
    assert.deepEqual(Object.keys(n).sort(), ['commentId', 'id', 'postId', 'read', 'recipientId', 'replyId']);
    assert.equal(typeof n.read, 'boolean', `${n.id}: read is a boolean`);
  }
});

test('notices: each one follows the comment tree (my comment, a live reply by someone else)', () => {
  for (const n of notices) {
    assert.ok(postById.has(n.postId), `${n.id}: post ${n.postId} exists`);
    const comment = commentIn(n.postId, n.commentId);
    assert.ok(comment, `${n.id}: comment ${n.commentId} is in ${n.postId}`);
    assert.equal(comment.node.authorId, n.recipientId, `${n.id}: the recipient wrote the comment`);
    assert.equal(comment.node.deleted, false, `${n.id}: the comment replied to is not deleted`);
    const reply = comment.node.children.find((c) => c.id === n.replyId);
    assert.ok(reply, `${n.id}: ${n.replyId} is a direct reply to ${n.commentId}`);
    assert.equal(reply.deleted, false, `${n.id}: the reply is not deleted`);
    assert.notEqual(reply.authorId, n.recipientId, `${n.id}: no notice for replying to oneself`);
    assert.ok(sample.users.some((u) => u.id === reply.authorId), `${n.id}: the reply's author exists`);
  }
});

test('notices: every live reply by someone else to a comment of the member viewer is notified once', () => {
  const expected = sample.posts.flatMap((p) => walk(p.comments)
    .filter(({ node, parent }) => parent !== undefined && parent.authorId === member && !parent.deleted
      && !node.deleted && node.authorId !== member)
    .map(({ node }) => node.id)).sort();
  const actual = notices.filter((n) => n.recipientId === member).map((n) => n.replyId).sort();
  assert.deepEqual(actual, expected);
  // the deleted reply c-120-03 to my comment c-120-02 gives no notice
  assert.ok(!actual.includes('c-120-03'));
});

test('notices: newest reply first; the member has unread and read ones, the admin none', () => {
  const at = (n) => Date.parse(commentIn(n.postId, n.replyId)?.node.at ?? '');
  for (let i = 1; i < notices.length; i += 1) {
    assert.ok(at(notices[i - 1]) >= at(notices[i]), `${notices[i - 1].id} is not older than ${notices[i].id}`);
  }
  const mine = notices.filter((n) => n.recipientId === member);
  assert.ok(mine.filter((n) => !n.read).length >= 2, 'two or more unread (the header count)');
  assert.ok(mine.some((n) => n.read), 'a read notice (unread / read are told apart)');
  assert.equal(notices.filter((n) => n.recipientId === admin).length, 0, 'the admin viewer has none (0 unread)');
  // replies are not in the future of the sample's today (2026-11-16)
  const endOfToday = Date.parse(`${sample.today}T00:00+09:00`) + 24 * 60 * 60 * 1000;
  for (const n of notices) assert.ok(at(n) < endOfToday, `${n.id}: not after today`);
});

test('notices: each post opens in post-detail through a scenario', () => {
  const mapped = new Set(Object.values(sample.postDetailScenarios));
  for (const n of notices) assert.ok(mapped.has(n.postId), `${n.id}: ${n.postId} has a post-detail scenario`);
});
