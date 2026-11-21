// MockPaging: pure paging logic of long lists -> window.MockPaging (task 8.1, my-posts paging;
// contract MockPagingService in types.d.ts). Pages are 1-based; out-of-range pages are clamped.
//
// A foundation script without the DOM: mk-pager (components/shell.js), mk-notice-list
// (components/posts.js) and the my-posts page script use it, and tests/unit loads it with
// node:vm. It sits right after mock-state.js and before i18n.js and the components.
(function () {
  /** @param {number} total @param {number} size @returns {number} */
  const pageCount = (total, size) => Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, size)));
  /** @param {number} page @param {number} total @param {number} size @returns {number} */
  const clampPage = (page, total, size) => {
    if (!Number.isFinite(page)) return 1;
    return Math.min(pageCount(total, size), Math.max(1, Math.floor(page)));
  };
  /** @param {number} total @param {number} page @param {number} size @returns {{ from: number, to: number }} */
  const pageRange = (total, page, size) => {
    if (total <= 0) return { from: 0, to: 0 };
    const p = clampPage(page, total, size);
    return { from: (p - 1) * size + 1, to: Math.min(total, p * size) };
  };
  /**
   * @template T
   * @param {readonly T[]} items @param {number} page @param {number} size
   * @returns {T[]}
   */
  const pageItems = (items, page, size) => {
    const p = clampPage(page, items.length, size);
    return items.slice((p - 1) * size, p * size);
  };
  window.MockPaging = Object.freeze({ PAGE_SIZE: 30, pageCount, clampPage, pageRange, pageItems });
})();
