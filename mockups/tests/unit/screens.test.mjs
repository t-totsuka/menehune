// Task 1.4: screen registry (data/screens.js -> window.MockScreens).
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

const SCREEN_IDS = [
  'top', 'calendar-month', 'day-detail', 'astro-events', 'star-chart',
  'post-detail', 'post-edit', 'my-posts', 'settings', 'login',
  'report', 'appeal', 'admin', 'attribution', 'privacy',
];
const SCENARIO_IDS = [
  'default', 'empty', 'fetch-error', 'validation-error',
  'private-blocked', 'hidden-own', 'hidden-other',
  'deleted-comment', 'no-location', 'weather-failed', 'provisional-holiday',
];
const AUTH_STATES = ['guest', 'member', 'admin'];
const REVIEW_STATUSES = ['draft', 'in-review', 'changes-requested', 'approved'];

const registry = () => load('data/screens.js').MockScreens;
const byId = () => new Map(registry().map((s) => [s.id, s]));

test('registers exactly the 15 screen ids, each once', () => {
  const screens = registry();
  assert.ok(Array.isArray(screens), 'window.MockScreens must be an array');
  const ids = screens.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
  assert.deepEqual([...ids].sort(), [...SCREEN_IDS].sort());
});

test('titleKey is screen.{id}.title and exists in both dictionaries', () => {
  const w = load('assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js', 'data/screens.js');
  for (const s of w.MockScreens) {
    assert.equal(s.titleKey, `screen.${s.id}.title`);
    assert.ok(s.titleKey in w.MockMessages.ja, `ja missing ${s.titleKey}`);
    assert.ok(s.titleKey in w.MockMessages.en, `en missing ${s.titleKey}`);
  }
});

test('scenarios start with default, are unique and are valid ScenarioIds', () => {
  for (const s of registry()) {
    assert.equal(s.scenarios[0], 'default', `${s.id} scenarios[0]`);
    assert.equal(new Set(s.scenarios).size, s.scenarios.length, `${s.id} duplicate scenarios`);
    for (const sc of s.scenarios) assert.ok(SCENARIO_IDS.includes(sc), `${s.id}: bad scenario ${sc}`);
  }
});

test('scenario assignments follow the design initial values', () => {
  const m = byId();
  const expected = {
    'calendar-month': ['default', 'provisional-holiday'],
    'astro-events': ['default', 'empty', 'fetch-error'],
    'my-posts': ['default', 'empty', 'fetch-error'],
    'post-detail': ['default', 'private-blocked', 'hidden-own', 'hidden-other',
      'deleted-comment', 'no-location', 'weather-failed'],
    'post-edit': ['default', 'validation-error'],
    admin: ['default', 'empty'],
  };
  for (const id of SCREEN_IDS) {
    assert.deepEqual([...m.get(id).scenarios], expected[id] ?? ['default'], `${id} scenarios`);
  }
});

test('access levels: admin is admin, member-only screens are member, others public', () => {
  const m = byId();
  const member = ['post-edit', 'my-posts', 'settings', 'report', 'appeal'];
  for (const id of SCREEN_IDS) {
    const want = id === 'admin' ? 'admin' : member.includes(id) ? 'member' : 'public';
    assert.equal(m.get(id).access, want, `${id} access`);
  }
});

test('authStates are valid, unique, include the default guest, and admin can switch all three', () => {
  for (const s of registry()) {
    assert.ok(s.authStates.length > 0, `${s.id} authStates empty`);
    assert.equal(new Set(s.authStates).size, s.authStates.length, `${s.id} duplicate authStates`);
    for (const a of s.authStates) assert.ok(AUTH_STATES.includes(a), `${s.id}: bad auth ${a}`);
    assert.equal(s.authStates[0], 'guest', `${s.id} default auth guest must come first`);
    assert.ok(s.authStates.includes('member'), `${s.id} must allow member`);
  }
  assert.deepEqual([...byId().get('admin').authStates], ['guest', 'member', 'admin']);
});

// Screens whose wireframe review has been recorded by a person (see data/screens.js).
const REVIEWED_WIREFRAMES = new Map([['top', 'changes-requested']]);

test('review statuses are valid, unreviewed stages are draft and the hifi/wireframe invariant holds', () => {
  for (const s of registry()) {
    for (const stage of ['wireframe', 'hifi']) {
      assert.ok(REVIEW_STATUSES.includes(s.review[stage]?.status), `${s.id} ${stage} status`);
      const expected = (stage === 'wireframe' && REVIEWED_WIREFRAMES.get(s.id)) || 'draft';
      assert.equal(s.review[stage].status, expected, `${s.id} ${stage} status`);
    }
    if (s.review.wireframe.status !== 'draft') {
      assert.ok(s.review.wireframe.reviewedAt, `${s.id} reviewed wireframe has reviewedAt`);
      if (s.review.wireframe.status === 'changes-requested') {
        assert.ok((s.review.wireframe.notes ?? []).length > 0, `${s.id} changes-requested has notes`);
      }
    }
    if (s.review.hifi.status !== 'draft') {
      assert.equal(s.review.wireframe.status, 'approved', `${s.id} invariant`);
    }
  }
});

test('registry and every nested object is frozen', () => {
  const screens = registry();
  assert.ok(Object.isFrozen(screens));
  for (const s of screens) {
    for (const o of [s, s.authStates, s.scenarios, s.review, s.review.wireframe, s.review.hifi]) {
      assert.ok(Object.isFrozen(o), `${s.id} not deeply frozen`);
    }
  }
});
