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
// Task 8.1: every screen got the cross-screen note of 2026-11-19 and is back to in-review, except
// the wireframes a person has approved (add the id here when a person approves another screen).
const APPROVED_WIREFRAMES = new Set(['star-chart']);
const REVIEWED_WIREFRAMES = new Map(SCREEN_IDS.map((id) => [id, APPROVED_WIREFRAMES.has(id) ? 'approved' : 'in-review']));
const APPROVAL_NOTE = /^承認（8\.1）：/;

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

// Task 8.1: only a person approves. An approved wireframe records the approval as its last note
// ("承認（8.1）：..."); a wireframe that is not approved has no approval note.
test('an approved wireframe ends with the 承認（8.1） note; the others have none', () => {
  for (const s of registry()) {
    const notes = [...(s.review.wireframe.notes ?? [])];
    if (s.review.wireframe.status === 'approved') {
      assert.match(notes.at(-1) ?? '', APPROVAL_NOTE, `${s.id} last note records the approval`);
      assert.equal(notes.filter((n) => APPROVAL_NOTE.test(n)).length, 1, `${s.id} one approval note`);
    } else {
      assert.ok(!notes.some((n) => APPROVAL_NOTE.test(n)), `${s.id} not approved has no approval note`);
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
  assert.equal(original.length, 7);
  assert.ok(outcomes.length >= original.length, 'every note has an applied / deferred entry');
  assert.ok(outcomes.some((n) => n.startsWith('見送り')), 'the deferred member location basis is recorded');
  assert.ok(original.includes(GUEST_BAND_NOTE), 'the cross-screen note is recorded for top too');
  // the relative days note (2026-11-19, after astro-events got relative-days) comes last, in the
  // user's words, right after the guest band outcome, and is followed by its own outcome
  const at = notes.indexOf(TOP_RELATIVE_DAYS_NOTE);
  assert.equal(at, notes.indexOf(GUEST_BAND_NOTE) + 2, `records "${TOP_RELATIVE_DAYS_NOTE}" verbatim after the guest band outcome`);
  assert.match(notes[at + 1] ?? '', /^反映（8\.1）：/, 'outcome right after the note');
  assert.equal(notes.length, at + 2);
});
const TOP_RELATIVE_DAYS_NOTE = 'トップにも出すようにしたい。';

// Task 8.1 (cross-screen note of 2026-11-19): the guest notice is one band right below the header
// on every screen. Every screen records the note (in the user's words) and its outcome; login is
// the only screen where it is deferred (no band on the login screen itself).
const GUEST_BAND_NOTE = '「ログインしていないため、閲覧のみ・・・」は全画面通して一番上にエリアを作って表示に統一';

test('every screen records the 2026-11-19 guest band note and its outcome', () => {
  for (const s of registry()) {
    const wf = s.review.wireframe;
    const expected = APPROVED_WIREFRAMES.has(s.id) ? 'approved' : 'in-review';
    assert.equal(wf.status, expected, `${s.id} in-review, or approved by a person`);
    assert.equal(wf.reviewedAt, '2026-11-19', `${s.id} reviewedAt`);
    const notes = [...(wf.notes ?? [])];
    const at = notes.indexOf(GUEST_BAND_NOTE);
    assert.ok(at >= 0, `${s.id} records the note`);
    const outcome = notes[at + 1] ?? '';
    const outcomeExpected = s.id === 'login' ? /^見送り（8\.1）：/ : /^反映（8\.1）：/;
    assert.match(outcome, outcomeExpected, `${s.id} outcome right after the note`);
  }
});

// Task 8.1 (calendar-month, 2026-11-19): three notes in the user's words, each followed right
// after by its outcome; the guest band note recorded earlier stays.
const CALENDAR_MONTH_NOTES = ['月曜始まりが望ましい', '月の移動ができない', 'カレンダーで2026年11月が2回出てくるので要修正'];

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

// Task 8.1 (day-detail, second round of 2026-11-19): four notes in the user's words, each
// followed right after by its outcome. The fourth (二十四節気) clarifies the second (七十二候):
// only the 候 gets the day count. The earlier notes and outcomes stay before them.
const DAY_DETAIL_WORDING_NOTES = [
  '日の詳細で「この日」が多用されている。日付が1つしかないのは自明なので「年月日」を表示すること、「この日の投稿」も投稿は自明なので不要。',
  '日の詳細の七十二候は期間なので「ＸＸＸＸ（ｎ日目）」が良い',
  '日の詳細で「なし」の項目は非表示が良い',
  '二十四節気は太陽の位置から決められたポイントなので同じ形にする必要はない。',
  // follow-up (2026-11-19): the moonrise / moonset rows were not plain 「なし」 and must stay
  '月の出・月の入りは「なし」ではなかったが消えてしまった。',
];

test('day-detail: the second-round notes are recorded in order, each followed by its outcome', () => {
  const wf = byId().get('day-detail').review.wireframe;
  assert.equal(wf.status, 'in-review');
  assert.equal(wf.reviewedAt, '2026-11-19');
  const notes = [...(wf.notes ?? [])];
  let previous = notes.indexOf(DAY_DETAIL_NOTE);
  assert.ok(previous >= 2, 'the 1:2 note stays');
  for (const note of DAY_DETAIL_WORDING_NOTES) {
    const at = notes.indexOf(note);
    assert.ok(at > previous + 1, `records "${note}" verbatim after the previous outcome`);
    assert.match(notes[at + 1] ?? '', /^反映（8\.1）：/, `outcome right after "${note}"`);
    previous = at;
  }
  // the 二十四節気 outcome says the 節気 keeps its form (only the 候 gets the day count)
  const sekki = notes.indexOf(DAY_DETAIL_WORDING_NOTES[3]);
  assert.match(notes[sekki + 1] ?? '', /二十四節気/);
  // the moonrise / moonset outcome says the rows are back
  assert.match(notes[previous + 1] ?? '', /月の出・月の入りの行/);
});

// Task 8.1 (astro-events, 2026-11-19): one note in the user's words, followed right after by its
// outcome; the guest band note and its outcome recorded earlier stay first.
const ASTRO_EVENTS_NOTE = '過去の日付のものはわかるようにしたい';
const ASTRO_EVENTS_DAYS_NOTE = '天文現象の一覧で「何日後」なのか知りたい';
const ASTRO_EVENTS_NO_DAYS_AGO_NOTE = '過去の現象では何日前は出さなくてOK';

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
  // the second note (days from today) follows the first one's outcome, with its own outcome
  const days = notes.indexOf(ASTRO_EVENTS_DAYS_NOTE);
  assert.equal(days, at + 2, `records "${ASTRO_EVENTS_DAYS_NOTE}" verbatim after the first outcome`);
  assert.match(notes[days + 1] ?? '', /^反映（8\.1）：/, 'outcome right after the second note');
  // the third note (no 「n日前」 for past events) follows the second one's outcome
  const noAgo = notes.indexOf(ASTRO_EVENTS_NO_DAYS_AGO_NOTE);
  assert.equal(noAgo, days + 2, `records "${ASTRO_EVENTS_NO_DAYS_AGO_NOTE}" verbatim after the second outcome`);
  assert.match(notes[noAgo + 1] ?? '', /^反映（8\.1）：/, 'outcome right after the third note');
  assert.equal(notes.length, noAgo + 2);
});

