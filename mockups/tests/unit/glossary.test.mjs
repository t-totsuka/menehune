// Task 3.1: almanac / astronomy term translations (ja/en dictionaries) and the glossary metadata.
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

const w = load('assets/i18n/messages.ja.js', 'assets/i18n/messages.en.js', 'data/glossary.js');
const ja = w.MockMessages.ja;
const en = w.MockMessages.en;
const glossary = w.MockGlossary;
const byKey = new Map((glossary ?? []).map((e) => [e.key, e]));

const KEY_FORMAT = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const CATEGORIES = [
  'ui', 'rokuyo', 'sekki', 'kou', 'zassetsu', 'lunar-month',
  'moon-phase', 'astro-event', 'holiday', 'location', 'weather', 'moderation',
];
const POLICIES = ['translation', 'transliteration', 'both', 'standard'];
/** Default policy per category (design.md: MessageDictionaries と GlossaryMeta, Implementation Notes). */
const DEFAULT_POLICY = {
  ui: 'translation',
  rokuyo: 'both',
  sekki: 'both',
  kou: 'translation',
  zassetsu: 'both',
  'lunar-month': 'both',
  'moon-phase': 'standard',
  'astro-event': 'standard',
  holiday: 'translation',
  location: 'translation',
  weather: 'translation',
  moderation: 'translation',
};

const ROKUYO = ['sensho', 'tomobiki', 'sakimake', 'butsumetsu', 'taian', 'shakko'];
const SEKKI = [
  'risshun', 'usui', 'keichitsu', 'shunbun', 'seimei', 'kokuu',
  'rikka', 'shoman', 'boshu', 'geshi', 'shousho', 'taisho',
  'risshu', 'shosho', 'hakuro', 'shubun', 'kanro', 'soko',
  'ritto', 'shosetsu', 'taisetsu', 'toji', 'shokan', 'daikan',
];
const ZASSETSU = [
  'setsubun', 'higan-spring', 'higan-autumn', 'shanichi-spring', 'shanichi-autumn',
  'hachijuhachiya', 'nyubai', 'hangesho', 'doyo-spring', 'doyo-summer', 'doyo-autumn', 'doyo-winter',
  'nihyakutoka', 'nihyakuhatsuka',
];
const HOLIDAYS = [
  'ganjitsu', 'seijin-no-hi', 'kenkoku-kinen-no-hi', 'tenno-tanjobi', 'shunbun-no-hi', 'showa-no-hi',
  'kenpo-kinenbi', 'midori-no-hi', 'kodomo-no-hi', 'umi-no-hi', 'yama-no-hi', 'keiro-no-hi',
  'shubun-no-hi', 'sports-no-hi', 'bunka-no-hi', 'kinro-kansha-no-hi', 'furikae-kyujitsu', 'kokumin-no-kyujitsu',
];
/** Cabinet Office (内閣府) English names of the national holidays. */
const HOLIDAY_EN = {
  ganjitsu: "New Year's Day",
  'seijin-no-hi': 'Coming of Age Day',
  'kenkoku-kinen-no-hi': 'National Foundation Day',
  'tenno-tanjobi': "Emperor's Birthday",
  'shunbun-no-hi': 'Vernal Equinox Day',
  'showa-no-hi': 'Showa Day',
  'kenpo-kinenbi': 'Constitution Memorial Day',
  'midori-no-hi': 'Greenery Day',
  'kodomo-no-hi': "Children's Day",
  'umi-no-hi': 'Marine Day',
  'yama-no-hi': 'Mountain Day',
  'keiro-no-hi': 'Respect for the Aged Day',
  'shubun-no-hi': 'Autumnal Equinox Day',
  'sports-no-hi': 'Sports Day',
  'bunka-no-hi': 'Culture Day',
  'kinro-kansha-no-hi': 'Labor Thanksgiving Day',
};
const MOON_PHASES = ['new-moon', 'first-quarter', 'full-moon', 'last-quarter'];
const ASTRO_EVENTS = [
  'new-moon', 'first-quarter', 'full-moon', 'last-quarter', 'perigee', 'apogee', 'max-north', 'max-south',
  'conjunction', 'opposition', 'greatest-elongation-east', 'greatest-elongation-west', 'close-approach',
  'superior-conjunction', 'inferior-conjunction',
];
/** AstroEventKind in types.d.ts */
const ASTRO_KINDS = [
  'moon-phase', 'moon-apsis', 'moon-declination', 'planet-conjunction',
  'planet-opposition', 'planet-elongation', 'close-approach',
];
const BODIES = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
const CONSTELLATIONS = [
  'orion', 'taurus', 'auriga', 'gemini', 'cassiopeia', 'perseus', 'andromeda', 'pegasus', 'cygnus',
  'lyra', 'aquila', 'cetus', 'pisces', 'aries', 'canis-major', 'canis-minor', 'ursa-major', 'ursa-minor', 'cepheus',
];
const STARS = [
  'sirius', 'betelgeuse', 'rigel', 'aldebaran', 'capella', 'procyon', 'pollux', 'castor',
  'vega', 'deneb', 'altair', 'polaris', 'fomalhaut',
];
/** LocationPrecision in types.d.ts */
const PRECISIONS = ['exact', 'fuzzed-1km', 'municipality', 'prefecture', 'country'];
const WEATHER = ['clear', 'partly-cloudy', 'cloudy', 'rain', 'snow', 'fog', 'thunderstorm'];
/** ReportReason and ReportQueueState in types.d.ts */
const REASONS = ['spam', 'harassment', 'inappropriate', 'personal-info', 'other'];
const QUEUE_STATES = ['open', 'auto-hidden', 'hidden-by-admin', 'appealed', 'restored', 'removed'];

