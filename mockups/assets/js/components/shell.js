// Shell components: mk-site-header, mk-site-footer, mk-guest-notice, mk-status-badge,
// mk-admin-band (design: Parts > プレゼンテーション部品; attributes *Attrs in types.d.ts).
//
// - mk-site-header (3.2, 9.4, 11.2): logo, main nav (calendar, astro events, star chart, my
//   posts; plus admin for the admin viewer), language switch, theme switch (system / light /
//   dark; through MockState.update, so a manual theme wins over the OS appearance), login state
//   (guest: login link; member / admin: display name of SampleDataSet.viewerIds[auth]).
//   `current` marks the current nav item; without it the item is inferred from the screen id.
//   Below 600px the menu collapses behind a toggle button (aria-expanded / aria-controls);
//   Escape closes it.
// - mk-site-footer: links to the attribution and privacy pages.
// - mk-guest-notice (6.5, 6.8): variant read-only (default) / private-post, with a login link.
//   Showing it only to guests is the page's job ([data-when-auth="guest"]).
// - mk-status-badge (6.6, 13.3): PostStatus as color + symbol + text.
// - mk-admin-band (3.6): band that marks a screen as admin-only.
//
// Links point at mockups/screens/*.html resolved from this script's URL
// (assets/js/components/ -> ../../../screens/), so they work from screens/ and from the catalog
// pages at the root. A logged-in auth state is carried over when the target screen allows it.
//
// Preconditions: base.js (window.MockElement) is loaded first.
(function () {
  const scriptEl = document.currentScript;
  const scriptSrc = scriptEl instanceof HTMLScriptElement ? scriptEl.src : '';

  /**
   * @param {ScreenId} id
   * @param {MockStateSnapshot} state
   * @returns {string}
   */
  const screenHref = (id, state) => {
    /** @type {URL} */
    let url;
    try {
      url = new URL(`../../../screens/${id}.html`, scriptSrc || window.location.href);
    } catch {
      return `${id}.html`;
    }
    const registry = Array.isArray(window.MockScreens) ? window.MockScreens : [];
    const entry = registry.find((s) => s.id === id);
    if (state.auth !== 'guest' && entry !== undefined && entry.authStates.includes(state.auth)) {
      url.searchParams.set('auth', state.auth);
    }
    return url.href;
  };

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
        box.append(this.el('a', { href: screenHref('login', state) }, this.t('nav.login')));
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
      const attrs = { href: screenHref('settings', state) };
      if (current === 'settings') attrs['aria-current'] = 'page';
      box.append(this.el('a', attrs, this.t('nav.settings')));
      return box;
    }

    /** @param {MockStateSnapshot} state */
    render(state) {
      const current = this.currentItem(state);
      const items = state.auth === 'admin' ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;
      const list = this.el('ul');
      for (const { item, screen, labelKey } of items) {
        /** @type {Record<string, string>} */
        const attrs = { href: screenHref(screen, state) };
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

      const logo = this.el('a', { class: 'mk-header__logo', href: screenHref('top', state) },
        this.el('span', { class: 'mk-header__logo-mark', 'aria-hidden': 'true', 'data-decor': '' }, '✦'),
        this.el('span', null, this.t('site.name')));

      this.replaceChildren(this.el('header', { class: 'mk-header' },
        this.el('div', { class: 'mk-header__inner' },
          this.el('div', { class: 'mk-header__bar' }, logo, toggle),
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
              this.el('li', null, this.el('a', { href: screenHref('attribution', state) }, this.t('screen.attribution.title'))),
              this.el('li', null, this.el('a', { href: screenHref('privacy', state) }, this.t('screen.privacy.title'))))),
          this.el('p', { class: 'mk-footer__note' }, this.t('footer.note')))));
    }
  }

  /** @type {readonly NonNullable<GuestNoticeAttrs['variant']>[]} */
  const NOTICE_VARIANTS = ['read-only', 'private-post'];

  class GuestNotice extends MockElement {
    static observedAttributes = ['variant'];

    /** @param {MockStateSnapshot} state */
    render(state) {
      const attr = this.getAttribute('variant');
      /** @type {NonNullable<GuestNoticeAttrs['variant']>} */
      let variant = 'read-only';
      if (isOneOf(NOTICE_VARIANTS, attr)) variant = attr;
      else if (attr !== null) console.warn(`[mk-guest-notice] unknown variant="${attr}"; using read-only`);
      const message = variant === 'private-post' ? this.t('guest-notice.private-post') : this.t('guest-notice.read-only');
      this.replaceChildren(this.el('div', { class: 'mk-guest-notice', 'data-variant': variant },
        this.el('p', { class: 'mk-guest-notice__text' }, message),
        this.el('a', { class: 'mk-guest-notice__login', href: screenHref('login', state) }, this.t('guest-notice.login'))));
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

  customElements.define('mk-site-header', SiteHeader);
  customElements.define('mk-site-footer', SiteFooter);
  customElements.define('mk-guest-notice', GuestNotice);
  customElements.define('mk-status-badge', StatusBadge);
  customElements.define('mk-admin-band', AdminBand);
})();
