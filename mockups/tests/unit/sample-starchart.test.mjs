// Task 3.4: star-chart sample data (data/sample-data.js -> window.MockSample.starChart).
// The sky as seen at a fictional point near Tokyo on 2026-11-16 around 20:00 JST.
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
const chart = w.MockSample.starChart;
const stars = chart.stars ?? [];
const lines = chart.constellationLines ?? [];
const labels = chart.constellationLabels ?? [];
const bodies = chart.bodies ?? [];

/** Smallest angular difference between two azimuths, in degrees. */
const azDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

const starByKey = (key) => stars.find((s) => s.nameKey === key);

test('observedAt is the evening of 2026-11-16 in JST', () => {
  assert.match(chart.observedAt, /^2026-11-16T(19|20|21):\d{2}(:\d{2})?\+09:00$/);
});

test('placeLabel is a non-empty municipality-level label', () => {
  assert.equal(typeof chart.placeLabel, 'string');
  assert.ok(chart.placeLabel.trim().length > 0);
  assert.match(chart.placeLabel, /^\S+[都道府県] \S+[市区町村]$/);
});

test('at least 20 stars with sane az / alt / mag', () => {
  assert.ok(stars.length >= 20, `stars: ${stars.length}`);
  for (const [i, s] of stars.entries()) {
    assert.ok(Number.isFinite(s.az) && s.az >= 0 && s.az < 360, `star ${i} az ${s.az}`);
    assert.ok(Number.isFinite(s.alt) && s.alt >= -90 && s.alt <= 90, `star ${i} alt ${s.alt}`);
    // stars listed are the ones visible above the horizon
    assert.ok(s.alt >= 0, `star ${i} is below the horizon (${s.alt})`);
    assert.ok(Number.isFinite(s.mag) && s.mag >= -1.5 && s.mag <= 6, `star ${i} mag ${s.mag}`);
  }
  // a range of magnitudes so that the chart can show size by brightness (5.2)
  const mags = stars.map((s) => s.mag);
  assert.ok(Math.min(...mags) < 0.5 && Math.max(...mags) > 3, 'magnitude range');
});

test('named stars use astro.star.* keys and include the expected bright stars', () => {
  for (const s of stars) {
    if (s.nameKey !== undefined) assert.match(s.nameKey, /^astro\.star\./);
  }
  for (const key of ['vega', 'deneb', 'altair', 'capella', 'aldebaran', 'fomalhaut', 'polaris', 'mirfak']) {
    assert.ok(starByKey(`astro.star.${key}`), `missing astro.star.${key}`);
  }
  const keys = stars.flatMap((s) => (s.nameKey ? [s.nameKey] : []));
  assert.equal(new Set(keys).size, keys.length, 'duplicate star nameKey');
});

test('Polaris sits due north at about the latitude', () => {
  const p = starByKey('astro.star.polaris');
  assert.ok(p);
  assert.ok(Math.abs(p.alt - 35.7) <= 1, `polaris alt ${p.alt}`);
  assert.ok(azDiff(p.az, 0) <= 2, `polaris az ${p.az}`);
});

test('the sky is plausible for an autumn evening (summer triangle in the west, Taurus in the east)', () => {
  const vega = starByKey('astro.star.vega');
  const altair = starByKey('astro.star.altair');
  const aldebaran = starByKey('astro.star.aldebaran');
  const fomalhaut = starByKey('astro.star.fomalhaut');
  assert.ok(vega.az > 270 && vega.az < 330, `vega az ${vega.az}`);
  assert.ok(altair.az > 240 && altair.az < 290, `altair az ${altair.az}`);
  assert.ok(aldebaran.az > 60 && aldebaran.az < 110, `aldebaran az ${aldebaran.az}`);
  assert.ok(azDiff(fomalhaut.az, 180) < 30 && fomalhaut.alt < 30, `fomalhaut ${fomalhaut.az}/${fomalhaut.alt}`);
});

test('constellation lines are index pairs within the star array, without self-loops or duplicates', () => {
  assert.ok(lines.length >= 20, `lines: ${lines.length}`);
  const seen = new Set();
  for (const [k, pair] of lines.entries()) {
    assert.equal(pair.length, 2, `line ${k}`);
    const [a, b] = pair;
    for (const i of [a, b]) {
      assert.ok(Number.isInteger(i) && i >= 0 && i < stars.length, `line ${k} index ${i} out of range`);
    }
    assert.notEqual(a, b, `line ${k} is a self-loop`);
    const id = [Math.min(a, b), Math.max(a, b)].join('-');
    assert.ok(!seen.has(id), `line ${k} duplicates ${id}`);
    seen.add(id);
  }
});

test('constellation labels cover the main autumn and winter constellations', () => {
  assert.ok(labels.length >= 8, `labels: ${labels.length}`);
  for (const l of labels) {
    assert.match(l.nameKey, /^astro\.constellation\./);
    assert.ok(l.az >= 0 && l.az < 360 && l.alt >= 0 && l.alt <= 90, `${l.nameKey} position`);
  }
  const keys = labels.map((l) => l.nameKey);
  assert.equal(new Set(keys).size, keys.length, 'duplicate constellation label');
  for (const c of ['cassiopeia', 'pegasus', 'andromeda', 'cygnus', 'lyra', 'aquila', 'perseus', 'taurus', 'auriga', 'ursa-minor']) {
    assert.ok(keys.includes(`astro.constellation.${c}`), `missing label ${c}`);
  }
});

test('bodies: the moon is up in the south-west, a planet is shown, the sun is below the horizon', () => {
  for (const b of bodies) {
    assert.ok(['sun', 'moon', 'planet'].includes(b.kind), `kind ${b.kind}`);
    assert.match(b.nameKey, /^astro\.body\./);
    assert.ok(b.az >= 0 && b.az < 360 && b.alt >= -90 && b.alt <= 90, `${b.nameKey} position`);
  }
  const moon = bodies.find((b) => b.kind === 'moon');
  assert.ok(moon, 'moon present');
  assert.equal(moon.nameKey, 'astro.body.moon');
  assert.ok(moon.alt > 0, `moon alt ${moon.alt}`);
  assert.ok(moon.az > 180 && moon.az < 270, `moon az ${moon.az}`);
  const planets = bodies.filter((b) => b.kind === 'planet');
  assert.ok(planets.some((p) => p.alt > 0), 'at least one visible planet');
  const sun = bodies.find((b) => b.kind === 'sun');
  if (sun) {
    assert.equal(sun.nameKey, 'astro.body.sun');
    assert.ok(sun.alt < 0, 'the sun is below the horizon at 20:00');
  }
});

test('every nameKey exists in both dictionaries', () => {
  const keys = [
    ...stars.flatMap((s) => (s.nameKey ? [s.nameKey] : [])),
    ...labels.map((l) => l.nameKey),
    ...bodies.map((b) => b.nameKey),
  ];
  assert.ok(keys.length > 0);
  for (const k of keys) {
    assert.ok(typeof ja[k] === 'string' && ja[k].length > 0, `ja missing ${k}`);
    assert.ok(typeof en[k] === 'string' && en[k].length > 0, `en missing ${k}`);
  }
});
