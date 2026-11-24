// functions/publicMentorshipCopyCore.js
//
// The public mentorship dashboard link is opened by people who are not signed
// in, and the database lets only signed-in users read mentorship visits (and
// only staff the IMNCI/EENC visit reports), so the public dashboard used to
// show 0 everywhere. This keeps a copy of the three collections for it, made
// on the server, with every personal detail taken out:
//
//   - health worker names become an anonymous code (one per worker and
//     facility), so "health workers visited" still counts correctly;
//   - mentors' names and emails, mothers' names, phones, signatures, notes,
//     comments and who created or edited the record are dropped;
//   - facility problems keep only their category and status, never the
//     problem text, the solution or the person responsible.
//
// The dashboard runs the same calculations on this copy as on the real
// records. Kept current the same way as the Dashboard's facility copy
// (facilityDashboardCopyCore.js): changed records only, a count() for
// deletes, a weekly full rebuild.

const crypto = require("crypto");
const { makeCore, toMillis, slimFacility } = require("./facilityDashboardCopyCore");
// The saved facility copy of facilityDashboardCopy.js (facilityDashboardCopyCore DOC_ID).
const FACILITY_STORE_ID = "facilities";
const { categorizeProblem } = require("./problemCategoriesCore");

// Any key whose name says it holds a person's details or free text.
const DROP_KEY = /phone|e-?mail|signature|^notes?$|_notes?$|notes$|comment|^mentor(Name|Display)$|^mother_?(name|phone)|^workerName$|^supervisor(Name|Display)$|responsible|createdBy|updatedBy|edited_?by|submittedBy|submitter|reporter|approvedBy|(^|By|_)uid$|^photos?|_photos?$|images?$/i;
// Facility staff lists, kept on some reports.
const DROP_EXACT = new Set(["staff", "staffList", "healthWorkers", "attendees", "participants"]);

const LONG_TEXT = 1000;
// Each page of a list sent to the browser stays under this many characters
// (a callable answer is limited in size; pages also arrive side by side).
const PAGE_CHARS = 3 * 1024 * 1024;

const anonCode = (facilityId, name) => {
  const key = `${facilityId || ""}|${String(name || "").trim().toLowerCase()}`;
  return `HW-${crypto.createHash("sha256").update(key).digest("hex").slice(0, 10)}`;
};

const isTimestamp = (v) => v && typeof v === "object" && (typeof v.toMillis === "function" || typeof v._seconds === "number");

// Server timestamps become { seconds, nanoseconds }, the shape the dashboard
// already reads (sub.effectiveDate.seconds).
const plainTime = (v) => {
  const ms = toMillis(v);
  return { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 };
};

function clean(value, depth = 0) {
  if (isTimestamp(value)) return plainTime(value);
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  if (value && typeof value === "object") {
    if (depth > 6) return null;
    const out = {};
    Object.keys(value).forEach((k) => {
      if (DROP_KEY.test(k) || DROP_EXACT.has(k)) return;
      out[k] = clean(value[k], depth + 1);
    });
    return out;
  }
  // Pictures saved inline and long free text: no chart reads them, and they
  // are most of a record's size.
  if (typeof value === "string" && (value.startsWith("data:") || value.length > LONG_TEXT)) return null;
  return value;
}

/** One record as the public dashboard receives it. */
function slimPublic(id, data) {
  const d = data || {};
  const out = clean(d);
  out.id = id;
  if (d.healthWorkerName) out.healthWorkerName = anonCode(d.facilityId, d.healthWorkerName);
  if (Array.isArray(d.challenges_table)) {
    out.challenges_table = d.challenges_table
      .filter((ch) => ch && String(ch.problem || "").trim())
      .map((ch) => ({
        id: ch.id ?? null,
        category: categorizeProblem(ch.problem),
        status: ch.status || ch.immediate_status || "Pending",
      }));
  }
  // Milliseconds, as the copy's delta queries need (makeCore reads the
  // newest lastUpdatedAt of the copy to know where to continue from).
  out.lastUpdatedAt = toMillis(d.lastUpdatedAt) || 0;
  return out;
}

const COLLECTIONS = {
  submissions: "skillMentorship",
  imnci: "imnciVisitReports",
  eenc: "eencVisitReports",
};

