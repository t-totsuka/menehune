// Shell components: mk-site-header, mk-site-footer, mk-guest-notice, mk-status-badge,
// mk-admin-band, mk-pager (design: Parts > プレゼンテーション部品; attributes *Attrs in types.d.ts).
//
// - mk-site-header (3.2, 9.4, 11.2): logo, main nav (calendar, astro events, star chart, my
//   posts; plus admin for the admin viewer), language switch, theme switch (system / light /
//   dark; through MockState.update, so a manual theme wins over the OS appearance), login state
//   (guest: login link; member / admin: display name of SampleDataSet.viewerIds[auth]).
//   `current` marks the current nav item; without it the item is inferred from the screen id.
//   Task 8.1 (6.9): while logged in, the bar (next to the logo, so it stays visible when the menu
//   is collapsed) holds a link to the notices of my-posts (my-posts.html#notices, ?auth carried
//   over like the nav links) with the number of the viewer's unread ReplyNotice as text
//   (notice.header-unread, "お知らせ（未読 2 件）"; not colour alone). With 0 unread it reads
//   notice.label ("お知らせ") without a count, so the read notices stay one click away. The count
//   does not follow the scenario (it is the same on every screen). Guests get no link.
//   Below 600px the menu collapses behind a toggle button (aria-expanded / aria-controls);
//   Escape closes it. Task 8.3: a decorative starfield (svg.mk-starfield, data-decor,
//   aria-hidden) is drawn behind the bar on the hi-fi stage.
//   Post-validation cleanup (13.5): the header starts with a skip link to the page's <main>
//   (a.mk-skip-link, nav.skip-to-content). It is the first Tab stop of every screen, hidden until
//   focused (components.css), and focuses <main> without changing the URL.
// - mk-site-footer: links to the attribution and privacy pages.
// - mk-guest-notice (6.5, 6.8): variant read-only (default) / private-post, with a login link.
//   Showing it only to guests is the page's job ([data-when-auth="guest"]). With the boolean
//   `band` attribute (task 8.1) it renders the full-width band that every screen but login places
//   right after mk-site-header: a region named by guest-notice.band-label.
// - mk-status-badge (6.6, 13.3): PostStatus as color + symbol + text.
// - mk-admin-band (3.6): band that marks a screen as admin-only.
// - mk-pager (task 8.1, my-posts paging; opt-in, used where a list is long): `total`, `page`
//   (1-based, clamped), `page-size` (default 30, provisional) and `label-key` (the nav's name).
//   A <nav> with the range as text ("31〜60件目 / 全75件", [data-pager-range]) and a list of buttons:
//   previous / next (disabled, so not focusable, on the first / last page) and one per page
//   ([data-pager-page], accessible name "n ページ目"; the current one has aria-current="page").
//   A button sets `page` and fires a bubbling CustomEvent<{ page: number }>('mk-page-change'); the
//   owner shows that page and moves focus (my-posts focuses the list's heading). With total <=
//   page-size it renders nothing. The pure logic is window.MockPaging (assets/js/paging.js, a
//   foundation script without the DOM).
//
// Links come from MockElement#screenHref (base.js): mockups/screens/*.html, with a logged-in auth
// state carried over when the target screen allows it.
//
// Preconditions: paging.js (window.MockPaging) and base.js (window.MockElement) are loaded first.
(function () {
  /** id given to a <main> without one, so the skip link can name it */
  const MAIN_ID = 'main-content';

  /** @typedef {NonNullable<SiteHeaderAttrs['current']>} HeaderItem */
  /** @type {readonly HeaderItem[]} */
  const HEADER_ITEMS = ['calendar', 'astro-events', 'star-chart', 'my-posts', 'settings', 'admin'];
  /** @type {Readonly<Partial<Record<ScreenId, HeaderItem>>>} */
  const CURRENT_BY_SCREEN = {
    'calendar-month': 'calendar',
    'day-detail': 'calendar',
    'astro-events': 'astro-events',
    'star-chart': 'star-chart',
    'my-posts': 'my-posts',
    'settings': 'settings',
    'admin': 'admin',
  };

  /**
   * @typedef {object} NavItem
   * @property {HeaderItem} item
   * @property {ScreenId} screen
   * @property {MessageKey} labelKey
   */
  /** @type {readonly NavItem[]} */
  const NAV_ITEMS = [
    { item: 'calendar', screen: 'calendar-month', labelKey: 'nav.calendar' },
    { item: 'astro-events', screen: 'astro-events', labelKey: 'nav.astro-events' },
    { item: 'star-chart', screen: 'star-chart', labelKey: 'nav.star-chart' },
    { item: 'my-posts', screen: 'my-posts', labelKey: 'nav.my-posts' },
  ];
  /** @type {NavItem} */
  const ADMIN_ITEM = { item: 'admin', screen: 'admin', labelKey: 'nav.admin' };

  /** @type {readonly { value: LocaleId, labelKey: MessageKey }[]} */
  const LANG_OPTIONS = [
    { value: 'ja', labelKey: 'toggle.lang.ja' },
    { value: 'en', labelKey: 'toggle.lang.en' },
  ];
  /** @type {readonly { value: ThemePreference, labelKey: MessageKey }[]} */
  const THEME_OPTIONS = [
    { value: 'system', labelKey: 'toggle.theme.system' },
    { value: 'light', labelKey: 'toggle.theme.light' },
    { value: 'dark', labelKey: 'toggle.theme.dark' },
  ];

  /** @type {Readonly<Record<PostStatus, { symbol: string, labelKey: MessageKey }>>} */
  const STATUS_BADGES = {
    'public': { symbol: '●', labelKey: 'post.status.public' },
    'members-only': { symbol: '◆', labelKey: 'post.status.members-only' },
    'hidden': { symbol: '▲', labelKey: 'post.status.hidden' },
    'deleted': { symbol: '×', labelKey: 'post.status.deleted' },
  };

  /**
   * @template {string} T
   * @param {readonly T[]} list
   * @param {unknown} value
   * @returns {value is T}
   */
  const isOneOf = (list, value) => typeof value === 'string' && list.some((v) => v === value);

  /** @type {readonly LocaleId[]} */
  const LANGS = ['ja', 'en'];
  /** @type {readonly ThemePreference[]} */
  const THEMES = ['system', 'light', 'dark'];
  /** @type {readonly PostStatus[]} */
  const STATUSES = ['public', 'members-only', 'hidden', 'deleted'];

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /**
   * Stars of the header starfield (task 8.3): [x %, y %, size, shape]. They keep to the top and
   * bottom edges (the padding of the bar), so they rarely sit behind a word. 'dot' is a circle of
   * radius size; 'spark' is a four-pointed star reaching size * 3 from its centre.
   * @type {readonly [number, number, number, 'dot' | 'spark'][]}
   */
  const HEADER_STARS = [
    [3, 16, 1, 'dot'], [9, 84, 0.8, 'dot'], [16, 12, 1, 'spark'], [24, 88, 1.1, 'dot'],
    [31, 14, 0.8, 'dot'], [38, 86, 0.9, 'spark'], [46, 10, 1.2, 'dot'], [53, 90, 0.8, 'dot'],
    [61, 15, 1, 'spark'], [68, 85, 1, 'dot'], [75, 11, 0.9, 'dot'], [82, 88, 1, 'spark'],
    [89, 14, 1.1, 'dot'], [96, 84, 0.8, 'dot'],
  ];

  /**
   * Decorative starfield behind the header (task 8.3): an absolutely positioned inline SVG marked
   * as decoration (hidden on the wireframe stage, note 1.7) and hidden from assistive technology.
   * Positions are percentages, so the stars keep their shape at every width.
   * @param {readonly [number, number, number, 'dot' | 'spark'][]} stars
   * @returns {SVGSVGElement}
   */
  const starfield = (stars) => {
    /** @param {string} tag @param {Record<string, string>} attrs @returns {SVGElement} */
    const node = (tag, attrs) => {
      const n = /** @type {SVGElement} */ (document.createElementNS(SVG_NS, tag));
      for (const [name, value] of Object.entries(attrs)) n.setAttribute(name, value);
      return n;
    };
    const root = /** @type {SVGSVGElement} */ (node('svg', {
      class: 'mk-starfield', 'data-decor': '', 'aria-hidden': 'true', focusable: 'false',
    }));
    for (const [x, y, size, shape] of stars) {
      if (shape === 'dot') {
        root.append(node('circle', { class: 'mk-starfield__star', cx: `${x}%`, cy: `${y}%`, r: String(size) }));
        continue;
      }
      const a = size * 3;
      const b = Math.round(size * 70) / 100;
      const at = node('svg', { x: `${x}%`, y: `${y}%`, overflow: 'visible' });
      at.append(node('path', {
        class: 'mk-starfield__star',
        d: `M0 -${a} L${b} -${b} L${a} 0 L${b} ${b} L0 ${a} L-${b} ${b} L-${a} 0 L-${b} -${b} Z`,
      }));
      root.append(at);
    }
    return root;
  };

  if (typeof window.MockElement !== 'function') {
    console.error('[shell.js] window.MockElement is missing; load components/base.js first');
    return;
  }
  const MockElement = window.MockElement;
  let headerCount = 0;

  class SiteHeader extends MockElement {
    static observedAttributes = ['current'];

    constructor() {
      super();
      headerCount += 1;
      this.menuId = `mk-header-menu-${headerCount}`;
      this.menuOpen = false;
      this.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !this.menuOpen) return;
        this.menuOpen = false;
        this.refresh(window.MockState.get());
        const toggle = this.querySelector('[data-mk-focus="menu-toggle"]');
        if (toggle instanceof HTMLElement) toggle.focus();
      });
    }

    /** @param {MockStateSnapshot} state @returns {HeaderItem | undefined} */
    currentItem(state) {
      const attr = this.getAttribute('current');
      if (attr !== null) {
        if (isOneOf(HEADER_ITEMS, attr)) return attr;
        console.warn(`[mk-site-header] unknown current="${attr}"`);
        return undefined;
      }
      return state.screenId === undefined ? undefined : CURRENT_BY_SCREEN[state.screenId];
    }

    /**
     * @param {string} name
     * @param {MessageKey} labelKey
     * @param {readonly { value: string, labelKey: MessageKey }[]} options
     * @param {string} selected
     * @param {(value: string) => void} choose
     */
    switchGroup(name, labelKey, options, selected, choose) {
      const label = this.t(labelKey);
      const group = this.el('div', { class: 'mk-switch', role: 'group', 'aria-label': label },
        this.el('span', { class: 'mk-switch__label', 'aria-hidden': 'true' }, label));
      for (const option of options) {
        /** @type {Record<string, string>} */
        const attrs = {
          type: 'button',
          'aria-pressed': String(option.value === selected),
          'data-mk-focus': `${name}-${option.value}`,
        };
        if (name === 'lang') attrs['lang'] = option.value;
        const button = this.el('button', attrs, this.t(option.labelKey));
        button.addEventListener('click', () => choose(option.value));
        group.append(button);
      }
      return group;
    }

    /** @param {MockStateSnapshot} state */
    account(state) {
      const box = this.el('div', { class: 'mk-header__account' });
      if (state.auth === 'guest') {
        box.append(this.el('a', { href: this.screenHref('login', state) }, this.t('nav.login')));
        return box;
      }
      const sample = this.sample();
      const userId = sample.viewerIds[state.auth];
      const user = sample.users.find((u) => u.id === userId);
      box.append(user
        ? this.el('span', { class: 'mk-header__user' }, this.t('header.signed-in-as', { name: user.displayName }))
        : this.missingSample(userId));
      const current = this.currentItem(state);
      /** @type {Record<string, string>} */
      const attrs = { href: this.screenHref('settings', state) };
      if (current === 'settings') attrs['aria-current'] = 'page';
      box.append(this.el('a', attrs, this.t('nav.settings')));
      return box;
    }

    /**
     * Link to the notices of my-posts with the unread count (6.9); undefined for guests.
     * @param {MockStateSnapshot} state
     * @returns {HTMLAnchorElement | undefined}
     */
    notices(state) {
      if (state.auth === 'guest') return undefined;
      const sample = this.sample();
      const viewer = sample.viewerIds[state.auth];
      const unread = sample.notices.filter((n) => n.recipientId === viewer && !n.read).length;
      return this.el('a', {
        class: 'mk-header__notices',
        href: this.screenHref('my-posts', state, {}, '#notices'),
        'data-header-notices': '',
        'data-unread': String(unread),
      }, unread > 0 ? this.t('notice.header-unread', { count: unread }) : this.t('notice.label'));
    }

    /**
     * The skip link to the page's <main> (the first Tab stop; hidden until focused). <main> gets
     * id="main-content" when it has no id. Activating it focuses <main> (tabindex="-1") without
     * changing the URL. Without a <main> it still renders but does nothing.
     * @returns {HTMLAnchorElement}
     */
    skipLink() {
      const main = document.querySelector('main');
      if (main && !main.id) main.id = MAIN_ID;
      const link = this.el('a', {
        class: 'mk-skip-link',
        href: `#${main ? main.id : MAIN_ID}`,
        'data-mk-focus': 'skip-link',
      }, this.t('nav.skip-to-content'));
      link.addEventListener('click', (event) => {
        const target = document.querySelector('main');
        if (!target) return;
        event.preventDefault();
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus();
      });
      return link;
    }

    /** @param {MockStateSnapshot} state */
    render(state) {
      const current = this.currentItem(state);
      const items = state.auth === 'admin' ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;
      const list = this.el('ul');
      for (const { item, screen, labelKey } of items) {
        /** @type {Record<string, string>} */
        const attrs = { href: this.screenHref(screen, state) };
        if (item === current) attrs['aria-current'] = 'page';
        list.append(this.el('li', null, this.el('a', attrs, this.t(labelKey))));
      }

      const toggle = this.el('button', {
        type: 'button',
        class: 'mk-header__toggle',
        'aria-expanded': String(this.menuOpen),
        'aria-controls': this.menuId,
        'data-variant': 'secondary',
        'data-mk-focus': 'menu-toggle',
      }, this.el('span', { 'aria-hidden': 'true', 'data-decor': '' }, '☰'), this.t('header.menu'));
      toggle.addEventListener('click', () => {
        this.menuOpen = !this.menuOpen;
        this.refresh(window.MockState.get());
      });

      /** @type {Record<string, string>} */
      const menuAttrs = { class: 'mk-header__menu', id: this.menuId };
      if (this.menuOpen) menuAttrs['data-open'] = '';
      const menu = this.el('div', menuAttrs,
        this.el('nav', { class: 'mk-header__nav', 'aria-label': this.t('nav.main') }, list),
        this.el('div', { class: 'mk-header__tools' },
          this.switchGroup('lang', 'toggle.lang.label', LANG_OPTIONS, state.lang, (value) => {
            if (isOneOf(LANGS, value)) window.MockState.update({ lang: value });
          }),
          this.switchGroup('theme', 'toggle.theme.label', THEME_OPTIONS, state.theme, (value) => {
            if (isOneOf(THEMES, value)) window.MockState.update({ theme: value });
          }),
          this.account(state)));

      const logo = this.el('a', { class: 'mk-header__logo', href: this.screenHref('top', state) },
        this.el('span', { class: 'mk-header__logo-mark', 'aria-hidden': 'true', 'data-decor': '' }, '✦'),
        this.el('span', null, this.t('site.name')));

      this.replaceChildren(this.el('header', { class: 'mk-header' },
        this.skipLink(),
        starfield(HEADER_STARS),
        this.el('div', { class: 'mk-header__inner' },
          this.el('div', { class: 'mk-header__bar' }, ...[logo, this.notices(state), toggle].filter((n) => n !== undefined)),
          menu)));
    }
  }

  class SiteFooter extends MockElement {
    /** @param {MockStateSnapshot} state */
    render(state) {
      this.replaceChildren(this.el('footer', { class: 'mk-footer' },
        this.el('div', { class: 'mk-footer__inner' },
          this.el('nav', { class: 'mk-footer__nav', 'aria-label': this.t('footer.links') },
            this.el('ul', null,
              this.el('li', null, this.el('a', { href: this.screenHref('attribution', state) }, this.t('screen.attribution.title'))),
              this.el('li', null, this.el('a', { href: this.screenHref('privacy', state) }, this.t('screen.privacy.title'))))),
          this.el('p', { class: 'mk-footer__note' }, this.t('footer.note')))));
    }
  }

  /** @type {readonly NonNullable<GuestNoticeAttrs['variant']>[]} */
  const NOTICE_VARIANTS = ['read-only', 'private-post'];

  class GuestNotice extends MockElement {
    static observedAttributes = ['variant', 'band'];

    /** @param {MockStateSnapshot} state */
    render(state) {
      const attr = this.getAttribute('variant');
      /** @type {NonNullable<GuestNoticeAttrs['variant']>} */
      let variant = 'read-only';
      if (isOneOf(NOTICE_VARIANTS, attr)) variant = attr;
      else if (attr !== null) console.warn(`[mk-guest-notice] unknown variant="${attr}"; using read-only`);
      const message = variant === 'private-post' ? this.t('guest-notice.private-post') : this.t('guest-notice.read-only');
      const text = this.el('p', { class: 'mk-guest-notice__text' }, message);
      const login = this.el('a', { class: 'mk-guest-notice__login', href: this.screenHref('login', state) }, this.t('guest-notice.login'));
      if (this.hasAttribute('band')) {
        // Task 8.1: the full-width band below the site header (one per screen, the same on all).
        this.replaceChildren(this.el('section', { class: 'mk-guest-band', 'data-variant': variant, 'aria-label': this.t('guest-notice.band-label') },
          this.el('div', { class: 'mk-guest-band__inner' }, text, login)));
        return;
      }
      this.replaceChildren(this.el('div', { class: 'mk-guest-notice', 'data-variant': variant }, text, login));
    }
  }

  class StatusBadge extends MockElement {
    static observedAttributes = ['status'];

    render() {
      const status = this.getAttribute('status') ?? '';
      if (!isOneOf(STATUSES, status)) {
        this.replaceChildren(this.missingSample(status));
        return;
      }
      const badge = STATUS_BADGES[status];
      this.replaceChildren(this.el('span', { class: 'mk-status-badge', 'data-status': status },
        this.el('span', { class: 'mk-status-badge__symbol', 'data-status-symbol': '', 'aria-hidden': 'true' }, badge.symbol),
        this.el('span', { class: 'mk-status-badge__text' }, this.t(badge.labelKey))));
    }
  }

  class AdminBand extends MockElement {
    render() {
      this.replaceChildren(this.el('div', { class: 'mk-admin-band', role: 'note' },
        this.el('strong', { class: 'mk-admin-band__label' }, this.t('admin-band.label')),
        this.el('span', { class: 'mk-admin-band__description' }, this.t('admin-band.description'))));
    }
  }

  /**
   * A positive integer attribute, or the fallback.
   * @param {Element} el @param {string} name @param {number} fallback @param {number} min
   * @returns {number}
   */
  const intAttr = (el, name, fallback, min) => {
    const n = Number.parseInt(el.getAttribute(name) ?? '', 10);
    return Number.isFinite(n) && n >= min ? n : fallback;
  };

  class Pager extends MockElement {
    static observedAttributes = ['total', 'page', 'page-size', 'label-key'];

    render() {
      const P = window.MockPaging;
      const total = intAttr(this, 'total', 0, 0);
      const size = intAttr(this, 'page-size', P.PAGE_SIZE, 1);
      if (total <= size) {
        this.replaceChildren();
        return;
      }
      const count = P.pageCount(total, size);
      const page = P.clampPage(intAttr(this, 'page', 1, 1), total, size);
      const { from, to } = P.pageRange(total, page, size);
      /** @param {number} target */
      const go = (target) => {
        if (target === page) return;
        this.setAttribute('page', String(target));
        this.dispatchEvent(new CustomEvent('mk-page-change', { bubbles: true, detail: { page: target } }));
      };
      /**
       * @param {'prev' | 'next'} step @param {MessageKey} key @param {string} arrow @param {number} target
       * @returns {HTMLLIElement}
       */
      const stepItem = (step, key, arrow, target) => {
        const arrowEl = this.el('span', { class: 'mk-pager__arrow', 'aria-hidden': 'true' }, arrow);
        const label = this.el('span', null, this.t(key));
        const button = this.el('button', { type: 'button', class: 'mk-pager__step', 'data-pager-step': step, 'data-mk-focus': step },
          ...(step === 'prev' ? [arrowEl, label] : [label, arrowEl]));
        if (target < 1 || target > count) button.disabled = true;
        else button.addEventListener('click', () => go(target));
        return this.el('li', null, button);
      };
      const pages = Array.from({ length: count }, (_, i) => {
        const n = i + 1;
        /** @type {Record<string, string>} */
        const attrs = {
          type: 'button', class: 'mk-pager__page', 'data-pager-page': String(n), 'data-mk-focus': `page-${n}`,
          'aria-label': this.t('pager.page-label', { page: n }),
        };
        if (n === page) attrs['aria-current'] = 'page';
        const button = this.el('button', attrs, String(n));
        button.addEventListener('click', () => go(n));
        return this.el('li', null, button);
      });
      this.replaceChildren(this.el('nav', { class: 'mk-pager', 'aria-label': this.t(this.getAttribute('label-key') ?? 'pager.label') },
        this.el('p', { class: 'mk-pager__range', 'data-pager-range': '' }, this.t('pager.range', { from, to, total })),
        this.el('ul', { class: 'mk-pager__list' },
          stepItem('prev', 'pager.prev', '‹', page - 1),
          ...pages,
          stepItem('next', 'pager.next', '›', page + 1))));
    }
  }

  customElements.define('mk-site-header', SiteHeader);
  customElements.define('mk-site-footer', SiteFooter);
  customElements.define('mk-guest-notice', GuestNotice);
  customElements.define('mk-status-badge', StatusBadge);
  customElements.define('mk-admin-band', AdminBand);
  customElements.define('mk-pager', Pager);
})();
