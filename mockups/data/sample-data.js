// Fictional sample data (users, posts, comment trees, almanac values, astronomical events, star
// chart, weather). Classic script that registers into window.MockSample.
// Task 3.2 filled in the almanac and astronomical events; tasks 3.3-3.4 fill in the rest.
//
// All almanac / astronomy values are illustrative approximations for the mockups and have NOT
// been verified (design.md: SampleData "値の正確さは保証しない"). They are kept internally
// consistent:
// - lunar date: day 1 is the new-moon day (JST); rokuyo = (lunar month + lunar day) % 6
//   -> 大安, 赤口, 先勝, 友引, 先負, 仏滅 for 0..5
// - moonAge: days since the new moon at 21:00 JST, one decimal place
// - moonPhaseKey only on the days of 朔・上弦・望・下弦; sekkiKey / kouKey only on the first day
// - riseSet: a fictional point near Tokyo (sunrise/sunset interpolated; moonrise about 50 min
//   later each day, so some days have no moonrise or moonset)
// - leap month: no 閏月 falls in 2026-11 or 2027-03, so the single extra row 2025-07-25
//   (旧暦閏6月1日, the start of the leap 6th month of 2025) is the leap-month example
// - 2027-03-21 (春分の日) is a Sunday, so 2027-03-22 is a 振替休日; both are provisional
//   (next-year equinox holidays are announced in the official gazette in February)
(function () {
  /**
   * Freezes a value and everything reachable from it.
   * @template T
   * @param {T} value
   * @returns {T}
   */
  function deepFreeze(value) {
    if (value !== null && typeof value === 'object') {
      for (const v of Object.values(value)) deepFreeze(v);
      Object.freeze(value);
    }
    return value;
  }

  /**
   * Astronomical events of 2026-11 and 2026-12 (JST), ascending by time.
   * `bodies` are body ids (sun, moon, mercury, ... -> astro.body.{id}).
   * @type {AstroEvent[]}
   */
  const events = [
    { id: 'ev-2026-11-01-last-quarter', kind: 'moon-phase', at: '2026-11-01T05:28+09:00', titleKey: 'astro.event.last-quarter', bodies: ['moon'] },
    { id: 'ev-2026-11-09-new-moon', kind: 'moon-phase', at: '2026-11-09T16:02+09:00', titleKey: 'astro.event.new-moon', bodies: ['moon'] },
    { id: 'ev-2026-11-11-max-south', kind: 'moon-declination', at: '2026-11-11T09:14+09:00', titleKey: 'astro.event.max-south', bodies: ['moon'] },
    { id: 'ev-2026-11-13-apogee', kind: 'moon-apsis', at: '2026-11-13T01:07+09:00', titleKey: 'astro.event.apogee', bodies: ['moon'] },
    { id: 'ev-2026-11-17-first-quarter', kind: 'moon-phase', at: '2026-11-17T20:48+09:00', titleKey: 'astro.event.first-quarter', bodies: ['moon'] },
    { id: 'ev-2026-11-20-moon-saturn', kind: 'close-approach', at: '2026-11-20T18:30+09:00', titleKey: 'astro.event.close-approach', bodies: ['moon', 'saturn'] },
    { id: 'ev-2026-11-20-mercury-inferior', kind: 'planet-conjunction', at: '2026-11-20T22:00+09:00', titleKey: 'astro.event.inferior-conjunction', bodies: ['mercury'] },
    { id: 'ev-2026-11-24-full-moon', kind: 'moon-phase', at: '2026-11-24T23:53+09:00', titleKey: 'astro.event.full-moon', bodies: ['moon'] },
    { id: 'ev-2026-11-25-max-north', kind: 'moon-declination', at: '2026-11-25T06:40+09:00', titleKey: 'astro.event.max-north', bodies: ['moon'] },
    { id: 'ev-2026-11-25-perigee', kind: 'moon-apsis', at: '2026-11-25T18:12+09:00', titleKey: 'astro.event.perigee', bodies: ['moon'] },
    { id: 'ev-2026-11-26-uranus-opposition', kind: 'planet-opposition', at: '2026-11-26T03:00+09:00', titleKey: 'astro.event.opposition', bodies: ['uranus'] },
    { id: 'ev-2026-11-29-moon-jupiter', kind: 'close-approach', at: '2026-11-29T04:00+09:00', titleKey: 'astro.event.close-approach', bodies: ['moon', 'jupiter'] },
    { id: 'ev-2026-12-01-last-quarter', kind: 'moon-phase', at: '2026-12-01T15:08+09:00', titleKey: 'astro.event.last-quarter', bodies: ['moon'] },
    { id: 'ev-2026-12-06-moon-venus', kind: 'close-approach', at: '2026-12-06T05:30+09:00', titleKey: 'astro.event.close-approach', bodies: ['moon', 'venus'] },
    { id: 'ev-2026-12-07-mercury-elongation', kind: 'planet-elongation', at: '2026-12-07T10:00+09:00', titleKey: 'astro.event.greatest-elongation-west', bodies: ['mercury'] },
    { id: 'ev-2026-12-08-max-south', kind: 'moon-declination', at: '2026-12-08T15:20+09:00', titleKey: 'astro.event.max-south', bodies: ['moon'] },
    { id: 'ev-2026-12-09-new-moon', kind: 'moon-phase', at: '2026-12-09T09:52+09:00', titleKey: 'astro.event.new-moon', bodies: ['moon'] },
    { id: 'ev-2026-12-10-apogee', kind: 'moon-apsis', at: '2026-12-10T20:30+09:00', titleKey: 'astro.event.apogee', bodies: ['moon'] },
    { id: 'ev-2026-12-17-first-quarter', kind: 'moon-phase', at: '2026-12-17T14:42+09:00', titleKey: 'astro.event.first-quarter', bodies: ['moon'] },
    { id: 'ev-2026-12-22-max-north', kind: 'moon-declination', at: '2026-12-22T12:05+09:00', titleKey: 'astro.event.max-north', bodies: ['moon'] },
    { id: 'ev-2026-12-24-full-moon', kind: 'moon-phase', at: '2026-12-24T10:28+09:00', titleKey: 'astro.event.full-moon', bodies: ['moon'] },
    { id: 'ev-2026-12-24-perigee', kind: 'moon-apsis', at: '2026-12-24T15:40+09:00', titleKey: 'astro.event.perigee', bodies: ['moon'] },
    { id: 'ev-2026-12-27-mars-saturn', kind: 'planet-conjunction', at: '2026-12-27T21:00+09:00', titleKey: 'astro.event.conjunction', bodies: ['mars', 'saturn'] },
    { id: 'ev-2026-12-31-last-quarter', kind: 'moon-phase', at: '2026-12-31T08:59+09:00', titleKey: 'astro.event.last-quarter', bodies: ['moon'] },
  ];

  /**
   * Ids of the events on a JST date (keeps AlmanacDay.eventIds consistent with `events`).
   * @param {IsoDate} date
   * @returns {string[]}
   */
  const EV = (date) => events.filter((e) => e.at.slice(0, 10) === date).map((e) => e.id);

  /**
   * Leap-month example (2025-07-25), every day of 2026-11, and 2027-03 for the provisional
   * holidays. Ascending by date.
   * @type {AlmanacDay[]}
   */
  const almanac = [
    { date: '2025-07-25', rokuyoKey: 'rokuyo.shakko', lunar: { month: 6, day: 1, leap: true }, moonAge: 0.7, moonPhaseKey: 'moon-phase.new-moon', zassetsuKeys: [], eventIds: EV('2025-07-25'), riseSet: { sunrise: '2025-07-25T04:46+09:00', sunset: '2025-07-25T18:52+09:00', moonrise: '2025-07-25T05:44+09:00', moonset: '2025-07-25T18:09+09:00' } },
    { date: '2026-11-01', rokuyoKey: 'rokuyo.shakko', lunar: { month: 9, day: 22, leap: false }, moonAge: 21.8, moonPhaseKey: 'moon-phase.last-quarter', zassetsuKeys: [], eventIds: EV('2026-11-01'), riseSet: { sunrise: '2026-11-01T05:59+09:00', sunset: '2026-11-01T16:46+09:00', moonrise: '2026-11-01T23:55+09:00', moonset: '2026-11-01T11:21+09:00' } },
    { date: '2026-11-02', rokuyoKey: 'rokuyo.sensho', lunar: { month: 9, day: 23, leap: false }, moonAge: 22.8, kouKey: 'kou.k54', zassetsuKeys: [], eventIds: EV('2026-11-02'), riseSet: { sunrise: '2026-11-02T06:00+09:00', sunset: '2026-11-02T16:45+09:00', moonset: '2026-11-02T12:06+09:00' } },
    { date: '2026-11-03', rokuyoKey: 'rokuyo.tomobiki', lunar: { month: 9, day: 24, leap: false }, moonAge: 23.8, zassetsuKeys: [], holiday: { key: 'holiday.bunka-no-hi', provisional: false }, eventIds: EV('2026-11-03'), riseSet: { sunrise: '2026-11-03T06:01+09:00', sunset: '2026-11-03T16:45+09:00', moonrise: '2026-11-03T00:45+09:00', moonset: '2026-11-03T12:55+09:00' } },
    { date: '2026-11-04', rokuyoKey: 'rokuyo.sakimake', lunar: { month: 9, day: 25, leap: false }, moonAge: 24.8, zassetsuKeys: [], eventIds: EV('2026-11-04'), riseSet: { sunrise: '2026-11-04T06:02+09:00', sunset: '2026-11-04T16:44+09:00', moonrise: '2026-11-04T01:35+09:00', moonset: '2026-11-04T13:47+09:00' } },
    { date: '2026-11-05', rokuyoKey: 'rokuyo.butsumetsu', lunar: { month: 9, day: 26, leap: false }, moonAge: 25.8, zassetsuKeys: [], eventIds: EV('2026-11-05'), riseSet: { sunrise: '2026-11-05T06:03+09:00', sunset: '2026-11-05T16:44+09:00', moonrise: '2026-11-05T02:26+09:00', moonset: '2026-11-05T14:43+09:00' } },
    { date: '2026-11-06', rokuyoKey: 'rokuyo.taian', lunar: { month: 9, day: 27, leap: false }, moonAge: 26.8, zassetsuKeys: [], eventIds: EV('2026-11-06'), riseSet: { sunrise: '2026-11-06T06:04+09:00', sunset: '2026-11-06T16:43+09:00', moonrise: '2026-11-06T03:16+09:00', moonset: '2026-11-06T15:40+09:00' } },
    { date: '2026-11-07', rokuyoKey: 'rokuyo.shakko', lunar: { month: 9, day: 28, leap: false }, moonAge: 27.8, sekkiKey: 'sekki.ritto', kouKey: 'kou.k55', zassetsuKeys: [], eventIds: EV('2026-11-07'), riseSet: { sunrise: '2026-11-07T06:05+09:00', sunset: '2026-11-07T16:42+09:00', moonrise: '2026-11-07T04:07+09:00', moonset: '2026-11-07T16:38+09:00' } },
    { date: '2026-11-08', rokuyoKey: 'rokuyo.sensho', lunar: { month: 9, day: 29, leap: false }, moonAge: 28.8, zassetsuKeys: [], eventIds: EV('2026-11-08'), riseSet: { sunrise: '2026-11-08T06:06+09:00', sunset: '2026-11-08T16:42+09:00', moonrise: '2026-11-08T04:57+09:00', moonset: '2026-11-08T17:34+09:00' } },
    { date: '2026-11-09', rokuyoKey: 'rokuyo.butsumetsu', lunar: { month: 10, day: 1, leap: false }, moonAge: 0.2, moonPhaseKey: 'moon-phase.new-moon', zassetsuKeys: [], eventIds: EV('2026-11-09'), riseSet: { sunrise: '2026-11-09T06:07+09:00', sunset: '2026-11-09T16:41+09:00', moonrise: '2026-11-09T05:47+09:00', moonset: '2026-11-09T18:27+09:00' } },
    { date: '2026-11-10', rokuyoKey: 'rokuyo.taian', lunar: { month: 10, day: 2, leap: false }, moonAge: 1.2, zassetsuKeys: [], eventIds: EV('2026-11-10'), riseSet: { sunrise: '2026-11-10T06:08+09:00', sunset: '2026-11-10T16:40+09:00', moonrise: '2026-11-10T06:57+09:00', moonset: '2026-11-10T19:29+09:00' } },
    { date: '2026-11-11', rokuyoKey: 'rokuyo.shakko', lunar: { month: 10, day: 3, leap: false }, moonAge: 2.2, zassetsuKeys: [], eventIds: EV('2026-11-11'), riseSet: { sunrise: '2026-11-11T06:09+09:00', sunset: '2026-11-11T16:40+09:00', moonrise: '2026-11-11T07:47+09:00', moonset: '2026-11-11T20:25+09:00' } },
    { date: '2026-11-12', rokuyoKey: 'rokuyo.sensho', lunar: { month: 10, day: 4, leap: false }, moonAge: 3.2, kouKey: 'kou.k56', zassetsuKeys: [], eventIds: EV('2026-11-12'), riseSet: { sunrise: '2026-11-12T06:10+09:00', sunset: '2026-11-12T16:39+09:00', moonrise: '2026-11-12T08:38+09:00', moonset: '2026-11-12T21:18+09:00' } },
    { date: '2026-11-13', rokuyoKey: 'rokuyo.tomobiki', lunar: { month: 10, day: 5, leap: false }, moonAge: 4.2, zassetsuKeys: [], eventIds: EV('2026-11-13'), riseSet: { sunrise: '2026-11-13T06:11+09:00', sunset: '2026-11-13T16:39+09:00', moonrise: '2026-11-13T09:28+09:00', moonset: '2026-11-13T22:07+09:00' } },
    { date: '2026-11-14', rokuyoKey: 'rokuyo.sakimake', lunar: { month: 10, day: 6, leap: false }, moonAge: 5.2, zassetsuKeys: [], eventIds: EV('2026-11-14'), riseSet: { sunrise: '2026-11-14T06:12+09:00', sunset: '2026-11-14T16:38+09:00', moonrise: '2026-11-14T10:19+09:00', moonset: '2026-11-14T22:53+09:00' } },
    { date: '2026-11-15', rokuyoKey: 'rokuyo.butsumetsu', lunar: { month: 10, day: 7, leap: false }, moonAge: 6.2, zassetsuKeys: [], eventIds: EV('2026-11-15'), riseSet: { sunrise: '2026-11-15T06:13+09:00', sunset: '2026-11-15T16:37+09:00', moonrise: '2026-11-15T11:09+09:00', moonset: '2026-11-15T23:36+09:00' } },
    { date: '2026-11-16', rokuyoKey: 'rokuyo.taian', lunar: { month: 10, day: 8, leap: false }, moonAge: 7.2, zassetsuKeys: [], eventIds: EV('2026-11-16'), riseSet: { sunrise: '2026-11-16T06:14+09:00', sunset: '2026-11-16T16:37+09:00', moonrise: '2026-11-16T11:59+09:00' } },
    { date: '2026-11-17', rokuyoKey: 'rokuyo.shakko', lunar: { month: 10, day: 9, leap: false }, moonAge: 8.2, moonPhaseKey: 'moon-phase.first-quarter', kouKey: 'kou.k57', zassetsuKeys: [], eventIds: EV('2026-11-17'), riseSet: { sunrise: '2026-11-17T06:15+09:00', sunset: '2026-11-17T16:36+09:00', moonrise: '2026-11-17T12:50+09:00', moonset: '2026-11-17T00:19+09:00' } },
    { date: '2026-11-18', rokuyoKey: 'rokuyo.sensho', lunar: { month: 10, day: 10, leap: false }, moonAge: 9.2, zassetsuKeys: [], eventIds: EV('2026-11-18'), riseSet: { sunrise: '2026-11-18T06:16+09:00', sunset: '2026-11-18T16:35+09:00', moonrise: '2026-11-18T13:40+09:00', moonset: '2026-11-18T01:03+09:00' } },
    { date: '2026-11-19', rokuyoKey: 'rokuyo.tomobiki', lunar: { month: 10, day: 11, leap: false }, moonAge: 10.2, zassetsuKeys: [], eventIds: EV('2026-11-19'), riseSet: { sunrise: '2026-11-19T06:17+09:00', sunset: '2026-11-19T16:35+09:00', moonrise: '2026-11-19T14:31+09:00', moonset: '2026-11-19T01:51+09:00' } },
    { date: '2026-11-20', rokuyoKey: 'rokuyo.sakimake', lunar: { month: 10, day: 12, leap: false }, moonAge: 11.2, zassetsuKeys: [], eventIds: EV('2026-11-20'), riseSet: { sunrise: '2026-11-20T06:18+09:00', sunset: '2026-11-20T16:34+09:00', moonrise: '2026-11-20T15:21+09:00', moonset: '2026-11-20T02:41+09:00' } },
    { date: '2026-11-21', rokuyoKey: 'rokuyo.butsumetsu', lunar: { month: 10, day: 13, leap: false }, moonAge: 12.2, zassetsuKeys: [], eventIds: EV('2026-11-21'), riseSet: { sunrise: '2026-11-21T06:19+09:00', sunset: '2026-11-21T16:34+09:00', moonrise: '2026-11-21T16:11+09:00', moonset: '2026-11-21T03:35+09:00' } },
    { date: '2026-11-22', rokuyoKey: 'rokuyo.taian', lunar: { month: 10, day: 14, leap: false }, moonAge: 13.2, sekkiKey: 'sekki.shosetsu', kouKey: 'kou.k58', zassetsuKeys: [], eventIds: EV('2026-11-22'), riseSet: { sunrise: '2026-11-22T06:20+09:00', sunset: '2026-11-22T16:33+09:00', moonrise: '2026-11-22T17:02+09:00', moonset: '2026-11-22T04:32+09:00' } },
    { date: '2026-11-23', rokuyoKey: 'rokuyo.shakko', lunar: { month: 10, day: 15, leap: false }, moonAge: 14.2, zassetsuKeys: [], holiday: { key: 'holiday.kinro-kansha-no-hi', provisional: false }, eventIds: EV('2026-11-23'), riseSet: { sunrise: '2026-11-23T06:21+09:00', sunset: '2026-11-23T16:32+09:00', moonrise: '2026-11-23T17:52+09:00', moonset: '2026-11-23T05:30+09:00' } },
    { date: '2026-11-24', rokuyoKey: 'rokuyo.sensho', lunar: { month: 10, day: 16, leap: false }, moonAge: 15.2, moonPhaseKey: 'moon-phase.full-moon', zassetsuKeys: [], eventIds: EV('2026-11-24'), riseSet: { sunrise: '2026-11-24T06:22+09:00', sunset: '2026-11-24T16:32+09:00', moonrise: '2026-11-24T18:43+09:00', moonset: '2026-11-24T06:27+09:00' } },
    { date: '2026-11-25', rokuyoKey: 'rokuyo.tomobiki', lunar: { month: 10, day: 17, leap: false }, moonAge: 16.2, zassetsuKeys: [], eventIds: EV('2026-11-25'), riseSet: { sunrise: '2026-11-25T06:23+09:00', sunset: '2026-11-25T16:31+09:00', moonrise: '2026-11-25T19:33+09:00', moonset: '2026-11-25T07:22+09:00' } },
    { date: '2026-11-26', rokuyoKey: 'rokuyo.sakimake', lunar: { month: 10, day: 18, leap: false }, moonAge: 17.2, zassetsuKeys: [], eventIds: EV('2026-11-26'), riseSet: { sunrise: '2026-11-26T06:24+09:00', sunset: '2026-11-26T16:30+09:00', moonrise: '2026-11-26T20:23+09:00', moonset: '2026-11-26T08:13+09:00' } },
    { date: '2026-11-27', rokuyoKey: 'rokuyo.butsumetsu', lunar: { month: 10, day: 19, leap: false }, moonAge: 18.2, kouKey: 'kou.k59', zassetsuKeys: [], eventIds: EV('2026-11-27'), riseSet: { sunrise: '2026-11-27T06:25+09:00', sunset: '2026-11-27T16:30+09:00', moonrise: '2026-11-27T21:14+09:00', moonset: '2026-11-27T09:00+09:00' } },
    { date: '2026-11-28', rokuyoKey: 'rokuyo.taian', lunar: { month: 10, day: 20, leap: false }, moonAge: 19.2, zassetsuKeys: [], eventIds: EV('2026-11-28'), riseSet: { sunrise: '2026-11-28T06:26+09:00', sunset: '2026-11-28T16:29+09:00', moonrise: '2026-11-28T22:04+09:00', moonset: '2026-11-28T09:45+09:00' } },
    { date: '2026-11-29', rokuyoKey: 'rokuyo.shakko', lunar: { month: 10, day: 21, leap: false }, moonAge: 20.2, zassetsuKeys: [], eventIds: EV('2026-11-29'), riseSet: { sunrise: '2026-11-29T06:27+09:00', sunset: '2026-11-29T16:29+09:00', moonrise: '2026-11-29T22:55+09:00', moonset: '2026-11-29T10:28+09:00' } },
    { date: '2026-11-30', rokuyoKey: 'rokuyo.sensho', lunar: { month: 10, day: 22, leap: false }, moonAge: 21.2, zassetsuKeys: [], eventIds: EV('2026-11-30'), riseSet: { sunrise: '2026-11-30T06:28+09:00', sunset: '2026-11-30T16:28+09:00', moonrise: '2026-11-30T23:45+09:00', moonset: '2026-11-30T11:11+09:00' } },
    { date: '2027-03-01', rokuyoKey: 'rokuyo.taian', lunar: { month: 1, day: 23, leap: false }, moonAge: 22.8, moonPhaseKey: 'moon-phase.last-quarter', kouKey: 'kou.k06', zassetsuKeys: [], eventIds: EV('2027-03-01'), riseSet: { sunrise: '2027-03-01T06:11+09:00', sunset: '2027-03-01T17:41+09:00', moonset: '2027-03-01T12:09+09:00' } },
    { date: '2027-03-02', rokuyoKey: 'rokuyo.shakko', lunar: { month: 1, day: 24, leap: false }, moonAge: 23.8, zassetsuKeys: [], eventIds: EV('2027-03-02'), riseSet: { sunrise: '2027-03-02T06:10+09:00', sunset: '2027-03-02T17:42+09:00', moonrise: '2027-03-02T00:48+09:00', moonset: '2027-03-02T12:58+09:00' } },
    { date: '2027-03-03', rokuyoKey: 'rokuyo.sensho', lunar: { month: 1, day: 25, leap: false }, moonAge: 24.8, zassetsuKeys: [], eventIds: EV('2027-03-03'), riseSet: { sunrise: '2027-03-03T06:08+09:00', sunset: '2027-03-03T17:42+09:00', moonrise: '2027-03-03T01:38+09:00', moonset: '2027-03-03T13:50+09:00' } },
    { date: '2027-03-04', rokuyoKey: 'rokuyo.tomobiki', lunar: { month: 1, day: 26, leap: false }, moonAge: 25.8, zassetsuKeys: [], eventIds: EV('2027-03-04'), riseSet: { sunrise: '2027-03-04T06:07+09:00', sunset: '2027-03-04T17:43+09:00', moonrise: '2027-03-04T02:29+09:00', moonset: '2027-03-04T14:46+09:00' } },
    { date: '2027-03-05', rokuyoKey: 'rokuyo.sakimake', lunar: { month: 1, day: 27, leap: false }, moonAge: 26.8, zassetsuKeys: [], eventIds: EV('2027-03-05'), riseSet: { sunrise: '2027-03-05T06:06+09:00', sunset: '2027-03-05T17:44+09:00', moonrise: '2027-03-05T03:19+09:00', moonset: '2027-03-05T15:43+09:00' } },
    { date: '2027-03-06', rokuyoKey: 'rokuyo.butsumetsu', lunar: { month: 1, day: 28, leap: false }, moonAge: 27.8, sekkiKey: 'sekki.keichitsu', kouKey: 'kou.k07', zassetsuKeys: [], eventIds: EV('2027-03-06'), riseSet: { sunrise: '2027-03-06T06:04+09:00', sunset: '2027-03-06T17:45+09:00', moonrise: '2027-03-06T04:09+09:00', moonset: '2027-03-06T16:41+09:00' } },
    { date: '2027-03-07', rokuyoKey: 'rokuyo.taian', lunar: { month: 1, day: 29, leap: false }, moonAge: 28.8, zassetsuKeys: [], eventIds: EV('2027-03-07'), riseSet: { sunrise: '2027-03-07T06:03+09:00', sunset: '2027-03-07T17:45+09:00', moonrise: '2027-03-07T05:00+09:00', moonset: '2027-03-07T17:37+09:00' } },
    { date: '2027-03-08', rokuyoKey: 'rokuyo.tomobiki', lunar: { month: 2, day: 1, leap: false }, moonAge: 0.1, moonPhaseKey: 'moon-phase.new-moon', zassetsuKeys: [], eventIds: EV('2027-03-08'), riseSet: { sunrise: '2027-03-08T06:01+09:00', sunset: '2027-03-08T17:46+09:00', moonrise: '2027-03-08T05:50+09:00', moonset: '2027-03-08T18:30+09:00' } },
    { date: '2027-03-09', rokuyoKey: 'rokuyo.sakimake', lunar: { month: 2, day: 2, leap: false }, moonAge: 1.1, zassetsuKeys: [], eventIds: EV('2027-03-09'), riseSet: { sunrise: '2027-03-09T06:00+09:00', sunset: '2027-03-09T17:47+09:00', moonrise: '2027-03-09T06:52+09:00', moonset: '2027-03-09T19:24+09:00' } },
    { date: '2027-03-10', rokuyoKey: 'rokuyo.butsumetsu', lunar: { month: 2, day: 3, leap: false }, moonAge: 2.1, zassetsuKeys: [], eventIds: EV('2027-03-10'), riseSet: { sunrise: '2027-03-10T05:59+09:00', sunset: '2027-03-10T17:47+09:00', moonrise: '2027-03-10T07:42+09:00', moonset: '2027-03-10T20:20+09:00' } },
    { date: '2027-03-11', rokuyoKey: 'rokuyo.taian', lunar: { month: 2, day: 4, leap: false }, moonAge: 3.1, kouKey: 'kou.k08', zassetsuKeys: [], eventIds: EV('2027-03-11'), riseSet: { sunrise: '2027-03-11T05:57+09:00', sunset: '2027-03-11T17:48+09:00', moonrise: '2027-03-11T08:32+09:00', moonset: '2027-03-11T21:12+09:00' } },
    { date: '2027-03-12', rokuyoKey: 'rokuyo.shakko', lunar: { month: 2, day: 5, leap: false }, moonAge: 4.1, zassetsuKeys: [], eventIds: EV('2027-03-12'), riseSet: { sunrise: '2027-03-12T05:56+09:00', sunset: '2027-03-12T17:49+09:00', moonrise: '2027-03-12T09:23+09:00', moonset: '2027-03-12T22:01+09:00' } },
    { date: '2027-03-13', rokuyoKey: 'rokuyo.sensho', lunar: { month: 2, day: 6, leap: false }, moonAge: 5.1, zassetsuKeys: [], eventIds: EV('2027-03-13'), riseSet: { sunrise: '2027-03-13T05:55+09:00', sunset: '2027-03-13T17:49+09:00', moonrise: '2027-03-13T10:13+09:00', moonset: '2027-03-13T22:47+09:00' } },
    { date: '2027-03-14', rokuyoKey: 'rokuyo.tomobiki', lunar: { month: 2, day: 7, leap: false }, moonAge: 6.1, zassetsuKeys: [], eventIds: EV('2027-03-14'), riseSet: { sunrise: '2027-03-14T05:53+09:00', sunset: '2027-03-14T17:50+09:00', moonrise: '2027-03-14T11:04+09:00', moonset: '2027-03-14T23:31+09:00' } },
    { date: '2027-03-15', rokuyoKey: 'rokuyo.sakimake', lunar: { month: 2, day: 8, leap: false }, moonAge: 7.1, zassetsuKeys: [], eventIds: EV('2027-03-15'), riseSet: { sunrise: '2027-03-15T05:52+09:00', sunset: '2027-03-15T17:51+09:00', moonrise: '2027-03-15T11:54+09:00' } },
    { date: '2027-03-16', rokuyoKey: 'rokuyo.butsumetsu', lunar: { month: 2, day: 9, leap: false }, moonAge: 8.1, moonPhaseKey: 'moon-phase.first-quarter', kouKey: 'kou.k09', zassetsuKeys: [], eventIds: EV('2027-03-16'), riseSet: { sunrise: '2027-03-16T05:51+09:00', sunset: '2027-03-16T17:52+09:00', moonrise: '2027-03-16T12:44+09:00', moonset: '2027-03-16T00:14+09:00' } },
    { date: '2027-03-17', rokuyoKey: 'rokuyo.taian', lunar: { month: 2, day: 10, leap: false }, moonAge: 9.1, zassetsuKeys: [], eventIds: EV('2027-03-17'), riseSet: { sunrise: '2027-03-17T05:49+09:00', sunset: '2027-03-17T17:52+09:00', moonrise: '2027-03-17T13:35+09:00', moonset: '2027-03-17T00:58+09:00' } },
    { date: '2027-03-18', rokuyoKey: 'rokuyo.shakko', lunar: { month: 2, day: 11, leap: false }, moonAge: 10.1, zassetsuKeys: ['zassetsu.higan-spring'], eventIds: EV('2027-03-18'), riseSet: { sunrise: '2027-03-18T05:48+09:00', sunset: '2027-03-18T17:53+09:00', moonrise: '2027-03-18T14:25+09:00', moonset: '2027-03-18T01:45+09:00' } },
    { date: '2027-03-19', rokuyoKey: 'rokuyo.sensho', lunar: { month: 2, day: 12, leap: false }, moonAge: 11.1, zassetsuKeys: [], eventIds: EV('2027-03-19'), riseSet: { sunrise: '2027-03-19T05:46+09:00', sunset: '2027-03-19T17:54+09:00', moonrise: '2027-03-19T15:16+09:00', moonset: '2027-03-19T02:36+09:00' } },
    { date: '2027-03-20', rokuyoKey: 'rokuyo.tomobiki', lunar: { month: 2, day: 13, leap: false }, moonAge: 12.1, zassetsuKeys: ['zassetsu.shanichi-spring'], eventIds: EV('2027-03-20'), riseSet: { sunrise: '2027-03-20T05:45+09:00', sunset: '2027-03-20T17:54+09:00', moonrise: '2027-03-20T16:06+09:00', moonset: '2027-03-20T03:30+09:00' } },
    { date: '2027-03-21', rokuyoKey: 'rokuyo.sakimake', lunar: { month: 2, day: 14, leap: false }, moonAge: 13.1, sekkiKey: 'sekki.shunbun', kouKey: 'kou.k10', zassetsuKeys: [], holiday: { key: 'holiday.shunbun-no-hi', provisional: true }, eventIds: EV('2027-03-21'), riseSet: { sunrise: '2027-03-21T05:44+09:00', sunset: '2027-03-21T17:55+09:00', moonrise: '2027-03-21T16:56+09:00', moonset: '2027-03-21T04:27+09:00' } },
    { date: '2027-03-22', rokuyoKey: 'rokuyo.butsumetsu', lunar: { month: 2, day: 15, leap: false }, moonAge: 14.1, moonPhaseKey: 'moon-phase.full-moon', zassetsuKeys: [], holiday: { key: 'holiday.furikae-kyujitsu', provisional: true }, eventIds: EV('2027-03-22'), riseSet: { sunrise: '2027-03-22T05:42+09:00', sunset: '2027-03-22T17:56+09:00', moonrise: '2027-03-22T17:47+09:00', moonset: '2027-03-22T05:25+09:00' } },
    { date: '2027-03-23', rokuyoKey: 'rokuyo.taian', lunar: { month: 2, day: 16, leap: false }, moonAge: 15.1, zassetsuKeys: [], eventIds: EV('2027-03-23'), riseSet: { sunrise: '2027-03-23T05:41+09:00', sunset: '2027-03-23T17:56+09:00', moonrise: '2027-03-23T18:37+09:00', moonset: '2027-03-23T06:22+09:00' } },
    { date: '2027-03-24', rokuyoKey: 'rokuyo.shakko', lunar: { month: 2, day: 17, leap: false }, moonAge: 16.1, zassetsuKeys: [], eventIds: EV('2027-03-24'), riseSet: { sunrise: '2027-03-24T05:40+09:00', sunset: '2027-03-24T17:57+09:00', moonrise: '2027-03-24T19:28+09:00', moonset: '2027-03-24T07:16+09:00' } },
    { date: '2027-03-25', rokuyoKey: 'rokuyo.sensho', lunar: { month: 2, day: 18, leap: false }, moonAge: 17.1, zassetsuKeys: [], eventIds: EV('2027-03-25'), riseSet: { sunrise: '2027-03-25T05:38+09:00', sunset: '2027-03-25T17:58+09:00', moonrise: '2027-03-25T20:18+09:00', moonset: '2027-03-25T08:07+09:00' } },
    { date: '2027-03-26', rokuyoKey: 'rokuyo.tomobiki', lunar: { month: 2, day: 19, leap: false }, moonAge: 18.1, kouKey: 'kou.k11', zassetsuKeys: [], eventIds: EV('2027-03-26'), riseSet: { sunrise: '2027-03-26T05:37+09:00', sunset: '2027-03-26T17:59+09:00', moonrise: '2027-03-26T21:08+09:00', moonset: '2027-03-26T08:55+09:00' } },
    { date: '2027-03-27', rokuyoKey: 'rokuyo.sakimake', lunar: { month: 2, day: 20, leap: false }, moonAge: 19.1, zassetsuKeys: [], eventIds: EV('2027-03-27'), riseSet: { sunrise: '2027-03-27T05:35+09:00', sunset: '2027-03-27T17:59+09:00', moonrise: '2027-03-27T21:59+09:00', moonset: '2027-03-27T09:40+09:00' } },
    { date: '2027-03-28', rokuyoKey: 'rokuyo.butsumetsu', lunar: { month: 2, day: 21, leap: false }, moonAge: 20.1, zassetsuKeys: [], eventIds: EV('2027-03-28'), riseSet: { sunrise: '2027-03-28T05:34+09:00', sunset: '2027-03-28T18:00+09:00', moonrise: '2027-03-28T22:49+09:00', moonset: '2027-03-28T10:23+09:00' } },
    { date: '2027-03-29', rokuyoKey: 'rokuyo.taian', lunar: { month: 2, day: 22, leap: false }, moonAge: 21.1, zassetsuKeys: [], eventIds: EV('2027-03-29'), riseSet: { sunrise: '2027-03-29T05:33+09:00', sunset: '2027-03-29T18:01+09:00', moonrise: '2027-03-29T23:40+09:00', moonset: '2027-03-29T11:06+09:00' } },
    { date: '2027-03-30', rokuyoKey: 'rokuyo.shakko', lunar: { month: 2, day: 23, leap: false }, moonAge: 22.1, moonPhaseKey: 'moon-phase.last-quarter', zassetsuKeys: [], eventIds: EV('2027-03-30'), riseSet: { sunrise: '2027-03-30T05:31+09:00', sunset: '2027-03-30T18:01+09:00', moonset: '2027-03-30T11:51+09:00' } },
    { date: '2027-03-31', rokuyoKey: 'rokuyo.sensho', lunar: { month: 2, day: 24, leap: false }, moonAge: 23.1, kouKey: 'kou.k12', zassetsuKeys: [], eventIds: EV('2027-03-31'), riseSet: { sunrise: '2027-03-31T05:30+09:00', sunset: '2027-03-31T18:02+09:00', moonrise: '2027-03-31T00:30+09:00', moonset: '2027-03-31T12:40+09:00' } },
  ];

  /** @type {StarChartSample} */
  const starChart = Object.freeze({
    observedAt: '2026-11-16T20:00:00+09:00',
    placeLabel: '',
    stars: Object.freeze([]),
    constellationLines: Object.freeze([]),
    constellationLabels: Object.freeze([]),
    bodies: Object.freeze([]),
  });

  /** @type {SampleDataSet} */
  const sample = deepFreeze({
    today: '2026-11-16',
    users: [],
    almanac,
    events,
    posts: [],
    reports: [],
    starChart,
  });

  window.MockSample = sample;
})();
