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

const publicMentorshipCopy = onCall({ timeoutSeconds: 300, memory: "1GiB" }, async (request) => {
  const db = getFirestore();
  if (!copy) copy = makePublicMentorshipCopy({ db, Timestamp, log: (...a) => console.log("[publicMentorship]", ...a), tally: tallyFor("publicMentorshipCopy") });
  const data = request.data && typeof request.data === "object" ? request.data : {};
  // { list, page, version }: one page of one list. Otherwise the manifest:
  // each list's version and page count (lists the browser holds at that
  // version come back { unchanged: true }).
  const result = typeof data.list === "string"
    ? await copy.page(data.list, data.page, typeof data.version === "string" ? data.version : null)
    : await copy.manifest(data.versions && typeof data.versions === "object" ? data.versions : {});
  await flushUsage(db);
  return result;
});

module.exports = { publicMentorshipCopy };
