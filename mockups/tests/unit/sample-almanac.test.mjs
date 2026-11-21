// Task 3.2: almanac / astronomy sample data (data/sample-data.js -> window.MockSample).
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
const almanac = sample.almanac;
const events = sample.events;
const eventById = new Map(events.map((e) => [e.id, e]));

const ROKUYO = ['rokuyo.taian', 'rokuyo.shakko', 'rokuyo.sensho', 'rokuyo.tomobiki', 'rokuyo.sakimake', 'rokuyo.butsumetsu'];
const PHASES = ['moon-phase.new-moon', 'moon-phase.first-quarter', 'moon-phase.full-moon', 'moon-phase.last-quarter'];
const KINDS = [
  'moon-phase', 'moon-apsis', 'moon-declination', 'planet-conjunction',
  'planet-opposition', 'planet-elongation', 'close-approach',
];
const ISO_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?\+09:00$/;

/** All YYYY-MM-DD dates of one month. */
function monthDates(year, month) {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) =>
    `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
}
const day = (date) => almanac.find((d) => d.date === date);

/** Every MessageKey referenced by the almanac / event data. */
function usedKeys() {
  const keys = [];
  for (const d of almanac) {
    keys.push(d.rokuyoKey, ...d.zassetsuKeys);
    for (const k of [d.moonPhaseKey, d.sekkiKey, d.kouKey, d.holiday?.key]) if (k !== undefined) keys.push(k);
  }
  for (const e of events) keys.push(e.titleKey);
  return keys;
}

test('today is fixed to 2026-11-16', () => {
  assert.equal(sample.today, '2026-11-16');
});

test('almanac holds every day of 2026-11 and 2027-03, in ascending order without duplicates', () => {
  const dates = [...almanac.map((d) => d.date)];
  for (const date of [...monthDates(2026, 11), ...monthDates(2027, 3)]) {
    assert.ok(dates.includes(date), `missing ${date}`);
  }
  assert.deepEqual([...dates].sort(), dates, 'ascending');
  assert.equal(new Set(dates).size, dates.length, 'no duplicates');
});

test('rokuyo follows the lunar date: (month + day) % 6', () => {
  for (const d of almanac) {
    assert.equal(d.rokuyoKey, ROKUYO[(d.lunar.month + d.lunar.day) % 6], d.date);
  }
});

test('lunar date advances one day at a time and restarts at 1 only on the new moon day', () => {
  for (let i = 1; i < almanac.length; i++) {
    const prev = almanac[i - 1];
    const cur = almanac[i];
    const gap = (Date.parse(cur.date) - Date.parse(prev.date)) / 86400000;
    if (gap !== 1) continue;
    if (cur.lunar.day === 1) {
      assert.ok(prev.lunar.day === 29 || prev.lunar.day === 30, `${cur.date}: month length`);
    } else {
      assert.equal(cur.lunar.day, prev.lunar.day + 1, cur.date);
      assert.equal(cur.lunar.month, prev.lunar.month, cur.date);
    }
  }
  for (const d of almanac) {
    assert.ok(d.lunar.month >= 1 && d.lunar.month <= 12 && d.lunar.day >= 1 && d.lunar.day <= 30, d.date);
    assert.equal(d.lunar.day === 1, d.moonPhaseKey === 'moon-phase.new-moon', `${d.date}: new moon <-> lunar day 1`);
  }
});

test('moon age has one decimal, grows about 1 per day and is near 0 on the new moon day', () => {
  for (let i = 0; i < almanac.length; i++) {
    const d = almanac[i];
    assert.equal(Math.round(d.moonAge * 10) / 10, d.moonAge, d.date);
    assert.ok(d.moonAge >= 0 && d.moonAge < 30, d.date);
    if (d.moonPhaseKey === 'moon-phase.new-moon') assert.ok(d.moonAge < 1, `${d.date}: age at new moon`);
    const prev = almanac[i - 1];
    if (prev && (Date.parse(d.date) - Date.parse(prev.date)) / 86400000 === 1 && d.lunar.day !== 1) {
      const diff = d.moonAge - prev.moonAge;
      assert.ok(diff > 0.9 && diff < 1.1, `${d.date}: age step ${diff}`);
    }
  }
});

test('moonPhaseKey appears only on the four principal phases, and each lunation shows all four', () => {
  for (const d of almanac) {
    if (d.moonPhaseKey !== undefined) assert.ok(PHASES.includes(d.moonPhaseKey), d.date);
  }
  const nov = almanac.filter((d) => d.date.startsWith('2026-11') && d.moonPhaseKey);
  assert.deepEqual(
    [...nov.map((d) => d.moonPhaseKey)].sort(),
    [...PHASES].sort(),
    '2026-11 has each principal phase once',
  );
});

test('within 2026-11, a moonPhaseKey day carries the matching moon-phase event', () => {
  for (const d of almanac.filter((x) => x.date.startsWith('2026-11'))) {
    const phaseEvents = d.eventIds.map((id) => eventById.get(id)).filter((e) => e?.kind === 'moon-phase');
    if (d.moonPhaseKey === undefined) {
      assert.equal(phaseEvents.length, 0, d.date);
    } else {
      assert.equal(phaseEvents.length, 1, d.date);
      assert.equal(phaseEvents[0].titleKey, d.moonPhaseKey.replace('moon-phase.', 'astro.event.'), d.date);
    }
  }
});

test('sekki and kou start on plausible days', () => {
  assert.equal(day('2026-11-07').sekkiKey, 'sekki.ritto');
  assert.equal(day('2026-11-22').sekkiKey, 'sekki.shosetsu');
  assert.equal(day('2027-03-06').sekkiKey, 'sekki.keichitsu');
  assert.equal(day('2027-03-21').sekkiKey, 'sekki.shunbun');
  // A sekki day is also the first day of its first kou.
  assert.equal(day('2026-11-07').kouKey, 'kou.k55');
  assert.equal(day('2026-11-22').kouKey, 'kou.k58');
  assert.equal(day('2027-03-06').kouKey, 'kou.k07');
  assert.equal(day('2027-03-21').kouKey, 'kou.k10');
  for (const prefix of ['2026-11', '2027-03']) {
    const kouDays = almanac.filter((d) => d.date.startsWith(prefix) && d.kouKey);
    assert.ok(kouDays.length >= 5 && kouDays.length <= 7, `${prefix}: kou count ${kouDays.length}`);
    for (let i = 1; i < kouDays.length; i++) {
      const gap = (Date.parse(kouDays[i].date) - Date.parse(kouDays[i - 1].date)) / 86400000;
      assert.ok(gap >= 4 && gap <= 6, `${kouDays[i].date}: kou gap ${gap}`);
      const n = (k) => Number(k.slice('kou.k'.length));
      assert.equal(n(kouDays[i].kouKey), n(kouDays[i - 1].kouKey) + 1, kouDays[i].date);
    }
    const sekkiDays = almanac.filter((d) => d.date.startsWith(prefix) && d.sekkiKey);
    assert.equal(sekkiDays.length, 2, `${prefix}: two sekki`);
  }
});

test('zassetsu: spring higan begins 3 days before the equinox day and a spring shanichi exists', () => {
  assert.deepEqual([...day('2027-03-18').zassetsuKeys], ['zassetsu.higan-spring']);
  const shanichi = almanac.filter((d) => d.zassetsuKeys.includes('zassetsu.shanichi-spring'));
  assert.equal(shanichi.length, 1);
  assert.ok(shanichi[0].date.startsWith('2027-03'));
  for (const d of almanac.filter((x) => x.date.startsWith('2026-11'))) {
    assert.deepEqual([...d.zassetsuKeys], [], `${d.date}: no zassetsu in 2026-11`);
  }
});

test('holidays: 2026-11-03 / 11-23 are fixed, 2027-03-21 (and its substitute) are provisional', () => {
  assert.deepEqual({ ...day('2026-11-03').holiday }, { key: 'holiday.bunka-no-hi', provisional: false });
  assert.deepEqual({ ...day('2026-11-23').holiday }, { key: 'holiday.kinro-kansha-no-hi', provisional: false });
  assert.deepEqual({ ...day('2027-03-21').holiday }, { key: 'holiday.shunbun-no-hi', provisional: true });
  // 2027-03-21 is a Sunday, so the next day is a substitute holiday (also not yet announced).
  assert.deepEqual({ ...day('2027-03-22').holiday }, { key: 'holiday.furikae-kyujitsu', provisional: true });
  const holidays = [...almanac.filter((d) => d.holiday).map((d) => d.date)];
  assert.deepEqual(holidays, ['2026-11-03', '2026-11-23', '2027-03-21', '2027-03-22']);
  for (const d of almanac) {
    if (d.holiday?.provisional) assert.ok(d.date >= '2027-01-01', `${d.date}: only next-year holidays are provisional`);
  }
});

test('at least one leap-month example', () => {
  const leap = almanac.filter((d) => d.lunar.leap);
  assert.ok(leap.length >= 1);
});

test('every eventId resolves and lies on that day (JST)', () => {
  for (const d of almanac) {
    for (const id of d.eventIds) {
      const e = eventById.get(id);
      assert.ok(e, `${d.date}: unknown event ${id}`);
      assert.equal(e.at.slice(0, 10), d.date, `${id} is on ${d.date}`);
    }
  }
  // Every event in 2026-11 is listed on its day.
  for (const e of events.filter((x) => x.at.startsWith('2026-11'))) {
    assert.ok(day(e.at.slice(0, 10)).eventIds.includes(e.id), `${e.id} listed on its day`);
  }
});

test('events: unique ids, valid kinds, ISO +09:00 times within 2026-11..12, ascending', () => {
  assert.equal(new Set(events.map((e) => e.id)).size, events.length);
  for (const e of events) {
    assert.ok(KINDS.includes(e.kind), `${e.id}: kind ${e.kind}`);
    assert.match(e.at, ISO_OFFSET, e.id);
    assert.ok(e.at >= '2026-11-01' && e.at < '2027-01-01', `${e.id}: ${e.at}`);
    assert.ok(e.titleKey.startsWith('astro.event.'), e.id);
    assert.ok(e.bodies.length >= 1, e.id);
  }
  const times = [...events.map((e) => Date.parse(e.at))];
  assert.deepEqual([...times].sort((a, b) => a - b), times, 'ascending');
});

test('events cover every required kind in both months', () => {
  for (const month of ['2026-11', '2026-12']) {
    const titles = events.filter((e) => e.at.startsWith(month)).map((e) => e.titleKey);
    for (const t of [
      'astro.event.new-moon', 'astro.event.first-quarter', 'astro.event.full-moon', 'astro.event.last-quarter',
      'astro.event.max-north', 'astro.event.max-south', 'astro.event.perigee', 'astro.event.apogee',
    ]) {
      assert.ok(titles.includes(t), `${month}: ${t}`);
    }
  }
  const kinds = new Set(events.map((e) => e.kind));
  for (const k of KINDS) assert.ok(kinds.has(k), `kind ${k} present`);
});

test('sunrise / sunset change smoothly and monotonically day to day within each month', () => {
  const minutesOf = (iso) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
  // Nov: sunrise later, sunset earlier. Mar: sunrise earlier, sunset later.
  const direction = { '2026-11': { sunrise: 1, sunset: -1 }, '2027-03': { sunrise: -1, sunset: 1 } };
  for (const [month, dir] of Object.entries(direction)) {
    const days = almanac.filter((d) => d.date.startsWith(month));
    for (let i = 1; i < days.length; i++) {
      for (const k of ['sunrise', 'sunset']) {
        const diff = minutesOf(days[i].riseSet[k]) - minutesOf(days[i - 1].riseSet[k]);
        assert.ok(Math.abs(diff) <= 3, `${days[i].date} ${k}: step ${diff} min`);
        assert.ok(diff * dir[k] >= 0, `${days[i].date} ${k}: moves the wrong way (${diff} min)`);
      }
    }
  }
});

test('every almanac day has rise/set times for a fictional Tokyo-area point', () => {
  let missingMoon = 0;
  for (const d of almanac) {
    const rs = d.riseSet;
    assert.ok(rs, `${d.date}: riseSet`);
    for (const k of ['sunrise', 'sunset']) {
      assert.match(rs[k], ISO_OFFSET, `${d.date} ${k}`);
      assert.equal(rs[k].slice(0, 10), d.date, `${d.date} ${k}`);
    }
    assert.ok(rs.sunrise < rs.sunset, d.date);
    for (const k of ['moonrise', 'moonset']) {
      if (rs[k] === undefined) { missingMoon++; continue; }
      assert.match(rs[k], ISO_OFFSET, `${d.date} ${k}`);
      assert.equal(rs[k].slice(0, 10), d.date, `${d.date} ${k}`);
    }
  }
  assert.ok(missingMoon >= 1, 'some day has no moonrise or moonset');
});

test('every key referenced by the almanac and events exists in both dictionaries', () => {
  for (const k of usedKeys()) {
    assert.ok(Object.hasOwn(ja, k), `ja: ${k}`);
    assert.ok(Object.hasOwn(en, k), `en: ${k}`);
  }
});

test('the sample data is frozen', () => {
  assert.ok(Object.isFrozen(almanac) && Object.isFrozen(events));
  assert.ok(Object.isFrozen(almanac[0]) && Object.isFrozen(almanac[0].lunar) && Object.isFrozen(almanac[0].riseSet));
  assert.ok(events.length === 0 || Object.isFrozen(events[0].bodies));
});

// Task 8.1 (day-detail review: "七十二候は期間"): kouStarts lists the first day of every 候 that
// covers a sample day, so any sample day can show its 候 with the day count. The 候 that start
// inside the sample come from AlmanacDay.kouKey; the two that start before it (2025-07-22 for the
// leap-month example, 2026-10-28 for 2026-11-01) are listed explicitly.
test('kouStarts: ascending, consistent with kouKey, and every sample day is in a 候 of 5 or 6 days', () => {
  const starts = sample.kouStarts;
  assert.ok(Array.isArray(starts) && starts.length > 0, 'kouStarts exists');
  const dates = [...starts.map((s) => s.start)];
  assert.deepEqual([...dates].sort(), dates, 'ascending');
  assert.equal(new Set(dates).size, dates.length, 'no duplicates');
  for (const s of starts) {
    assert.match(s.key, /^kou\.k\d{2}$/);
    assert.ok(s.key in ja && s.key in en, `${s.key} in both dictionaries`);
    const d = day(s.start);
    if (d) assert.equal(d.kouKey, s.key, `${s.start}: kouKey matches the start`);
  }
  for (const d of almanac) {
    if (d.kouKey) assert.ok(starts.some((s) => s.start === d.date && s.key === d.kouKey), `${d.date} is listed`);
    const current = starts.filter((s) => s.start <= d.date).at(-1);
    assert.ok(current, `${d.date} has a 候`);
    const n = (Date.parse(d.date) - Date.parse(current.start)) / 86400000 + 1;
    assert.ok(n >= 1 && n <= 6, `${d.date}: day ${n} of ${current.key}`);
  }
  // consecutive starts are 5 or 6 days apart (one 候 is about 5 days)
  for (let i = 1; i < starts.length; i += 1) {
    const gap = (Date.parse(starts[i].start) - Date.parse(starts[i - 1].start)) / 86400000;
    if (gap < 30) assert.ok(gap === 5 || gap === 6, `${starts[i].start}: gap ${gap}`);
  }
  // the 候 before the sample: k53 before k54 (2026-11-02), k34 (大暑の初候) for the leap-month example
  assert.equal(starts.find((s) => s.start === '2026-10-28')?.key, 'kou.k53');
  assert.equal(starts.find((s) => s.start === '2025-07-22')?.key, 'kou.k34');
});
