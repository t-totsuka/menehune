// Task 3.3: users / posts / comments / likes / reports / locations / weather sample data
// (data/sample-data.js -> window.MockSample).
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
  for (const f of files) {
    vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });
  }
  return window;
}

const w = load('assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js', 'data/sample-data.js');
const ja = w.MockMessages.ja;
const en = w.MockMessages.en;
const sample = w.MockSample;
const users = sample.users ?? [];
const posts = sample.posts ?? [];
const reports = sample.reports ?? [];
const userById = new Map(users.map((u) => [u.id, u]));
const postById = new Map(posts.map((p) => [p.id, p]));

const STATUSES = ['public', 'members-only', 'hidden', 'deleted'];
const PRECISIONS = ['exact', 'fuzzed-1km', 'municipality', 'prefecture', 'country'];
const REASONS = ['spam', 'harassment', 'inappropriate', 'personal-info', 'other'];
const STATES = ['open', 'auto-hidden', 'hidden-by-admin', 'appealed', 'restored', 'removed'];
const POST_DETAIL_SCENARIOS = [
  'default', 'private-blocked', 'hidden-own', 'hidden-other',
  'deleted-comment', 'no-location', 'weather-failed',
];
const ISO_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Flattens a comment forest into [{ node, depth, parent }] (top level = depth 1). */
function walk(nodes, depth = 1, parent = undefined, out = []) {
  for (const node of nodes) {
    out.push({ node, depth, parent });
    walk(node.children, depth + 1, node, out);
  }
  return out;
}
const allComments = posts.flatMap((p) => walk(p.comments).map((c) => ({ ...c, post: p })));
const commentById = new Map(allComments.map((c) => [c.node.id, c]));
const maxDepth = (p) => walk(p.comments).reduce((m, c) => Math.max(m, c.depth), 0);
const ms = (iso) => Date.parse(iso);
const timeOf = (iso) => iso.slice(11, 16);

test('users: several fictional members and exactly one admin, unique ids', () => {
  assert.ok(users.filter((u) => !u.isAdmin).length >= 3, 'at least 3 members');
  assert.equal(users.filter((u) => u.isAdmin).length, 1, 'exactly one admin');
  assert.equal(userById.size, users.length, 'unique user ids');
  for (const u of users) assert.ok(u.displayName.trim().length > 0, `${u.id} has a display name`);
});

test('viewerIds: the member viewer is a non-admin user and the admin viewer is the admin', () => {
  assert.equal(userById.get(sample.viewerIds.member)?.isAdmin, false);
  assert.equal(userById.get(sample.viewerIds.admin)?.isAdmin, true);
});

test('posts: unique ids and every author / comment author exists', () => {
  assert.ok(posts.length >= 8);
  assert.equal(postById.size, posts.length, 'unique post ids');
  for (const p of posts) assert.ok(userById.has(p.authorId), `${p.id} author ${p.authorId}`);
  assert.equal(commentById.size, allComments.length, 'unique comment ids across all posts');
  for (const { node } of allComments) assert.ok(userById.has(node.authorId), `${node.id} author ${node.authorId}`);
});

test('posts cover every status, both guestVisible values, and status/visibility agree', () => {
  for (const s of STATUSES) assert.ok(posts.some((p) => p.status === s), `status ${s}`);
  assert.ok(posts.some((p) => p.guestVisible), 'guestVisible true');
  assert.ok(posts.some((p) => !p.guestVisible), 'guestVisible false');
  for (const p of posts) {
    if (p.status === 'public') assert.equal(p.guestVisible, true, `${p.id}: public implies guestVisible`);
    if (p.status === 'members-only') assert.equal(p.guestVisible, false, `${p.id}: members-only implies !guestVisible`);
  }
});

test('posts cover all 5 location precisions and a post without location', () => {
  for (const pr of PRECISIONS) assert.ok(posts.some((p) => p.location?.precision === pr), `precision ${pr}`);
  assert.ok(posts.some((p) => p.location === undefined), 'a post without location');
});

test('weather: present and absent; weather only exists with a location', () => {
  assert.ok(posts.some((p) => p.weather !== undefined), 'weather present');
  assert.ok(posts.some((p) => p.location !== undefined && p.weather === undefined), 'location but weather failed');
  for (const p of posts) {
    if (p.weather !== undefined) assert.ok(p.location !== undefined, `${p.id}: weather requires a location`);
  }
});

test('one post is written in English (no Japanese characters, long enough for wrapping)', () => {
  const english = posts.filter((p) => !/[぀-ヿ一-鿿]/.test(p.body));
  assert.ok(english.length >= 1);
  assert.ok(english.some((p) => p.body.length >= 200), 'a long English body');
});

