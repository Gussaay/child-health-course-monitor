// functions/pagedLists.js
//
// Sends lists too large for one callable answer: a manifest (each list's
// version and page count; lists the browser holds at that version come back
// { unchanged: true }) and pages of at most PAGE_CHARS characters. Pages are
// worked out once per version of each list. Used by mentorshipCopyCore.js.

const PAGE_CHARS = 3 * 1024 * 1024;

/**
 * lists: { name: () => ({ version, items }) } read after refreshAll().
 */
function makePagedLists({ lists, refreshAll, pageChars = PAGE_CHARS }) {
  const paged = {};
  function pagesOf(name) {
    const { version, items } = lists[name]();
    if (paged[name] && paged[name].version === version) return paged[name];
    const pages = [];
    let cur = [];
    let size = 0;
    items.forEach((it) => {
      const n = JSON.stringify(it).length;
      if (cur.length && size + n > pageChars) { pages.push(cur); cur = []; size = 0; }
      cur.push(it); size += n;
    });
    if (cur.length || !pages.length) pages.push(cur);
    paged[name] = { version, pages, count: items.length };
    return paged[name];
  }
  async function manifest(known = {}, only = null) {
    await refreshAll();
    const out = {};
    Object.keys(lists).filter((n) => !only || only.includes(n)).forEach((name) => {
      const p = pagesOf(name);
      out[name] = known[name] === p.version ? { unchanged: true, version: p.version } : { version: p.version, pages: p.pages.length, count: p.count };
    });
    return out;
  }
  async function page(name, n, version) {
    if (!lists[name]) return { error: "unknown list" };
    await refreshAll();
    const p = pagesOf(name);
    if (version && version !== p.version) return { stale: true, version: p.version };
    const i = Number(n) || 0;
    if (i < 0 || i >= p.pages.length) return { error: "no such page" };
    return { version: p.version, page: i, pages: p.pages.length, items: p.pages[i] };
  }
  return { manifest, page };
}

module.exports = { makePagedLists, PAGE_CHARS };
