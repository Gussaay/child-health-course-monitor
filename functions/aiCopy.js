// functions/aiCopy.js
//
// The data assistant's counting questions about health facilities used to read
// up to 6,000 facility records from the database each time (one billed read per
// record). The server already keeps a slim copy of every facility for the
// Dashboard (facilityDashboardCopyCore.js: every field except staff lists,
// signatures, photos, notes and history, kept current by reading only what
// changed). A counting question that needs only fields the copy keeps is
// answered from it, with the same filters and the caller's own scope applied
// in memory, so it costs a handful of reads instead of thousands.
//
// Anything that is not certain to give the same answer falls back to the
// database: another list, a field the copy drops, a date bucket, a list opened
// with `each`, an operator whose comparison differs from Firestore's.
const { makeCore, DROP_KEY } = require("./facilityDashboardCopyCore");

const SIMPLE_FIELD = /^[^./]{1,120}$/;
const primitive = (v) => ["string", "number", "boolean"].includes(typeof v);

/** The conditions a Firestore query would apply: the request's filters, then the caller's scope. */
function conditionsFor(access, spec, filters) {
  const out = (Array.isArray(filters) ? filters : []).map((f) => ({ field: f.field, op: f.op || "==", value: f.value }));
  if (spec && spec.scope && access.manageScope !== "all" && access.manageLocation) {
    if (access.manageScope === "state" && spec.scope.state) out.push({ field: spec.scope.state, op: "==", value: access.manageLocation });
    else if (access.manageScope === "locality" && spec.scope.locality) out.push({ field: spec.scope.locality, op: "==", value: access.manageLocation });
  }
  return out;
}

/** True when `conditions` can be applied in memory exactly as Firestore would. */
function applicable(conditions) {
  return conditions.every((c) => {
    if (!SIMPLE_FIELD.test(c.field) || DROP_KEY.test(c.field)) return false;
    if (c.op === "==" || c.op === "!=") return primitive(c.value);
    if (c.op === "in") return Array.isArray(c.value) && c.value.length > 0 && c.value.length <= 30 && c.value.every(primitive);
    if (["<", "<=", ">", ">="].includes(c.op)) return typeof c.value === "number" || typeof c.value === "string";
    return false; // array-contains and anything else: ask the database
  });
}

function matches(item, c) {
  const v = item[c.field];
  if (v === undefined || v === null) return false; // Firestore: a missing field matches no condition
  switch (c.op) {
    case "==": return v === c.value;
    case "!=": return v !== c.value;
    case "in": return c.value.includes(v);
    default:
      if (typeof v !== typeof c.value) return false;
      if (c.op === "<") return v < c.value;
      if (c.op === "<=") return v <= c.value;
      if (c.op === ">") return v > c.value;
      return v >= c.value;
  }
}

/**
 * Facility records for a counting question, from the kept copy, or null when
 * the question must go to the database.
 *   fields   every field the question reads (groupBy, valueField, breakdown, isDeleted)
 */
function createCopyReader({ db, Timestamp, tally = () => {}, log = () => {}, now }) {
  let core = null;
  const getCore = () => {
    if (!core) {
      core = makeCore({
        db, Timestamp, tally, log, now,
        minRefreshMs: 60 * 1000, countEveryMs: 10 * 60 * 1000, persistEveryMs: 10 * 60 * 1000,
      });
    }
    return core;
  };

  async function facilities(access, spec, collection, filters, fields) {
    if (collection !== "healthFacilities") return null;
    const wanted = fields.filter((f) => f !== "isDeleted");
    if (!wanted.every((f) => SIMPLE_FIELD.test(f) && !DROP_KEY.test(f))) return null;
    const conditions = conditionsFor(access, spec, filters);
    if (!applicable(conditions)) return null;
    try {
      const { items } = await getCore().answer(null);
      if (!Array.isArray(items)) return null;
      return items.filter((item) => conditions.every((c) => matches(item, c)));
    } catch (e) {
      log("copy unavailable, reading the database", e && e.message);
      return null;
    }
  }
  return { facilities };
}

module.exports = { createCopyReader, conditionsFor, applicable, matches };