test('dates: ISO formats, targetDate on or after the posted date and on or after today (2026-11-16)', () => {
  for (const p of posts) {
    assert.match(p.targetDate, ISO_DATE, p.id);
    assert.match(p.postedAt, ISO_OFFSET, p.id);
    assert.ok(p.targetDate >= p.postedAt.slice(0, 10), `${p.id}: targetDate >= posted date`);
    assert.ok(p.postedAt.slice(0, 10) <= sample.today, `${p.id}: posted on or before today`);
    assert.ok(p.targetDate >= sample.today, `${p.id}: targetDate is today or later`);
  }
  const nov = posts.filter((p) => p.targetDate.startsWith('2026-11') && p.status !== 'deleted');
  assert.ok(nov.length >= 5, 'several posts tied to 2026-11 dates');
  assert.ok(posts.some((p) => p.targetDate === sample.today && p.status === 'public'), 'a public post for today');
});

test('comments: times after the post and after the parent; deleted comments keep no body', () => {
  for (const { node, parent, post } of allComments) {
    assert.match(node.at, ISO_OFFSET, node.id);
    assert.ok(ms(node.at) >= ms(post.postedAt), `${node.id} after post`);
    if (parent) assert.ok(ms(node.at) >= ms(parent.at), `${node.id} after parent`);
    if (node.deleted) assert.equal(node.body, '', `${node.id}: deleted comment has an empty body`);
    else assert.ok(node.body.length > 0, `${node.id}: body`);
  }
});

test('a comment tree of depth >= 5 includes deleted comments that keep their children', () => {
  const deep = posts.filter((p) => maxDepth(p) >= 5);
  assert.ok(deep.length >= 1, 'a tree of depth >= 5');
  const nodes = deep.flatMap((p) => walk(p.comments));
  assert.ok(nodes.some((c) => c.node.deleted && c.node.children.length > 0), 'deleted node with children');
});

test('likes: non-negative counts, likedByMe implies count >= 1, both states present', () => {
  for (const p of posts) {
    assert.ok(Number.isInteger(p.likes.count) && p.likes.count >= 0, p.id);
    if (p.likes.likedByMe) assert.ok(p.likes.count >= 1, `${p.id}: likedByMe needs count >= 1`);
  }
  assert.ok(posts.some((p) => p.likes.likedByMe));
  assert.ok(posts.some((p) => !p.likes.likedByMe && p.likes.count > 0));
});

test('regionLabel is no finer than municipality and matches the precision', () => {
  for (const p of posts) {
    const loc = p.location;
    if (!loc) continue;
    const label = loc.regionLabel;
    assert.doesNotMatch(label, /[0-9０-９]|丁目|番地|町内|駅/, `${p.id}: ${label}`);
    if (loc.precision === 'country') assert.equal(label, '日本', p.id);
    else if (loc.precision === 'prefecture') assert.match(label, /^\S+[都道府県]$/, `${p.id}: ${label}`);
    else assert.match(label, /^\S+[都道府県] \S+[市区町村]$/, `${p.id}: ${label}`);
  }
});

test('mapFrame matches the precision', () => {
  const expected = {
    exact: { zoom: 'street', showPin: true, showRadiusKm: undefined },
    'fuzzed-1km': { zoom: 'district', showPin: false, showRadiusKm: 1 },
    municipality: { zoom: 'city', showPin: false, showRadiusKm: undefined },
    prefecture: { zoom: 'prefecture', showPin: false, showRadiusKm: undefined },
    country: { zoom: 'country', showPin: false, showRadiusKm: undefined },
  };
  for (const p of posts) {
    if (!p.location) continue;
    const f = p.location.mapFrame;
    assert.deepEqual({ zoom: f.zoom, showPin: f.showPin, showRadiusKm: f.showRadiusKm },
      expected[p.location.precision], p.id);
  }
});

test('location riseSet is plausible for November near Tokyo on the target date', () => {
  for (const p of posts) {
    if (!p.location) continue;
    const rs = p.location.riseSet;
    assert.ok(rs.sunrise && rs.sunset, `${p.id}: sun times`);
    for (const v of Object.values(rs)) {
      assert.match(v, ISO_OFFSET, p.id);
      assert.equal(v.slice(0, 10), p.targetDate, `${p.id}: riseSet on the target date`);
    }
    assert.ok(timeOf(rs.sunrise) >= '06:00' && timeOf(rs.sunrise) <= '06:40', `${p.id} sunrise ${rs.sunrise}`);
    assert.ok(timeOf(rs.sunset) >= '16:20' && timeOf(rs.sunset) <= '16:50', `${p.id} sunset ${rs.sunset}`);
  }
});

test('weather values are plausible and observed shortly before posting', () => {
  for (const p of posts) {
    const wx = p.weather;
    if (!wx) continue;
    assert.ok(wx.temperatureC >= -5 && wx.temperatureC <= 25, p.id);
    assert.ok(wx.humidityPct >= 0 && wx.humidityPct <= 100, p.id);
    assert.ok(wx.windMps >= 0 && wx.windMps <= 20, p.id);
    assert.match(wx.observedAt, ISO_OFFSET, p.id);
    const lag = ms(p.postedAt) - ms(wx.observedAt);
    assert.ok(lag >= 0 && lag <= 60 * 60 * 1000, `${p.id}: observed within 1h before posting`);
  }
});

