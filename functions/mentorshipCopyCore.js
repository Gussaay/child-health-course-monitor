// functions/mentorshipCopyCore.js
//
// The app's mentorship lists (visits, IMNCI and EENC visit reports) as a
// server copy, for a device's FIRST download (docs/server-dashboard-kpis.md,
// tier "a"). Every record is sent whole, as the database would send it, with
// server timestamps as { seconds, nanoseconds } (the shape the app already
// keeps on the device), so nothing on the device can tell the difference.
// After this first download the device syncs changes from the database as
// before. Kept current like the other copies: changed records only, a
// count() for deletes, a weekly full rebuild.

const { makeCore, toMillis } = require("./facilityDashboardCopyCore");
const { makePagedLists } = require("./pagedLists");

const COLLECTIONS = {
  skillMentorshipSubmissions: "skillMentorship",
  imnciVisitReports: "imnciVisitReports",
  eencVisitReports: "eencVisitReports",
};

const isTimestamp = (v) => v && typeof v === "object" && (typeof v.toMillis === "function" || typeof v._seconds === "number");

function plain(value, depth = 0) {
  if (isTimestamp(value)) {
    const ms = toMillis(value);
    return { seconds: Math.floor(ms / 1000), nanoseconds: (ms % 1000) * 1e6 };
  }
  if (Array.isArray(value)) return value.map((v) => plain(v, depth + 1));
  if (value && typeof value === "object" && depth < 12) {
    const out = {};
    Object.keys(value).forEach((k) => { out[k] = plain(value[k], depth + 1); });
    return out;
  }
  return value;
}

/** One record, whole, with plain timestamps. */
function wholeRecord(id, data) {
  return { ...plain(data || {}), id };
}

const markOf = (r) => {
  const v = r && r.lastUpdatedAt;
  if (!v) return 0;
  if (typeof v === "number") return v;
  return typeof v.seconds === "number" ? v.seconds * 1000 + Math.round((v.nanoseconds || 0) / 1e6) : 0;
};

function makeMentorshipCopy({ db, Timestamp, now, log = () => {}, tally = () => {} }) {
  const cores = Object.fromEntries(Object.entries(COLLECTIONS).map(([key, collection]) => [key, makeCore({
    db, Timestamp, now, log, tally,
    collection, slim: wholeRecord, markField: "lastUpdatedAt", markOf, storeId: `app_mentorship_${key}`,
    minRefreshMs: 2 * 60 * 1000, countEveryMs: 30 * 60 * 1000, persistEveryMs: 30 * 60 * 1000,
  })]));
  const lists = Object.fromEntries(Object.keys(COLLECTIONS).map((key) => [key, () => {
    const st = cores[key]._state();
    // Deleted records are kept: the app's own full download includes them
    // too, and its screens leave them out.
    return { version: st.version, items: Array.from(st.items.values()) };
  }]));
  const refreshAll = () => Promise.all(Object.values(cores).map((c) => c.refresh()));
  return makePagedLists({ lists, refreshAll });
}

module.exports = { makeMentorshipCopy, wholeRecord, COLLECTIONS };
