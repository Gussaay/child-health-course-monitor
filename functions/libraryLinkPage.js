// functions/libraryLinkPage.js
//
// Answers a shared Child Health Library link (/public/library/...) with the
// site's own start page whose title and link-preview tags describe what was
// shared: a single item shows its name, full description and book photo; a
// service or section shows its name. WhatsApp, Facebook and Telegram read
// those tags without running JavaScript. The app itself starts as before and
// opens the library page from the address (src/components/library).
//
// Library items are public (firestore.rules: libraryItems read: true), so this
// reveals nothing a visitor could not already read. Any failure gets the
// unchanged site page.
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { withCourseTags } = require("./courseLinkTags");
const { parseLibraryLink, libraryPreview } = require("./libraryLinkMeta");

const SITES = {
  "imnci-courses-monitor.web.app": { name: "National Child Health Program", image: "https://imnci-courses-monitor.web.app/og-main.png" },
  "imnci-courses-monitor.firebaseapp.com": { name: "National Child Health Program", image: "https://imnci-courses-monitor.web.app/og-main.png" },
  "ch-sudan.web.app": { name: "Sudan Child Health Online Training and Guidelines", image: "https://ch-sudan.web.app/og-ch.png" },
  "ch-sudan.firebaseapp.com": { name: "Sudan Child Health Online Training and Guidelines", image: "https://ch-sudan.web.app/og-ch.png" },
  "emonc-sudan.web.app": { name: "Emergency Obstetrics and Newborn Care (EmONC)", image: "https://emonc-sudan.web.app/emonc-logo.png" },
  "emonc-sudan.firebaseapp.com": { name: "Emergency Obstetrics and Newborn Care (EmONC)", image: "https://emonc-sudan.web.app/emonc-logo.png" },
};

exports.libraryLinkPage = onRequest({ region: "us-central1", memory: "256MiB", timeoutSeconds: 20 }, async (req, res) => {
  const host = String(req.headers["x-forwarded-host"] || req.hostname || "").split(",")[0].trim().toLowerCase();
  const site = SITES[host];
  if (!site) { res.status(404).send("Not found"); return; }
  let html;
  try {
    const r = await fetch(`https://${host}/`, { headers: { "user-agent": "library-link-page" } });
    if (!r.ok) throw new Error(`start page ${r.status}`);
    html = await r.text();
  } catch (e) {
    console.warn("[libraryLinkPage] start page failed:", e?.message);
    res.redirect(302, "/");
    return;
  }
  const path = req.path || "";
  const target = parseLibraryLink(path);
  try {
    if (target) {
      let item = null;
      if (target.itemId) {
        const snap = await getFirestore().collection("libraryItems").doc(target.itemId).get();
        item = snap.exists ? snap.data() : null;
      }
      const preview = libraryPreview(target, item, site);
      html = withCourseTags(html, { ...preview, siteName: site.name, url: `https://${host}${path}` });
    }
  } catch (e) {
    console.warn("[libraryLinkPage] lookup failed:", e?.message);
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "public, max-age=60, s-maxage=300");
  res.status(200).send(html);
});
