// Almanac components: mk-month-calendar, mk-day-cell, mk-almanac-summary, mk-rise-set, mk-event-list
// (design: Parts > プレゼンテーション部品; attributes *Attrs in types.d.ts).
// Task 4.2 implements mk-month-calendar and mk-day-cell; the others come with task 4.3.
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

  customElements.define('mk-day-cell', DayCell);
  customElements.define('mk-month-calendar', MonthCalendar);
})();
