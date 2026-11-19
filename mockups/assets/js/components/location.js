// Location components: mk-precision-picker and mk-map-sample (task 4.6; 6.2, 7.1, 7.2, 8.2, 13.4).
// mk-location-panel and mk-weather: task 4.7 (7.2, 7.3, 7.4, 7.5, 7.6). Design: Parts >
// プレゼンテーション部品; PrecisionPickerAttrs / MapSampleAttrs / LocationPanelAttrs / WeatherAttrs
// in types.d.ts.
//
// mk-precision-picker (`value`):
// - A real radio group: <fieldset> + <legend> (location.label) with the five LocationPrecision
//   levels in order. Each radio has a <label> and a description of how other people see the post
//   (location.precision.{p}.description), associated with aria-describedby.
// - `value` is the initial choice (nothing is checked without it). The current choice lives in
//   the component, so it survives re-renders (language / theme switches); changing the `value`
//   attribute resets it. The native `change` event bubbles out of the element.
// - Radio names and ids are unique per instance (several pickers can share a page).
// - `collapsed` (boolean, task 8.1, post-edit only) folds the fieldset into a closed <details>.
//   Its <summary> names the control and the current choice (location.summary, e.g.
//   「位置の公開精度：市区町村」; location.unselected when nothing is chosen) and follows the choice.
//   The fieldset keeps its legend inside; the open state survives re-renders.
//
// mk-map-sample (`precision`, optional `region`):
// - Schematic inline SVG map (no real geography). The MapFrame and the default region name come
//   from the first sample post with that precision; `region` overrides the region name (the
//   location panel passes the post's regionLabel). An unknown precision renders missingSample.
// - By zoom: street (exact) -> street grid and a pin; district (fuzzed-1km) -> a finer grid and a
//   circle whose radius equals the 1 km scale bar, no pin; city / prefecture / country ->
//   boundaries with the area shaded (city: neighbouring municipalities; prefecture: a coastline
//   and neighbouring prefectures; country: the islands all shaded). Each zoom has a scale bar.
// - Colors come from CSS classes in components.css that reference tokens (theme + wireframe
//   grays). Geometry is in viewBox user units, so the map scales with its width.
// - The non-focusable wrapper carries data-figure (wireframe placeholder); the <svg> has
//   role="img" and aria-label = describe(state) naming the region (Japanese free text, also in the
//   English UI). The caption repeats the region and the precision as visible text.
//
// mk-weather (`post-id`):
// - Display follows the data (SamplePost): location present with weather -> condition, temperature
//   (°C), humidity (%), wind speed (m/s) and the observation time (datetime format in <time>);
//   location present without weather -> the weather could not be fetched: weather.unavailable as
//   role="alert" (same as mk-event-list's fetch error); no location -> nothing (7.6). The screens
//   pick the post per scenario from SampleDataSet.postDetailScenarios (weather-failed -> p-107).
// - Units are the same symbols in both languages (in the dictionary templates). Temperature and
//   wind keep one decimal place, humidity is a whole number.
//
// mk-location-panel (`post-id`):
// - A <section> labelled by its h3 (location.panel.title) that groups the region name and map
//   (mk-map-sample with the post's precision and regionLabel as `region`; its caption shows the
//   region and precision), the rise / set times (h4 + mk-rise-set post-id) and the weather
//   (h4 weather.label + mk-weather post-id). A post without location renders nothing (7.6), so the
//   no-location scenario (p-106) shows no panel. The h3 / h4 levels are fixed; the screens check
//   the heading hierarchy (5.3).
//
// Preconditions: base.js (window.MockElement) and i18n.js are loaded first; almanac.js (mk-rise-set)
// is loaded for the panel.
(function () {
  if (typeof window.MockElement !== 'function') {
    console.error('[location.js] window.MockElement is missing; load components/base.js first');
    return;
  }
  const MockElement = window.MockElement;

  /** @type {readonly { precision: LocationPrecision, labelKey: MessageKey, descriptionKey: MessageKey, describeKey: MessageKey }[]} */
  const LEVELS = [
    { precision: 'exact', labelKey: 'location.precision.exact', descriptionKey: 'location.precision.exact.description', describeKey: 'map.describe.exact' },
    { precision: 'fuzzed-1km', labelKey: 'location.precision.fuzzed-1km', descriptionKey: 'location.precision.fuzzed-1km.description', describeKey: 'map.describe.fuzzed-1km' },
    { precision: 'municipality', labelKey: 'location.precision.municipality', descriptionKey: 'location.precision.municipality.description', describeKey: 'map.describe.municipality' },
    { precision: 'prefecture', labelKey: 'location.precision.prefecture', descriptionKey: 'location.precision.prefecture.description', describeKey: 'map.describe.prefecture' },
    { precision: 'country', labelKey: 'location.precision.country', descriptionKey: 'location.precision.country.description', describeKey: 'map.describe.country' },
  ];

  /** @param {string | null} value */
  const levelOf = (value) => LEVELS.find((l) => l.precision === value);

  // ---------------------------------------------------------------------------------------------
  // mk-precision-picker
  // ---------------------------------------------------------------------------------------------

  let pickerCount = 0;

  class PrecisionPicker extends MockElement {
    static observedAttributes = ['value', 'collapsed'];

    constructor() {
      super();
      pickerCount += 1;
      /** Whether the collapsed picker (`collapsed`) is open; kept across re-renders. */
      this.open = false;
      /** Prefix for the radio name and the element ids of this instance. */
      this.uid = `mk-precision-${pickerCount}`;
      /** @type {LocationPrecision | null} */
      this.selected = null;
      // The `value` attribute the choice was last reset from (undefined before the first render).
      /** @type {string | null | undefined} */
      this.valueAttr = undefined;
    }

    /** The `value` attribute as a precision (null when absent or unknown). */
    initialValue() {
      return levelOf(this.getAttribute('value'))?.precision ?? null;
    }

    /** @param {MockStateSnapshot} state */
    render(state) {
      // The first render and every change of the `value` attribute reset the choice to it.
      const valueAttr = this.getAttribute('value');
      if (valueAttr !== this.valueAttr) {
        this.valueAttr = valueAttr;
        this.selected = this.initialValue();
      }
      const collapsed = this.hasAttribute('collapsed');
      const summary = collapsed
        ? this.el('summary', { class: 'mk-precision-picker__summary', 'data-mk-focus': 'toggle' }, this.summaryText())
        : null;
      const options = this.el('div', { class: 'mk-precision-picker__options' });
      for (const level of LEVELS) {
        const id = `${this.uid}-${level.precision}`;
        const descriptionId = `${id}-description`;
        const radio = this.el('input', {
          type: 'radio', id, name: this.uid, value: level.precision,
          'aria-describedby': descriptionId, 'data-mk-focus': level.precision,
        });
        radio.checked = this.selected === level.precision;
        radio.addEventListener('change', () => {
          if (!radio.checked) return;
          this.selected = level.precision;
          if (summary !== null) summary.textContent = this.summaryText();
        });
        options.append(this.el('div', { class: 'mk-precision-picker__option', 'data-precision': level.precision },
          radio,
          this.el('label', { class: 'mk-precision-picker__label', for: id }, this.t(level.labelKey)),
          this.el('p', { class: 'mk-precision-picker__description', id: descriptionId }, this.t(level.descriptionKey))));
      }
      const fieldset = this.el('fieldset', { class: 'mk-precision-picker', lang: state.lang },
        this.el('legend', null, this.t('location.label')), options);
      if (summary === null) {
        this.replaceChildren(fieldset);
        return;
      }
      // Post-edit form: the radio group stays out of the way in a closed accordion (task 8.1).
      const details = this.el('details', { class: 'mk-precision-picker__toggle', lang: state.lang }, summary, fieldset);
      details.open = this.open;
      details.addEventListener('toggle', () => { this.open = details.open; });
      this.replaceChildren(details);
    }

    /** The summary of the collapsed picker: the control's name and the current choice. */
    summaryText() {
      const level = levelOf(this.selected);
      return this.t('location.summary', {
        label: this.t('location.label'),
        precision: level ? this.t(level.labelKey) : this.t('location.unselected'),
      });
    }
  }

  customElements.define('mk-precision-picker', PrecisionPicker);

  // ---------------------------------------------------------------------------------------------
  // mk-map-sample
  // ---------------------------------------------------------------------------------------------

  const SVG_NS = 'http://www.w3.org/2000/svg';
  /** viewBox size (user units). */
  const VIEW_W = 320;
  const VIEW_H = 200;
  const CX = VIEW_W / 2;
  const CY = VIEW_H / 2;
  /** Length of the scale bar (user units); for district it is 1 km, the radius of the circle. */
  const SCALE_BAR = 56;

  /** Scale bar label for each zoom (the distance SCALE_BAR stands for; language independent). */
  /** @type {Readonly<Record<MapFrame['zoom'], string>>} */
  const SCALE_LABEL = {
    street: '200 m',
    district: '1 km',
    city: '5 km',
    prefecture: '20 km',
    country: '300 km',
  };

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

  /** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {string} cls */
  const line = (x1, y1, x2, y2, cls) =>
    svg('line', { class: cls, x1: String(x1), y1: String(y1), x2: String(x2), y2: String(y2) });

  /** A road grid: vertical roads at xs, horizontal roads at ys. @param {number[]} xs @param {number[]} ys @param {string} cls */
  const grid = (xs, ys, cls) => svg('g', { class: 'mk-map__roads' },
    ...xs.map((x) => line(x, 0, x, VIEW_H, cls)),
    ...ys.map((y) => line(0, y, VIEW_W, y, cls)));

  /** Boundary lines from the vertices of a polygon out to the edge of the map. @param {readonly (readonly [number, number, number, number])[]} segs */
  const boundaries = (segs) => svg('g', { class: 'mk-map__boundaries' },
    ...segs.map(([x1, y1, x2, y2]) => line(x1, y1, x2, y2, 'mk-map__boundary')));

  /** @param {string} points */
  const region = (points) => svg('polygon', { class: 'mk-map__region', 'data-mark': 'region', points });

  /** The land covering the whole map. */
  const fullLand = () => svg('rect', { class: 'mk-map__land', x: '0', y: '0', width: String(VIEW_W), height: String(VIEW_H) });

  /**
   * Layers for each zoom (back to front, without the scale bar).
   * @type {Readonly<Record<MapFrame['zoom'], () => SVGElement[]>>}
   */
  const LAYERS = {
    street: () => [
      fullLand(),
      grid([40, 124, 204, 284], [56, 148], 'mk-map__road mk-map__road--major'),
      line(204, 148, VIEW_W, 84, 'mk-map__road mk-map__road--major'),
    ],
    district: () => [
      fullLand(),
      grid([20, 60, 100, 140, 180, 220, 260, 300], [30, 70, 110, 150, 190], 'mk-map__road'),
    ],
    city: () => [
      fullLand(),
      line(0, 130, VIEW_W, 70, 'mk-map__road'),
      boundaries([[112, 44, 84, 0], [204, 36, 224, 0], [232, 96, VIEW_W, 82], [202, 160, 244, VIEW_H], [118, 156, 88, VIEW_H], [94, 102, 0, 112]]),
      region('112,44 204,36 232,96 202,160 118,156 94,102'),
    ],
    prefecture: () => [
      svg('polygon', { class: 'mk-map__land', points: `0,0 ${VIEW_W},0 ${VIEW_W},64 276,104 252,166 196,${VIEW_H} 0,${VIEW_H}` }),
      boundaries([[92, 42, 70, 0], [196, 30, 214, 0], [238, 90, 300, 70], [214, 148, 252, 166], [122, 164, 112, VIEW_H], [72, 104, 0, 120]]),
      region('92,42 196,30 238,90 214,148 122,164 72,104'),
    ],
    country: () => [
      region('60,176 104,148 150,128 192,100 222,66 246,74 220,112 182,142 132,166 84,192'),
      region('246,14 292,22 282,52 252,46'),
      region('14,118 44,110 40,132 18,138'),
    ],
  };

  /** @implements {DescribableElement} */
  class MapSample extends MockElement {
    static observedAttributes = ['precision', 'region'];

    /** The sample location for this precision (first sample post with it), or null. */
    location() {
      const precision = levelOf(this.getAttribute('precision'))?.precision;
      if (!precision) return null;
      const post = this.sample().posts.find((p) => p.location?.precision === precision);
      return post?.location ?? null;
    }

    /** @param {PostLocation} location */
    regionName(location) {
      const given = this.getAttribute('region');
      return given !== null && given !== '' ? given : location.regionLabel;
    }

    /**
     * Alt text: the region name, the zoom and what marks the place (pin, circle or shaded area).
     * @param {MockStateSnapshot} state
     * @returns {string}
     */
    describe(state) {
      const location = this.location();
      const level = location ? levelOf(location.precision) : undefined;
      if (!location || !level) return '';
      // this.t() reads the current language (state.lang); the region name is not translated.
      return this.t(level.describeKey, { region: this.regionName(location) });
    }

    /** @param {MockStateSnapshot} state */
    render(state) {
      const location = this.location();
      const level = location ? levelOf(location.precision) : undefined;
      if (!location || !level) {
        this.replaceChildren(this.missingSample(this.getAttribute('precision') ?? ''));
        return;
      }
      const figure = this.el('div', { class: 'mk-map__figure', 'data-figure': '' }, this.drawing(location, state));
      const caption = this.el('p', { class: 'mk-map__caption' }, this.t('map.caption', {
        region: this.regionName(location),
        precision: this.t(level.labelKey),
      }));
      this.replaceChildren(this.el('div', { class: 'mk-map' }, figure, caption));
    }

    /**
     * @param {PostLocation} location
     * @param {MockStateSnapshot} state
     * @returns {SVGSVGElement}
     */
    drawing(location, state) {
      const frame = location.mapFrame;
      const layers = LAYERS[frame.zoom]();
      if (frame.showRadiusKm !== undefined) {
        // The scale bar is 1 km at district zoom, so the radius is SCALE_BAR per km.
        layers.push(svg('circle', {
          class: 'mk-map__radius', 'data-mark': 'radius',
          cx: String(CX), cy: String(CY), r: String(SCALE_BAR * frame.showRadiusKm),
        }));
      }
      if (frame.showPin) {
        // Teardrop pin whose tip is on the spot (CX, CY).
        layers.push(svg('g', { class: 'mk-map__pin', 'data-mark': 'pin' },
          svg('path', { class: 'mk-map__pin-body', d: `M ${CX} ${CY} C ${CX - 4} ${CY - 10} ${CX - 12} ${CY - 16} ${CX - 12} ${CY - 26} A 12 12 0 1 1 ${CX + 12} ${CY - 26} C ${CX + 12} ${CY - 16} ${CX + 4} ${CY - 10} ${CX} ${CY} Z` }),
          svg('circle', { class: 'mk-map__pin-dot', cx: String(CX), cy: String(CY - 26), r: '4.5' })));
      }
      const scaleX = 16;
      const scaleY = VIEW_H - 14;
      const scale = svg('g', { class: 'mk-map__scale' },
        line(scaleX, scaleY, scaleX + SCALE_BAR, scaleY, 'mk-map__scale-bar'),
        svg('text', { class: 'mk-map__scale-label', x: String(scaleX), y: String(scaleY - 6), 'font-size': '12' }, SCALE_LABEL[frame.zoom]));
      return svg('svg', {
        class: 'mk-map__svg',
        viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
        'data-zoom': frame.zoom,
        role: 'img',
        'aria-label': this.describe(state),
      }, svg('rect', { class: 'mk-map__water', x: '0', y: '0', width: String(VIEW_W), height: String(VIEW_H) }), ...layers, scale);
    }
  }

  customElements.define('mk-map-sample', MapSample);

  // ---------------------------------------------------------------------------------------------
  // mk-weather / mk-location-panel
  // ---------------------------------------------------------------------------------------------

  /** @typedef {'temperature' | 'humidity' | 'wind'} WeatherItem */

  class Weather extends MockElement {
    static observedAttributes = ['post-id'];

    render() {
      const postId = this.getAttribute('post-id') ?? '';
      const post = this.sample().posts.find((p) => p.id === postId);
      if (!post) {
        this.replaceChildren(this.missingSample(postId));
        return;
      }
      // No location: no weather either (7.6).
      if (!post.location) {
        this.replaceChildren();
        return;
      }
      const weather = post.weather;
      if (!weather) {
        // Location present, weather undefined: the weather could not be fetched (7.5).
        this.replaceChildren(this.el('div', { class: 'mk-weather', 'data-state': 'unavailable' },
          this.el('p', { class: 'mk-weather__error', role: 'alert' }, this.t('weather.unavailable'))));
        return;
      }
      /** @type {readonly [WeatherItem, string][]} */
      const items = [
        ['temperature', this.t('weather.temperature', { value: weather.temperatureC.toFixed(1) })],
        ['humidity', this.t('weather.humidity', { value: Math.round(weather.humidityPct) })],
        ['wind', this.t('weather.wind', { value: weather.windMps.toFixed(1) })],
      ];
      const values = this.el('ul', { class: 'mk-weather__values' },
        ...items.map(([item, text]) => this.el('li', { class: 'mk-weather__value', 'data-item': item }, text)));
      const observed = this.el('p', { class: 'mk-weather__observed' },
        this.el('time', { datetime: weather.observedAt },
          this.t('weather.observed-at', { time: window.MockI18n.formatDate(weather.observedAt, 'datetime') })));
      this.replaceChildren(this.el('div', { class: 'mk-weather', 'data-state': 'available' },
        this.el('p', { class: 'mk-weather__condition' }, this.t(weather.conditionKey)), values, observed));
    }
  }

  customElements.define('mk-weather', Weather);

  /**
   * A child mk-* element (not in HTMLElementTagNameMap, so not through this.el()).
   * @param {MockElementName} name
   * @param {Readonly<Record<string, string>>} attrs
   * @returns {HTMLElement}
   */
  const childElement = (name, attrs) => {
    const node = document.createElement(name);
    for (const [attr, value] of Object.entries(attrs)) node.setAttribute(attr, value);
    return node;
  };

  let panelCount = 0;

  class LocationPanel extends MockElement {
    static observedAttributes = ['post-id'];

    constructor() {
      super();
      panelCount += 1;
      /** Prefix for the heading ids of this instance. */
      this.uid = `mk-location-panel-${panelCount}`;
    }

    render() {
      const postId = this.getAttribute('post-id') ?? '';
      const post = this.sample().posts.find((p) => p.id === postId);
      if (!post) {
        this.replaceChildren(this.missingSample(postId));
        return;
      }
      // A post without location shows no panel (7.6).
      const location = post.location;
      if (!location) {
        this.replaceChildren();
        return;
      }
      const titleId = `${this.uid}-title`;
      const map = childElement('mk-map-sample', { precision: location.precision, region: location.regionLabel });
      const riseSet = this.el('div', { class: 'mk-location-panel__block', 'data-block': 'rise-set' },
        this.el('h4', null, this.t('location.panel.rise-set')),
        childElement('mk-rise-set', { 'post-id': post.id }));
      const weather = this.el('div', { class: 'mk-location-panel__block', 'data-block': 'weather' },
        this.el('h4', null, this.t('weather.label')),
        childElement('mk-weather', { 'post-id': post.id }));
      this.replaceChildren(this.el('section', { class: 'mk-location-panel', 'aria-labelledby': titleId },
        this.el('h3', { class: 'mk-location-panel__title', id: titleId }, this.t('location.panel.title')),
        this.el('div', { class: 'mk-location-panel__body' },
          this.el('div', { class: 'mk-location-panel__map' }, map),
          this.el('div', { class: 'mk-location-panel__details' }, riseSet, weather))));
    }
  }

  customElements.define('mk-location-panel', LocationPanel);
})();
