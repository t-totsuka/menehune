// Post components: mk-post-card, mk-comment-tree, mk-like-button, mk-report-link, mk-notice-list
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
//   `comment-count` (opt-in boolean, task 8.1 for my-posts) adds the number of comments in the
//   post's tree as text ([data-comment-count]; post-card.comment-count / -one) in the same row as
//   the status (the [data-meta-icons] row with meta="icons", else a plain row). Replies count;
//   deleted comments (kept in the tree as deleted, 6.4) do not. A deleted post shows no count.
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
// - mk-notice-list (6.10, task 8.1) `user-id` (optional; omitted = the viewer
//   SampleDataSet.viewerIds[auth], and guests get nothing): the user's ReplyNotice as an <ol>, one
//   <li data-notice-id data-read> per notice in the sample's order (newest reply first): unread /
//   read as text ([data-notice-state], notice.unread / notice.read; not colour alone) and the
//   reply's datetime, who replied, an excerpt of my comment ([data-notice-comment]) and of the
//   reply ([data-notice-reply]), the post (author and target date, [data-notice-post]) and a link
//   to the reply: post-detail of that post (its postDetailScenarios scenario) at #post-comments,
//   since comments have no anchors of their own (the gallery shows the same tree twice, so ids
//   would repeat). Scenario `empty` (or no notice) shows empty.notices; `fetch-error` shows
//   error.notices (role="alert").
//   Task 8.1 (my-posts paging): scenario `many-items` adds SampleDataSet.paging.notices after the
//   shared ones (still newest first). `page-size` (opt-in, a positive integer) shows one page and
//   an mk-pager (label pager.notices-label) below the list; the page is kept across re-renders
//   (clamped) and goes back to 1 when the scenario changes. Without it every notice is listed.
//
// Posts are looked up by id with MockElement#findPost (base.js): SampleDataSet.posts and then
// SampleDataSet.paging.posts (the extra own posts of the scenario many-items; only my-posts lists them).
//
// Like counts use like.count, and like.count-one for one like (English common.count has no
// plural). Links come from MockElement#screenHref (base.js): mockups/screens/*.html, with a
// logged-in auth state carried over when the target screen allows it.
//
// Preconditions: base.js (window.MockElement), paging.js (window.MockPaging), shell.js
// (mk-status-badge, mk-pager) and i18n.js are loaded first.
(function () {
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
  const EXCERPT_NOTICE = 40;

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

  /**
   * Comments in a tree that are not deleted, replies included (a deleted comment's replies count).
   * @param {readonly CommentNode[]} nodes
   * @returns {number}
   */
  const liveCommentCount = (nodes) =>
    nodes.reduce((n, node) => n + (node.deleted ? 0 : 1) + liveCommentCount(node.children), 0);

  /**
   * URL parameters that make post-detail show a post (it picks the post by scenario).
   * @param {string} postId
   * @returns {Record<string, string>}
   */
  const postDetailParams = (postId) => {
    /** @type {Record<string, string>} */
    const params = {};
    const scenario = Object.entries(window.MockSample.postDetailScenarios).find(([, id]) => id === postId);
    if (scenario && scenario[0] !== 'default') params['scenario'] = scenario[0];
    return params;
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
    static observedAttributes = ['post-id', 'variant', 'meta', 'comment-count'];

    /** @param {MockStateSnapshot} state */
    render(state) {
      const id = this.getAttribute('post-id') ?? '';
      const post = this.findPost(id);
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
      const params = postDetailParams(post.id);

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

      /** @type {Element} */
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
      if (this.hasAttribute('comment-count') && post.status !== 'deleted') {
        const count = liveCommentCount(post.comments);
        const text = this.t(count === 1 ? 'post-card.comment-count-one' : 'post-card.comment-count', { count });
        const node = this.el('span', { class: 'mk-post-card__comments', 'data-comment-count': String(count) }, text);
        if (icons) meta.append(node);
        else meta = this.el('div', { class: 'mk-post-card__icons' }, badge, node);
      }

      this.replaceChildren(this.el('article', articleAttrs,
        this.el('div', { class: 'mk-post-card__head' },
          this.el('p', { class: 'mk-post-card__date' },
            this.el('span', { class: 'mk-post-card__date-label' }, this.t('post-card.target-date')),
            this.el('a', { class: 'mk-post-card__link', href: this.screenHref('post-detail', state, params) },
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
      const post = this.findPost(id);
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
      const post = this.findPost(id);
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
      const post = this.findPost(id);
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
        href: this.screenHref('report', state, { target: id }),
        'aria-label': label,
      },
      this.el('span', { class: 'mk-report-link__symbol', 'aria-hidden': 'true' }, '⚑'),
      this.t('button.report')));
    }
  }

  class NoticeList extends MockElement {
    static observedAttributes = ['user-id', 'page-size'];

    constructor() {
      super();
      /** current page of the opt-in paging (1-based) */
      this.page = 1;
      /** @type {ScenarioId | null} scenario of the last render (a change resets the page) */
      this.lastScenario = null;
      this.addEventListener('mk-page-change', (event) => {
        if (!(event instanceof CustomEvent)) return;
        this.page = Number(event.detail.page) || 1;
        this.refresh(window.MockState.get());
      });
    }

    /**
     * @param {ReplyNotice} notice
     * @param {MockStateSnapshot} state
     * @returns {HTMLElement}
     */
    item(notice, state) {
      const post = this.findPost(notice.postId);
      const mine = post ? findInTree(post.comments, notice.commentId) : undefined;
      const reply = mine?.children.find((c) => c.id === notice.replyId);
      if (!post || !mine || !reply) return this.el('li', null, this.missingSample(notice.id));
      const name = userName(reply.authorId);
      const at = window.MockI18n.formatDate(reply.at, 'datetime');
      const date = window.MockI18n.formatDate(post.targetDate, 'date-long');
      /** @param {MessageKey} labelKey @param {string} text @param {string} data */
      const quote = (labelKey, text, data) => this.el('p', { class: 'mk-notice__quote', [data]: '' },
        this.el('span', { class: 'mk-notice__label' }, this.t(labelKey)),
        this.el('q', null, excerpt(text, EXCERPT_NOTICE)));
      return this.el('li', { class: 'mk-notice', 'data-notice-id': notice.id, 'data-read': String(notice.read) },
        this.el('p', { class: 'mk-notice__head' },
          this.el('span', { class: 'mk-notice__state', 'data-notice-state': notice.read ? 'read' : 'unread' },
            this.t(notice.read ? 'notice.read' : 'notice.unread')),
          this.el('time', { class: 'mk-notice__at', datetime: reply.at }, at)),
        this.el('p', { class: 'mk-notice__summary' }, this.t('notice.summary', { name })),
        quote('notice.my-comment', mine.body, 'data-notice-comment'),
        quote('notice.reply', reply.body, 'data-notice-reply'),
        this.el('p', { class: 'mk-notice__post', 'data-notice-post': '' },
          this.el('span', { class: 'mk-notice__label' }, this.t('notice.post')),
          this.t('notice.post-title', { name: userName(post.authorId), date })),
        this.el('p', { class: 'mk-notice__open' },
          this.el('a', {
            href: this.screenHref('post-detail', state, postDetailParams(post.id), '#post-comments'),
            'aria-label': this.t('notice.open-label', { name, datetime: at }),
          }, this.t('notice.open'))));
    }

    /** @param {MockStateSnapshot} state */
    render(state) {
      const attr = this.getAttribute('user-id');
      const sample = this.sample();
      const userId = attr ?? (state.auth === 'guest' ? undefined : sample.viewerIds[state.auth]);
      if (userId === undefined) {
        this.replaceChildren();
        return;
      }
      if (findUser(userId) === undefined) {
        this.replaceChildren(this.missingSample(userId));
        return;
      }
      // A scenario change (fetch-error included) goes back to page 1.
      if (this.lastScenario !== state.scenario) this.page = 1;
      this.lastScenario = state.scenario;
      if (state.scenario === 'fetch-error') {
        this.replaceChildren(this.el('p', { class: 'mk-notice-list__error', role: 'alert' }, this.t('error.notices')));
        return;
      }
      /** @type {readonly ReplyNotice[]} */
      let source = sample.notices;
      if (state.scenario === 'empty') source = [];
      else if (state.scenario === 'many-items') source = [...sample.notices, ...sample.paging.notices];
      const notices = source.filter((n) => n.recipientId === userId);
      if (notices.length === 0) {
        this.replaceChildren(this.el('p', { class: 'mk-notice-list__empty' }, this.t('empty.notices')));
        return;
      }
      const size = Number.parseInt(this.getAttribute('page-size') ?? '', 10);
      if (!(size >= 1)) {
        this.replaceChildren(this.el('ol', { class: 'mk-notice-list', 'aria-label': this.t('notice.list-label') },
          ...notices.map((n) => this.item(n, state))));
        return;
      }
      const P = window.MockPaging;
      this.page = P.clampPage(this.page, notices.length, size);
      const pager = childElement('mk-pager', {
        total: String(notices.length), page: String(this.page), 'page-size': String(size), 'label-key': 'pager.notices-label',
      });
      this.replaceChildren(
        this.el('ol', { class: 'mk-notice-list', 'aria-label': this.t('notice.list-label') },
          ...P.pageItems(notices, this.page, size).map((n) => this.item(n, state))),
        pager);
    }
  }

  customElements.define('mk-post-card', PostCard);
  customElements.define('mk-comment-tree', CommentTree);
  customElements.define('mk-like-button', LikeButton);
  customElements.define('mk-report-link', ReportLink);
  customElements.define('mk-notice-list', NoticeList);
})();
