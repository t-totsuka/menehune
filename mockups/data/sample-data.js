// Fictional sample data (users, posts, comment trees, almanac values, astronomical events, star
// chart, weather). Classic script that registers into window.MockSample.
// Task 3.2 filled in the almanac and astronomical events; task 3.3 the users, posts, comments,
// likes, reports, locations and weather; task 3.4 fills in the star chart; task 8.1 adds the
// reply notices.
//
// All almanac / astronomy values are illustrative approximations for the mockups and have NOT
// been verified (design.md: SampleData "値の正確さは保証しない"). They are kept internally
// consistent:
// - lunar date: day 1 is the new-moon day (JST); rokuyo = (lunar month + lunar day) % 6
//   -> 大安, 赤口, 先勝, 友引, 先負, 仏滅 for 0..5
// - moonAge: days since the new moon at 21:00 JST, one decimal place
// - moonPhaseKey only on the days of 朔・上弦・望・下弦; sekkiKey / kouKey only on the first day
//   (kouStarts lists the first day of every 候 covering a sample day, task 8.1)
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

  /**
   * First day of every 七十二候 that covers a sample day, ascending (task 8.1, day-detail: a 候 is
   * a period, so the day detail shows the current 候 with its day count). The 候 that start inside
   * the sample come from AlmanacDay.kouKey; two start before the first sample day of their run:
   * 桐始結花 (大暑の初候, 2025-07-22) for the leap-month example and 霎時施 (霜降の次候,
   * 2026-10-28) for 2026-11-01. Illustrative dates, like the rest of the almanac.
   * @type {KouStart[]}
   */
  const kouStarts = [
    { key: 'kou.k34', start: '2025-07-22' },
    { key: 'kou.k53', start: '2026-10-28' },
    ...almanac.flatMap((d) => (d.kouKey ? [{ key: d.kouKey, start: d.date }] : [])),
  ];

  // ---------------------------------------------------------------------------------------------
  // Users, posts, comments, likes, reports, locations and weather (task 3.3).
  // - Every user is a fictional handle; bodies avoid anything that identifies a real person or
  //   place. regionLabel is "都道府県 市区町村" at most (for exact / fuzzed-1km too; the map frame
  //   shows the precision), "都道府県" for prefecture and "日本" for country.
  // - status vs guestVisible: 'public' always has guestVisible true and 'members-only' always has
  //   guestVisible false (the badge for a post hidden from guests). 'hidden' and 'deleted' keep
  //   the visibility the author chose.
  // - location undefined -> no map, rise/set or weather (no-location). location present and
  //   weather undefined -> the weather could not be fetched (weather-failed). weather never
  //   exists without a location.
  // - mapFrame by precision: exact -> street + pin; fuzzed-1km -> district + 1 km radius, no pin;
  //   municipality -> city; prefecture -> prefecture; country -> country.
  // - location.riseSet is for the target date at the post's point (the almanac's sample point
  //   shifted by a minute or two).
  // - Deleted comments keep their place and replies in the tree but have an empty body.
  // - "me" is viewerIds.member when logged in as member and viewerIds.admin as admin
  //   (LikeState.likedByMe, hidden-own, my-posts).
  // - postDetailScenarios lists the post id that post-detail shows for each of its scenarios.
  // ---------------------------------------------------------------------------------------------

  /** @type {SampleUser[]} */
  const users = [
    { id: 'u-hoshizora', displayName: 'ほしぞら散歩', isAdmin: false },
    { id: 'u-tsukimi', displayName: 'つきみ団子', isAdmin: false },
    { id: 'u-koyomi', displayName: 'こよみ帖', isAdmin: false },
    { id: 'u-orion', displayName: 'orion_walker', isAdmin: false },
    { id: 'u-kumo', displayName: 'くもまにあ', isAdmin: false },
    { id: 'u-admin', displayName: '運営チーム', isAdmin: true },
  ];

  /** @type {Record<LocationPrecision, MapFrame>} */
  const MAP = {
    exact: { zoom: 'street', showPin: true },
    'fuzzed-1km': { zoom: 'district', showPin: false, showRadiusKm: 1 },
    municipality: { zoom: 'city', showPin: false },
    prefecture: { zoom: 'prefecture', showPin: false },
    country: { zoom: 'country', showPin: false },
  };

  /**
   * A post location; the map frame follows the precision.
   * @param {LocationPrecision} precision
   * @param {string} regionLabel
   * @param {RiseSet} riseSet
   * @returns {PostLocation}
   */
  const loc = (precision, regionLabel, riseSet) => ({ precision, regionLabel, mapFrame: { ...MAP[precision] }, riseSet });

  /**
   * A comment.
   * @param {string} id
   * @param {string} authorId
   * @param {IsoDateTime} at
   * @param {string} body
   * @param {CommentNode[]} [children]
   * @returns {CommentNode}
   */
  const cm = (id, authorId, at, body, children = []) => ({ id, authorId, body, at, deleted: false, children });

  /**
   * A deleted comment: it keeps its place and its replies, but not its body.
   * @param {string} id
   * @param {string} authorId
   * @param {IsoDateTime} at
   * @param {CommentNode[]} [children]
   * @returns {CommentNode}
   */
  const gone = (id, authorId, at, children = []) => ({ id, authorId, body: '', at, deleted: true, children });

  /** @type {SamplePost[]} */
  const posts = [
    {
      // default: public, municipality, weather, short comment tree, liked by me
      id: 'p-101', authorId: 'u-tsukimi', targetDate: '2026-11-17', postedAt: '2026-11-16T18:42+09:00',
      body: '明日は上弦の月。夕方、南の空の高いところに半月が見えるはずです。仕事帰りに少し空を見上げてみませんか。',
      status: 'public', guestVisible: true,
      location: loc('municipality', '東京都 武蔵野市', { sunrise: '2026-11-17T06:16+09:00', sunset: '2026-11-17T16:37+09:00', moonrise: '2026-11-17T12:51+09:00', moonset: '2026-11-17T00:20+09:00' }),
      weather: { conditionKey: 'weather.condition.clear', temperatureC: 11.8, humidityPct: 58, windMps: 2.1, observedAt: '2026-11-16T18:30+09:00' },
      likes: { count: 12, likedByMe: true },
      comments: [
        cm('c-101-1', 'u-hoshizora', '2026-11-16T19:05+09:00', '半月の欠け際のクレーター、双眼鏡でも見えますね。', [
          cm('c-101-2', 'u-tsukimi', '2026-11-16T19:20+09:00', 'ぜひ！月の出は昼過ぎなので、日の入り直後から見られます。'),
        ]),
        cm('c-101-3', 'u-kumo', '2026-11-16T20:02+09:00', '明日の夕方は雲が少なそうです。'),
      ],
    },
    {
      // exact precision; the public post for today
      id: 'p-102', authorId: 'u-hoshizora', targetDate: '2026-11-16', postedAt: '2026-11-16T07:05+09:00',
      body: '今朝は冷えて空気が澄んでいました。今夜は月が沈んだあと、秋の星座がよく見えそうです。',
      status: 'public', guestVisible: true,
      location: loc('exact', '東京都 三鷹市', { sunrise: '2026-11-16T06:15+09:00', sunset: '2026-11-16T16:38+09:00', moonrise: '2026-11-16T12:00+09:00' }),
      weather: { conditionKey: 'weather.condition.partly-cloudy', temperatureC: 8.4, humidityPct: 72, windMps: 1.2, observedAt: '2026-11-16T07:00+09:00' },
      likes: { count: 3, likedByMe: false },
      comments: [
        cm('c-102-1', 'u-orion', '2026-11-16T08:12+09:00', 'こちらも朝から快晴です。'),
      ],
    },
    {
      // fuzzed-1km precision; the English post (long text for wrapping)
      id: 'p-103', authorId: 'u-orion', targetDate: '2026-11-20', postedAt: '2026-11-15T21:10+09:00',
      body: 'On the evening of November 20 the Moon passes close to Saturn in the southern sky. Both should be easy to spot with the naked eye shortly after sunset, and a small telescope will show the rings as well. I am planning to watch from a riverside park if the sky stays clear, and I would love to hear what you see from your area.',
      status: 'public', guestVisible: true,
      location: loc('fuzzed-1km', '神奈川県 川崎市', { sunrise: '2026-11-20T06:18+09:00', sunset: '2026-11-20T16:35+09:00', moonrise: '2026-11-20T15:22+09:00', moonset: '2026-11-20T02:42+09:00' }),
      weather: { conditionKey: 'weather.condition.cloudy', temperatureC: 12.3, humidityPct: 66, windMps: 3.4, observedAt: '2026-11-15T21:00+09:00' },
      likes: { count: 7, likedByMe: false },
      comments: [
        cm('c-103-1', 'u-tsukimi', '2026-11-16T07:40+09:00', '土星の環、見えるといいですね。'),
      ],
    },
    {
      // private-blocked: members only, prefecture precision; one of my posts
      id: 'p-104', authorId: 'u-hoshizora', targetDate: '2026-11-24', postedAt: '2026-11-14T22:15+09:00',
      body: '24日は満月。近所の公園で、月の出から少しずつ高くなる月を眺める予定です。',
      status: 'members-only', guestVisible: false,
      location: loc('prefecture', '埼玉県', { sunrise: '2026-11-24T06:23+09:00', sunset: '2026-11-24T16:32+09:00', moonrise: '2026-11-24T18:44+09:00', moonset: '2026-11-24T06:28+09:00' }),
      weather: { conditionKey: 'weather.condition.clear', temperatureC: 6.9, humidityPct: 64, windMps: 1.8, observedAt: '2026-11-14T22:00+09:00' },
      likes: { count: 5, likedByMe: false },
      comments: [
        cm('c-104-1', 'u-kumo', '2026-11-15T06:50+09:00', '満月の日は、東の空が開けた場所がいいですね。'),
      ],
    },
    {
      // country precision
      id: 'p-105', authorId: 'u-kumo', targetDate: '2026-11-26', postedAt: '2026-11-16T12:30+09:00',
      body: '26日は天王星が衝。肉眼で見えるかどうかの明るさなので、双眼鏡を用意しておきます。',
      status: 'public', guestVisible: true,
      location: loc('country', '日本', { sunrise: '2026-11-26T06:24+09:00', sunset: '2026-11-26T16:30+09:00', moonrise: '2026-11-26T20:23+09:00', moonset: '2026-11-26T08:13+09:00' }),
      weather: { conditionKey: 'weather.condition.partly-cloudy', temperatureC: 15.2, humidityPct: 55, windMps: 4.0, observedAt: '2026-11-16T12:00+09:00' },
      likes: { count: 0, likedByMe: false },
      comments: [],
    },
    {
      // no-location: no map, rise/set or weather
      id: 'p-106', authorId: 'u-koyomi', targetDate: '2026-11-22', postedAt: '2026-11-16T09:20+09:00',
      body: '22日は二十四節気の小雪。暦の上では、そろそろ冬の気配が感じられるころです。',
      status: 'public', guestVisible: true,
      likes: { count: 9, likedByMe: true },
      comments: [
        cm('c-106-1', 'u-hoshizora', '2026-11-16T10:02+09:00', '朝晩の冷え込みが増してきましたね。', [
          // task 8.1: a reply to my comment (a reply notice, 6.10)
          cm('c-106-2', 'u-koyomi', '2026-11-16T10:40+09:00', '本当に。小雪のころから、夜空もいっそう澄んで見えますね。'),
        ]),
      ],
    },
    {
      // weather-failed: location present, weather could not be fetched
      id: 'p-107', authorId: 'u-tsukimi', targetDate: '2026-11-18', postedAt: '2026-11-16T20:05+09:00',
      body: '18日の夕方、月と夕焼けを一緒に撮りたいと思っています。おすすめの時間帯はありますか。',
      status: 'public', guestVisible: true,
      location: loc('municipality', '千葉県 船橋市', { sunrise: '2026-11-18T06:14+09:00', sunset: '2026-11-18T16:33+09:00', moonrise: '2026-11-18T13:38+09:00', moonset: '2026-11-18T01:01+09:00' }),
      likes: { count: 2, likedByMe: false },
      comments: [],
    },
    {
      // hidden-own: my post, temporarily hidden after reports; I have appealed
      id: 'p-108', authorId: 'u-hoshizora', targetDate: '2026-11-19', postedAt: '2026-11-13T23:40+09:00',
      body: '19日の夜に観望会を開きます。参加したい方はコメントで声をかけてください。',
      status: 'hidden', guestVisible: true,
      location: loc('municipality', '東京都 小金井市', { sunrise: '2026-11-19T06:18+09:00', sunset: '2026-11-19T16:36+09:00', moonrise: '2026-11-19T14:32+09:00', moonset: '2026-11-19T01:52+09:00' }),
      weather: { conditionKey: 'weather.condition.clear', temperatureC: 7.5, humidityPct: 70, windMps: 0.9, observedAt: '2026-11-13T23:30+09:00' },
      likes: { count: 1, likedByMe: false },
      comments: [],
    },
    {
      // hidden-other: another user's post, automatically hidden after many reports
      id: 'p-109', authorId: 'u-orion', targetDate: '2026-11-21', postedAt: '2026-11-15T08:00+09:00',
      body: '望遠鏡のセールのお知らせです。詳しくはプロフィールをご覧ください。',
      status: 'hidden', guestVisible: true,
      likes: { count: 0, likedByMe: false },
      comments: [],
    },
    {
      // hidden by an administrator
      id: 'p-110', authorId: 'u-kumo', targetDate: '2026-11-25', postedAt: '2026-11-12T19:00+09:00',
      body: '25日の近地点の月について、知人から聞いた話をまとめました。',
      status: 'hidden', guestVisible: false,
      likes: { count: 0, likedByMe: false },
      comments: [],
    },
    {
      // deleted by its author (one of my posts; listed in my-posts)
      id: 'p-111', authorId: 'u-hoshizora', targetDate: '2026-11-28', postedAt: '2026-11-10T21:30+09:00',
      body: '28日の予定を書いていましたが、都合が悪くなったので取り下げます。',
      status: 'deleted', guestVisible: true,
      likes: { count: 0, likedByMe: false },
      comments: [],
    },
    {
      // deleted-comment: a comment tree of depth 7 with deleted comments that keep their replies
      id: 'p-120', authorId: 'u-koyomi', targetDate: '2026-11-24', postedAt: '2026-11-15T19:30+09:00',
      body: '24日の満月は、近地点に近い大きめの満月です。皆さんはどこで見る予定ですか。',
      status: 'public', guestVisible: true,
      location: loc('municipality', '東京都 府中市', { sunrise: '2026-11-24T06:23+09:00', sunset: '2026-11-24T16:33+09:00', moonrise: '2026-11-24T18:44+09:00', moonset: '2026-11-24T06:28+09:00' }),
      weather: { conditionKey: 'weather.condition.partly-cloudy', temperatureC: 10.6, humidityPct: 61, windMps: 2.6, observedAt: '2026-11-15T19:00+09:00' },
      likes: { count: 24, likedByMe: false },
      comments: [
        cm('c-120-01', 'u-tsukimi', '2026-11-15T19:48+09:00', '河川敷の土手で見るつもりです。東の空が低いところまで開けています。', [
          cm('c-120-02', 'u-hoshizora', '2026-11-15T20:10+09:00', 'いいですね。月の出の直後は大きく見えますよね。', [
            gone('c-120-03', 'u-orion', '2026-11-15T20:31+09:00', [
              cm('c-120-04', 'u-kumo', '2026-11-15T21:02+09:00', '話がそれてきたので、満月の話に戻しましょう。', [
                cm('c-120-05', 'u-tsukimi', '2026-11-15T21:15+09:00', '当日は晴れるといいですね。', [
                  cm('c-120-06', 'u-hoshizora', '2026-11-15T21:40+09:00', '雲が出たら、切れ間を待ちます。', [
                    cm('c-120-07', 'u-koyomi', '2026-11-15T22:05+09:00', '月の出は 18 時 44 分ごろです。日の入りから 2 時間ほどあとなので、空が暗くなってから昇ってきます。'),
                  ]),
                ]),
              ]),
            ]),
          ]),
        ]),
        gone('c-120-08', 'u-kumo', '2026-11-16T06:30+09:00', [
          cm('c-120-09', 'u-orion', '2026-11-16T07:15+09:00', 'Thanks, I will try the riverside too.'),
        ]),
        cm('c-120-10', 'u-hoshizora', '2026-11-16T08:00+09:00', '写真を撮ったら、また投稿します。'),
      ],
    },
  ];

  /**
   * Report queue: one item per state (open has a post and a comment). Each report names one
   * reason, so reasonCounts adds up to reportCount; reasons are listed most frequent first
   * (task 8.1: the admin screen shows the per-reason counts).
   * @type {ReportQueueItem[]}
   */
  const reports = [
    { targetId: 'p-101', targetType: 'post', reportCount: 2, reasons: ['inappropriate', 'other'], reasonCounts: { inappropriate: 1, other: 1 }, state: 'open' },
    { targetId: 'c-120-04', targetType: 'comment', reportCount: 1, reasons: ['harassment'], reasonCounts: { harassment: 1 }, state: 'open' },
    { targetId: 'p-109', targetType: 'post', reportCount: 5, reasons: ['spam', 'inappropriate'], reasonCounts: { spam: 3, inappropriate: 2 }, state: 'auto-hidden' },
    { targetId: 'p-110', targetType: 'post', reportCount: 1, reasons: ['personal-info'], reasonCounts: { 'personal-info': 1 }, state: 'hidden-by-admin' },
    { targetId: 'p-108', targetType: 'post', reportCount: 3, reasons: ['spam', 'other'], reasonCounts: { spam: 2, other: 1 }, state: 'appealed' },
    { targetId: 'p-103', targetType: 'post', reportCount: 2, reasons: ['spam'], reasonCounts: { spam: 2 }, state: 'restored' },
    { targetId: 'c-120-03', targetType: 'comment', reportCount: 4, reasons: ['harassment', 'personal-info'], reasonCounts: { harassment: 3, 'personal-info': 1 }, state: 'removed' },
  ];

  /**
   * Reply notices (task 8.1, 6.9 and 6.10), newest reply first. Each one follows the comment
   * trees: someone else's live, direct reply (replyId) to a comment of the recipient (commentId);
   * the replier and the datetime come from the reply. Every such reply to a comment of the member
   * viewer has one notice; the deleted reply c-120-03 to my c-120-02 has none (its author and body
   * are gone). Two are unread (the header count), one is read. The admin viewer has none (the
   * header without a count and the empty list). Every post here has a post-detail scenario, so
   * the notice's link opens the right post.
   * @type {ReplyNotice[]}
   */
  const notices = [
    { id: 'n-101-2', recipientId: 'u-hoshizora', postId: 'p-101', commentId: 'c-101-1', replyId: 'c-101-2', read: false },
    { id: 'n-106-2', recipientId: 'u-hoshizora', postId: 'p-106', commentId: 'c-106-1', replyId: 'c-106-2', read: false },
    { id: 'n-120-07', recipientId: 'u-hoshizora', postId: 'p-120', commentId: 'c-120-06', replyId: 'c-120-07', read: true },
  ];

  /** @type {Record<Exclude<AuthState, 'guest'>, string>} */
  const viewerIds = { member: 'u-hoshizora', admin: 'u-admin' };

  /**
   * Post shown by post-detail for each scenario.
   * - default: p-101 (public; municipality; weather; short tree; liked by me)
   * - private-blocked: p-104 (members-only, guestVisible false; open it as guest)
   * - hidden-own: p-108 (my post, hidden, report appealed; open it as member)
   * - hidden-other: p-109 (another user's post, auto-hidden; open it as guest or member)
   * - deleted-comment: p-120 (tree of depth 7 with deleted comments that keep their replies)
   * - no-location: p-106 (no location, so no map, rise/set or weather)
   * - weather-failed: p-107 (location present, weather undefined = fetch failed)
   * @type {Record<PostDetailScenarioId, string>}
   */
  const postDetailScenarios = {
    default: 'p-101',
    'private-blocked': 'p-104',
    'hidden-own': 'p-108',
    'hidden-other': 'p-109',
    'deleted-comment': 'p-120',
    'no-location': 'p-106',
    'weather-failed': 'p-107',
  };

  /**
   * Star chart: the sky at a fictional point in 東京都 三鷹市 (about 35.7°N, 139.6°E) on
   * 2026-11-16 at 20:00 JST (local sidereal time about 0h).
   * - az: degrees from north, clockwise (east = 90); alt: degrees above the horizon
   * - stars: bright stars of the autumn / winter sky, converted from J2000 RA/Dec (with a simple
   *   precession correction) to alt/az, rounded to 0.1°. Only stars above the horizon are listed.
   *   Stars without nameKey are drawn without a label (the comment names them for review).
   *   The Pleiades are one point with the cluster's integrated magnitude.
   * - constellationLines: pairs of indexes into stars; constellationLabels sit beside their stars
   * - bodies: the moon (age 7.2, a day before first quarter) is low in the south-west; Saturn is
   *   high in the south; Jupiter and Mars have not risen yet. The sun is kept with its real,
   *   negative altitude so that the chart component can show it is below the horizon (it must
   *   not draw objects with alt < 0 inside the sky circle).
   * Values are illustrative approximations, not verified ephemerides.
   * @type {StarChartSample}
   */
  const starChart = {
    observedAt: '2026-11-16T20:00:00+09:00',
    placeLabel: '東京都 三鷹市',
    stars: [
      { az: 0.5, alt: 36.1, mag: 1.98, nameKey: 'astro.star.polaris' }, // 0 Polaris (α UMi)
      { az: 355.9, alt: 35.1, mag: 4.35 }, // 1 δ UMi
      { az: 351.0, alt: 32.7, mag: 4.20 }, // 2 ε UMi
      { az: 348.5, alt: 28.2, mag: 4.30 }, // 3 ζ UMi
      { az: 348.3, alt: 23.4, mag: 2.08 }, // 4 Kochab (β UMi)
      { az: 344.9, alt: 23.0, mag: 3.05 }, // 5 Pherkad (γ UMi)
      { az: 345.3, alt: 28.5, mag: 4.95 }, // 6 η UMi
      { az: 3.2, alt: 66.3, mag: 2.27 }, // 7 Caph (β Cas)
      { az: 15.2, alt: 67.9, mag: 2.24 }, // 8 Schedar (α Cas)
      { az: 15.6, alt: 63.2, mag: 2.15 }, // 9 γ Cas
      { az: 22.7, alt: 61.7, mag: 2.68 }, // 10 Ruchbah (δ Cas)
      { az: 23.0, alt: 56.9, mag: 3.37 }, // 11 Segin (ε Cas)
      { az: 214.3, alt: 66.3, mag: 2.49 }, // 12 Markab (α Peg)
      { az: 241.4, alt: 76.1, mag: 2.42 }, // 13 Scheat (β Peg)
      { az: 170.3, alt: 69.4, mag: 2.83 }, // 14 Algenib (γ Peg)
      { az: 162.6, alt: 83.2, mag: 2.06, nameKey: 'astro.star.alpheratz' }, // 15 Alpheratz (α And)
      { az: 238.4, alt: 50.0, mag: 2.39 }, // 16 Enif (ε Peg)
      { az: 220.2, alt: 59.6, mag: 3.40 }, // 17 Homam (ζ Peg)
      { az: 116.3, alt: 80.4, mag: 3.27 }, // 18 δ And
      { az: 84.6, alt: 75.7, mag: 2.05 }, // 19 Mirach (β And)
      { az: 64.8, alt: 65.0, mag: 2.10 }, // 20 Almach (γ And)
      { az: 300.3, alt: 51.8, mag: 1.25, nameKey: 'astro.star.deneb' }, // 21 Deneb (α Cyg)
      { az: 293.3, alt: 47.6, mag: 2.23 }, // 22 Sadr (γ Cyg)
      { az: 282.6, alt: 33.5, mag: 3.05 }, // 23 Albireo (β Cyg)
      { az: 282.2, alt: 50.7, mag: 2.48 }, // 24 Gienah (ε Cyg)
      { az: 301.9, alt: 41.9, mag: 2.87 }, // 25 δ Cyg
      { az: 299.5, alt: 27.9, mag: 0.03, nameKey: 'astro.star.vega' }, // 26 Vega (α Lyr)
      { az: 297.6, alt: 28.8, mag: 4.30 }, // 27 ζ Lyr
      { az: 295.9, alt: 30.3, mag: 4.30 }, // 28 δ Lyr
      { az: 291.1, alt: 29.4, mag: 3.25 }, // 29 Sulafat (γ Lyr)
      { az: 292.7, alt: 28.0, mag: 3.50 }, // 30 Sheliak (β Lyr)
      { az: 260.7, alt: 27.8, mag: 0.77, nameKey: 'astro.star.altair' }, // 31 Altair (α Aql)
      { az: 263.0, alt: 27.9, mag: 2.72 }, // 32 Tarazed (γ Aql)
      { az: 257.7, alt: 27.2, mag: 3.71 }, // 33 Alshain (β Aql)
      { az: 52.4, alt: 50.6, mag: 1.79, nameKey: 'astro.star.mirfak' }, // 34 Mirfak (α Per)
      { az: 67.0, alt: 52.9, mag: 2.10, nameKey: 'astro.star.algol' }, // 35 Algol (β Per)
      { az: 46.0, alt: 53.2, mag: 2.90 }, // 36 γ Per
      { az: 55.4, alt: 47.5, mag: 3.00 }, // 37 δ Per
      { az: 65.7, alt: 43.5, mag: 2.90 }, // 38 ε Per
      { az: 76.6, alt: 41.7, mag: 2.85 }, // 39 ζ Per
      { az: 87.9, alt: 26.3, mag: 0.85, nameKey: 'astro.star.aldebaran' }, // 40 Aldebaran (α Tau)
      { az: 86.7, alt: 39.9, mag: 1.60, nameKey: 'astro.star.pleiades' }, // 41 Pleiades (M45)
      { az: 70.0, alt: 22.4, mag: 1.65 }, // 42 Elnath (β Tau)
      { az: 75.4, alt: 16.3, mag: 3.00 }, // 43 ζ Tau
      { az: 86.3, alt: 29.1, mag: 3.50 }, // 44 Ain (ε Tau)
      { az: 91.0, alt: 29.1, mag: 3.65 }, // 45 γ Tau
      { az: 53.2, alt: 31.5, mag: 0.08, nameKey: 'astro.star.capella' }, // 46 Capella (α Aur)
      { az: 50.9, alt: 24.2, mag: 1.90 }, // 47 Menkalinan (β Aur)
      { az: 58.2, alt: 20.5, mag: 2.65 }, // 48 θ Aur
      { az: 68.7, alt: 30.0, mag: 2.70 }, // 49 Hassaleh (ι Aur)
      { az: 194.5, alt: 23.2, mag: 1.16, nameKey: 'astro.star.fomalhaut' }, // 50 Fomalhaut (α PsA)
      { az: 167.0, alt: 35.4, mag: 2.04, nameKey: 'astro.star.diphda' }, // 51 Diphda (β Cet)
      { az: 104.8, alt: 59.8, mag: 2.00, nameKey: 'astro.star.hamal' }, // 52 Hamal (α Ari)
      { az: 112.5, alt: 60.8, mag: 2.64 }, // 53 Sheratan (β Ari)
      { az: 84.5, alt: 5.1, mag: 0.50, nameKey: 'astro.star.betelgeuse' }, // 54 Betelgeuse (α Ori)
      { az: 103.2, alt: 4.2, mag: 0.13, nameKey: 'astro.star.rigel' }, // 55 Rigel (β Ori)
      { az: 89.7, alt: 10.6, mag: 1.64, nameKey: 'astro.star.bellatrix' }, // 56 Bellatrix (γ Ori)
    ],
    constellationLines: [
      // Ursa Minor (Little Dipper)
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3],
      // Cassiopeia (W)
      [7, 8], [8, 9], [9, 10], [10, 11],
      // Pegasus (Great Square with Alpheratz, and the neck to Enif)
      [12, 13], [13, 15], [15, 14], [14, 12], [12, 17], [17, 16],
      // Andromeda
      [15, 18], [18, 19], [19, 20],
      // Cygnus (Northern Cross)
      [21, 22], [22, 23], [25, 22], [22, 24],
      // Lyra
      [26, 27], [27, 30], [30, 29], [29, 28], [28, 27],
      // Aquila
      [32, 31], [31, 33],
      // Perseus
      [36, 34], [34, 37], [37, 38], [38, 39], [34, 35],
      // Taurus (Hyades V and the horns)
      [45, 44], [44, 42], [45, 40], [40, 43],
      // Auriga (pentagon shared with Elnath)
      [46, 47], [47, 48], [48, 42], [42, 49], [49, 46],
      // Aries
      [52, 53],
      // Orion (rising: shoulders only)
      [54, 56],
    ],
    constellationLabels: [
      { az: 346.0, alt: 31.0, nameKey: 'astro.constellation.ursa-minor' },
      { az: 14.0, alt: 61.0, nameKey: 'astro.constellation.cassiopeia' },
      { az: 222.0, alt: 64.0, nameKey: 'astro.constellation.pegasus' },
      { az: 95.0, alt: 73.0, nameKey: 'astro.constellation.andromeda' },
      { az: 288.0, alt: 44.0, nameKey: 'astro.constellation.cygnus' },
      { az: 293.0, alt: 25.0, nameKey: 'astro.constellation.lyra' },
      { az: 262.0, alt: 24.0, nameKey: 'astro.constellation.aquila' },
      { az: 60.0, alt: 46.0, nameKey: 'astro.constellation.perseus' },
      { az: 82.0, alt: 22.0, nameKey: 'astro.constellation.taurus' },
      { az: 60.0, alt: 26.0, nameKey: 'astro.constellation.auriga' },
      { az: 110.0, alt: 57.0, nameKey: 'astro.constellation.aries' },
      { az: 194.0, alt: 19.0, nameKey: 'astro.constellation.piscis-austrinus' },
      { az: 96.0, alt: 2.0, nameKey: 'astro.constellation.orion' },
    ],
    bodies: [
      { kind: 'moon', nameKey: 'astro.body.moon', az: 226.3, alt: 21.8 },
      { kind: 'planet', nameKey: 'astro.body.saturn', az: 161.7, alt: 55.0 },
      { kind: 'sun', nameKey: 'astro.body.sun', az: 276.3, alt: -41.7 },
    ],
  };

  /** @type {SampleDataSet} */
  const sample = deepFreeze({
    today: '2026-11-16',
    users,
    viewerIds,
    postDetailScenarios,
    almanac,
    kouStarts,
    events,
    posts,
    reports,
    notices,
    starChart,
  });

  window.MockSample = sample;
})();
