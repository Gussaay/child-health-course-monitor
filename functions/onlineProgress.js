// functions/onlineProgress.js
//
// The managers' online course progress: the callable behind the dashboard
// tab, and the loader the data assistant's online_progress tool uses. The
// arithmetic is in onlineProgressReport.js.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { buildReport } = require("./onlineProgressReport");

const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** The report for the person `uid`, or null when they manage nobody. */
async function loadProgressReport(db, uid) {
  const me = await db.collection("users").doc(uid).get();
  if (!me.exists) return null;
  const [courses, items, progress, users] = await Promise.all([
    db.collection("onlineCourses").select("title", "isPublished", "isDeleted").get(),
    db.collection("onlineCourseItems").where("kind", "==", "section").select("courseId", "kind", "isDeleted").get(),
    db.collection("onlineProgress").select("completed").get(),
    db.collection("users").select("displayName", "name", "email", "assignedState", "assignedLocality", "role", "roles", "isDeleted").get(),
  ]);
  return buildReport({ caller: me.data(), courses: docs(courses), items: docs(items), progress: docs(progress), users: docs(users) });
}

exports.onlineProgressReport = onCall({ timeoutSeconds: 60, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const report = await loadProgressReport(getFirestore(), request.auth.uid);
  if (!report) throw new HttpsError("permission-denied", "Online course progress is for managers.");
  return report;
});

exports.loadProgressReport = loadProgressReport;
