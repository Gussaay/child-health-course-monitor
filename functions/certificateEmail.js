// Sends certificates by email, straight from the server: the PDF the app drew
// as an attachment when it is given, with the download link as a backup.
//
// This replaces the "Trigger Email from Firestore" extension for certificates.
// Firebase Extensions shut down on 31 March 2027, and the extension only ever
// told the app "queued": when Gmail refused a message the person sending saw
// nothing. Here each email is sent while the person waits, and any failure
// comes back with its reason.
//
// Setup, once:
//   1. Turn on 2-Step Verification for child.health.sudan@gmail.com and create
//      an App Password (Google Account > Security > App passwords).
//   2. firebase functions:secrets:set SMTP_PASSWORD   (paste the app password)
//   3. Deploy functions (a push to main does it).

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");

const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");
const FROM_ADDRESS = "child.health.sudan@gmail.com";
const FROM_NAME = "National Child Health Program";
const LIVE_SITE = "https://imnci-courses-monitor.web.app";
const MAX_PER_CALL = 100;

// Same list as staffRoles() in firestore.rules: who may email certificates.
const STAFF_ROLES = ["super_user", "federal_manager", "states_manager", "locality_manager",
  "federal_coordinator", "facilitator", "state_coordinator", "course_coordinator", "mentor"];

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

function buildMessage(participant, id, lang, attached) {
  const link = `${LIVE_SITE}/public/certificate/download/${encodeURIComponent(id)}?lang=${lang}`;
  const name = escapeHtml(participant.name);
  if (lang === "ar") {
    const how = attached
      ? `<p>تجد شهادتك مرفقة بهذه الرسالة كملف PDF. ويمكنك أيضاً تحميلها من الرابط أدناه:</p>`
      : `<p>يمكنك تحميل شهادتك مباشرة من الرابط أدناه:</p>`;
    return {
      subject: `شهادة إكمال الدورة - ${participant.name || ""}`,
      html: `<div dir="rtl"><p>عزيزي/عزيزتي <strong>${name}</strong>،</p>
        <p>تهانينا على إكمال الدورة التدريبية.</p>
        ${how}
        <p><a href="${link}">اضغط هنا لتحميل الشهادة</a></p>
        <br/><p>البرنامج القومي لصحة الطفل</p></div>`,
    };
  }
  const how = attached
    ? `<p>Your certificate is attached to this email as a PDF. You can also download it from the link below:</p>`
    : `<p>You can download your certificate directly from the link below:</p>`;
  return {
    subject: `Course Completion Certificate - ${participant.name || ""}`,
    html: `<p>Dear <strong>${name}</strong>,</p>
      <p>Congratulations on completing the training course.</p>
      ${how}
      <p><a href="${link}">Click here to download certificate</a></p>
      <br/><p>National Child Health Program</p>`,
  };
}

// A certificate the app drew on the sender's device, checked before it goes
// out: it must really be a PDF and of a sensible size.
const MAX_PDF_BYTES = 7 * 1024 * 1024;
function readPdf(base64) {
  if (typeof base64 !== "string" || !base64) return null;
  const buf = Buffer.from(base64, "base64");
  if (buf.length === 0 || buf.length > MAX_PDF_BYTES) return null;
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") return null;
  return buf;
}

const fileNameFor = (participant) => {
  const safe = String(participant.name || "Certificate").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_").slice(0, 80);
  return `Certificate_${safe || "Participant"}.pdf`;
};

// Gmail's answers, in words a programme officer can act on.
function explain(error) {
  const text = String(error?.response || error?.message || error);
  if (error?.code === "EAUTH" || /Invalid login|Username and Password not accepted|BadCredentials/i.test(text)) {
    return "The programme's Gmail account refused the password. The SMTP_PASSWORD app password needs renewing.";
  }
  if (/Daily user sending limit|quota/i.test(text)) return "Gmail's daily sending limit has been reached. Try again tomorrow.";
  if (/recipient|mailbox|550|553/i.test(text)) return "The email address was refused. Check it is typed correctly.";
  return text.slice(0, 200);
}

exports.sendCertificateEmails = onCall({ secrets: [SMTP_PASSWORD], timeoutSeconds: 300 }, async (request) => {
  const { auth, data } = request;
  if (!auth) throw new HttpsError("unauthenticated", "You must be logged in.");

  const db = getFirestore();
  const profile = (await db.collection("users").doc(auth.uid).get()).data() || {};
  const roles = Array.isArray(profile.roles) && profile.roles.length ? profile.roles : [String(profile.role || "").toLowerCase()];
  if (!roles.some((r) => STAFF_ROLES.includes(r))) {
    throw new HttpsError("permission-denied", "You do not have permission to email certificates.");
  }

  const ids = Array.isArray(data?.participantIds) ? [...new Set(data.participantIds.filter((x) => typeof x === "string" && x))] : [];
  const lang = data?.lang === "ar" ? "ar" : "en";
  // Optional: { participantId: base64 PDF } drawn by the app, attached as is.
  const pdfs = data?.pdfs && typeof data.pdfs === "object" ? data.pdfs : {};
  if (ids.length === 0) throw new HttpsError("invalid-argument", "No participants were given.");
  if (ids.length > MAX_PER_CALL) throw new HttpsError("invalid-argument", `At most ${MAX_PER_CALL} emails at a time.`);

  const password = SMTP_PASSWORD.value();
  if (!password) throw new HttpsError("failed-precondition", "Email sending is not set up yet (SMTP_PASSWORD is missing).");

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com", port: 465, secure: true, pool: true, maxConnections: 2,
    auth: { user: FROM_ADDRESS, pass: password },
  });

  try {
    await transport.verify();
  } catch (error) {
    throw new HttpsError("failed-precondition", explain(error));
  }

  // The link and the address come from the participant record, never from the
  // caller, so this cannot be used to send arbitrary mail from our account.
  const refs = ids.map((id) => db.collection("participants").doc(id));
  const snaps = await db.getAll(...refs);
  const results = [];
  for (const snap of snaps) {
    const id = snap.id;
    const p = snap.exists ? snap.data() : null;
    if (!p || p.isDeleted === true || p.isDeleted === "true") {
      results.push({ id, ok: false, error: "Participant not found." });
      continue;
    }
    const to = String(p.email || "").trim();
    if (!EMAIL_RE.test(to)) {
      results.push({ id, name: p.name || "", ok: false, error: to ? "The saved email address is not valid." : "No email address saved." });
      continue;
    }
    try {
      const pdf = readPdf(pdfs[id]);
      if (pdfs[id] && !pdf) {
        results.push({ id, name: p.name || "", ok: false, error: "The certificate file was not a valid PDF." });
        continue;
      }
      const { subject, html } = buildMessage(p, id, lang, !!pdf);
      await transport.sendMail({
        from: { name: FROM_NAME, address: FROM_ADDRESS }, to, subject, html,
        attachments: pdf ? [{ filename: fileNameFor(p), content: pdf, contentType: "application/pdf" }] : [],
      });
      results.push({ id, name: p.name || "", ok: true, attached: !!pdf });
    } catch (error) {
      results.push({ id, name: p.name || "", ok: false, error: explain(error) });
    }
  }
  transport.close();

  await db.collection("certificateEmailLog").add({
    by: auth.uid, at: new Date(), lang,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  }).catch(() => null);

  return { results };
});
