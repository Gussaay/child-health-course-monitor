// functions/googleUsage.js
//
// Google's OWN count of this project's Firestore reads, writes and deletes for
// a month: the numbers behind the Firebase console's Usage graphs, read from
// Cloud Monitoring. The admin Usage tab puts them beside the counts the app
// keeps itself, so the per-user and per-page breakdown (the app's) can be
// checked against the total Google actually saw.
//
// Super users only. Runs as the function's own service account, which needs
// the "Monitoring Viewer" role (roles/monitoring.viewer). The project's default
// service account normally has it through Editor; if Google refuses, the error
// names the role so the fix is one click in the console.
//
// This reports OPERATION COUNTS and a Firestore cost worked out from them with
// the daily free quota. It is not the invoice: other services (Functions,
// Storage, Hosting, AI) are billed on the Billing page, which no function can
// read without a BigQuery billing export. Logic: googleUsageCore.js.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { UsageError, loadMonth } = require("./googleUsageCore");

async function accessToken() {
  const token = await getApp().options.credential.getAccessToken();
  return token.access_token;
}

const googleFirestoreUsage = onCall({ timeoutSeconds: 60 }, async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  const snap = await getFirestore().collection("users").doc(auth.uid).get();
  const d = snap.exists ? snap.data() || {} : {};
  const roles = Array.isArray(d.roles) && d.roles.length ? d.roles : (d.role ? [String(d.role).toLowerCase()] : []);
  if (!roles.includes("super_user")) throw new HttpsError("permission-denied", "Only a super user can read the project's usage.");
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new HttpsError("failed-precondition", "The project id is not available to this function.");
  try {
    return await loadMonth({ projectId, month: String((data && data.month) || ""), token: await accessToken() });
  } catch (e) {
    if (e instanceof UsageError) throw new HttpsError(e.code, e.message);
    throw e;
  }
});

module.exports = { googleFirestoreUsage };
