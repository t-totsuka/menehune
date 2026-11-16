// Fictional sample data (users, posts, comment trees, almanac values, astronomical events, star
// chart, weather). Classic script that registers into window.MockSample. This is the empty but
// fully typed skeleton from task 1.9; tasks 3.2-3.4 fill in the values.
(function () {
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
  const sample = Object.freeze({
    today: '2026-11-16',
    users: Object.freeze([]),
    almanac: Object.freeze([]),
    events: Object.freeze([]),
    posts: Object.freeze([]),
    reports: Object.freeze([]),
    starChart,
  });

  window.MockSample = sample;
})();
