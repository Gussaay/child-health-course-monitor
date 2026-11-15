// functions/homeCopy.js
//
// The main menu's greeting numbers (courses, participants trained, average
// score, mentorship visits, facilities reached, facilitators) used to need
// every course, participant, visit and facilitator downloaded to each phone:
// thousands of database reads per device. This callable keeps a slim copy of
// those four lists in the server's memory (same core as the Dashboard's
// facility copy: only changed records are read, a count() catches deletes,
// a full rebuild once a week) and sends them to the app, which works the
// numbers out exactly as before (src/utils/homeStats.js).
//
// The app sends the version it holds for each list; only lists that changed
// are sent back. The copies hold no names, phones or other personal data.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { makeHomeCopy } = require("./homeCopyCore");
const { tallyFor, flushUsage } = require("./usageTally");

let home = null;

const homeCopy = onCall({ timeoutSeconds: 120, memory: "1GiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  const db = getFirestore();
  if (!home) home = makeHomeCopy({ db, Timestamp, log: (...a) => console.log("[homeCopy]", ...a), tally: tallyFor("homeCopy") });
  const known = request.data && typeof request.data.versions === "object" && request.data.versions ? request.data.versions : {};
  const result = await home.answer(known);
  await flushUsage(db);
  return result;
});

module.exports = { homeCopy };
