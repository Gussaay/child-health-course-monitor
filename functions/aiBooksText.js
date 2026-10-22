// functions/aiBooksText.js
//
// The page choosing behind aiBooks.js, with no Firebase in it so the tests
// can load it without the Cloud Functions runtime.

/** A page range kept inside the book: [from, to], 1-based and inclusive. */
const pageRange = (entry, from, to) => {
  const n = entry.pages.length;
  const a = Math.max(1, Math.min(n, parseInt(from, 10) || 1));
  const b = Math.max(a, Math.min(n, parseInt(to, 10) || n));
  return [a, b];
};

// Questions are answered from the pages that share the most words with them.
// Plain keyword scoring (BM25-like) is enough for manuals, costs nothing, and
// needs no embedding quota. Arabic is normalised so ة/ه and the alef forms
// match.
const STOP = new Set("the and for with that this from are was were what which when how who why does into have has not can its their there about should child children".split(" "));
const norm = (s) => String(s).toLowerCase()
  .replace(/[\u064B-\u0652\u0640]/g, "")
  .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
const words = (s) => (norm(s).match(/[\p{L}\p{N}]{3,}/gu) || [])
  .map((w) => (w.startsWith("ال") && w.length > 4 ? w.slice(2) : w))
  .filter((w) => !STOP.has(w));

function rankPages(pages, query) {
  const terms = [...new Set(words(query))];
  if (!terms.length) return pages;
  const df = new Map(terms.map((t) => [t, 0]));
  const counted = pages.map((p) => {
    const tf = new Map();
    for (const w of words(p.text)) if (df.has(w)) tf.set(w, (tf.get(w) || 0) + 1);
    for (const t of tf.keys()) df.set(t, df.get(t) + 1);
    return { p, tf, len: p.text.length };
  });
  const avg = counted.reduce((n, c) => n + c.len, 0) / (counted.length || 1) || 1;
  const N = pages.length;
  return counted
    .map(({ p, tf, len }) => {
      let s = 0;
      for (const [t, f] of tf) {
        const idf = Math.log(1 + (N - df.get(t) + 0.5) / (df.get(t) + 0.5));
        s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * len / avg));
      }
      return { p, s };
    })
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .map((x) => x.p);
}

/** The best-ranked pages that fit in `limit` characters, back in book order. */
function bestPages(ranked, limit) {
  const out = [];
  let used = 0;
  for (const p of ranked) {
    if (used + p.text.length > limit) continue;
    out.push(p);
    used += p.text.length + 12;
  }
  return out.sort((a, b) => (a.title === b.title ? a.page - b.page : a.title.localeCompare(b.title)));
}

module.exports = { pageRange, rankPages, bestPages, words };