function makePublicMentorshipCopy({ db, Timestamp, now, log = () => {}, tally = () => {} }) {
  const cores = Object.fromEntries(Object.entries(COLLECTIONS).map(([key, collection]) => [key, makeCore({
    db, Timestamp, now, log, tally,
    collection, slim: slimPublic, markField: "lastUpdatedAt", storeId: `public_mentorship_v2_${key}`,
    minRefreshMs: 5 * 60 * 1000, countEveryMs: 30 * 60 * 1000, persistEveryMs: 30 * 60 * 1000,
  })]));
  // The facilities the dashboard needs (name, state, locality, type,
  // project, tools...), so the public page does not download the whole
  // facility list. Facility records are public already (firestore.rules);
  // staff lists and the other fields slimFacility drops are left out.
  // It shares the saved copy the main Dashboard's facility copy keeps
  // (facilityDashboardCopy.js, same store, same format), so a cold start
  // restores it instead of reading ~7,000 facilities again.
  const facilities = makeCore({
    db, Timestamp, now, log, tally,
    collection: "healthFacilities", slim: slimFacility, markField: "lastSnapshotAt", storeId: FACILITY_STORE_ID,
    minRefreshMs: 5 * 60 * 1000, countEveryMs: 30 * 60 * 1000, persistEveryMs: 30 * 60 * 1000,
  });

  const live = (r) => r && r.isDeleted !== true && r.isDeleted !== "true";
  const LISTS = [...Object.keys(COLLECTIONS), "facilities"];

  // The list as sent, with its version: visits and reports straight from
  // their copy; facilities cut down to those some visit or report names.
  function listNow(list) {
    if (COLLECTIONS[list]) {
      const st = cores[list]._state();
      return { version: st.version, items: Array.from(st.items.values()).filter(live) };
    }
    const ids = new Set();
    Object.keys(COLLECTIONS).forEach((k) => cores[k]._state().items.forEach((r) => { if (live(r) && r.facilityId) ids.add(r.facilityId); }));
    const fst = facilities._state();
    const version = `${fst ? fst.version : "none"}|${ids.size}|${Object.keys(COLLECTIONS).map((k) => cores[k]._state().version).join("|")}`;
    return { version, items: fst ? Array.from(fst.items.values()).filter((f) => ids.has(f.id) && live(f)) : [] };
  }

  // Pages are worked out once per version of each list.
  const paged = {};
  function pagesOf(list) {
    const { version, items } = listNow(list);
    if (paged[list] && paged[list].version === version) return paged[list];
    const pages = [];
    let cur = [];
    let size = 0;
    items.forEach((it) => {
      const n = JSON.stringify(it).length;
      if (cur.length && size + n > PAGE_CHARS) { pages.push(cur); cur = []; size = 0; }
      cur.push(it); size += n;
    });
    if (cur.length || !pages.length) pages.push(cur);
    paged[list] = { version, pages, count: items.length };
    return paged[list];
  }

  async function refreshAll() {
    await Promise.all([...Object.keys(COLLECTIONS).map((k) => cores[k].refresh()), facilities.refresh()]);
  }

  /**
   * What the browser should fetch: for each list its version and number of
   * pages, or { unchanged: true } when `known[list]` is already that version.
   */
  async function manifest(known = {}) {
    await refreshAll();
    const out = {};
    LISTS.forEach((list) => {
      const p = pagesOf(list);
      out[list] = known[list] === p.version ? { unchanged: true, version: p.version } : { version: p.version, pages: p.pages.length, count: p.count };
    });
    return out;
  }

  /** One page of one list; { stale: true } when the list moved on since the manifest. */
  async function page(list, n, version) {
    if (!LISTS.includes(list)) return { error: "unknown list" };
    await refreshAll();
    const p = pagesOf(list);
    if (version && version !== p.version) return { stale: true, version: p.version };
    const i = Number(n) || 0;
    if (i < 0 || i >= p.pages.length) return { error: "no such page" };
    return { version: p.version, page: i, pages: p.pages.length, items: p.pages[i] };
  }

  /** Everything in one answer (tests; small data sets). */
  async function answer(known = {}) {
    const m = await manifest(known);
    const out = {};
    LISTS.forEach((list) => {
      out[list] = m[list].unchanged ? m[list] : { version: m[list].version, items: [].concat(...pagesOf(list).pages) };
    });
    return out;
  }
  return { answer, manifest, page };
}

module.exports = { makePublicMentorshipCopy, slimPublic, anonCode, COLLECTIONS, PAGE_CHARS };