const placeholders = (s) => [...s.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]).sort();
const glossaryKeys = (category) => [...glossary].filter((e) => e.category === category).map((e) => e.key);
/** Asserts the key is in both dictionaries and in the glossary with the expected category. */
function assertTerm(key, category) {
  assert.ok(key in ja, `ja missing ${key}`);
  assert.ok(key in en, `en missing ${key}`);
  const entry = byKey.get(key);
  assert.ok(entry, `glossary missing ${key}`);
  assert.equal(entry.category, category, `category of ${key}`);
}

test('glossary is a frozen, non-empty array of frozen entries', () => {
  assert.ok(Array.isArray(glossary));
  assert.ok(glossary.length > 0);
  assert.ok(Object.isFrozen(glossary));
  for (const e of glossary) assert.ok(Object.isFrozen(e), `entry ${e.key} is not frozen`);
});

test('glossary has no duplicate keys and every key has the language-independent format', () => {
  const keys = glossary.map((e) => e.key);
  assert.equal(new Set(keys).size, keys.length, 'duplicate glossary keys');
  for (const k of keys) assert.match(k, KEY_FORMAT);
});

test('every glossary key exists in both dictionaries with matching placeholders', () => {
  for (const { key } of glossary) {
    assert.ok(key in ja, `ja missing ${key}`);
    assert.ok(key in en, `en missing ${key}`);
    assert.deepEqual(placeholders(ja[key]), placeholders(en[key]), `placeholder mismatch in ${key}`);
  }
  assert.deepEqual(Object.keys(ja).sort(), Object.keys(en).sort());
});

test('categories and policies are valid; the default policy applies unless a note explains the exception', () => {
  for (const e of glossary) {
    assert.ok(CATEGORIES.includes(e.category), `bad category ${e.category} on ${e.key}`);
    assert.ok(POLICIES.includes(e.policy), `bad policy ${e.policy} on ${e.key}`);
    if (e.note !== undefined) {
      assert.equal(typeof e.note.ja, 'string', `note.ja of ${e.key}`);
      assert.equal(typeof e.note.en, 'string', `note.en of ${e.key}`);
      assert.ok(e.note.ja.trim() && e.note.en.trim(), `empty note on ${e.key}`);
    }
    if (e.policy !== DEFAULT_POLICY[e.category]) {
      assert.ok(e.note, `${e.key} deviates from the ${e.category} default policy without a note`);
    }
  }
});