// Task 8.1 (post-detail, 2026-11-19): each note in the user's words, followed right after by its
// outcome (the 1:1 note, then the follow-up asking for a narrower comments column); the guest
// band note and its outcome recorded earlier stay first.
const POST_DETAIL_NOTE = '左右１：１で「投稿」と「コメント」は近くに寄せたい';
const POST_DETAIL_WIDTH_NOTE = '投稿の詳細でコメントと投稿が１：１になっているがコメントの幅を減らして';

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
  // follow-up (2026-11-19): the narrower comments column is a new note after the 1:1 outcome
  const next = notes.indexOf(POST_DETAIL_WIDTH_NOTE);
  assert.ok(next >= at + 2, `records "${POST_DETAIL_WIDTH_NOTE}" verbatim after the first outcome`);
  assert.match(notes[next + 1] ?? '', /^反映（8\.1）：/, 'outcome right after the follow-up note');
});

// Task 8.1 (post-edit, 2026-11-19): two notes in the user's words, each followed right after by
// its outcome; the guest band note and its outcome recorded earlier stay first.
const POST_EDIT_NOTES = ['位置の公開精度はアコーディオンで', '編集エリアは大きめに取りたい'];

test('post-edit: the 2026-11-19 review notes are kept and each outcome follows its note', () => {
  const wf = byId().get('post-edit').review.wireframe;
  assert.equal(wf.status, 'in-review');
  assert.equal(wf.reviewedAt, '2026-11-19');
  const notes = [...(wf.notes ?? [])];
  assert.equal(notes.indexOf(GUEST_BAND_NOTE), 0, 'the guest band note stays first');
  assert.match(notes[1] ?? '', /^反映（8\.1）：/, 'the guest band outcome stays second');
  for (const note of POST_EDIT_NOTES) {
    const at = notes.indexOf(note);
    assert.ok(at >= 2, `records "${note}" verbatim after the guest band outcome`);
    assert.match(notes[at + 1] ?? '', /^反映（8\.1）：/, `outcome right after "${note}"`);
  }
});

