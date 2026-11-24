// functions/dashboardKpis.js
//
// Callable: a dashboard's numbers worked out on the server
// (dashboardKpisCore.js, docs/server-dashboard-kpis.md). Signed-in users only:
// these are the app's own dashboards. Each page falls back to reading the
// lists itself when this cannot answer (for example if the paid plan lapses),
// so a failure here never blanks a dashboard.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { makeDashboardKpis } = require("./dashboardKpisCore");
const { tallyFor, flushUsage } = require("./usageTally");

let kpis = null;

const dashboardKpis = onCall({ timeoutSeconds: 300, memory: "1GiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  const db = getFirestore();
  if (!kpis) kpis = makeDashboardKpis({ db, Timestamp, log: (...a) => console.log("[dashboardKpis]", ...a), tally: tallyFor("dashboardKpis") });
  const result = await kpis.answer(request.data && typeof request.data === "object" ? request.data : {});
  if (result && result.error) throw new HttpsError("invalid-argument", result.error);
  await flushUsage(db);
  return result;
});

module.exports = { dashboardKpis };
