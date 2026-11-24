// functions/publicMentorshipCopy.js
//
// Callable for the public mentorship dashboard link (see
// publicMentorshipCopyCore.js). Open to visitors who are not signed in: it
// returns only the anonymous copy (no names, phones, emails, notes or problem
// text), served from the server's memory, so a visitor costs no database
// reads beyond the shared refresh.
const { onCall } = require("firebase-functions/v2/https");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { makePublicMentorshipCopy } = require("./publicMentorshipCopyCore");
const { tallyFor, flushUsage } = require("./usageTally");

let copy = null;

const publicMentorshipCopy = onCall({ timeoutSeconds: 120, memory: "1GiB" }, async (request) => {
  const db = getFirestore();
  if (!copy) copy = makePublicMentorshipCopy({ db, Timestamp, log: (...a) => console.log("[publicMentorship]", ...a), tally: tallyFor("publicMentorshipCopy") });
  const known = request.data && typeof request.data.versions === "object" && request.data.versions ? request.data.versions : {};
  const result = await copy.answer(known);
  await flushUsage(db);
  return result;
});

module.exports = { publicMentorshipCopy };
