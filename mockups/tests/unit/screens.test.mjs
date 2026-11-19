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
// Task 8.1: every screen got the cross-screen note of 2026-11-19 and is back to in-review.
const REVIEWED_WIREFRAMES = new Map(SCREEN_IDS.map((id) => [id, 'in-review']));

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

// Task 8.1: after the changes are applied the wireframe goes back to in-review (only a person
// approves). The five recorded notes stay, and the outcome of each is recorded after them
// as "反映（8.1）：..." or "見送り（8.1）：...".
test('top: the 2026-11-19 review notes are kept and each outcome is recorded', () => {
  const top = byId().get('top').review.wireframe;
  assert.equal(top.status, 'in-review');
  assert.equal(top.reviewedAt, '2026-11-19');
  const notes = [...(top.notes ?? [])];
  const original = notes.filter((n) => !/^(反映|見送り)（8\.1）：/.test(n));
  const outcomes = notes.filter((n) => /^(反映|見送り)（8\.1）：/.test(n));
  assert.equal(original.length, 6);
  assert.ok(outcomes.length >= original.length, 'every note has an applied / deferred entry');
  assert.ok(outcomes.some((n) => n.startsWith('見送り')), 'the deferred member location basis is recorded');
  assert.ok(original.includes(GUEST_BAND_NOTE), 'the cross-screen note is recorded for top too');
});

// Task 8.1 (cross-screen note of 2026-11-19): the guest notice is one band right below the header
// on every screen. Every screen records the note (in the user's words) and its outcome; login is
// the only screen where it is deferred (no band on the login screen itself).
const GUEST_BAND_NOTE = '「ログインしていないため、閲覧のみ・・・」は全画面通して一番上にエリアを作って表示に統一';

test('every screen records the 2026-11-19 guest band note and its outcome', () => {
  for (const s of registry()) {
    const wf = s.review.wireframe;
    assert.equal(wf.status, 'in-review', `${s.id} back to in-review (only a person approves)`);
    assert.equal(wf.reviewedAt, '2026-11-19', `${s.id} reviewedAt`);
    const notes = [...(wf.notes ?? [])];
    const at = notes.indexOf(GUEST_BAND_NOTE);
    assert.ok(at >= 0, `${s.id} records the note`);
    const outcome = notes[at + 1] ?? '';
    const expected = s.id === 'login' ? /^見送り（8\.1）：/ : /^反映（8\.1）：/;
    assert.match(outcome, expected, `${s.id} outcome right after the note`);
  }
});

// Task 8.1 (calendar-month, 2026-11-19): two notes in the user's words, each followed right
// after by its outcome; the guest band note recorded earlier stays.
const CALENDAR_MONTH_NOTES = ['月曜始まりが望ましい', '月の移動ができない'];

test('calendar-month: the 2026-11-19 review notes are kept and each outcome follows its note', () => {
  const wf = byId().get('calendar-month').review.wireframe;
  assert.equal(wf.status, 'in-review');
  assert.equal(wf.reviewedAt, '2026-11-19');
  const notes = [...(wf.notes ?? [])];
  assert.ok(notes.includes(GUEST_BAND_NOTE), 'the guest band note stays');
  for (const note of CALENDAR_MONTH_NOTES) {
    const at = notes.indexOf(note);
    assert.ok(at >= 0, `records "${note}" verbatim`);
    assert.match(notes[at + 1] ?? '', /^反映（8\.1）：/, `outcome right after "${note}"`);
  }
});

// Task 8.1 (day-detail, 2026-11-19): one note in the user's words, followed right after by its
// outcome; the guest band note and its outcome recorded earlier stay first.
const DAY_DETAIL_NOTE = 'Topに同じく、投稿がメインなので左右１：２で表示';

test('day-detail: the 2026-11-19 review note is kept and its outcome follows it', () => {
  const wf = byId().get('day-detail').review.wireframe;
  assert.equal(wf.status, 'in-review');
  assert.equal(wf.reviewedAt, '2026-11-19');
  const notes = [...(wf.notes ?? [])];
  assert.equal(notes.indexOf(GUEST_BAND_NOTE), 0, 'the guest band note stays first');
  const at = notes.indexOf(DAY_DETAIL_NOTE);
  assert.ok(at >= 2, `records "${DAY_DETAIL_NOTE}" verbatim after the guest band outcome`);
  assert.match(notes[at + 1] ?? '', /^反映（8\.1）：/, 'outcome right after the note');
});

// Task 8.1 (astro-events, 2026-11-19): one note in the user's words, followed right after by its
// outcome; the guest band note and its outcome recorded earlier stay first.
const ASTRO_EVENTS_NOTE = '過去の日付のものはわかるようにしたい';

test('astro-events: the 2026-11-19 review note is kept and its outcome follows it', () => {
  const wf = byId().get('astro-events').review.wireframe;
  assert.equal(wf.status, 'in-review');
  assert.equal(wf.reviewedAt, '2026-11-19');
  const notes = [...(wf.notes ?? [])];
  assert.equal(notes.indexOf(GUEST_BAND_NOTE), 0, 'the guest band note stays first');
  assert.match(notes[1] ?? '', /^反映（8\.1）：/, 'the guest band outcome stays second');
  const at = notes.indexOf(ASTRO_EVENTS_NOTE);
  assert.ok(at >= 2, `records "${ASTRO_EVENTS_NOTE}" verbatim after the guest band outcome`);
  assert.match(notes[at + 1] ?? '', /^反映（8\.1）：/, 'outcome right after the note');
});

// Task 8.1 (post-detail, 2026-11-19): one note in the user's words, followed right after by its
// outcome; the guest band note and its outcome recorded earlier stay first.
const POST_DETAIL_NOTE = '左右１：１で「投稿」と「コメント」は近くに寄せたい';

test('post-detail: the 2026-11-19 review note is kept and its outcome follows it', () => {
  const wf = byId().get('post-detail').review.wireframe;
  assert.equal(wf.status, 'in-review');
  assert.equal(wf.reviewedAt, '2026-11-19');
  const notes = [...(wf.notes ?? [])];
  assert.equal(notes.indexOf(GUEST_BAND_NOTE), 0, 'the guest band note stays first');
  assert.match(notes[1] ?? '', /^反映（8\.1）：/, 'the guest band outcome stays second');
  const at = notes.indexOf(POST_DETAIL_NOTE);
  assert.ok(at >= 2, `records "${POST_DETAIL_NOTE}" verbatim after the guest band outcome`);
  assert.match(notes[at + 1] ?? '', /^反映（8\.1）：/, 'outcome right after the note');
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
