// functions/facilityDashboardCopy.js
//
// Callable: the Dashboard's copy of the health facilities (see
// facilityDashboardCopyCore.js). Any signed-in user; the facilities themselves
// are readable by everyone (firestore.rules), so this shows nothing new.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { makeCore } = require("./facilityDashboardCopyCore");
const { tallyFor, flushUsage } = require("./usageTally");

let core = null;

const facilityDashboardCopy = onCall({ timeoutSeconds: 120, memory: "1GiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  if (!core) core = makeCore({ db: getFirestore(), Timestamp, log: (...a) => console.log("[dashboardCopy]", ...a), tally: tallyFor("facilityDashboardCopy"),
    // Requests within a minute share one refresh; deletes are checked every
    // 10 minutes; a changed copy is saved at most every 10 minutes.
    minRefreshMs: 60 * 1000, countEveryMs: 10 * 60 * 1000, persistEveryMs: 10 * 60 * 1000 });
  const known = request.data && typeof request.data.version === "string" ? request.data.version : null;
  const answer = await core.answer(known);
  await flushUsage(getFirestore());
  return answer;
});

module.exports = { facilityDashboardCopy };
