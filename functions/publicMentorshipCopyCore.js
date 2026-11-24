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
const { categorizeProblem } = require("./problemCategoriesCore");

// Any key whose name says it holds a person's details or free text.
const DROP_KEY = /phone|e-?mail|signature|^notes?$|_notes?$|notes$|comment|^mentor(Name|Display)$|^mother_?(name|phone)|^workerName$|^supervisor(Name|Display)$|responsible|createdBy|updatedBy|edited_?by|submittedBy|submitter|reporter|approvedBy|(^|By|_)uid$|^photos?|_photos?$|images?$/i;
// Facility staff lists, kept on some reports.
const DROP_EXACT = new Set(["staff", "staffList", "healthWorkers", "attendees", "participants"]);

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
    collection, slim: slimPublic, markField: "lastUpdatedAt", storeId: `public_mentorship_${key}`,
    minRefreshMs: 5 * 60 * 1000, countEveryMs: 30 * 60 * 1000, persistEveryMs: 30 * 60 * 1000,
  })]));
  // The facilities the dashboard needs (name, state, locality, type,
  // project, tools...), so the public page does not download the whole
  // facility list. Facility records are public already (firestore.rules);
  // staff lists and the other fields slimFacility drops are left out.
  const facilities = makeCore({
    db, Timestamp, now, log, tally,
    collection: "healthFacilities", slim: slimFacility, markField: "lastSnapshotAt", storeId: "public_mentorship_facilities",
    minRefreshMs: 5 * 60 * 1000, countEveryMs: 30 * 60 * 1000, persistEveryMs: 30 * 60 * 1000,
  });

  /** `known`: { submissions: version, ... } the browser already holds. */
  async function answer(known = {}) {
    const out = {};
    for (const key of Object.keys(COLLECTIONS)) {
      out[key] = await cores[key].answer(typeof known[key] === "string" ? known[key] : null);
    }
    // Only the facilities that some visit or visit report names.
    const ids = new Set();
    Object.keys(COLLECTIONS).forEach((key) => (out[key].items || []).forEach((r) => {
      const id = r && (r.facilityId || (r.fullData && r.fullData.facilityId));
      if (id) ids.add(id);
    }));
    await facilities.answer(null);
    const st = facilities._state();
    const items = st ? Array.from(st.items.values()).filter((f) => ids.has(f.id) && f.isDeleted !== true && f.isDeleted !== "true") : [];
    out.facilities = { count: items.length, items };
    return out;
  }
  return { answer };
}

module.exports = { makePublicMentorshipCopy, slimPublic, anonCode, COLLECTIONS };
