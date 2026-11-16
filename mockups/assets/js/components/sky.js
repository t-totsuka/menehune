// Sky component: mk-star-chart (design: Parts > プレゼンテーション部品; StarChartAttrs and
// StarChartSample in types.d.ts). Task 4.4 (5.1, 5.2, 5.4, 5.5, 13.4).
//
// - `sample`: omitted (or empty) means SampleDataSet.starChart; any other value is an unknown sample id and
//   renders this.missingSample(id). The date/time and place inputs live on the screen, not here.
// - Projection: zenith-centred stereographic projection of the horizontal coordinates
//   (az from north, clockwise, degrees; alt in degrees):
//       r = R * tan((90° - alt) / 2)        (zenith r = 0, horizon r = R)
//       x = cx - r * sin(az),  y = cy - r * cos(az)
//   The chart is the sky seen from below (planisphere orientation): north up, EAST ON THE LEFT,
//   south down, west on the right. Objects with alt < 0 (e.g. the sun at -41.7°) are not drawn,
//   nor are lines touching such a star.
// - Drawn: the sky disc and horizon circle, cardinal labels (sky.direction.*), stars with a radius
//   from their magnitude (brighter = larger), labels only for stars with nameKey, constellation
//   lines and names, the moon (circle) and planets / the sun (diamond) with their names.
// - Label layout (deterministic, estimated boxes; see LabelLayout): bright star points, body
//   marks and cardinal labels are obstacles; then body names, star names in brightness order and
//   constellation names are placed at the first candidate position that collides with nothing
//   already placed. A label that fits nowhere is omitted (the alt text still lists it).
//   Constellation names are drawn under the star names as faint secondary information.
// - Colors come from CSS classes in components.css that reference tokens (follow the theme and
//   the wireframe grays). Geometry is in viewBox user units, so the chart scales with its width.
// - The non-focusable wrapper carries data-figure (wireframe placeholder); the <svg> has
//   role="img" and aria-label = describe(state) (date/time, place, visible bodies with directions,
//   main stars, constellations).
//
// Preconditions: base.js (window.MockElement) and i18n.js are loaded first.
(function () {
  if (typeof window.MockElement !== 'function') {
    console.error('[sky.js] window.MockElement is missing; load components/base.js first');
    return;
  }
  const MockElement = window.MockElement;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  /** viewBox size (user units); the horizon circle has radius RADIUS around the centre. */
  const VIEW = 440;
  const CENTER = VIEW / 2;
  const RADIUS = 190;
  /** Cardinal labels sit just outside the horizon. */
  const CARDINAL_OFFSET = 16;
  /** Half size of the moon / planet marks (user units). */
  const BODY_MARK = 7;
  /** Number of named stars listed in the alt text (brightest first). */
  const DESCRIBED_STARS = 6;

  const DEG = Math.PI / 180;

  /** @typedef {'n' | 'e' | 's' | 'w'} Cardinal */
  /** @type {readonly { dir: Cardinal, az: number, key: MessageKey }[]} */
  const CARDINALS = [
    { dir: 'n', az: 0, key: 'sky.direction.n' },
    { dir: 'e', az: 90, key: 'sky.direction.e' },
    { dir: 's', az: 180, key: 'sky.direction.s' },
    { dir: 'w', az: 270, key: 'sky.direction.w' },
  ];

  /** Eight-point compass names for the alt text (north first, clockwise). */
  /** @type {readonly MessageKey[]} */
  const COMPASS_KEYS = [
    'sky.compass.n', 'sky.compass.ne', 'sky.compass.e', 'sky.compass.se',
    'sky.compass.s', 'sky.compass.sw', 'sky.compass.w', 'sky.compass.nw',
  ];

  /**
   * Stereographic projection (see the header comment).
   * @param {number} az degrees from north, clockwise
   * @param {number} alt degrees above the horizon
   * @returns {{ x: number, y: number }}
   */
  const project = (az, alt) => {
    const r = RADIUS * Math.tan(((90 - alt) / 2) * DEG);
    return { x: CENTER - r * Math.sin(az * DEG), y: CENTER - r * Math.cos(az * DEG) };
  };

  /** Star radius in user units: brighter (smaller magnitude) is larger. @param {number} mag */
  const starRadius = (mag) => Math.min(4.6, Math.max(1.2, 4.2 - 0.65 * mag));

  /** @param {number} n */
  const fmt = (n) => String(Math.round(n * 100) / 100);

  /** @param {number} az @returns {MessageKey} */
  const compassKey = (az) => COMPASS_KEYS[Math.round((((az % 360) + 360) % 360) / 45) % 8];

  /**
   * @template {keyof SVGElementTagNameMap} K
   * @param {K} tag
   * @param {Readonly<Record<string, string>>} attrs
   * @param {readonly (Node | string)[]} children
   * @returns {SVGElementTagNameMap[K]}
   */
  const svg = (tag, attrs, ...children) => {
    const node = /** @type {SVGElementTagNameMap[K]} */ (document.createElementNS(SVG_NS, tag));
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    node.append(...children);
    return node;
  };

  /** @param {StarChartBody} body */
  const bodyId = (body) => body.nameKey.replace(/^astro\.body\./, '');

  // ---- Label layout (deterministic, no DOM measurement) ----
  // Label font sizes are viewBox user units (set as attributes, so the estimate below and the
  // rendering always agree; the whole chart scales with its width).
  const FONT = { star: 12, constellation: 11, body: 14, cardinal: 16 };
  /** Estimated line box of a label relative to its font size (ascent above / descent below the baseline). */
  const ASCENT = 1.1;
  const DESCENT = 0.4;
  /** Minimum clearance between two label boxes or a label and a point (user units). */
  const CLEARANCE = 1.5;
  /** Stars at least this bright are obstacles for labels. */
  const OBSTACLE_MAG = 3.2;

  /** @typedef {{ x0: number, y0: number, x1: number, y1: number }} Box */

  /**
   * Estimated advance width of a label: full-width (CJK, kana, full-width forms) = 1 em,
   * Latin capitals ~0.7 em, other narrow characters ~0.6 em, spaces ~0.32 em.
   * @param {string} text @param {number} size @param {boolean} [bold]
   */
  const textWidth = (text, size, bold = false) => {
    let em = 0;
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 0;
      if (code >= 0x2e80) em += 1;
      else if (ch === ' ') em += 0.32;
      else if (ch >= 'A' && ch <= 'Z') em += 0.7;
      else em += 0.6;
    }
    return em * size * (bold ? 1.08 : 1);
  };

  /** @param {Box} a @param {Box} b */
  const intersects = (a, b) =>
    a.x0 < b.x1 + CLEARANCE && b.x0 < a.x1 + CLEARANCE && a.y0 < b.y1 + CLEARANCE && b.y0 < a.y1 + CLEARANCE;

  /** @param {number} x @param {number} y @param {number} r @returns {Box} */
  const pointBox = (x, y, r) => ({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });

  /** Boxes taken by points and placed labels; a candidate fits when it hits none and stays in the viewBox. */
  class LabelLayout {
    constructor() {
      /** @type {{ box: Box, owner: string }[]} */
      this.taken = [];
    }

    /** @param {Box} box @param {string} owner */
    reserve(box, owner) {
      this.taken.push({ box, owner });
    }

    /**
     * Returns the first candidate box that fits (and reserves it), or null. A candidate that sticks
     * out of the viewBox sideways is shifted back inside; one that sticks out vertically is skipped.
     * Every reserved box counts, including the label's own point (candidates never cover it).
     * @param {readonly Box[]} candidates
     * @param {string} owner
     * @returns {Box | null}
     */
    place(candidates, owner) {
      for (const candidate of candidates) {
        const dx = candidate.x0 < 0 ? -candidate.x0 : Math.min(0, VIEW - candidate.x1);
        const box = { x0: candidate.x0 + dx, y0: candidate.y0, x1: candidate.x1 + dx, y1: candidate.y1 };
        if (box.y0 < 0 || box.y1 > VIEW || box.x0 < 0 || box.x1 > VIEW) continue;
        if (this.taken.some((t) => intersects(box, t.box))) continue;
        this.reserve(box, owner);
        return box;
      }
      return null;
    }
  }

  /**
   * Candidate boxes around a point of radius r for a label of width w and font size `size`, in
   * preference order: right-below, left-below, right-above, left-above, right, left, below, above,
   * then the four diagonal corners clear of the point, first close to the point and then in two farther rings. None of them covers the point itself.
   * @param {number} x @param {number} y @param {number} r @param {number} w @param {number} size
   * @returns {Box[]}
   */
  const pointCandidates = (x, y, r, w, size) => {
    const h = (ASCENT + DESCENT) * size;
    /** @type {[number, number][]} top-left corners; a near ring, then farther ones */
    const corners = [];
    for (const gap of [CLEARANCE + 1, CLEARANCE + 7, CLEARANCE + 17]) {
      corners.push(
        [x + r + gap, y + r * 0.3],
        [x - r - gap - w, y + r * 0.3],
        [x + r + gap, y - r * 0.3 - h],
        [x - r - gap - w, y - r * 0.3 - h],
        [x + r + gap, y - h / 2],
        [x - r - gap - w, y - h / 2],
        [x - w / 2, y + r + gap],
        [x - w / 2, y - r - gap - h],
        [x + r, y + r + gap],
        [x - r - w, y + r + gap],
        [x + r, y - r - gap - h],
        [x - r - w, y - r - gap - h],
      );
    }
    return corners.map(([bx, by]) => ({ x0: bx, y0: by, x1: bx + w, y1: by + h }));
  };

  /**
   * Candidate boxes for a constellation name centred on (x, y), then shifted on a grid (up to
   * 3 lines up / down and one label width sideways), nearest first.
   * @param {number} x @param {number} y @param {number} w @param {number} size @returns {Box[]}
   */
  const areaCandidates = (x, y, w, size) => {
    const h = (ASCENT + DESCENT) * size;
    /** @type {[number, number][]} centre offsets on a grid, nearest first (stable sort keeps ties in grid order) */
    const shifts = [];
    for (const dy of [0, -1, 1, -2, 2, -3, 3]) {
      for (const dx of [0, -0.5, 0.5, -1, 1]) shifts.push([dx * w, dy * h]);
    }
    shifts.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
    return shifts.map(([dx, dy]) => ({
      x0: x + dx - w / 2, y0: y + dy - h / 2, x1: x + dx + w / 2, y1: y + dy + h / 2,
    }));
  };

  /** Baseline position of a label whose box is `box` (text-anchor start). @param {Box} box @param {number} size */
  const baselineOf = (box, size) => ({ x: fmt(box.x0), y: fmt(box.y0 + ASCENT * size) });

  /** @implements {DescribableElement} */
  class StarChart extends MockElement {
    static observedAttributes = ['sample'];

    /** @returns {StarChartSample | null} */
    chart() {
      const id = this.getAttribute('sample');
      return id === null || id === '' ? this.sample().starChart : null;
    }

    /**
     * Alt text: date/time and place, orientation, visible bodies with directions, the brightest
     * named stars with directions, and the visible constellations.
     * @param {MockStateSnapshot} state
     * @returns {string}
     */
    describe(state) {
      const chart = this.chart();
      if (!chart) return '';
      const sep = state.lang === 'ja' ? '、' : ', ';
      const sentenceSep = state.lang === 'ja' ? '' : ' ';
      const sentences = [this.t('sky.describe.intro', {
        datetime: window.MockI18n.formatDate(chart.observedAt, 'datetime'),
        place: chart.placeLabel,
      })];
      const bodies = chart.bodies.filter((b) => b.alt >= 0)
        .map((b) => this.t('sky.describe.body', { name: this.t(b.nameKey), direction: this.t(compassKey(b.az)) }));
      if (bodies.length > 0) sentences.push(this.t('sky.describe.bodies', { list: bodies.join(sep) }));
      const stars = chart.stars.filter((s) => s.alt >= 0 && s.nameKey !== undefined)
        .slice().sort((a, b) => a.mag - b.mag).slice(0, DESCRIBED_STARS)
        .map((s) => this.t('sky.describe.star', { name: this.t(/** @type {MessageKey} */ (s.nameKey)), direction: this.t(compassKey(s.az)) }));
      if (stars.length > 0) sentences.push(this.t('sky.describe.stars', { list: stars.join(sep) }));
      const constellations = chart.constellationLabels.filter((l) => l.alt >= 0).map((l) => this.t(l.nameKey));
      if (constellations.length > 0) sentences.push(this.t('sky.describe.constellations', { list: constellations.join(sep) }));
      return sentences.join(sentenceSep);
    }

    /** @param {MockStateSnapshot} state */
    render(state) {
      const chart = this.chart();
      if (!chart) {
        this.replaceChildren(this.missingSample(this.getAttribute('sample') ?? ''));
        return;
      }
      const figure = this.el('div', { class: 'mk-star-chart__figure', 'data-figure': '' }, this.drawing(chart, state));
      const caption = this.el('p', { class: 'mk-star-chart__caption' }, this.t('sky.caption', {
        datetime: window.MockI18n.formatDate(chart.observedAt, 'datetime'),
        place: chart.placeLabel,
      }));
      this.replaceChildren(this.el('div', { class: 'mk-star-chart' }, figure, caption));
    }

    /**
     * @param {StarChartSample} chart
     * @param {MockStateSnapshot} state
     * @returns {SVGSVGElement}
     */
    drawing(chart, state) {
      const sky = svg('circle', { class: 'mk-star-chart__sky', cx: fmt(CENTER), cy: fmt(CENTER), r: fmt(RADIUS) });
      const layout = new LabelLayout();

      const lines = svg('g', { class: 'mk-star-chart__lines' });
      for (const [a, b] of chart.constellationLines) {
        const from = chart.stars[a];
        const to = chart.stars[b];
        if (!from || !to || from.alt < 0 || to.alt < 0) continue;
        const p = project(from.az, from.alt);
        const q = project(to.az, to.alt);
        lines.append(svg('line', { class: 'mk-star-chart__line', x1: fmt(p.x), y1: fmt(p.y), x2: fmt(q.x), y2: fmt(q.y) }));
      }

      // Points: every visible star is drawn; bright stars and the bodies are label obstacles.
      const stars = svg('g', { class: 'mk-star-chart__stars' });
      /** @type {{ index: number, star: StarChartStar, x: number, y: number, r: number }[]} */
      const placedStars = [];
      chart.stars.forEach((star, index) => {
        if (star.alt < 0) return;
        const p = project(star.az, star.alt);
        const r = starRadius(star.mag);
        placedStars.push({ index, star, x: p.x, y: p.y, r });
        stars.append(svg('circle', {
          class: 'mk-star-chart__star', 'data-star-index': String(index), cx: fmt(p.x), cy: fmt(p.y), r: fmt(r),
        }));
        if (star.mag <= OBSTACLE_MAG) layout.reserve(pointBox(p.x, p.y, r), `star-${index}`);
      });

      const visibleBodies = chart.bodies.filter((b) => b.alt >= 0).map((body) => {
        const p = project(body.az, body.alt);
        layout.reserve(pointBox(p.x, p.y, BODY_MARK), `body-${bodyId(body)}`);
        return { body, x: p.x, y: p.y };
      });

      // Cardinal labels: fixed just outside the horizon (also obstacles).
      const cardinals = svg('g', { class: 'mk-star-chart__cardinals' });
      for (const c of CARDINALS) {
        const r = RADIUS + CARDINAL_OFFSET;
        const x = CENTER - r * Math.sin(c.az * DEG);
        const y = CENTER - r * Math.cos(c.az * DEG);
        const text = this.t(c.key);
        const w = textWidth(text, FONT.cardinal, true);
        layout.reserve({ x0: x - w / 2, y0: y - FONT.cardinal * 0.75, x1: x + w / 2, y1: y + FONT.cardinal * 0.75 }, `cardinal-${c.dir}`);
        cardinals.append(svg('text', {
          class: 'mk-star-chart__cardinal', 'data-direction': c.dir, x: fmt(x), y: fmt(y), 'font-size': String(FONT.cardinal),
          'text-anchor': 'middle', 'dominant-baseline': 'central',
        }, text));
      }

      // Label priority: 1. moon / planet names, 2. star names by brightness, 3. constellation names.
      const bodies = svg('g', { class: 'mk-star-chart__bodies' });
      for (const { body, x, y } of visibleBodies) {
        const name = this.t(body.nameKey);
        const owner = `body-${bodyId(body)}`;
        const box = layout.place(pointCandidates(x, y, BODY_MARK, textWidth(name, FONT.body, true), FONT.body), owner);
        const mark = body.kind === 'moon'
          ? svg('circle', { class: 'mk-star-chart__body-mark', cx: fmt(x), cy: fmt(y), r: fmt(BODY_MARK) })
          : svg('path', {
            class: 'mk-star-chart__body-mark',
            d: `M ${fmt(x)} ${fmt(y - BODY_MARK)} L ${fmt(x + BODY_MARK)} ${fmt(y)} L ${fmt(x)} ${fmt(y + BODY_MARK)} L ${fmt(x - BODY_MARK)} ${fmt(y)} Z`,
          });
        const group = svg('g', { class: 'mk-star-chart__body', 'data-body': bodyId(body), 'data-kind': body.kind }, mark);
        if (box) {
          group.append(svg('text', { class: 'mk-star-chart__body-label', ...baselineOf(box, FONT.body), 'font-size': String(FONT.body) }, name));
        }
        bodies.append(group);
      }

      const starLabels = svg('g', { class: 'mk-star-chart__star-labels' });
      const named = placedStars.filter((s) => s.star.nameKey !== undefined).sort((a, b) => a.star.mag - b.star.mag);
      for (const { index, star, x, y, r } of named) {
        const name = this.t(/** @type {MessageKey} */ (star.nameKey));
        const box = layout.place(pointCandidates(x, y, r, textWidth(name, FONT.star), FONT.star), `star-${index}`);
        if (!box) continue; // a dimmer star whose name cannot be placed stays unnamed
        starLabels.append(svg('text', {
          class: 'mk-star-chart__star-label', 'data-star-index': String(index), ...baselineOf(box, FONT.star), 'font-size': String(FONT.star),
        }, name));
      }

      // Constellation names: faint secondary information, drawn under the star names.
      const constellations = svg('g', { class: 'mk-star-chart__constellations' });
      for (const label of chart.constellationLabels) {
        if (label.alt < 0) continue;
        const p = project(label.az, label.alt);
        const name = this.t(label.nameKey);
        const box = layout.place(areaCandidates(p.x, p.y, textWidth(name, FONT.constellation), FONT.constellation), `constellation-${label.nameKey}`);
        if (!box) continue;
        constellations.append(svg('text', {
          class: 'mk-star-chart__constellation', 'data-name-key': label.nameKey,
          ...baselineOf(box, FONT.constellation), 'font-size': String(FONT.constellation),
        }, name));
      }

      const horizon = svg('circle', { class: 'mk-star-chart__horizon', cx: fmt(CENTER), cy: fmt(CENTER), r: fmt(RADIUS) });

      return svg('svg', {
        class: 'mk-star-chart__svg',
        viewBox: `0 0 ${VIEW} ${VIEW}`,
        role: 'img',
        'aria-label': this.describe(state),
      }, sky, lines, stars, constellations, starLabels, bodies, horizon, cardinals);
    }
  }

  customElements.define('mk-star-chart', StarChart);
})();