test('6 rokuyo terms, policy both, English as "Romanized (Meaning)"', () => {
  for (const id of ROKUYO) {
    const key = `rokuyo.${id}`;
    assertTerm(key, 'rokuyo');
    assert.equal(byKey.get(key).policy, 'both');
    assert.match(en[key], /^\S.* \(.+\)$/, `en of ${key}`);
  }
  assert.equal(en['rokuyo.taian'], 'Taian (Great Peace)');
  assert.equal(ja['rokuyo.taian'], '大安');
  assert.equal(glossaryKeys('rokuyo').filter((k) => ROKUYO.includes(k.slice('rokuyo.'.length))).length, 6);
});

test('24 sekki in order, policy both, English as "Meaning (Romanized)"', () => {
  const keys = Object.keys(ja).filter((k) => /^sekki\.[a-z]+$/.test(k) && k !== 'sekki.label');
  assert.deepEqual(keys, SEKKI.map((s) => `sekki.${s}`));
  for (const key of keys) {
    assertTerm(key, 'sekki');
    assert.equal(byKey.get(key).policy, 'both');
    assert.match(en[key], /^[A-Z][A-Za-z ]+ \([A-Z][a-zāīūēō]+\)$/, `en of ${key}`);
  }
  assert.equal(en['sekki.risshun'], 'Start of Spring (Risshun)');
  assert.equal(en['sekki.daikan'], 'Major Cold (Daikan)');
  assert.equal(en['sekki.label'], '24 Solar Terms (Nijūshi Sekki)');
  assert.equal(ja['sekki.risshun'], '立春');
  assert.equal(ja['sekki.daikan'], '大寒');
});

test('72 kou k01..k72 in order starting from 東風解凍, policy translation', () => {
  const keys = Object.keys(ja).filter((k) => /^kou\.k\d{2}$/.test(k));
  const expected = Array.from({ length: 72 }, (_, i) => `kou.k${String(i + 1).padStart(2, '0')}`);
  assert.deepEqual(keys, expected);
  assert.deepEqual(Object.keys(en).filter((k) => /^kou\.k\d{2}$/.test(k)), expected);
  for (const key of keys) {
    assertTerm(key, 'kou');
    assert.equal(byKey.get(key).policy, 'translation');
  }
  assert.equal(ja['kou.k01'], '東風解凍');
  assert.equal(en['kou.k01'], 'East wind melts the ice');
  assert.equal(ja['kou.k72'], '鶏始乳');
  assert.equal(ja['kou.k34'], '桐始結花');
  assert.match(en['kou.k34'], /flower buds/);
  assert.equal(ja['kou.k60'], '橘始黄');
  assert.match(en['kou.k60'], /fruits/);
  // Kou names are unique within each language.
  assert.equal(new Set(keys.map((k) => ja[k])).size, 72);
  assert.equal(new Set(keys.map((k) => en[k])).size, 72);
});

test('zassetsu terms, policy both', () => {
  for (const id of ZASSETSU) {
    const key = `zassetsu.${id}`;
    assertTerm(key, 'zassetsu');
    assert.equal(byKey.get(key).policy, 'both');
  }
  assert.equal(ja['zassetsu.setsubun'], '節分');
});

