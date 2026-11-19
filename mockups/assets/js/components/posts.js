// Post components: mk-post-card, mk-comment-tree, mk-like-button, mk-report-link
// (design: Parts > プレゼンテーション部品; attributes *Attrs in types.d.ts).
//
// - mk-post-card (6.6) `post-id`, `variant` (list (default) / compact): target date (link to
//   post-detail), status badge (mk-status-badge with post.status), excerpt of the body and the like
//   count. compact cuts the excerpt shorter. `meta="icons"` (opt-in, task 8.1 for my-posts) groups
//   the status into a row [data-meta-icons] with the visibility setting (guestVisible) as an icon
//   (inline SVG: globe = shown to guests, lock = logged-in users only; role="img", aria-label and
//   title). The status badge of public / members-only shows its symbol only (data-icon; the text
//   stays for assistive technology, visually hidden by CSS; title on hover). Hidden and deleted
//   keep the full text badge, since they are moderation states that must stay readable.
// - mk-comment-tree (6.1, 6.4, 12.4) `post-id`: nested <ol> lists, one <li data-comment-id
//   data-depth> per comment. Each reply list carries data-level (indent level of its comments,
//   top level = 0) and, beyond the indent limit, data-flat: "phone" for levels 4..6 (no indent
//   below 600px), "all" for levels over 6 (no indent at any width). Comments on those levels also
//   render the reply-to label ("↳ {name} さんへの返信"; data-scope phone / all), shown by CSS only
//   where the indent stops. A deleted comment shows moderation.comment-deleted instead of its
//   author and body and keeps its replies. Logged-in viewers get a report link per comment that
//   is not deleted.
// - mk-like-button (6.7, 6.8) `post-id`: member / admin get a toggle button (aria-pressed =
//   LikeState.likedByMe of the viewer, count); clicking toggles the state and count locally
//   (mockup only; reset when post-id changes). Guests see the count only.
// - mk-report-link (8.3) `target-id` (post or comment id): link to screens/report.html?target=ID.
//   Guests see nothing.
//
// Like counts use like.count, and like.count-one for one like (English common.count has no
// plural). Links point at mockups/screens/*.html resolved from this script's URL; a logged-in auth
// state is carried over when the target screen allows it.
//
// Preconditions: base.js (window.MockElement), shell.js (mk-status-badge) and i18n.js are loaded first.
(function () {
  const scriptEl = document.currentScript;
  const scriptSrc = scriptEl instanceof HTMLScriptElement ? scriptEl.src : '';

  if (typeof window.MockElement !== 'function') {
    console.error('[posts.js] window.MockElement is missing; load components/base.js first');
    return;
  }
  const MockElement = window.MockElement;

  /** Indent limits of the comment tree (levels; top-level comments are level 0). */
  const INDENT_LIMIT_PHONE = 3;
  const INDENT_LIMIT_PC = 6;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  /** Statuses whose badge becomes a symbol in meta="icons" (hidden / deleted keep their text). */
  const ICON_STATUSES = ['public', 'members-only'];
  /**
   * Shapes of the visibility icons (viewBox 0 0 16 16, stroked with currentColor). The my-posts
   * legend repeats them in its HTML; tests/screens-my-posts-review.spec.mjs keeps them equal.
   * @type {Readonly<Record<'guests' | 'members', readonly (readonly [string, Readonly<Record<string, string>>])[]>>}
   */
  const VISIBILITY_SHAPES = {
    guests: [
      ['circle', { cx: '8', cy: '8', r: '6.5' }],
      ['ellipse', { cx: '8', cy: '8', rx: '2.75', ry: '6.5' }],
      ['path', { d: 'M1.5 8h13' }],
    ],
    members: [
      ['rect', { x: '3', y: '7', width: '10', height: '7.5', rx: '1' }],
      ['path', { d: 'M5 7V5a3 3 0 0 1 6 0v2' }],
    ],
  };

  /**
   * A decorative inline SVG icon (the accessible name is on its wrapper).
   * @param {'guests' | 'members'} kind
   * @returns {SVGSVGElement}
   */
  const visibilitySvg = (kind) => {
    const root = document.createElementNS(SVG_NS, 'svg');
    for (const [name, value] of Object.entries({
      viewBox: '0 0 16 16', width: '16', height: '16', fill: 'none', stroke: 'currentColor',
      'stroke-width': '1.5', 'aria-hidden': 'true', focusable: 'false', class: 'mk-post-card__icon-svg',
    })) root.setAttribute(name, value);
    for (const [tag, attrs] of VISIBILITY_SHAPES[kind]) {
      const node = document.createElementNS(SVG_NS, tag);
      for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
      root.append(node);
    }
    return root;
  };

  /** Excerpt lengths in characters (code points). */
  const EXCERPT_LIST = 80;
  const EXCERPT_COMPACT = 40;

  /**
   * @param {ScreenId} id
   * @param {MockStateSnapshot} state
   * @param {Readonly<Record<string, string>>} [params]
   * @returns {string}
   */
  const screenHref = (id, state, params = {}) => {
    /** @type {URL} */
    let url;
    try {
      url = new URL(`../../../screens/${id}.html`, scriptSrc || window.location.href);
    } catch {
      return `${id}.html`;
    }
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
    const registry = Array.isArray(window.MockScreens) ? window.MockScreens : [];
    const entry = registry.find((s) => s.id === id);
    if (state.auth !== 'guest' && entry !== undefined && entry.authStates.includes(state.auth)) {
      url.searchParams.set('auth', state.auth);
    }
    return url.href;
  };

  /**
   * A child mk-* element (custom element names are not in HTMLElementTagNameMap).
   * @param {MockElementName} name
   * @param {Readonly<Record<string, string>>} attrs
   * @returns {HTMLElement}
   */
  const childElement = (name, attrs) => {
    const node = document.createElement(name);
    for (const [attr, value] of Object.entries(attrs)) node.setAttribute(attr, value);
    return node;
  };

  /** @param {string} id @returns {SamplePost | undefined} */
  const findPost = (id) => window.MockSample.posts.find((p) => p.id === id);

  /** @param {string} id @returns {SampleUser | undefined} */
  const findUser = (id) => window.MockSample.users.find((u) => u.id === id);

  /** @param {string} id @returns {string} display name (the id when the user is missing) */
  const userName = (id) => findUser(id)?.displayName ?? id;

  /**
   * Depth-first search for a comment by id.
   * @param {readonly CommentNode[]} nodes
   * @param {string} id
   * @returns {CommentNode | undefined}
   */
  const findInTree = (nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const hit = findInTree(node.children, id);
      if (hit) return hit;
    }
    return undefined;
  };

  /** @param {string} id @returns {CommentNode | undefined} */
  const findComment = (id) => {
    for (const p of window.MockSample.posts) {
      const hit = findInTree(p.comments, id);
      if (hit) return hit;
    }
    return undefined;
  };

  /** @param {number} count @returns {string} */
  const likeText = (count) => window.MockI18n.t(count === 1 ? 'like.count-one' : 'like.count', { count });

  /** @param {string} text @param {number} max @returns {string} */
  const excerpt = (text, max) => {
    const chars = Array.from(text);
    if (chars.length <= max) return text;
    return `${chars.slice(0, max).join('').trimEnd()}…`;
  };

  class PostCard extends MockElement {
    static observedAttributes = ['post-id', 'variant', 'meta'];

    /** @param {MockStateSnapshot} state */
    render(state) {
      const id = this.getAttribute('post-id') ?? '';
      const post = findPost(id);
      if (!post) {
        this.replaceChildren(this.missingSample(id));
        return;
      }
      const attr = this.getAttribute('variant');
      /** @type {NonNullable<PostCardAttrs['variant']>} */
      let variant = 'list';
      if (attr === 'compact' || attr === 'list') variant = attr;
      else if (attr !== null) console.warn(`[mk-post-card] unknown variant="${attr}"; using list`);

      const metaAttr = this.getAttribute('meta');
      const icons = metaAttr === 'icons';
      if (metaAttr !== null && !icons) console.warn(`[mk-post-card] unknown meta="${metaAttr}"; using text badges`);

      const date = window.MockI18n.formatDate(post.targetDate, 'date-long');
      /** @type {Record<string, string>} */
      const params = {};
      const scenarios = window.MockSample.postDetailScenarios;
      const scenario = Object.entries(scenarios).find(([, postId]) => postId === post.id);
      if (scenario && scenario[0] !== 'default') params['scenario'] = scenario[0];

      /** @type {Record<string, string>} */
      const badgeAttrs = { status: post.status };
      if (icons && ICON_STATUSES.includes(post.status)) {
        badgeAttrs['data-icon'] = '';
        badgeAttrs['title'] = this.t('post-card.status-label', { status: this.t(`post.status.${post.status}`) });
      }
      const badge = childElement('mk-status-badge', badgeAttrs);
      /** @type {Record<string, string>} */
      const articleAttrs = { class: 'mk-post-card', 'data-variant': variant, 'data-status': post.status };
      if (icons) articleAttrs['data-meta'] = 'icons';

      let meta = badge;
      if (icons) {
        const kind = post.guestVisible ? 'guests' : 'members';
        const label = post.guestVisible ? this.t('post-card.visibility.guests') : this.t('post-card.visibility.members');
        meta = this.el('div', { class: 'mk-post-card__icons', 'data-meta-icons': '' },
          this.el('span', {
            class: 'mk-post-card__icon', 'data-meta-icon': 'visibility', 'data-value': kind,
            role: 'img', 'aria-label': label, title: label,
          }, visibilitySvg(kind)),
          badge);
      }

      this.replaceChildren(this.el('article', articleAttrs,
        this.el('div', { class: 'mk-post-card__head' },
          this.el('p', { class: 'mk-post-card__date' },
            this.el('span', { class: 'mk-post-card__date-label' }, this.t('post-card.target-date')),
            this.el('a', { class: 'mk-post-card__link', href: screenHref('post-detail', state, params) },
              this.el('time', { datetime: post.targetDate }, date))),
          meta),
        this.el('p', { class: 'mk-post-card__excerpt' },
          excerpt(post.body, variant === 'compact' ? EXCERPT_COMPACT : EXCERPT_LIST)),
        this.el('p', { class: 'mk-post-card__likes' },
          this.el('span', { class: 'mk-post-card__like-symbol', 'aria-hidden': 'true' }, '♥'),
          likeText(post.likes.count))));
    }
  }

  class CommentTree extends MockElement {
    static observedAttributes = ['post-id'];

    /**
     * @param {readonly CommentNode[]} nodes
     * @param {number} level indent level of these comments (top level = 0)
     * @param {CommentNode | undefined} parent
     * @param {MockStateSnapshot} state
     * @returns {HTMLOListElement}
     */
    list(nodes, level, parent, state) {
      /** @type {Record<string, string>} */
      const attrs = level === 0
        ? { class: 'mk-comment-tree__list', 'aria-label': this.t('comment.tree-label') }
        : { class: 'mk-comment__replies', 'data-level': String(level) };
      if (level > INDENT_LIMIT_PC) attrs['data-flat'] = 'all';
      else if (level > INDENT_LIMIT_PHONE) attrs['data-flat'] = 'phone';
      const list = this.el('ol', attrs);
      for (const node of nodes) list.append(this.item(node, level, parent, state));
      return list;
    }

    /**
     * @param {CommentNode} node
     * @param {number} level
     * @param {CommentNode | undefined} parent
     * @param {MockStateSnapshot} state
     * @returns {HTMLLIElement}
     */
    item(node, level, parent, state) {
      /** @type {Record<string, string>} */
      const attrs = { class: 'mk-comment', 'data-comment-id': node.id, 'data-depth': String(level + 1) };
      if (node.deleted) attrs['data-deleted'] = '';
      const box = this.el('div', { class: 'mk-comment__box' });

      if (parent && level > INDENT_LIMIT_PHONE) {
        const replyTo = parent.deleted
          ? this.t('comment.reply-to-deleted')
          : this.t('comment.reply-to', { name: userName(parent.authorId) });
        box.append(this.el('p', { class: 'mk-comment__reply-to', 'data-scope': level > INDENT_LIMIT_PC ? 'all' : 'phone' },
          this.el('span', { class: 'mk-comment__reply-mark', 'aria-hidden': 'true' }, '↳'),
          replyTo));
      }

      if (node.deleted) {
        box.append(this.el('p', { class: 'mk-comment__deleted' }, this.t('moderation.comment-deleted')));
      } else {
        box.append(
          this.el('p', { class: 'mk-comment__meta' },
            this.el('span', { class: 'mk-comment__author' }, userName(node.authorId)),
            this.el('time', { class: 'mk-comment__at', datetime: node.at }, window.MockI18n.formatDate(node.at, 'datetime'))),
          this.el('p', { class: 'mk-comment__body' }, node.body));
        if (state.auth !== 'guest') {
          box.append(this.el('div', { class: 'mk-comment__actions' }, childElement('mk-report-link', { 'target-id': node.id })));
        }
      }

      const li = this.el('li', attrs, box);
      if (node.children.length > 0) li.append(this.list(node.children, level + 1, node, state));
      return li;
    }

    /** @param {MockStateSnapshot} state */
    render(state) {
      const id = this.getAttribute('post-id') ?? '';
      const post = findPost(id);
      if (!post) {
        this.replaceChildren(this.missingSample(id));
        return;
      }
      if (post.comments.length === 0) {
        this.replaceChildren(this.el('p', { class: 'mk-comment-tree__empty' }, this.t('empty.comments')));
        return;
      }
      this.replaceChildren(this.el('div', { class: 'mk-comment-tree' }, this.list(post.comments, 0, undefined, state)));
    }
  }

  class LikeButton extends MockElement {
    static observedAttributes = ['post-id'];

    constructor() {
      super();
      /** @type {{ postId: string, liked: boolean, count: number } | null} local toggle state */
      this.local = null;
    }

    /** @param {MockStateSnapshot} state */
    render(state) {
      const id = this.getAttribute('post-id') ?? '';
      const post = findPost(id);
      if (!post) {
        this.local = null;
        this.replaceChildren(this.missingSample(id));
        return;
      }
      if (this.local === null || this.local.postId !== id) {
        this.local = { postId: id, liked: post.likes.likedByMe, count: post.likes.count };
      }
      const { liked, count } = this.local;
      if (state.auth === 'guest') {
        this.replaceChildren(this.el('span', { class: 'mk-like', 'data-readonly': '' },
          this.el('span', { class: 'mk-like__symbol', 'aria-hidden': 'true' }, '♥'),
          this.el('span', { class: 'mk-like__count' }, likeText(post.likes.count))));
        return;
      }
      const button = this.el('button', {
        type: 'button',
        class: 'mk-like',
        'aria-pressed': String(liked),
        'data-variant': 'secondary',
        'data-mk-focus': 'like',
      },
      this.el('span', { class: 'mk-like__symbol', 'aria-hidden': 'true' }, liked ? '♥' : '♡'),
      this.el('span', { class: 'mk-like__count' }, likeText(count)));
      button.addEventListener('click', () => {
        if (this.local === null) return;
        this.local = { postId: id, liked: !liked, count: count + (liked ? -1 : 1) };
        this.refresh(window.MockState.get());
      });
      this.replaceChildren(button);
    }
  }

  class ReportLink extends MockElement {
    static observedAttributes = ['target-id'];

    /** @param {MockStateSnapshot} state */
    render(state) {
      const id = this.getAttribute('target-id') ?? '';
      const post = findPost(id);
      const comment = post ? undefined : findComment(id);
      if (!post && !comment) {
        this.replaceChildren(this.missingSample(id));
        return;
      }
      // Guests cannot report (8.3, 6.8): render nothing.
      if (state.auth === 'guest') {
        this.replaceChildren();
        return;
      }
      const label = comment
        ? this.t('report-link.comment', { name: userName(comment.authorId) })
        : this.t('report-link.post');
      this.replaceChildren(this.el('a', {
        class: 'mk-report-link',
        href: screenHref('report', state, { target: id }),
        'aria-label': label,
      },
      this.el('span', { class: 'mk-report-link__symbol', 'aria-hidden': 'true' }, '⚑'),
      this.t('button.report')));
    }
  }

  customElements.define('mk-post-card', PostCard);
  customElements.define('mk-comment-tree', CommentTree);
  customElements.define('mk-like-button', LikeButton);
  customElements.define('mk-report-link', ReportLink);
})();
