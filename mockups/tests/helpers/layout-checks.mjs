// In-page checks for task 7.2 (overflow and missing messages). Every export is passed to
// page.evaluate(), so each function must be self-contained (no references to module scope).
//
// Text overflow heuristic (collectLayoutIssues). A "text element" is a rendered element with at
// least one non-blank direct text node; its text extent is the union of the client rects of
// those text nodes (Range#getClientRects), i.e. where the glyph runs were actually laid out, not
// where the element box is. Components render their text with textContent (no data-i18n), so
// the check is not limited to [data-i18n]. One issue per element, first match wins:
//   clipped-by-self      overflow-x/y is hidden or clip and scrollWidth/Height exceeds the client
//                        size (covers clipping and text-overflow: ellipsis)
//   escapes-own-box      the text runs past the element's border box horizontally (overflow
//                        visible): it is drawn over neighbouring content
//   clipped-by-ancestor  the text runs past the padding box of the nearest ancestor whose
//                        overflow-x is hidden or clip
//   outside-viewport     the text runs past the left or right edge of the viewport
//   outside-svg          an SVG <text>/<tspan> runs past its <svg> element (which clips it)
// The horizontal axis is what matters for 11.6 and 12.2; the vertical extent of a text range is
// the font's content area, which legitimately exceeds the line box with a tight line-height, so
// vertical clipping is only judged from scroll metrics (clipped-by-self).
// Not flagged (intentional or invisible):
//   - [data-decor] ornaments, [hidden] / display: none / visibility: hidden content
//   - visually hidden text (an ancestor-or-self with overflow other than visible that is at most
//     1px wide or tall, or clip-path: inset(50%)) — the sr-only pattern
//   - text inside a scroll container (overflow-x auto or scroll): it is reachable by scrolling;
//     the scroll container itself is still a box on the page, so the page-level scroll check
//     and its own placement still apply
// A tolerance of 1px absorbs sub-pixel rounding.

/**
 * @typedef {object} LayoutIssue
 * @property {'clipped-by-self' | 'escapes-own-box' | 'clipped-by-ancestor' | 'outside-viewport' | 'outside-svg'} kind
 * @property {string} id       element id ('' when none)
 * @property {string} selector short description: nearest mk-* host > tag#id.class
 * @property {string} text     the element's own text (first 60 characters)
 * @property {string} detail   the measured numbers
 */

/**
 * Pixels by which the page scrolls horizontally (0 when it does not).
 * @returns {number}
 */
export function pageHorizontalOverflow() {
  const root = document.documentElement;
  return Math.max(0, root.scrollWidth - root.clientWidth);
}

/**
 * Lists text elements that overflow (see the heuristic above).
 * @returns {LayoutIssue[]}
 */
