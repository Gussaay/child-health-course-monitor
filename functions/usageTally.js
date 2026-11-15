// functions/usageTally.js
//
// Reads made by Cloud Functions go through the Admin SDK, so the app's own
// counter (src/utils/usageLedger.js) never sees them, and the admin
// "What costs money, and who" tab showed far fewer reads than Google's
// count. Each function notes its reads here, and the totals are added to the
// same monthly documents the app writes:
//
//   usageMonthly/<YYYY-MM>_fn_<function>
//     email "Cloud Function: <function>", reads, writes, byCollection,
//     byView.fn_<function>, bySource.function
//
// so each function appears as its own row under "Who", its lists under
// "Which list", and "function" under "Which kind of activity".
//
// Counting costs little: the totals are kept in the instance's memory and
// written at most every 10 minutes (one write per function), or sooner once
// 5,000 reads have piled up. A flush that fails keeps its counts for the next
// one. An instance shut down between flushes loses at most those minutes.
//
// Billing rules used: a query is one read per document returned, or one read
// when it returns nothing; a count() is one read per 1,000 documents counted
// (at least one); a document get is one read.

const FLUSH_MS = 10 * 60 * 1000;
const FLUSH_READS = 5000;

let pending = {};
let pendingReads = 0;
let lastFlush = Date.now();

const safeKey = (name) => String(name || "other").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40) || "other";
const monthKey = (d = new Date()) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** Reads billed for a query snapshot. */
const queryReads = (snap) => Math.max(1, (snap && snap.size) || 0);
/** Reads billed for a count() of `n` documents. */
const countReads = (n) => Math.max(1, Math.ceil((Number(n) || 0) / 1000));

/** Notes `reads` (and `writes`) made by function `fn` on `collection`. */
function tally(fn, collection, reads = 0, writes = 0) {
  if (!(reads > 0) && !(writes > 0)) return;
  const f = safeKey(fn);
  const c = safeKey(collection);
  const row = pending[f] || (pending[f] = { reads: 0, writes: 0, byCollection: {} });
  row.reads += reads || 0;
  row.writes += writes || 0;
  const col = row.byCollection[c] || (row.byCollection[c] = { r: 0, w: 0 });
  col.r += reads || 0;
  col.w += writes || 0;
  pendingReads += reads || 0;
}

/** A tally bound to one function name. */
const tallyFor = (fn) => (collection, reads, writes) => tally(fn, collection, reads, writes);

/** The monthly document update for one function's totals (`inc` is FieldValue.increment). */
function payloadFor(fn, row, inc, stamp, month = monthKey()) {
  const both = (r, w) => ({ ...(r ? { r: inc(r) } : {}), ...(w ? { w: inc(w) } : {}) });
  return {
    month,
    email: `Cloud Function: ${fn}`,
    reads: inc(row.reads),
    writes: inc(row.writes),
    trackingWrites: inc(1),
    byCollection: Object.fromEntries(Object.entries(row.byCollection).map(([k, v]) => [k, both(v.r, v.w)])),
    byView: { [`fn_${fn}`]: both(row.reads, row.writes) },
    bySource: { function: both(row.reads, row.writes) },
    lastUpdated: stamp(),
  };
}

/**
 * Writes the noted totals when they are due (or always with `force`). Never
 * throws: counting must not break the function it measures.
 */
async function flushUsage(db, { force = false, now = Date.now() } = {}) {
  if (!Object.keys(pending).length) return false;
  if (!force && now - lastFlush < FLUSH_MS && pendingReads < FLUSH_READS) return false;
  const taken = pending;
  pending = {};
  pendingReads = 0;
  lastFlush = now;
  const month = monthKey(new Date(now));
  try {
    const { FieldValue } = require("firebase-admin/firestore");
    const batch = db.batch();
    Object.entries(taken).forEach(([fn, row]) => {
      batch.set(db.collection("usageMonthly").doc(`${month}_fn_${fn}`),
        payloadFor(fn, row, FieldValue.increment, FieldValue.serverTimestamp, month), { merge: true });
    });
    await batch.commit();
    return true;
  } catch (e) {
    // Put the counts back for the next flush.
    Object.entries(taken).forEach(([fn, row]) => {
      Object.entries(row.byCollection).forEach(([c, v]) => tally(fn, c, v.r, v.w));
    });
    console.warn("[usageTally] flush failed:", e && e.message);
    return false;
  }
}

/** Test helper. */
function _reset() { pending = {}; pendingReads = 0; lastFlush = Date.now(); }
const _pending = () => pending;

module.exports = { tally, tallyFor, queryReads, countReads, flushUsage, payloadFor, monthKey, _reset, _pending };