test('12 lunar month names (睦月..師走) plus a leap-month label with {month}', () => {
  const keys = Object.keys(ja).filter((k) => /^lunar-month\.m\d{2}$/.test(k));
  assert.deepEqual(keys, Array.from({ length: 12 }, (_, i) => `lunar-month.m${String(i + 1).padStart(2, '0')}`));
  for (const key of keys) {
    assertTerm(key, 'lunar-month');
    assert.equal(byKey.get(key).policy, 'both');
  }
  assert.equal(ja['lunar-month.m01'], '睦月');
  assert.equal(ja['lunar-month.m12'], '師走');
  assertTerm('lunar-month.leap', 'lunar-month');
  assert.deepEqual(placeholders(ja['lunar-month.leap']), ['month']);
});

test('moon phases, astro event titles and kinds, bodies, constellations and stars', () => {
  for (const id of MOON_PHASES) assertTerm(`moon-phase.${id}`, 'moon-phase');
  // Only the four principal phases (朔・上弦・望・下弦) are phase names.
  const phaseNames = [...glossary].filter((g) => g.category === 'moon-phase' && !['moon-phase.label', 'moon-phase.age'].includes(g.key)).map((g) => g.key);
  assert.deepEqual(phaseNames, MOON_PHASES.map((id) => `moon-phase.${id}`));
  for (const id of ASTRO_EVENTS) {
    assertTerm(`astro.event.${id}`, 'astro-event');
    assert.equal(byKey.get(`astro.event.${id}`).policy, 'standard');
  }
  for (const id of ASTRO_KINDS) assertTerm(`astro.kind.${id}`, 'astro-event');
  for (const id of BODIES) assertTerm(`astro.body.${id}`, 'astro-event');
  for (const id of CONSTELLATIONS) assertTerm(`astro.constellation.${id}`, 'astro-event');
  for (const id of STARS) assertTerm(`astro.star.${id}`, 'astro-event');
  assert.equal(en['astro.event.opposition'], '{body} at Opposition');
  assert.deepEqual(placeholders(ja['astro.event.conjunction']), ['body1', 'body2']);
});

test('all national holidays, policy translation, English matches the Cabinet Office names', () => {
  assert.deepEqual(glossaryKeys('holiday').filter((k) => k !== 'holiday.provisional'), HOLIDAYS.map((h) => `holiday.${h}`));
  for (const id of HOLIDAYS) {
    const key = `holiday.${id}`;
    assertTerm(key, 'holiday');
    assert.equal(byKey.get(key).policy, 'translation');
  }
  for (const [id, name] of Object.entries(HOLIDAY_EN)) assert.equal(en[`holiday.${id}`], name);
  assert.equal(ja['holiday.ganjitsu'], '元日');
});

test('location precision, weather and moderation terms, policy translation', () => {
  for (const id of PRECISIONS) {
    assertTerm(`location.precision.${id}`, 'location');
    assertTerm(`location.precision.${id}.description`, 'location');
  }
  for (const id of WEATHER) assertTerm(`weather.condition.${id}`, 'weather');
  for (const [key, ph] of [
    ['weather.temperature', ['value']],
    ['weather.humidity', ['value']],
    ['weather.wind', ['value']],
    ['weather.observed-at', ['time']],
  ]) {
    assertTerm(key, 'weather');
    assert.deepEqual(placeholders(en[key]), ph, `placeholders of ${key}`);
  }
  assertTerm('moderation.report', 'moderation');
  assertTerm('moderation.report-count', 'moderation');
  assertTerm('moderation.report-count-one', 'moderation');
  assert.equal(en['moderation.report-count-one'], '{count} report');
  assert.deepEqual(placeholders(ja['moderation.report-count-one']), ['count']);
  assertTerm('moderation.hidden', 'moderation');
  assertTerm('moderation.appeal', 'moderation');
  for (const id of REASONS) assertTerm(`moderation.reason.${id}`, 'moderation');
  for (const id of QUEUE_STATES) assertTerm(`moderation.state.${id}`, 'moderation');
  for (const e of glossary.filter((g) => ['location', 'weather', 'moderation'].includes(g.category))) {
    assert.equal(e.policy, 'translation', `policy of ${e.key}`);
  }
});
