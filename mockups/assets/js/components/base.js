// MockElement: base class of every mk-* component -> window.MockElement (design: Parts >
// MockElement 基底; contract MockElementContract in types.d.ts).
//
// - Light DOM only: subclasses render with this.replaceChildren(...) (no Shadow DOM), so the
//   product CSS (components.css) and the stage skin (wireframe.css) apply as usual.
// - connectedCallback renders once with MockState.get() and subscribes to 'mock:change';
//   every change re-renders. disconnectedCallback unsubscribes.
// - Data comes in through attributes (post-id, date, ...); sample data is only looked up by id
//   via this.sample(). A missing id is shown with this.missingSample(id) (error.missing-sample),
//   styled apart from the product look.
// - Re-rendering keeps keyboard focus: an element marked data-mk-focus="name" that had focus is
//   focused again after the render when the new DOM has the same name.
// - Shared lookups of the components: this.findPost(id) looks in SampleDataSet.posts and then in
//   SampleDataSet.paging.posts (the extra own posts of the scenario many-items), so every component
//   finds a post the same way. this.screenHref(id, state, params, hash) builds the link to
//   mockups/screens/{id}.html, resolved from this script's URL (assets/js/components/ ->
//   ../../../screens/, so it works from screens/ and from the catalog pages at the root), and
//   carries a logged-in auth state over when the target screen's authStates allow it (it reads
//   the screen registry, data/screens.js).
//
// Preconditions: data/screens.js, mock-state.js and i18n.js are loaded first; component scripts
// load after this.
(function () {
  const scriptEl = document.currentScript;
  const scriptSrc = scriptEl instanceof HTMLScriptElement ? scriptEl.src : '';

  class MockElement extends HTMLElement {
    constructor() {
      super();
      /** @type {boolean} */
      this.subscribed = false;
      /** @param {CustomEvent<MockStateSnapshot>} event */
      this.onMockChange = (event) => this.refresh(event.detail);
    }

    /**
     * Abstract: overridden by every subclass.
     * @param {MockStateSnapshot} state
     * @returns {void}
     */
    render(state) {
      throw new Error(`${this.localName} must override render() (state: ${state.lang})`);
    }

    /** @returns {SampleDataSet} */
    sample() {
      return window.MockSample;
    }

    /** @param {MessageKey} key @param {MessageArgs} [args] @returns {string} */
    t(key, args) {
      return window.MockI18n.t(key, args);
    }

    /**
     * @template {keyof HTMLElementTagNameMap} K
     * @param {K} tag
     * @param {Readonly<Record<string, string>> | null} [attrs]
     * @param {readonly (Node | string)[]} children
     * @returns {HTMLElementTagNameMap[K]}
     */
    el(tag, attrs, ...children) {
      const node = document.createElement(tag);
      if (attrs) for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
      node.append(...children);
      return node;
    }

    /** @param {string} id @returns {SamplePost | undefined} */
    findPost(id) {
      const sample = this.sample();
      return sample.posts.find((p) => p.id === id) ?? sample.paging.posts.find((p) => p.id === id);
    }

    /**
     * @param {ScreenId} id
     * @param {MockStateSnapshot} state
     * @param {Readonly<Record<string, string>>} [params]
     * @param {string} [hash] e.g. '#post-comments'
     * @returns {string}
     */
    screenHref(id, state, params = {}, hash = '') {
      /** @type {URL} */
      let url;
      try {
        url = new URL(`../../../screens/${id}.html`, scriptSrc || window.location.href);
      } catch {
        return `${id}.html${hash}`;
      }
      url.hash = hash;
      for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
      const registry = Array.isArray(window.MockScreens) ? window.MockScreens : [];
      const entry = registry.find((s) => s.id === id);
      if (state.auth !== 'guest' && entry !== undefined && entry.authStates.includes(state.auth)) {
        url.searchParams.set('auth', state.auth);
      }
      return url.href;
    }

    /** @param {string} id @returns {HTMLElement} */
    missingSample(id) {
      return this.el('span', { class: 'mk-missing-sample', 'data-missing-sample': id, role: 'alert' },
        this.t('error.missing-sample', { id }));
    }

    /** @param {MockStateSnapshot} state */
    refresh(state) {
      const active = document.activeElement;
      const focusName = active instanceof HTMLElement && this.contains(active)
        ? active.getAttribute('data-mk-focus')
        : null;
      this.render(state);
      if (focusName === null) return;
      const next = Array.from(this.querySelectorAll('[data-mk-focus]'))
        .find((node) => node.getAttribute('data-mk-focus') === focusName);
      if (next instanceof HTMLElement) next.focus();
    }

    connectedCallback() {
      if (!this.subscribed) {
        document.addEventListener('mock:change', this.onMockChange);
        this.subscribed = true;
      }
      this.refresh(window.MockState.get());
    }

    disconnectedCallback() {
      document.removeEventListener('mock:change', this.onMockChange);
      this.subscribed = false;
    }

    // Subclasses list their attributes in `static observedAttributes`; a change re-renders.
    attributeChangedCallback() {
      if (this.isConnected && this.subscribed) this.refresh(window.MockState.get());
    }
  }

  window.MockElement = MockElement;
})();