test('reports: every state, valid reasons, and targets that exist and match the state', () => {
  for (const s of STATES) assert.ok(reports.some((r) => r.state === s), `state ${s}`);
  assert.ok(reports.some((r) => r.targetType === 'comment'), 'a comment target');
  for (const r of reports) {
    assert.ok(Number.isInteger(r.reportCount) && r.reportCount >= 1, r.targetId);
    assert.ok(r.reasons.length >= 1, r.targetId);
    for (const reason of r.reasons) assert.ok(REASONS.includes(reason), `${r.targetId}: ${reason}`);
    if (r.targetType === 'post') {
      const p = postById.get(r.targetId);
      assert.ok(p, `post ${r.targetId} exists`);
      if (['auto-hidden', 'hidden-by-admin', 'appealed'].includes(r.state)) assert.equal(p.status, 'hidden', r.targetId);
      if (r.state === 'removed') assert.equal(p.status, 'deleted', r.targetId);
      if (['open', 'restored'].includes(r.state)) assert.ok(['public', 'members-only'].includes(p.status), r.targetId);
    } else {
      const c = commentById.get(r.targetId);
      assert.ok(c, `comment ${r.targetId} exists`);
      if (r.state === 'removed') assert.equal(c.node.deleted, true, r.targetId);
      if (['open', 'restored'].includes(r.state)) assert.equal(c.node.deleted, false, r.targetId);
    }
  }
  assert.ok(reports.some((r) => r.reportCount === 1), 'a single-report item (moderation.report-count-one)');
});

test('every MessageKey used by posts and reports exists in both dictionaries', () => {
  const keys = [
    ...posts.flatMap((p) => (p.weather ? [p.weather.conditionKey] : [])),
    ...posts.flatMap((p) => (p.location ? [`location.precision.${p.location.precision}`] : [])),
    ...posts.map((p) => `post.status.${p.status}`),
    ...reports.flatMap((r) => [`moderation.state.${r.state}`, ...r.reasons.map((x) => `moderation.reason.${x}`)]),
  ];
  for (const k of keys) {
    assert.ok(k in ja, `ja has ${k}`);
    assert.ok(k in en, `en has ${k}`);
  }
});

test('postDetailScenarios maps every post-detail scenario to a post that fits it', () => {
  const sc = sample.postDetailScenarios;
  const me = sample.viewerIds.member;
  assert.deepEqual(Object.keys(sc).sort(), [...POST_DETAIL_SCENARIOS].sort());
  const get = (s) => {
    const p = postById.get(sc[s]);
    assert.ok(p, `${s} -> ${sc[s]} exists`);
    return p;
  };
  const d = get('default');
  assert.equal(d.status, 'public');
  assert.ok(d.location && d.weather && d.comments.length > 0, 'default shows location, weather, comments');
  const pb = get('private-blocked');
  assert.equal(pb.guestVisible, false);
  assert.notEqual(pb.status, 'deleted');
  const ho = get('hidden-own');
  assert.equal(ho.status, 'hidden');
  assert.equal(ho.authorId, me, 'hidden-own is authored by the member viewer');
  assert.ok(reports.some((r) => r.targetId === ho.id && r.state === 'appealed'), 'hidden-own can be appealed');
  const hx = get('hidden-other');
  assert.equal(hx.status, 'hidden');
  assert.notEqual(hx.authorId, me, 'hidden-other is not authored by the member viewer');
  const dc = get('deleted-comment');
  assert.ok(maxDepth(dc) >= 5, 'deleted-comment uses the deep tree');
  assert.ok(walk(dc.comments).some((c) => c.node.deleted && c.node.children.length > 0));
  const nl = get('no-location');
  assert.equal(nl.location, undefined);
  assert.equal(nl.weather, undefined);
  const wf = get('weather-failed');
  assert.ok(wf.location, 'weather-failed keeps the location');
  assert.equal(wf.weather, undefined, 'weather-failed has no weather (fetch failed)');
  for (const s of ['default', 'deleted-comment', 'no-location', 'weather-failed']) {
    assert.equal(get(s).status, 'public', `${s} is a public post`);
  }
});

test('the sample data stays deeply frozen', () => {
  assert.ok(Object.isFrozen(sample.posts) && Object.isFrozen(sample.users) && Object.isFrozen(sample.reports));
  assert.ok(Object.isFrozen(sample.postDetailScenarios) && Object.isFrozen(sample.viewerIds));
  for (const { node } of allComments) assert.ok(Object.isFrozen(node) && Object.isFrozen(node.children));
});

// Task 8.1 (my-posts review, 2026-11-19): the list is sorted by target date, newest first, so
// the viewer's own posts need several distinct target dates (and no ties) to show the order.
test('the member viewer has at least three own posts with distinct target dates', () => {
  const mine = posts.filter((p) => p.authorId === sample.viewerIds.member);
  const dates = mine.map((p) => p.targetDate);
  assert.ok(dates.length >= 3, 'three or more own posts');
  assert.equal(new Set(dates).size, dates.length, 'no two own posts share a target date');
});