// Task 8.1 (my-posts, 2026-11-19): four notes in the user's words, each followed right after by
// its outcome; the guest band note and its outcome recorded earlier stay first. The fourth (the
// comment count) came later and is recorded after the first three.
const MY_POSTS_NOTES = [
  '投稿の時系列がわからないので1列にすること',
  '新しい日付が上に来るように',
  '公開範囲などはアイコン化する（マウスホバーで説明が出ればよい）',
  '自分の投稿で投稿にぶら下がるコメントが何件あるか出してください',
  'コメントにコメントがついたときに知る機能が欲しい',
];

test('my-posts: the 2026-11-19 review notes are kept and each outcome follows its note', () => {
  const wf = byId().get('my-posts').review.wireframe;
  assert.equal(wf.status, 'in-review');
  assert.equal(wf.reviewedAt, '2026-11-19');
  const notes = [...(wf.notes ?? [])];
  assert.equal(notes.indexOf(GUEST_BAND_NOTE), 0, 'the guest band note stays first');
  assert.match(notes[1] ?? '', /^反映（8\.1）：/, 'the guest band outcome stays second');
  for (const note of MY_POSTS_NOTES) {
    const at = notes.indexOf(note);
    assert.ok(at >= 2, `records "${note}" verbatim after the guest band outcome`);
    assert.match(notes[at + 1] ?? '', /^反映（8\.1）：/, `outcome right after "${note}"`);
  }
  const countAt = notes.indexOf(MY_POSTS_NOTES[3]);
  assert.ok(countAt > notes.indexOf(MY_POSTS_NOTES[2]), 'the comment count note follows the earlier notes');
  assert.match(notes[countAt + 1] ?? '', /削除/, 'the outcome says how deleted comments count');
  // the reply notices (requirements 6.9-6.11, added for this note) come last; the outcome names
  // the requirements and the header change, which applies to every screen
  const noticeAt = notes.indexOf(MY_POSTS_NOTES[4]);
  assert.ok(noticeAt > countAt, 'the reply notice note follows the comment count note');
  assert.equal(notes.length, noticeAt + 2, 'the reply notice outcome is the last note');
  const outcome = notes[noticeAt + 1] ?? '';
  for (const req of ['6.9', '6.10', '6.11']) assert.ok(outcome.includes(req), `the outcome names ${req}`);
  assert.match(outcome, /ヘッダー/, 'the outcome mentions the header (every screen)');
});

// Task 8.1 (settings, 2026-11-19): the reply notice request recorded on my-posts also adds the
// setting of 6.11 here; the note in the user's words and its outcome follow the guest band entries.
test('settings: the reply notice setting (6.11) is recorded after the guest band entries', () => {
  const wf = byId().get('settings').review.wireframe;
  assert.equal(wf.status, 'in-review');
  assert.equal(wf.reviewedAt, '2026-11-19');
  const notes = [...(wf.notes ?? [])];
  assert.equal(notes.indexOf(GUEST_BAND_NOTE), 0, 'the guest band note stays first');
  assert.match(notes[1] ?? '', /^反映（8\.1）：/, 'the guest band outcome stays second');
  assert.equal(notes[2], MY_POSTS_NOTES[4], 'the request in the user\'s words');
  assert.match(notes[3] ?? '', /^反映（8\.1）：.*6\.11/, 'its outcome names 6.11');
  assert.equal(notes.length, 4);
});

