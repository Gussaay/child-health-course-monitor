// functions/aiBooksVectors.js
//
// Page vectors for the AI library, so a question finds pages by meaning as
// well as by their words (aiBooksText.js hybridRankPages).
//
// Each page's text is embedded once with Gemini and kept with the book:
//   aiBooks/{id}/vectors/{part}  { stamp, dims, from, rows: base64 int8[], scales: base64 float32[] }
// one part per 400 pages, int8 with a scale per page (value = q * scale), so a
// 400-page book takes ~100 KB. `stamp` is the book's updatedAt: a book whose
// pages change is embedded again. Vectors are made the first time a book is
// asked about, a few books at a time; until then it is searched by keywords.

const EMBED_MODEL = "gemini-embedding-001";
const DIMS = 256;
const PART = 400;
const BATCH = 100;      // texts per embedding call
const PAGE_CHARS = 6000;
const memo = new Map(); // bookId -> { stamp, vecs: Map(page -> { q: Int8Array, scale }) }

async function embed(texts, key, taskType) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      requests: texts.map((t) => ({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: t }] },
        taskType,
        outputDimensionality: DIMS,
      })),
    }),
    signal: AbortSignal.timeout(30000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`embedding ${r.status}: ${j?.error?.message || ""}`);
  return (j.embeddings || []).map((e) => unit(Float32Array.from(e.values || [])));
}

function unit(v) {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

function quantise(v) {
  const max = Math.max(...v.map(Math.abs)) || 1;
  const scale = max / 127;
  return { q: Int8Array.from(v, (x) => Math.round(x / scale)), scale };
}

const toB64 = (typed) => Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength).toString("base64");
const fromB64 = (s, Type) => {
  const b = Buffer.from(s || "", "base64");
  const out = new Type(b.length / Type.BYTES_PER_ELEMENT);
  new Uint8Array(out.buffer).set(b);
  return out;
};

/** The book's page vectors (Map page -> { q, scale }), made and saved when missing. */
async function bookVectors(db, entry, key, { make = true } = {}) {
  const id = entry.book.id;
  const hit = memo.get(id);
  if (hit && hit.stamp === entry.stamp) return hit.vecs;

  const col = db.collection("aiBooks").doc(id).collection("vectors");
  const parts = (await col.get()).docs.map((d) => d.data());
  const vecs = new Map();
  if (parts.length && parts.every((p) => p.stamp === entry.stamp && p.dims === DIMS)) {
    for (const p of parts) {
      const rows = fromB64(p.rows, Int8Array);
      const scales = fromB64(p.scales, Float32Array);
      const pages = p.pages || [];
      pages.forEach((page, i) => vecs.set(page, { q: rows.subarray(i * DIMS, (i + 1) * DIMS), scale: scales[i] }));
    }
    memo.set(id, { stamp: entry.stamp, vecs });
    return vecs;
  }
  if (!make || !key) return null;

  const pages = [];
  entry.pages.forEach((t, i) => { if (t && t.trim()) pages.push(i + 1); });
  const made = [];
  for (let i = 0; i < pages.length; i += BATCH) {
    const batch = pages.slice(i, i + BATCH);
    const out = await embed(batch.map((p) => entry.pages[p - 1].slice(0, PAGE_CHARS)), key, "RETRIEVAL_DOCUMENT");
    out.forEach((v, k) => made.push([batch[k], quantise(v)]));
  }
  const batch = db.batch();
  parts.length && (await col.get()).docs.forEach((d) => batch.delete(d.ref));
  for (let i = 0; i < made.length; i += PART) {
    const slice = made.slice(i, i + PART);
    const rows = new Int8Array(slice.length * DIMS);
    slice.forEach(([, v], k) => rows.set(v.q, k * DIMS));
    batch.set(col.doc(`p${String(i / PART).padStart(3, "0")}`), {
      stamp: entry.stamp, dims: DIMS, model: EMBED_MODEL,
      pages: slice.map(([p]) => p),
      rows: toB64(rows),
      scales: toB64(Float32Array.from(slice.map(([, v]) => v.scale))),
    });
  }
  await batch.commit();
  made.forEach(([p, v]) => vecs.set(p, v));
  memo.set(id, { stamp: entry.stamp, vecs });
  vecs.fresh = true; // made in this call, which spends embedding quota
  return vecs;
}

/**
 * A function giving each page's similarity to the question (or null), for
 * the books in `entries`. Embeds at most `newBooks` books that have no
 * vectors yet; any failure leaves the keyword search to do the work.
 */
async function meaningOf(db, entries, query, key, { newBooks = 2, log = () => {} } = {}) {
  // Embedding sends book text to Google, so it follows the app's Gemini
  // switch (off unless AI_USE_GEMINI=1, see aiModels.js): keywords alone then.
  if (process.env.AI_USE_GEMINI !== "1") return null;
  if (!key || !entries.length) return null;
  let budget = newBooks;
  const byBook = new Map();
  for (const e of entries) {
    try {
      const v = await bookVectors(db, e, key, { make: budget > 0 });
      if (!v) continue;
      byBook.set(e.book.id, v);
      if (v.fresh) {
        delete v.fresh;
        budget--;
      }
    } catch (err) {
      log(`vectors for ${e.book.id}: ${err.message}`);
      budget = 0;
    }
  }
  if (!byBook.size) return null;
  const [q] = await embed([query.slice(0, 2000)], key, "RETRIEVAL_QUERY");
  return (page) => {
    const v = byBook.get(page.bookId)?.get(page.page);
    if (!v) return null;
    let s = 0;
    for (let d = 0; d < DIMS; d++) s += v.q[d] * q[d];
    return s * v.scale;
  };
}

module.exports = { meaningOf, bookVectors, EMBED_MODEL, DIMS };