export function collectLayoutIssues() {
  const TOL = 1;
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'TITLE']);
  const viewportWidth = document.documentElement.clientWidth;
  /** @type {LayoutIssue[]} */
  const issues = [];

  /** @param {Element} el */
  const label = (el) => {
    const cls = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls}`;
  };
  /** @param {Element} el */
  const describe = (el) => {
    // Up to two parents, then the nearest custom element (mk-*) or element with an id, so the
    // report says where on the screen the text is.
    const chain = [label(el)];
    let a = el.parentElement;
    for (let i = 0; i < 2 && a && a !== document.body; i += 1, a = a.parentElement) {
      chain.unshift(label(a));
    }
    for (; a && a !== document.body; a = a.parentElement) {
      if (a.tagName.includes('-') || a.id) { chain.unshift(`${label(a)} …`); break; }
    }
    return chain.join(' > ');
  };
  /** @param {number} n */
  const px = (n) => Math.round(n * 10) / 10;

  /** @param {Element} el */
  const isVisuallyHidden = (el) => {
    for (/** @type {Element | null} */ let a = el; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.clipPath.startsWith('inset(50%')) return true;
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const r = a.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) return true;
      }
    }
    return false;
  };

  // Group the non-blank text nodes by their parent element.
  /** @type {Map<Element, Text[]>} */
  const byElement = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = /** @type {Text} */ (n);
    const el = text.parentElement;
    if (!el || SKIP_TAGS.has(el.tagName) || !/\S/.test(text.data)) continue;
    const list = byElement.get(el);
    if (list) list.push(text); else byElement.set(el, [text]);
  }

  for (const [el, texts] of byElement) {
    if (el.closest('[data-decor], [hidden]')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || el.getClientRects().length === 0) continue;
    if (isVisuallyHidden(el)) continue;

    let left = Infinity; let right = -Infinity; let top = Infinity; let bottom = -Infinity;
    const range = document.createRange();
    for (const t of texts) {
      range.selectNodeContents(t);
      for (const r of range.getClientRects()) {
        if (r.width <= 0 || r.height <= 0) continue;
        left = Math.min(left, r.left); right = Math.max(right, r.right);
        top = Math.min(top, r.top); bottom = Math.max(bottom, r.bottom);
      }
    }
    if (left === Infinity) continue;

    const text = texts.map((t) => t.data).join('').replace(/\s+/g, ' ').trim().slice(0, 60);
    /** @param {LayoutIssue['kind']} kind @param {string} detail */
    const report = (kind, detail) => issues.push({
      kind, id: el.id, selector: describe(el), text, detail,
    });
    const span = `text x ${px(left)}..${px(right)}`;

    if (el instanceof SVGElement) {
      const svg = el instanceof SVGSVGElement ? el : el.ownerSVGElement;
      if (!svg) continue;
      const box = svg.getBoundingClientRect();
      if (left < box.left - TOL || right > box.right + TOL
        || top < box.top - TOL || bottom > box.bottom + TOL) {
        report('outside-svg', `${span}, y ${px(top)}..${px(bottom)} vs svg x ${px(box.left)}..${px(box.right)}, y ${px(box.top)}..${px(box.bottom)}`);
      }
      continue;
    }

    const clipsX = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
    const clipsY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
    if ((clipsX && el.scrollWidth > el.clientWidth + TOL)
      || (clipsY && el.scrollHeight > el.clientHeight + TOL)) {
      report('clipped-by-self', `scroll ${el.scrollWidth}x${el.scrollHeight} > client ${el.clientWidth}x${el.clientHeight} (overflow ${cs.overflowX} ${cs.overflowY}${cs.textOverflow === 'ellipsis' ? ', ellipsis' : ''})`);
      continue;
    }

    const own = el.getBoundingClientRect();
    if (cs.overflowX === 'visible' && (left < own.left - TOL || right > own.right + TOL)) {
      report('escapes-own-box', `${span} vs box x ${px(own.left)}..${px(own.right)}`);
      continue;
    }

    let inScroller = cs.overflowX === 'auto' || cs.overflowX === 'scroll';
    let clipped = false;
    for (let a = el.parentElement; a && !inScroller && a !== document.documentElement; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (acs.overflowX === 'auto' || acs.overflowX === 'scroll') { inScroller = true; break; }
      if (acs.overflowX === 'hidden' || acs.overflowX === 'clip') {
        const r = a.getBoundingClientRect();
        const padLeft = r.left + a.clientLeft;
        const padRight = padLeft + a.clientWidth;
        if (left < padLeft - TOL || right > padRight + TOL) {
          report('clipped-by-ancestor', `${span} vs ${label(a)} x ${px(padLeft)}..${px(padRight)}`);
          clipped = true;
        }
        break;
      }
    }
    if (clipped || inScroller) continue;

    if (left < -TOL || right > viewportWidth + TOL) {
      report('outside-viewport', `${span} vs viewport 0..${viewportWidth}`);
    }
  }
  return issues;
}

/**
 * Lists every missing-key marker (⟦key⟧, see I18nRuntime) in the title, in text (hidden or not)
 * and in attribute values, as "where: value" strings.
 * @returns {string[]}
 */
export function collectMissingKeyMarkers() {
  const MARK = '⟦';
  /** @type {string[]} */
  const out = [];
  /** @param {Element} el */
  const label = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`;
  if (document.title.includes(MARK)) out.push(`title: ${document.title}`);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const data = /** @type {Text} */ (n).data;
    if (data.includes(MARK)) {
      out.push(`${n.parentElement ? label(n.parentElement) : '#text'}: ${data.trim()}`);
    }
  }
  for (const el of document.querySelectorAll('*')) {
    for (const attr of el.attributes) {
      if (attr.value.includes(MARK)) out.push(`${label(el)} ${attr.name}="${attr.value}"`);
    }
  }
  return out;
}
