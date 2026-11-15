// functions/homeCopyCore.js
//
// Logic of the main menu's slim list copies (callable wrapper: homeCopy.js).
const { makeCore, toMillis } = require("./facilityDashboardCopyCore");

const pick = (fields) => (id, data) => {
  const out = { id };
  fields.forEach((f) => {
    const v = data ? data[f] : undefined;
    if (v === undefined || v === null || v === "") return;
    out[f] = v && typeof v === "object" ? toMillis(v) : v;
  });
  return out;
};

// The fields src/utils/homeStats.js reads, and nothing else
// (tests/homeCopy.test.js keeps the two in step).
const LISTS = {
  courses: { collection: "courses", fields: ["start_date", "state", "locality", "course_type", "isDeleted", "lastUpdatedAt"] },
  participants: { collection: "participants", fields: ["courseId", "post_test_score", "isDeleted", "lastUpdatedAt"] },
  sessions: { collection: "skillMentorship", fields: ["status", "sessionDate", "date", "state", "locality", "service", "facilityId", "facilityName", "isDeleted", "lastUpdatedAt"] },
  facilitators: { collection: "facilitators", fields: ["currentState", "isDeleted", "lastUpdatedAt"] },
};

function makeHomeCopy({ db, Timestamp: Ts, now, log = () => {}, tally = () => {} }) {
  const cores = Object.fromEntries(Object.entries(LISTS).map(([key, def]) => [key, makeCore({
    db, Timestamp: Ts, now, log, tally,
    collection: def.collection, slim: pick(def.fields), markField: "lastUpdatedAt", storeId: `home_${key}`,
    minRefreshMs: 60 * 1000, countEveryMs: 10 * 60 * 1000, persistEveryMs: 10 * 60 * 1000,
  })]));
  /** `known`: { courses: version, ... } the app already holds. */
  async function answer(known = {}) {
    const out = {};
    for (const key of Object.keys(LISTS)) {
      // One list at a time keeps the instance's memory and reads predictable.
      out[key] = await cores[key].answer(typeof known[key] === "string" ? known[key] : null);
    }
    return out;
  }
  return { answer };
}

module.exports = { makeHomeCopy, LISTS, pick };
