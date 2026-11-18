// Almanac components: mk-month-calendar, mk-day-cell, mk-almanac-summary, mk-rise-set, mk-event-list
// (design: Parts > プレゼンテーション部品; attributes *Attrs in types.d.ts).
// Task 4.2 implements mk-month-calendar and mk-day-cell; task 4.3 the summary, rise/set and event list.
//
// - mk-day-cell (4.1, 4.2, 4.6, 13.3) `date`, `compact`:
//   full    : date (link to day-detail, accessible name = full date), weekday, holiday with the
//             provisional label as text, rokuyo, lunar date (leap month label), moon age, and the
//             marks of sekki / kou / zassetsu / astronomical events as symbol + text.
//   compact : date, holiday mark, moon phase symbol and mark symbols only; role="img" with the
//             full information as aria-label (the calendar's button takes its name from it).
// - mk-month-calendar (4.1, 4.2, 12.3) `month` (YYYY-MM): renders both layouts and CSS picks one.
//   PC (>= 600px)   : <table> with 7 columns, Sunday first, cells are full mk-day-cell.
//   phone (< 600px) : role="grid" of compact cells (one button per day, roving tabindex,
//                     aria-selected) plus the summary panel of the selected day (aria-live).
//                     Click / tap, arrow keys (+-1 day, +-1 week), Home / End (start / end of
//                     the week) select a day. The first selection is today if the month holds
//                     it, otherwise the 1st.
//   Today (SampleDataSet.today) is marked with aria-current="date" and a text label.
// - mk-almanac-summary (4.3, 4.6, 4.7) `date`, `variant`:
//   full (default, day detail): date, rokuyo, lunar date (leap label), moon phase / age, sekki,
//                               kou, zassetsu, holiday (+ provisional label), the day's events;
//                               items without a value show almanac.none as text.
//   brief (top page)          : date, rokuyo, lunar date, moon, plus sekki / holiday when present,
//                               next to a moon figure drawn from the moon age (task 8.1: the lit
//                               part is bounded by the limb and the terminator ellipse; waxing is
//                               lit on the right, as seen from Japan; role="img" + aria-label).
// - mk-rise-set (4.3, 7.3, 7.6) `date` (AlmanacDay.riseSet) or `post-id` (post.location.riseSet;
//   a post without location renders nothing). A time that does not occur shows
//   almanac.riseset-none. With `chart` (task 8.1, top page) a 0-24h chart of when the sun and the
//   moon are above the horizon comes first (rows labelled with text, role="img" + aria-label
//   listing the times); a missing rise or set means the body was already up / stays up.
// - Figures sit in a non-focusable wrapper with data-figure (wireframe placeholder, note 1.7).
// - mk-event-list (3.4, 3.5, 4.4, 4.5) `from`, `to`, `kinds` (initial filter values; the filter
//   state is local and survives language / theme re-renders, reset when the attributes change):
//   period (date inputs bounded by the sample events) and kind checkboxes in fieldsets; changes
//   update only the results and the role="status" count. Scenario `empty` (or no match) shows
//   empty.events, `fetch-error` shows error.fetch (role="alert"). `filters="collapsed"` (task
//   8.1, top page) folds the filters into a closed <details>; its open state survives re-renders.
//
// Days are looked up by date in SampleDataSet.almanac (its first row is the leap-month example
// 2025-07-25, so the calendar filters by month); events by AlmanacDay.eventIds.
// Day-detail links point at mockups/screens/day-detail.html?date=YYYY-MM-DD resolved from this
// script's URL; a logged-in auth state is carried over when day-detail allows it.
//
// Preconditions: base.js (window.MockElement) and i18n.js are loaded first.
(function () {
  const scriptEl = document.currentScript;
  const scriptSrc = scriptEl instanceof HTMLScriptElement ? scriptEl.src : '';

  if (typeof window.MockElement !== 'function') {
    console.error('[almanac.js] window.MockElement is missing; load components/base.js first');
    return;
  }
  const MockElement = window.MockElement;

  /** @typedef {'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'} WeekdayId */
  /** @type {readonly WeekdayId[]} */
  const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  /** A Sunday-to-Saturday week used to format the weekday headers. */
  const HEADER_WEEK = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];

  /** @type {Readonly<Record<string, string>>} moonPhaseKey -> symbol */
  const PHASE_SYMBOLS = {
    'moon-phase.new-moon': '●',
    'moon-phase.first-quarter': '◐',
    'moon-phase.full-moon': '○',
    'moon-phase.last-quarter': '◑',
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';

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

  /** @param {number} n */
  const fmt = (n) => String(Math.round(n * 100) / 100);

  /** Mean synodic month in days. */
  const SYNODIC_MONTH = 29.53;

  /**
   * Shape of the moon at a moon age (days since the new moon).
   * @param {number} age
   * @returns {{ waxing: boolean, illumination: number, terminatorRx: number }}
   *   illumination 0..1 = (1 - cos(phase angle)) / 2; terminatorRx relative to the radius (0..1)
   */
  const moonShape = (age) => {
    const angle = (2 * Math.PI * age) / SYNODIC_MONTH;
    return {
      waxing: age < SYNODIC_MONTH / 2,
      illumination: (1 - Math.cos(angle)) / 2,
      terminatorRx: Math.abs(Math.cos(angle)),
    };
  };

  /** Moon figure geometry (viewBox units). */
  const MOON = { view: 100, c: 50, r: 45 };

  /** @typedef {'sekki' | 'kou' | 'zassetsu' | 'event'} MarkKind */
  /** @type {Readonly<Record<MarkKind, string>>} */
  const MARK_SYMBOLS = { sekki: '◆', kou: '◇', zassetsu: '■', event: '★' };

  /** @typedef {'moon' | 'planet'} EventTone */
  /** @param {AstroEvent} event @returns {EventTone} */
  const eventTone = (event) => (event.kind.startsWith('moon-') || event.bodies.includes('moon') ? 'moon' : 'planet');

  /**
   * @typedef {object} Mark
   * @property {MarkKind} kind
   * @property {string} symbol
   * @property {string} text
   * @property {EventTone} [tone]
   */

  /** @param {number} n */
  const pad2 = (n) => String(n).padStart(2, '0');

  /** @param {IsoDate} date @returns {{ y: number, m: number, d: number } | null} */
  const parseIsoDate = (date) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return null;
    return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  };

  /** Calendar weekday (0 = Sunday), independent of the time zone. @param {number} y @param {number} m @param {number} d */
  const weekdayOf = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  /** @param {number} y @param {number} m */
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

  /** @param {IsoDate} date @param {MockStateSnapshot} state @returns {string} */
  const dayDetailHref = (date, state) => {
    /** @type {URL} */
    let url;
    try {
      url = new URL('../../../screens/day-detail.html', scriptSrc || window.location.href);
    } catch {
      return `day-detail.html?date=${date}`;
    }
    url.searchParams.set('date', date);
    const registry = Array.isArray(window.MockScreens) ? window.MockScreens : [];
    const entry = registry.find((s) => s.id === 'day-detail');
    if (state.auth !== 'guest' && entry !== undefined && entry.authStates.includes(state.auth)) {
      url.searchParams.set('auth', state.auth);
    }
    return url.href;
  };

  /** @param {IsoDate} date @returns {AlmanacDay | undefined} */
  const findDay = (date) => window.MockSample.almanac.find((d) => d.date === date);

  /** @param {MessageKey} key @param {MessageArgs} [args] */
  const t = (key, args) => window.MockI18n.t(key, args);

  /** @param {AstroEvent} event @returns {string} */
  const eventTitle = (event) => {
    /** @type {Record<string, string>} */
    const args = {};
    event.bodies.forEach((id, i) => {
      const name = t(`astro.body.${id}`);
      if (i === 0) args['body'] = name;
      args[`body${i + 1}`] = name;
    });
    return t(event.titleKey, args);
  };

  /** @param {AlmanacDay} day @returns {Mark[]} */
  const marksOf = (day) => {
    /** @type {Mark[]} */
    const marks = [];
    if (day.sekkiKey) marks.push({ kind: 'sekki', symbol: MARK_SYMBOLS.sekki, text: t(day.sekkiKey) });
    if (day.kouKey) marks.push({ kind: 'kou', symbol: MARK_SYMBOLS.kou, text: t(day.kouKey) });
    for (const key of day.zassetsuKeys) marks.push({ kind: 'zassetsu', symbol: MARK_SYMBOLS.zassetsu, text: t(key) });
    for (const id of day.eventIds) {
      const event = window.MockSample.events.find((e) => e.id === id);
      if (event) marks.push({ kind: 'event', symbol: MARK_SYMBOLS.event, text: eventTitle(event), tone: eventTone(event) });
    }
    return marks;
  };

  /** @param {AlmanacDay} day */
  const lunarText = (day) => t(day.lunar.leap ? 'lunar-month.date-leap' : 'lunar-month.date',
    { month: day.lunar.month, day: day.lunar.day });

  /** @param {AlmanacDay} day */
  const moonAgeText = (day) => t('moon-phase.age', { age: day.moonAge.toFixed(1) });

  /** Rokuyo id for data-rokuyo (rokuyo.taian -> taian). @param {AlmanacDay} day */
  const rokuyoId = (day) => day.rokuyoKey.replace(/^rokuyo\./, '');

  /**
   * Full text of a day (compact cells and the calendar buttons).
   * @param {AlmanacDay} day
   * @param {MockStateSnapshot} state
   */
  const dayLabel = (day, state) => {
    const parts = [window.MockI18n.formatDate(day.date, 'date-long')];
    if (day.date === window.MockSample.today) parts.push(t('calendar.today'));
    if (day.holiday) {
      parts.push(t(day.holiday.key));
      if (day.holiday.provisional) parts.push(t('holiday.provisional'));
    }
    parts.push(t(day.rokuyoKey), lunarText(day));
    if (day.moonPhaseKey) parts.push(t(day.moonPhaseKey));
    parts.push(moonAgeText(day));
    for (const mark of marksOf(day)) parts.push(mark.text);
    return parts.join(state.lang === 'ja' ? '、' : ', ');
  };

  class DayCell extends MockElement {
    static observedAttributes = ['date', 'compact'];

    /** @param {MockStateSnapshot} state */
    render(state) {
      const date = this.getAttribute('date') ?? '';
      const parsed = parseIsoDate(date);
      const day = parsed ? findDay(date) : undefined;
      if (!parsed || !day) {
        this.replaceChildren(this.missingSample(date));
        return;
      }
      const weekday = WEEKDAYS[weekdayOf(parsed.y, parsed.m, parsed.d)];
      /** @type {Record<string, string>} */
      const attrs = { class: 'mk-day-cell', 'data-weekday': weekday };
      if (day.holiday) attrs['data-holiday'] = '';
      this.replaceChildren(this.hasAttribute('compact')
        ? this.compactCell(attrs, parsed.d, day, state)
        : this.fullCell(attrs, parsed.d, day, state));
    }

    /**
     * @param {Record<string, string>} attrs
     * @param {number} dayOfMonth
     * @param {AlmanacDay} day
     * @param {MockStateSnapshot} state
     */
    compactCell(attrs, dayOfMonth, day, state) {
      const cell = this.el('span', { ...attrs, 'data-compact': '', role: 'img', 'aria-label': dayLabel(day, state) },
        this.el('span', { class: 'mk-day-cell__num' }, String(dayOfMonth)));
      if (day.holiday) {
        /** @type {Record<string, string>} */
        const markAttrs = { class: 'mk-day-cell__holiday-mark' };
        if (day.holiday.provisional) markAttrs['data-provisional'] = '';
        cell.append(this.el('span', markAttrs, this.t('calendar.holiday-short')));
      }
      if (day.moonPhaseKey) {
        cell.append(this.el('span', { class: 'mk-day-cell__phase' }, PHASE_SYMBOLS[day.moonPhaseKey] ?? '◌'));
      }
      const marks = marksOf(day);
      if (marks.length > 0) {
        const symbols = this.el('span', { class: 'mk-day-cell__mark-symbols' });
        for (const mark of marks) {
          /** @type {Record<string, string>} */
          const markAttrs = { class: 'mk-mark__symbol', 'data-mark': mark.kind };
          if (mark.tone) markAttrs['data-tone'] = mark.tone;
          symbols.append(this.el('span', markAttrs, mark.symbol));
        }
        cell.append(symbols);
      }
      return cell;
    }

    /**
     * @param {Record<string, string>} attrs
     * @param {number} dayOfMonth
     * @param {AlmanacDay} day
     * @param {MockStateSnapshot} state
     */
    fullCell(attrs, dayOfMonth, day, state) {
      const head = this.el('div', { class: 'mk-day-cell__head' },
        this.el('a', {
          class: 'mk-day-cell__date',
          href: dayDetailHref(day.date, state),
          'aria-label': window.MockI18n.formatDate(day.date, 'date-long'),
          'data-mk-focus': `date-${day.date}`,
        },
        this.el('span', { class: 'mk-day-cell__num' }, String(dayOfMonth)),
        this.el('span', { class: 'mk-day-cell__weekday' }, window.MockI18n.formatDate(day.date, 'weekday'))));
      if (day.date === this.sample().today) {
        head.append(this.el('span', { class: 'mk-day-cell__today' }, this.t('calendar.today')));
      }
      const cell = this.el('div', attrs, head);

      if (day.holiday) {
        const holiday = this.el('p', { class: 'mk-day-cell__holiday' },
          this.el('span', { class: 'mk-day-cell__holiday-name' }, this.t(day.holiday.key)));
        if (day.holiday.provisional) {
          holiday.append(' ', this.el('span', { class: 'mk-day-cell__provisional' }, this.t('holiday.provisional')));
        }
        cell.append(holiday);
      }
      cell.append(
        this.el('p', { class: 'mk-day-cell__rokuyo', 'data-rokuyo': rokuyoId(day) }, this.t(day.rokuyoKey)),
        this.el('p', { class: 'mk-day-cell__lunar' }, lunarText(day)));

      const moon = this.el('p', { class: 'mk-day-cell__moon' });
      if (day.moonPhaseKey) {
        moon.append(
          this.el('span', { class: 'mk-day-cell__phase', 'aria-hidden': 'true' }, PHASE_SYMBOLS[day.moonPhaseKey] ?? '◌'),
          ' ', this.el('span', { class: 'mk-day-cell__phase-name' }, this.t(day.moonPhaseKey)), ' ');
      }
      moon.append(this.el('span', null, moonAgeText(day)));
      cell.append(moon);

      const marks = marksOf(day);
      if (marks.length > 0) {
        const list = this.el('ul', { class: 'mk-day-cell__marks' });
        for (const mark of marks) {
          /** @type {Record<string, string>} */
          const markAttrs = { class: 'mk-mark', 'data-mark': mark.kind };
          if (mark.tone) markAttrs['data-tone'] = mark.tone;
          list.append(this.el('li', markAttrs,
            this.el('span', { class: 'mk-mark__symbol', 'aria-hidden': 'true' }, mark.symbol),
            this.el('span', { class: 'mk-mark__text' }, mark.text)));
        }
        cell.append(list);
      }
      return cell;
    }
  }

  /** A child mk-day-cell (custom element names are not in HTMLElementTagNameMap). @param {IsoDate} date @param {boolean} compact */
  const dayCellElement = (date, compact) => {
    const cell = document.createElement('mk-day-cell');
    cell.setAttribute('date', date);
    if (compact) cell.setAttribute('compact', '');
    return cell;
  };

  /** Keyboard moves in the compact grid: day offsets, or week edges for Home / End. */
  /** @type {Readonly<Record<string, number>>} */
  const KEY_OFFSETS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

  class MonthCalendar extends MockElement {
    static observedAttributes = ['month'];

    constructor() {
      super();
      /** @type {IsoDate | null} */
      this.selected = null;
      /**
       * Persistent skeleton: the summary panel (aria-live) stays the same element across
       * renders and only its contents are replaced, so selections are announced politely.
       * @type {{ root: HTMLDivElement, compact: HTMLDivElement, summary: HTMLElement } | null}
       */
      this.layout = null;
    }

    ensureLayout() {
      if (this.layout === null) {
        const summary = this.el('section', { class: 'mk-calendar__summary', 'aria-live': 'polite' });
        const compact = this.el('div', { class: 'mk-calendar__compact', 'data-layout': 'compact' },
          this.el('table'), this.el('div'), summary);
        this.layout = { root: this.el('div', { class: 'mk-calendar' }, this.el('table'), compact), compact, summary };
      }
      if (this.childElementCount !== 1 || this.firstElementChild !== this.layout.root) this.replaceChildren(this.layout.root);
      return this.layout;
    }

    /** Legend of the compact grid: holiday marks and symbols as text (12.3, 13.3). */
    legend() {
      /** @param {Node} sample @param {string} text */
      const item = (sample, text) => this.el('li', null, sample, this.el('span', null, text));
      const list = this.el('ul', { class: 'mk-calendar__legend-list' },
        item(this.el('span', { class: 'mk-day-cell__holiday-mark' }, this.t('calendar.holiday-short')), this.t('calendar.legend.holiday')),
        item(this.el('span', { class: 'mk-day-cell__holiday-mark', 'data-provisional': '' }, this.t('calendar.holiday-short')), this.t('calendar.legend.provisional')),
        item(this.el('span', { class: 'mk-mark__symbol', 'data-mark': 'sekki' }, MARK_SYMBOLS.sekki), this.t('sekki.label')),
        item(this.el('span', { class: 'mk-mark__symbol', 'data-mark': 'kou' }, MARK_SYMBOLS.kou), this.t('kou.label')),
        item(this.el('span', { class: 'mk-mark__symbol', 'data-mark': 'zassetsu' }, MARK_SYMBOLS.zassetsu), this.t('zassetsu.label')),
        item(this.el('span', { class: 'mk-mark__symbol', 'data-mark': 'event' }, MARK_SYMBOLS.event), this.t('calendar.legend.event')));
      for (const [key, symbol] of Object.entries(PHASE_SYMBOLS)) {
        list.append(item(this.el('span', { class: 'mk-day-cell__phase' }, symbol), this.t(key)));
      }
      return this.el('div', { class: 'mk-calendar__legend' },
        this.el('p', { class: 'mk-calendar__legend-title' }, this.t('calendar.legend.label')), list);
    }

    /** @returns {{ y: number, m: number, prefix: string } | null} */
    month() {
      const attr = this.getAttribute('month') ?? '';
      const match = /^(\d{4})-(\d{2})$/.exec(attr);
      if (!match) return null;
      const y = Number(match[1]);
      const m = Number(match[2]);
      if (m < 1 || m > 12) return null;
      return { y, m, prefix: attr };
    }

    /** @param {IsoDate} date @param {boolean} focus */
    select(date, focus) {
      this.selected = date;
      this.refresh(window.MockState.get());
      if (!focus) return;
      const button = this.querySelector(`button[data-date="${date}"]`);
      if (button instanceof HTMLElement) button.focus();
    }

    /** @param {MockStateSnapshot} state */
    render(state) {
      const month = this.month();
      const attr = this.getAttribute('month') ?? '';
      const sample = this.sample();
      if (!month || !sample.almanac.some((d) => d.date.startsWith(`${attr}-`))) {
        this.layout = null;
        this.replaceChildren(this.missingSample(attr));
        return;
      }
      const total = daysInMonth(month.y, month.m);
      /** @param {number} d */
      const dateOf = (d) => `${month.prefix}-${pad2(d)}`;
      if (this.selected === null || !this.selected.startsWith(`${month.prefix}-`)) {
        this.selected = sample.today.startsWith(`${month.prefix}-`) ? sample.today : dateOf(1);
      }
      const selected = this.selected;

      /** @type {(number | null)[][]} weeks of day numbers, null outside the month */
      const weeks = [];
      /** @type {(number | null)[]} */
      let week = Array.from({ length: weekdayOf(month.y, month.m, 1) }, () => null);
      for (let d = 1; d <= total; d += 1) {
        week.push(d);
        if (week.length === 7) { weeks.push(week); week = []; }
      }
      if (week.length > 0) {
        while (week.length < 7) week.push(null);
        weeks.push(week);
      }

      const monthYear = window.MockI18n.formatDate(dateOf(1), 'month-year');
      const headerRow = () => this.el('tr', null, ...HEADER_WEEK.map((date, i) =>
        this.el('th', { scope: 'col', 'data-weekday': WEEKDAYS[i] }, window.MockI18n.formatDate(date, 'weekday'))));

      // PC: full cells in a 7-column table.
      const fullBody = this.el('tbody');
      for (const days of weeks) {
        const row = this.el('tr');
        for (const d of days) {
          if (d === null) { row.append(this.el('td', { class: 'mk-calendar__blank' })); continue; }
          const date = dateOf(d);
          /** @type {Record<string, string>} */
          const tdAttrs = {};
          if (date === sample.today) tdAttrs['aria-current'] = 'date';
          row.append(this.el('td', tdAttrs, dayCellElement(date, false)));
        }
        fullBody.append(row);
      }
      const full = this.el('table', { class: 'mk-calendar__grid', 'data-layout': 'full' },
        this.el('caption', null, monthYear),
        this.el('thead', null, headerRow()),
        fullBody);

      // Phone: compact grid + summary of the selected day.
      const compactBody = this.el('tbody');
      for (const days of weeks) {
        const row = this.el('tr');
        for (const d of days) {
          if (d === null) { row.append(this.el('td', { class: 'mk-calendar__blank' })); continue; }
          const date = dateOf(d);
          const isSelected = date === selected;
          /** @type {Record<string, string>} */
          const tdAttrs = { 'aria-selected': String(isSelected) };
          if (date === sample.today) tdAttrs['aria-current'] = 'date';
          const button = this.el('button', {
            type: 'button',
            class: 'mk-calendar__day',
            tabindex: isSelected ? '0' : '-1',
            'data-date': date,
            'data-mk-focus': `day-${date}`,
          }, dayCellElement(date, true));
          button.addEventListener('click', () => this.select(date, true));
          row.append(this.el('td', tdAttrs, button));
        }
        compactBody.append(row);
      }
      const compactGrid = this.el('table', {
        class: 'mk-calendar__grid mk-calendar__grid--compact',
        role: 'grid',
        'aria-label': this.t('calendar.grid-label', { month: monthYear }),
      }, this.el('thead', null, headerRow()), compactBody);
      compactGrid.addEventListener('keydown', (event) => {
        const target = event.target instanceof HTMLElement ? event.target.closest('button[data-date]') : null;
        const current = target ? parseIsoDate(target.getAttribute('data-date') ?? '') : null;
        if (!current) return;
        let next = current.d;
        const offset = KEY_OFFSETS[event.key];
        if (offset !== undefined) next += offset;
        else if (event.key === 'Home') next -= weekdayOf(current.y, current.m, current.d);
        else if (event.key === 'End') next += 6 - weekdayOf(current.y, current.m, current.d);
        else return;
        event.preventDefault();
        next = Math.min(Math.max(next, 1), total);
        if (next !== current.d) this.select(dateOf(next), true);
      });

      const layout = this.ensureLayout();
      layout.root.firstElementChild?.replaceWith(full);
      const [gridSlot, legendSlot] = Array.from(layout.compact.children);
      gridSlot?.replaceWith(compactGrid);
      legendSlot?.replaceWith(this.legend());
      layout.summary.setAttribute('aria-label', this.t('calendar.summary-label'));
      layout.summary.replaceChildren(
        this.el('h3', { class: 'mk-calendar__summary-title' }, window.MockI18n.formatDate(selected, 'date-long')),
        dayCellElement(selected, false),
        this.el('a', { class: 'mk-calendar__detail-link', href: dayDetailHref(selected, state) }, this.t('calendar.open-day-detail')));
    }
  }

  /** Text of a day's holiday with the provisional label as its own element. @param {Holiday} holiday @param {MockElementContract} host */
  const holidayNodes = (holiday, host) => {
    /** @type {(Node | string)[]} */
    const nodes = [host.el('span', { class: 'mk-almanac-summary__holiday' }, host.t(holiday.key))];
    if (holiday.provisional) {
      nodes.push(' ', host.el('span', { class: 'mk-almanac-summary__provisional' }, host.t('holiday.provisional')));
    }
    return nodes;
  };

  /** @typedef {'rokuyo' | 'lunar' | 'moon' | 'sekki' | 'kou' | 'zassetsu' | 'holiday' | 'events'} SummaryItem */

  class AlmanacSummary extends MockElement {
    static observedAttributes = ['date', 'variant'];

    /** @param {MockStateSnapshot} state */
    render(state) {
      const date = this.getAttribute('date') ?? '';
      const day = parseIsoDate(date) ? findDay(date) : undefined;
      if (!day) {
        this.replaceChildren(this.missingSample(date));
        return;
      }
      const brief = this.getAttribute('variant') === 'brief';
      const none = () => this.el('span', { class: 'mk-almanac-summary__none' }, this.t('almanac.none'));
      const list = this.el('dl', { class: 'mk-almanac-summary__items' });
      /** @param {SummaryItem} item @param {MessageKey} labelKey @param {readonly (Node | string)[]} value @param {Record<string, string>} [extra] */
      const add = (item, labelKey, value, extra) => {
        list.append(this.el('div', { class: 'mk-almanac-summary__item', 'data-item': item, ...extra },
          this.el('dt', null, this.t(labelKey)),
          this.el('dd', null, ...value)));
      };

      add('rokuyo', 'rokuyo.label', [this.t(day.rokuyoKey)], { 'data-rokuyo': rokuyoId(day) });
      add('lunar', 'lunar-month.label', [lunarText(day)], day.lunar.leap ? { 'data-leap': '' } : {});
      /** @type {(Node | string)[]} */
      const moon = [];
      if (day.moonPhaseKey) {
        moon.push(this.el('span', { class: 'mk-day-cell__phase', 'aria-hidden': 'true' }, PHASE_SYMBOLS[day.moonPhaseKey] ?? '◌'),
          ' ', this.t(day.moonPhaseKey), state.lang === 'ja' ? '・' : ', ');
      }
      moon.push(moonAgeText(day));
      add('moon', 'almanac.moon', moon);

      if (brief) {
        // Top page: the summary only; sekki and holiday when the day has them.
        if (day.sekkiKey) add('sekki', 'sekki.label', [this.t(day.sekkiKey)]);
        if (day.holiday) add('holiday', 'almanac.holiday', holidayNodes(day.holiday, this));
      } else {
        // Day detail: every item, "none" as text when the day has no value.
        add('sekki', 'sekki.label', [day.sekkiKey ? this.t(day.sekkiKey) : none()]);
        add('kou', 'kou.label', [day.kouKey ? this.t(day.kouKey) : none()]);
        add('zassetsu', 'zassetsu.label', day.zassetsuKeys.length > 0
          ? [day.zassetsuKeys.map((key) => this.t(key)).join(state.lang === 'ja' ? '、' : ', ')]
          : [none()]);
        add('holiday', 'almanac.holiday', day.holiday ? holidayNodes(day.holiday, this) : [none()]);
        const events = day.eventIds
          .map((id) => this.sample().events.find((e) => e.id === id))
          .filter(/** @returns {e is AstroEvent} */ (e) => e !== undefined);
        if (events.length > 0) {
          const ul = this.el('ul', { class: 'mk-almanac-summary__events' });
          for (const event of events) {
            ul.append(this.el('li', { 'data-tone': eventTone(event) },
              this.el('time', { datetime: event.at }, window.MockI18n.formatDate(event.at, 'time')),
              ' ', eventTitle(event)));
          }
          add('events', 'almanac.events', [ul]);
        } else {
          add('events', 'almanac.events', [none()]);
        }
      }

      this.replaceChildren(this.el('div', { class: 'mk-almanac-summary', 'data-variant': brief ? 'brief' : 'full' },
        this.el('p', { class: 'mk-almanac-summary__date' },
          this.el('time', { datetime: day.date }, window.MockI18n.formatDate(day.date, 'date-long'))),
        brief ? this.el('div', { class: 'mk-almanac-summary__body' }, this.moonFigure(day), list) : list));
    }

    /**
     * Moon figure of the day (brief variant). Non-focusable wrapper with data-figure.
     * @param {AlmanacDay} day
     */
    moonFigure(day) {
      const { waxing, illumination, terminatorRx } = moonShape(day.moonAge);
      const { view, c, r } = MOON;
      const top = `${fmt(c)} ${fmt(c - r)}`;
      const bottom = `${fmt(c)} ${fmt(c + r)}`;
      const crescent = illumination < 0.5;
      // Limb from the top to the bottom on the lit side, then the terminator ellipse back up.
      const limbSweep = waxing ? 1 : 0;
      const terminatorSweep = waxing === crescent ? 0 : 1;
      const d = `M ${top} A ${fmt(r)} ${fmt(r)} 0 0 ${limbSweep} ${bottom} `
        + `A ${fmt(r * terminatorRx)} ${fmt(r)} 0 0 ${terminatorSweep} ${top} Z`;
      const percent = Math.round(illumination * 100);
      const drawing = svg('svg', {
        class: 'mk-moon__svg',
        viewBox: `0 0 ${view} ${view}`,
        role: 'img',
        'aria-label': this.t(waxing ? 'almanac.moon-figure.waxing' : 'almanac.moon-figure.waning',
          { age: day.moonAge.toFixed(1), percent }),
      },
      svg('circle', { class: 'mk-moon__disc', cx: fmt(c), cy: fmt(c), r: fmt(r) }),
      svg('path', { class: 'mk-moon__lit', d }));
      return this.el('div', {
        class: 'mk-moon-figure', 'data-figure': '',
        'data-waxing': String(waxing), 'data-illumination': String(percent),
      }, drawing);
    }
  }

  /** @typedef {'sunrise' | 'sunset' | 'moonrise' | 'moonset'} RiseSetItem */
  /** @type {readonly { item: RiseSetItem, labelKey: MessageKey }[]} */
  const RISE_SET_ITEMS = [
    { item: 'sunrise', labelKey: 'astro.riseset.sunrise' },
    { item: 'sunset', labelKey: 'astro.riseset.sunset' },
    { item: 'moonrise', labelKey: 'astro.riseset.moonrise' },
    { item: 'moonset', labelKey: 'astro.riseset.moonset' },
  ];

  const MINUTES_PER_DAY = 24 * 60;

  /** Minutes after JST midnight of an IsoDateTime (offsets other than +09:00 are not used). @param {IsoDateTime} at */
  const minutesOf = (at) => {
    const match = /T(\d{2}):(\d{2})/.exec(at);
    return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
  };

  /**
   * Intervals (minutes) of the day when a body is above the horizon. A missing rise means the body
   * was already up at midnight; a missing set means it stays up until midnight. Neither -> none.
   * @param {IsoDateTime | undefined} rise
   * @param {IsoDateTime | undefined} set
   * @returns {[number, number][]}
   */
  const upIntervals = (rise, set) => {
    if (rise !== undefined && set !== undefined) {
      const from = minutesOf(rise);
      const to = minutesOf(set);
      return from < to ? [[from, to]] : [[0, to], [from, MINUTES_PER_DAY]];
    }
    if (rise !== undefined) return [[minutesOf(rise), MINUTES_PER_DAY]];
    if (set !== undefined) return [[0, minutesOf(set)]];
    return [];
  };

  /** Rise / set chart geometry (viewBox units): label column, 24h track, two rows, hour ticks. */
  const CHART = {
    width: 300, height: 74, labelEnd: 38, trackX: 44, trackW: 248,
    rows: { sun: 8, moon: 30 }, rowH: 14, trackY: 4, trackH: 44, tickY: 66, fontSize: 10,
  };

  class RiseSetTimes extends MockElement {
    static observedAttributes = ['date', 'post-id', 'chart'];

    /**
     * 0-24h chart of when the sun and the moon are up. Non-focusable wrapper with data-figure.
     * @param {RiseSet} riseSet
     * @param {MockStateSnapshot} state
     */
    chart(riseSet, state) {
      const { width, height, labelEnd, trackX, trackW, rows, rowH, trackY, trackH, tickY, fontSize } = CHART;
      const xOf = (/** @type {number} */ minutes) => trackX + (trackW * minutes) / MINUTES_PER_DAY;
      const track = svg('rect', {
        class: 'mk-rise-set-chart__track', x: fmt(trackX), y: fmt(trackY), width: fmt(trackW), height: fmt(trackH),
      });
      const ticks = svg('g', { class: 'mk-rise-set-chart__ticks' });
      for (const hour of [0, 6, 12, 18, 24]) {
        const x = xOf(hour * 60);
        if (hour > 0 && hour < 24) {
          ticks.append(svg('line', {
            class: 'mk-rise-set-chart__tick', x1: fmt(x), x2: fmt(x), y1: fmt(trackY), y2: fmt(trackY + trackH),
          }));
        }
        ticks.append(svg('text', {
          class: 'mk-rise-set-chart__hour', x: fmt(x), y: fmt(tickY), 'text-anchor': 'middle', 'font-size': String(fontSize),
        }, String(hour)));
      }
      const spans = svg('g', { class: 'mk-rise-set-chart__spans' });
      const labels = svg('g', { class: 'mk-rise-set-chart__labels' });
      /** @type {readonly { body: 'sun' | 'moon', rise: IsoDateTime | undefined, set: IsoDateTime | undefined }[]} */
      const bodies = [
        { body: 'sun', rise: riseSet.sunrise, set: riseSet.sunset },
        { body: 'moon', rise: riseSet.moonrise, set: riseSet.moonset },
      ];
      for (const { body, rise, set } of bodies) {
        const y = rows[body];
        labels.append(svg('text', {
          class: 'mk-rise-set-chart__label', x: fmt(labelEnd), y: fmt(y + rowH / 2 + fontSize * 0.35),
          'text-anchor': 'end', 'font-size': String(fontSize),
        }, this.t(`astro.body.${body}`)));
        for (const [from, to] of upIntervals(rise, set)) {
          spans.append(svg('rect', {
            class: 'mk-rise-set-chart__span', 'data-body': body, 'data-from': String(from), 'data-to': String(to),
            x: fmt(xOf(from)), y: fmt(y), width: fmt(xOf(to) - xOf(from)), height: fmt(rowH),
          }));
        }
      }
      const items = RISE_SET_ITEMS.map(({ item, labelKey }) => {
        const at = riseSet[item];
        return `${this.t(labelKey)} ${at === undefined ? this.t('almanac.riseset-none') : window.MockI18n.formatDate(at, 'time')}`;
      }).join(state.lang === 'ja' ? '、' : ', ');
      const drawing = svg('svg', {
        class: 'mk-rise-set-chart__svg',
        viewBox: `0 0 ${width} ${height}`,
        role: 'img',
        'aria-label': this.t('almanac.riseset-chart.describe', { items }),
      }, track, ticks, spans, labels);
      return this.el('div', { class: 'mk-rise-set-chart', 'data-figure': '' }, drawing);
    }

    /** @param {MockStateSnapshot} state */
    render(state) {
      const postId = this.getAttribute('post-id');
      /** @type {RiseSet} */
      let riseSet;
      if (postId !== null) {
        const post = this.sample().posts.find((p) => p.id === postId);
        if (!post) {
          this.replaceChildren(this.missingSample(postId));
          return;
        }
        // A post without location has no rise/set (7.6): render nothing.
        if (!post.location) {
          this.replaceChildren();
          return;
        }
        riseSet = post.location.riseSet;
      } else {
        const date = this.getAttribute('date') ?? '';
        const day = parseIsoDate(date) ? findDay(date) : undefined;
        if (!day) {
          this.replaceChildren(this.missingSample(date));
          return;
        }
        riseSet = day.riseSet;
      }
      const list = this.el('dl', { class: 'mk-rise-set' });
      for (const { item, labelKey } of RISE_SET_ITEMS) {
        const at = riseSet[item];
        /** @type {Record<string, string>} */
        const attrs = { class: 'mk-rise-set__item', 'data-item': item, 'data-body': item.startsWith('sun') ? 'sun' : 'moon' };
        if (at === undefined) attrs['data-none'] = '';
        list.append(this.el('div', attrs,
          this.el('dt', null, this.t(labelKey)),
          this.el('dd', null, at === undefined
            ? this.t('almanac.riseset-none')
            : this.el('time', { datetime: at }, window.MockI18n.formatDate(at, 'time')))));
      }
      if (this.hasAttribute('chart')) this.replaceChildren(this.chart(riseSet, state), list);
      else this.replaceChildren(list);
    }
  }

  /** Every AstroEventKind in display order, with its dictionary key. */
  /** @type {readonly { kind: AstroEventKind, labelKey: MessageKey }[]} */
  const EVENT_KINDS = [
    { kind: 'moon-phase', labelKey: 'astro.kind.moon-phase' },
    { kind: 'moon-apsis', labelKey: 'astro.kind.moon-apsis' },
    { kind: 'moon-declination', labelKey: 'astro.kind.moon-declination' },
    { kind: 'planet-conjunction', labelKey: 'astro.kind.planet-conjunction' },
    { kind: 'planet-opposition', labelKey: 'astro.kind.planet-opposition' },
    { kind: 'planet-elongation', labelKey: 'astro.kind.planet-elongation' },
    { kind: 'close-approach', labelKey: 'astro.kind.close-approach' },
  ];

  /** @param {AstroEventKind} kind @returns {MessageKey} */
  const kindKey = (kind) => EVENT_KINDS.find((k) => k.kind === kind)?.labelKey ?? `astro.kind.${kind}`;

  /** JST date of an event. @param {AstroEvent} event @returns {IsoDate} */
  const eventDate = (event) => event.at.slice(0, 10);

  /**
   * @typedef {object} EventFilter
   * @property {IsoDate} from  '' means no lower bound
   * @property {IsoDate} to    '' means no upper bound
   * @property {Set<AstroEventKind>} kinds
   */

  class EventList extends MockElement {
    static observedAttributes = ['from', 'to', 'kinds', 'filters'];

    constructor() {
      super();
      /** Whether the collapsed filters (filters="collapsed") are open; kept across re-renders. */
      this.filtersOpen = false;
      /** Filter state; the attributes are its initial values (reset when they change). @type {EventFilter | null} */
      this.filter = null;
      /** @type {string} */
      this.filterSource = '';
      /** @type {{ results: HTMLElement, count: HTMLElement } | null} */
      this.parts = null;
    }

    /** Event dates covered by the sample (min / max of the date inputs). */
    bounds() {
      const dates = this.sample().events.map(eventDate).sort();
      return { min: dates[0] ?? '', max: dates[dates.length - 1] ?? '' };
    }

    /** @returns {EventFilter} */
    currentFilter() {
      const from = this.getAttribute('from') ?? '';
      const to = this.getAttribute('to') ?? '';
      const kindsAttr = this.getAttribute('kinds');
      const source = `${from}|${to}|${kindsAttr ?? ''}`;
      if (this.filter === null || this.filterSource !== source) {
        const { min, max } = this.bounds();
        const requested = kindsAttr === null ? [] : kindsAttr.split(/\s+/).filter((k) => k !== '');
        const kinds = EVENT_KINDS.map((k) => k.kind).filter((k) => requested.length === 0 || requested.includes(k));
        this.filter = { from: from || min, to: to || max, kinds: new Set(kinds) };
        this.filterSource = source;
      }
      return this.filter;
    }

    /** @param {MockStateSnapshot} state */
    render(state) {
      const filter = this.currentFilter();
      const { min, max } = this.bounds();

      /** @param {'from' | 'to'} which @param {MessageKey} labelKey */
      const dateField = (which, labelKey) => {
        const input = this.el('input', { type: 'date', min, max, 'data-mk-focus': which });
        input.value = filter[which];
        const onChange = () => {
          filter[which] = input.value;
          this.updateResults(window.MockState.get());
        };
        input.addEventListener('input', onChange);
        input.addEventListener('change', onChange);
        return this.el('label', { class: 'field mk-event-list__date' }, this.el('span', null, this.t(labelKey)), input);
      };

      const kindList = this.el('div', { class: 'mk-event-list__kind-options' });
      for (const { kind, labelKey } of EVENT_KINDS) {
        const box = this.el('input', { type: 'checkbox', value: kind, 'data-mk-focus': `kind-${kind}` });
        box.checked = filter.kinds.has(kind);
        box.addEventListener('change', () => {
          if (box.checked) filter.kinds.add(kind);
          else filter.kinds.delete(kind);
          this.updateResults(window.MockState.get());
        });
        kindList.append(this.el('label', { class: 'mk-event-list__kind-option' }, box, this.el('span', null, this.t(labelKey))));
      }

      const filters = this.el('div', { class: 'mk-event-list__filters' },
        this.el('fieldset', { class: 'mk-event-list__period' },
          this.el('legend', null, this.t('event-list.period')),
          this.el('div', { class: 'mk-event-list__dates' },
            dateField('from', 'event-list.from'), dateField('to', 'event-list.to'))),
        this.el('fieldset', { class: 'mk-event-list__kinds' },
          this.el('legend', null, this.t('event-list.kinds')), kindList));

      /** @type {HTMLElement} */
      let controls = filters;
      if (this.getAttribute('filters') === 'collapsed') {
        // Top page: the filters stay out of the way in a closed accordion (task 8.1).
        const details = this.el('details', { class: 'mk-event-list__filter-toggle' },
          this.el('summary', { class: 'mk-event-list__filter-summary', 'data-mk-focus': 'filters-toggle' },
            this.t('event-list.filters')),
          filters);
        details.open = this.filtersOpen;
        details.addEventListener('toggle', () => { this.filtersOpen = details.open; });
        controls = details;
      }

      const count = this.el('p', { class: 'mk-event-list__count', role: 'status' });
      const results = this.el('div', { class: 'mk-event-list__results' });
      this.parts = { results, count };
      this.replaceChildren(this.el('div', { class: 'mk-event-list' }, controls, count, results));
      this.updateResults(state);
    }

    /** Re-renders only the results and the count, so the filter controls keep focus. @param {MockStateSnapshot} state */
    updateResults(state) {
      if (this.parts === null || this.filter === null) return;
      const { results, count } = this.parts;
      if (state.scenario === 'fetch-error') {
        count.textContent = '';
        results.replaceChildren(this.el('p', { class: 'mk-event-list__error', role: 'alert' }, this.t('error.fetch')));
        return;
      }
      const filter = this.filter;
      const source = state.scenario === 'empty' ? [] : this.sample().events;
      const shown = source
        .filter((e) => filter.kinds.has(e.kind)
          && (filter.from === '' || eventDate(e) >= filter.from)
          && (filter.to === '' || eventDate(e) <= filter.to))
        .slice()
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      count.textContent = shown.length === 1
        ? this.t('event-list.result-count-one')
        : this.t('event-list.result-count', { count: shown.length });
      if (shown.length === 0) {
        results.replaceChildren(this.el('p', { class: 'mk-event-list__empty' }, this.t('empty.events')));
        return;
      }
      const list = this.el('ol', { class: 'mk-event-list__items' });
      for (const event of shown) {
        list.append(this.el('li', { class: 'mk-event', 'data-kind': event.kind, 'data-tone': eventTone(event), 'data-event-id': event.id },
          this.el('time', { class: 'mk-event__at', datetime: event.at }, window.MockI18n.formatDate(event.at, 'datetime')),
          this.el('span', { class: 'mk-event__kind' }, this.t(kindKey(event.kind))),
          this.el('span', { class: 'mk-event__title' }, eventTitle(event))));
      }
      results.replaceChildren(list);
    }
  }

  customElements.define('mk-day-cell', DayCell);
  customElements.define('mk-month-calendar', MonthCalendar);
  customElements.define('mk-almanac-summary', AlmanacSummary);
  customElements.define('mk-rise-set', RiseSetTimes);
  customElements.define('mk-event-list', EventList);
})();
