// functions/mentorshipCopy.js
//
// Callable: the mentorship lists for a device's first download, from the
// server's copy (mentorshipCopyCore.js) instead of the database. Staff only,
// as the database rules allow these lists (staffRoles() in firestore.rules).
//   { lists: [...], versions: {...} }   -> manifest
//   { list, page, version }             -> one page
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { makeMentorshipCopy } = require("./mentorshipCopyCore");
const { tallyFor, flushUsage } = require("./usageTally");

// Same allowlist as staffRoles() in firestore.rules.
const STAFF_ROLES = [
  "super_user", "federal_manager", "states_manager", "locality_manager",
  "federal_coordinator", "facilitator", "state_coordinator", "course_coordinator", "mentor",
];

let copy = null;

const mentorshipCopy = onCall({ timeoutSeconds: 300, memory: "2GiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  const db = getFirestore();
  const snap = await db.collection("users").doc(request.auth.uid).get();
  const profile = snap.exists ? snap.data() || {} : {};
  const roles = [profile.role, ...(Array.isArray(profile.roles) ? profile.roles : [])].filter(Boolean).map((r) => String(r).toLowerCase());
  if (!roles.some((r) => STAFF_ROLES.includes(r))) throw new HttpsError("permission-denied", "Staff only.");
  if (!copy) copy = makeMentorshipCopy({ db, Timestamp, log: (...a) => console.log("[mentorshipCopy]", ...a), tally: tallyFor("mentorshipCopy") });
  const data = request.data && typeof request.data === "object" ? request.data : {};
  const result = typeof data.list === "string"
    ? await copy.page(data.list, data.page, typeof data.version === "string" ? data.version : null)
    : await copy.manifest(data.versions && typeof data.versions === "object" ? data.versions : {}, Array.isArray(data.lists) ? data.lists : null);
  await flushUsage(db);
  return result;
});

module.exports = { mentorshipCopy };
