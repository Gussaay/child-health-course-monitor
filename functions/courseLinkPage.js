// functions/courseLinkPage.js
//
// Answers a shared course link, https://<site>/learn/<courseId>, with the
// site's own start page (the same HTML the site serves at "/") whose title and
// link-preview tags carry the COURSE's title. WhatsApp, Facebook and
// Telegram read those tags without running any JavaScript, so a static page
// could only ever show the site's name. The app itself starts exactly as
// before: src/utils/courseLink.js reads /learn/<id> in the browser.
//
// Only a published, not deleted course's title and description are revealed.
// Anything else (unknown id, draft, a failure) gets the unchanged site page.
const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

// The sites this may answer for, with the picture a course link shows.
const SITES = {
  "imnci-courses-monitor.web.app": { name: "National Child Health Program", image: "https://imnci-courses-monitor.web.app/og-main.png" },
  "imnci-courses-monitor.firebaseapp.com": { name: "National Child Health Program", image: "https://imnci-courses-monitor.web.app/og-main.png" },
  "ch-sudan.web.app": { name: "Sudan Child Health Online Training and Guidelines", image: "https://ch-sudan.web.app/og-ch.png" },
  "ch-sudan.firebaseapp.com": { name: "Sudan Child Health Online Training and Guidelines", image: "https://ch-sudan.web.app/og-ch.png" },
  "emonc-sudan.web.app": { name: "Emergency Obstetrics and Newborn Care (EmONC)", image: "https://emonc-sudan.web.app/emonc-logo.png" },
  "emonc-sudan.firebaseapp.com": { name: "Emergency Obstetrics and Newborn Care (EmONC)", image: "https://emonc-sudan.web.app/emonc-logo.png" },
};
const COURSE_PATH = /^\/learn\/([A-Za-z0-9_-]{1,128})\/?$/;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clip = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** `html` with its title, description and link-preview tags set for a course. */
function withCourseTags(html, { title, description, siteName, image, url }) {
  const full = `${title} - ${siteName}`;
  const tags = [
    ["og:type", "website"], ["og:site_name", siteName], ["og:title", full], ["og:description", description],
    ["og:image", image], ["og:image:width", "1200"], ["og:image:height", "630"], ["og:url", url],
  ].map(([k, v]) => `<meta property="${k}" content="${esc(v)}" />`)
    .concat([["twitter:card", "summary_large_image"], ["twitter:title", full], ["twitter:description", description], ["twitter:image", image]]
      .map(([k, v]) => `<meta name="${k}" content="${esc(v)}" />`)).join("\n    ");
  return html
    .replace(/\s*<meta (property="og:|name="twitter:)[^>]*>/g, "")
    .replace(/<title>[^<]*<\/title>/, () => `<title>${esc(full)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, (m, a, b) => `${a}${esc(description)}${b}`)
    .replace("</head>", () => `    ${tags}\n  </head>`);
}

async function courseFor(id) {
  const snap = await getFirestore().collection("onlineCourses").doc(id).get();
  const c = snap.exists ? snap.data() : null;
  if (!c || c.isDeleted === true || c.isDeleted === "true" || c.isPublished !== true || !c.title) return null;
  return c;
}

exports.courseLinkPage = onRequest({ region: "us-central1", memory: "256MiB", timeoutSeconds: 20 }, async (req, res) => {
  const host = String(req.headers["x-forwarded-host"] || req.hostname || "").split(",")[0].trim().toLowerCase();
  const site = SITES[host];
  if (!site) { res.status(404).send("Not found"); return; }
  let html;
  try {
    const r = await fetch(`https://${host}/`, { headers: { "user-agent": "course-link-page" } });
    if (!r.ok) throw new Error(`start page ${r.status}`);
    html = await r.text();
  } catch (e) {
    console.warn("[courseLinkPage] start page failed:", e?.message);
    res.redirect(302, "/");
    return;
  }
  const match = COURSE_PATH.exec(req.path || "");
  try {
    const course = match ? await courseFor(match[1]) : null;
    if (course) {
      html = withCourseTags(html, {
        title: clip(course.title, 120),
        description: clip(course.description || course.summary, 200) || `Online course on ${site.name}`,
        siteName: site.name, image: site.image, url: `https://${host}/learn/${match[1]}`,
      });
    }
  } catch (e) {
    console.warn("[courseLinkPage] course lookup failed:", e?.message);
  }
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "public, max-age=60, s-maxage=300");
  res.status(200).send(html);
});

exports.withCourseTags = withCourseTags;
