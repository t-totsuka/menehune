// Final-validation remediation (requirement 5.2): the daytime star-chart sample
// (data/sample-data.js -> window.MockSample.starChartDaytime), so that the star chart can show how
// the sun is drawn. Same observer and date as the evening sample, around 12:00 JST: the sun high in
// the south, the moon (age 7.2, rose 11:59) low in the east-southeast. Values are illustrative.
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
const night = w.MockSample.starChart;
const day = w.MockSample.starChartDaytime;

/** Smallest angular difference between two azimuths, in degrees. */
const azDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test('the daytime sample exists and is frozen like the rest of the sample data', () => {
  assert.ok(day && typeof day === 'object', 'MockSample.starChartDaytime is missing');
  assert.ok(Object.isFrozen(day), 'starChartDaytime must be frozen');
});

test('same observer and date as the evening sample, around noon JST', () => {
  assert.equal(day.placeLabel, night.placeLabel);
  assert.match(day.observedAt, /^2026-11-16T(11|12|13):\d{2}(:\d{2})?\+09:00$/);
  assert.equal(day.observedAt.slice(0, 10), night.observedAt.slice(0, 10));
});

test('the sun is above the horizon, roughly due south at about 34-35°', () => {
  const suns = day.bodies.filter((b) => b.kind === 'sun');
  assert.equal(suns.length, 1, 'exactly one sun');
  const sun = suns[0];
  assert.equal(sun.nameKey, 'astro.body.sun');
  assert.ok(sun.alt >= 33 && sun.alt <= 36, `sun alt ${sun.alt}`);
  assert.ok(azDiff(sun.az, 180) <= 15, `sun az ${sun.az}`);
});

test('the moon is low in the east-southeast (it rose at 11:59)', () => {
  const moon = day.bodies.find((b) => b.kind === 'moon');
  assert.ok(moon, 'moon present');
  assert.equal(moon.nameKey, 'astro.body.moon');
  assert.ok(moon.alt >= 0 && moon.alt < 10, `moon alt ${moon.alt}`);
  assert.ok(azDiff(moon.az, 112.5) <= 15, `moon az ${moon.az}`);
});

test('bodies have valid kinds, keys and positions', () => {
  for (const b of day.bodies) {
    assert.ok(['sun', 'moon', 'planet'].includes(b.kind), `kind ${b.kind}`);
    assert.match(b.nameKey, /^astro\.body\./);
    assert.ok(b.az >= 0 && b.az < 360 && b.alt >= -90 && b.alt <= 90, `${b.nameKey} position`);
  }
  const keys = day.bodies.map((b) => b.nameKey);
  assert.equal(new Set(keys).size, keys.length, 'duplicate body');
});

test('stars: sane values above the horizon, unique astro.star.* keys, Polaris due north', () => {
  assert.ok(day.stars.length >= 20, `stars: ${day.stars.length}`);
  for (const [i, s] of day.stars.entries()) {
    assert.ok(s.az >= 0 && s.az < 360, `star ${i} az ${s.az}`);
    assert.ok(s.alt >= 0 && s.alt <= 90, `star ${i} alt ${s.alt}`);
    assert.ok(s.mag >= -1.5 && s.mag <= 6, `star ${i} mag ${s.mag}`);
    if (s.nameKey !== undefined) assert.match(s.nameKey, /^astro\.star\./);
  }
  const keys = day.stars.flatMap((s) => (s.nameKey ? [s.nameKey] : []));
  assert.equal(new Set(keys).size, keys.length, 'duplicate star nameKey');
  const polaris = day.stars.find((s) => s.nameKey === 'astro.star.polaris');
  assert.ok(polaris && Math.abs(polaris.alt - 35.7) <= 1 && azDiff(polaris.az, 0) <= 2, 'polaris');
  // the summer triangle is in the eastern half of the noon sky in November
  for (const k of ['vega', 'deneb', 'altair']) {
    const s = day.stars.find((x) => x.nameKey === `astro.star.${k}`);
    assert.ok(s && s.az > 30 && s.az < 150, `${k} az`);
  }
});

test('constellation lines are valid, unique index pairs; labels are unique and above the horizon', () => {
  assert.ok(day.constellationLines.length >= 15);
  const seen = new Set();
  for (const [k, [a, b]] of day.constellationLines.entries()) {
    for (const i of [a, b]) assert.ok(Number.isInteger(i) && i >= 0 && i < day.stars.length, `line ${k} index ${i}`);
    assert.notEqual(a, b, `line ${k} self-loop`);
    const id = [Math.min(a, b), Math.max(a, b)].join('-');
    assert.ok(!seen.has(id), `line ${k} duplicates ${id}`);
    seen.add(id);
  }
  const keys = day.constellationLabels.map((l) => l.nameKey);
  assert.ok(keys.length >= 5);
  assert.equal(new Set(keys).size, keys.length);
  for (const l of day.constellationLabels) {
    assert.match(l.nameKey, /^astro\.constellation\./);
    assert.ok(l.alt >= 0 && l.alt <= 90, `${l.nameKey} alt`);
  }
});

test('every nameKey and the daytime note exist in both dictionaries', () => {
  const keys = [
    ...day.stars.flatMap((s) => (s.nameKey ? [s.nameKey] : [])),
    ...day.constellationLabels.map((l) => l.nameKey),
    ...day.bodies.map((b) => b.nameKey),
    'sky.daytime-note',
  ];
  for (const k of keys) {
    assert.ok(typeof ja[k] === 'string' && ja[k].length > 0, `ja missing ${k}`);
    assert.ok(typeof en[k] === 'string' && en[k].length > 0, `en missing ${k}`);
  }
});

test('the evening sample is unchanged: the sun stays below the horizon there', () => {
  const sun = night.bodies.find((b) => b.kind === 'sun');
  assert.ok(sun && sun.alt < 0);
  assert.equal(night.observedAt, '2026-11-16T20:00:00+09:00');
});