// Task 8.1 (admin, 2026-11-19): two notes in the user's words, each followed right after by its
// outcome; the guest band note and its outcome recorded earlier stay first.
const ADMIN_NOTES = [
  '表示をKANBAN形式にしたい',
  '通報件数・理由は見やすくしたい',
];

test('admin: the 2026-11-19 review notes are kept and each outcome follows its note', () => {
  const wf = byId().get('admin').review.wireframe;
  assert.equal(wf.status, 'in-review');
  assert.equal(wf.reviewedAt, '2026-11-19');
  const notes = [...(wf.notes ?? [])];
  assert.equal(notes.indexOf(GUEST_BAND_NOTE), 0, 'the guest band note stays first');
  assert.match(notes[1] ?? '', /^反映（8\.1）：/, 'the guest band outcome stays second');
  for (const note of ADMIN_NOTES) {
    const at = notes.indexOf(note);
    assert.ok(at >= 2, `records "${note}" verbatim after the guest band outcome`);
    assert.match(notes[at + 1] ?? '', /^反映（8\.1）：/, `outcome right after "${note}"`);
  }
});

// Task 8.1 (star-chart, 2026-11-19): one note in the user's words, followed right after by its
// outcome; the guest band note and its outcome recorded earlier stay first. A person then approved
// the wireframe (「星図OK」, 2026-11-19), recorded as the last note; hifi stays draft.
const STAR_CHART_NOTE = '星図の全天図右に４：１くらいのサイズ感で地図を表示したい';
const STAR_CHART_ENDS_NOTE = '全天図と地図を両端において３：１から４：１の範囲に収まるようにしてみて';
const STAR_CHART_FLEX_NOTE = '全天図の幅が固定なので、地図のほうを可変として両端に寄せた状態で互いのマージンは固定して、地図の上下の比率は保ってほしい';

test('star-chart: the 2026-11-19 review note is kept and its outcome follows it', () => {
  const wf = byId().get('star-chart').review.wireframe;
  assert.equal(wf.status, 'approved', 'a person approved it on 2026-11-19 (「星図OK」)');
  assert.equal(wf.reviewedAt, '2026-11-19');
  const notes = [...(wf.notes ?? [])];
  assert.equal(notes.indexOf(GUEST_BAND_NOTE), 0, 'the guest band note stays first');
  assert.match(notes[1] ?? '', /^反映（8\.1）：/, 'the guest band outcome stays second');
  const at = notes.indexOf(STAR_CHART_NOTE);
  assert.ok(at >= 2, `records "${STAR_CHART_NOTE}" verbatim after the guest band outcome`);
  assert.match(notes[at + 1] ?? '', /^反映（8\.1）：/, 'outcome right after the note');
  // follow-up (2026-11-19): chart and map at both ends, 3:1..4:1, after the first outcome
  const next = notes.indexOf(STAR_CHART_ENDS_NOTE);
  assert.ok(next >= at + 2, `records "${STAR_CHART_ENDS_NOTE}" verbatim after the first outcome`);
  assert.match(notes[next + 1] ?? '', /^反映（8\.1）：/, 'outcome right after the follow-up note');
  // refinement (2026-11-19): the map takes the remaining width; the 3:1..4:1 outcome says it was superseded
  assert.match(notes[next + 1] ?? '', /置き換え/, 'the 3:1..4:1 outcome says it was superseded');
  const flex = notes.indexOf(STAR_CHART_FLEX_NOTE);
  assert.ok(flex >= next + 2, `records "${STAR_CHART_FLEX_NOTE}" verbatim after the 3:1..4:1 outcome`);
  assert.match(notes[flex + 1] ?? '', /^反映（8\.1）：/, 'outcome right after the refinement note');
  // approval (2026-11-19): the person wrote 「星図OK」; it is the last note, after every outcome
  assert.equal(notes.length, flex + 3, 'the approval note follows the last outcome');
  assert.match(notes.at(-1) ?? '', APPROVAL_NOTE, 'the last note records the approval');
  assert.match(notes.at(-1) ?? '', /2026-11-19/);
  assert.match(notes.at(-1) ?? '', /「星図OK」/);
  assert.equal(byId().get('star-chart').review.hifi.status, 'draft', 'hifi stays draft');
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
