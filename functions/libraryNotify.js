// Emails the people who registered for a draft library item when the item
// becomes final. A draft item in `libraryItems` is shown in the Child Health
// Library but cannot be opened; instead a visitor leaves their name and
// email address in `libraryRequests` ("Notify me"). When a manager saves the
// item as final, this trigger sends each waiting person the item's public
// link and stamps their registration `notifiedAt`, so nobody is emailed
// twice for the same item.
//
// Uses the same Gmail account and SMTP_PASSWORD secret as
// certificateEmail.js (child.health.sudan@gmail.com).

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");

const SMTP_PASSWORD = defineSecret("SMTP_PASSWORD");
const FROM_ADDRESS = "child.health.sudan@gmail.com";
const FROM_NAME = "National Child Health Program";
const LIVE_SITE = "https://imnci-courses-monitor.web.app";
const MAX_PER_RUN = 200;

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function buildMessage(person, item, itemId) {
  const link = `${LIVE_SITE}/public/library/item/${encodeURIComponent(itemId)}`;
  const name = escapeHtml(person.name);
  const title = escapeHtml(item.name);
  if (person.lang === "ar") {
    return {
      subject: `أصبح متاحاً الآن في مكتبة صحة الطفل: ${item.name || ""}`,
      html: `<div dir="rtl"><p>عزيزي/عزيزتي <strong>${name}</strong>،</p>
        <p>طلبتَ إشعارك عندما يصبح كتاب «${title}» جاهزاً في مكتبة صحة الطفل. الكتاب الآن نهائي ومتاح للقراءة والتحميل:</p>
        <p><a href="${link}">اضغط هنا لفتح الكتاب</a></p>
        <br/><p>البرنامج القومي لصحة الطفل</p></div>`,
    };
  }
  return {
    subject: `Now available in the Child Health Library: ${item.name || ""}`,
    html: `<p>Dear <strong>${name}</strong>,</p>
      <p>You asked to be told when <strong>${title}</strong> became available in the Child Health Library. It is now final and ready to read or download:</p>
      <p><a href="${link}">Click here to open the book</a></p>
      <br/><p>National Child Health Program</p>`,
  };
}

exports.libraryNotifyOnPublish = onDocumentUpdated(
  { document: "libraryItems/{itemId}", secrets: [SMTP_PASSWORD], timeoutSeconds: 300 },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    // Only the draft -> final step sends mail. An item with no status counts
    // as final, so edits to older items never trigger this.
    if (before.status !== "draft" || after.status === "draft") return;

    const itemId = event.params.itemId;
    const db = getFirestore();
    const snap = await db.collection("libraryRequests").where("itemId", "==", itemId).get();
    const waiting = snap.docs.filter((d) => !d.data().notifiedAt).slice(0, MAX_PER_RUN);
    if (waiting.length === 0) return;

    const password = SMTP_PASSWORD.value();
    if (!password) {
      console.error("libraryNotify: SMTP_PASSWORD is not set; cannot email", waiting.length, "people about", itemId);
      return;
    }
    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 465, secure: true, pool: true, maxConnections: 2,
      auth: { user: FROM_ADDRESS, pass: password },
    });

    let sent = 0;
    let failed = 0;
    try {
      await transport.verify();
      for (const docSnap of waiting) {
        const person = docSnap.data();
        const to = String(person.email || "").trim();
        try {
          const { subject, html } = buildMessage(person, after, itemId);
          await transport.sendMail({ from: { name: FROM_NAME, address: FROM_ADDRESS }, to, subject, html });
          await docSnap.ref.update({ notifiedAt: FieldValue.serverTimestamp() });
          sent += 1;
        } catch (error) {
          failed += 1;
          await docSnap.ref.update({
            notifyError: String(error?.message || error).slice(0, 300),
            notifyAttemptAt: FieldValue.serverTimestamp(),
          }).catch(() => null);
        }
      }
    } catch (error) {
      console.error("libraryNotify: transport failed for", itemId, error);
      failed = waiting.length;
    } finally {
      transport.close();
    }

    await db.collection("libraryNotifyLog").add({
      itemId, itemName: after.name || "", at: new Date(), sent, failed,
    }).catch(() => null);
  }
);
