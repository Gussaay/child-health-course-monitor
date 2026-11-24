// functions/libraryLinkMeta.js
// The pure part of libraryLinkPage.js (no Firebase imports, so the tests can
// load it): what a shared Child Health Library link shows in its preview.
//
// Keep LIBRARY_SERVICES / LIBRARY_CATEGORIES in step with
// src/components/library/libraryModel.js (tests/childHealthLibrary.test.js
// checks they match).
const { clip } = require("./courseLinkTags");

const LIBRARY_TITLE = "Child Health Library";
const LIBRARY_DESCRIPTION = "Training materials, guidelines, protocols, operational guides and SOPs for each child health service. Open to everyone, no sign-in needed.";

const LIBRARY_SERVICES = {
  imnci: "Integrated Management of Newborn and Childhood Illnesses (IMNCI)",
  iccm: "Integrated Community Case Management for under 5 children (iCCM)",
  etat: "Emergency Triage, Assessment & Treatment (ETAT)",
  eenc: "Early Essential Newborn Care (EENC)",
  emonc: "Emergency Obstetric and Newborn Care (EmONC)",
  ssnc: "Small & Sick Newborn Care",
  ipc: "Infection Prevention & Control (Neonatal Unit)",
  midwives: "Comprehensive Package For Community Midwives",
  program_management: "Program Management",
};
const LIBRARY_CATEGORIES = {
  training: "Training",
  guidelines: "Guidelines & Protocols",
  operational: "Operational Guides & SOP",
};

// /public/library, /public/library/<service>[/<section>], /public/library/item/<id>
function parseLibraryLink(pathname) {
  const m = /^\/public\/library(?:\/([A-Za-z0-9_-]{1,128}))?(?:\/([A-Za-z0-9_-]{1,128}))?\/?$/.exec(String(pathname || ""));
  if (!m) return null;
  if (m[1] === "item") return m[2] ? { itemId: m[2] } : {};
  const service = LIBRARY_SERVICES[String(m[1] || "").toLowerCase()] ? String(m[1]).toLowerCase() : null;
  const category = service && LIBRARY_CATEGORIES[m[2]] ? m[2] : null;
  return { service, category };
}

const isHttps = (u) => /^https:\/\/[^\s"<>]+$/.test(String(u || ""));

/**
 * The preview for a library link: { title, description, image, imageSize }.
 * `item` is the libraryItems document for an item link (null when missing);
 * `site` is { name, image } of the site the link was opened on.
 * An item shows its own name, its full description and its photo (the site's
 * picture when it has none); the other levels show the library or service.
 */
function libraryPreview(target, item, site) {
  const fallback = { image: site.image, imageSize: [1200, 630] };
  if (target && target.itemId && item && item.name) {
    const where = [LIBRARY_SERVICES[serviceSlugOf(item.service)], LIBRARY_CATEGORIES[item.category]].filter(Boolean).join(" · ");
    const photo = isHttps(item.imageUrl) ? { image: item.imageUrl, imageSize: null } : fallback;
    return {
      title: clip(item.name, 150),
      // The whole description: apps cut it to fit their preview themselves.
      description: clip(item.description, 5000) || (where ? `${LIBRARY_TITLE}: ${where}` : LIBRARY_DESCRIPTION),
      ...photo,
    };
  }
  if (target && target.service) {
    const service = LIBRARY_SERVICES[target.service];
    const section = target.category ? LIBRARY_CATEGORIES[target.category] : null;
    return {
      title: section ? `${section} - ${service}` : `${service} - ${LIBRARY_TITLE}`,
      description: section
        ? `${section} for ${service} in the ${LIBRARY_TITLE}. Open to everyone, no sign-in needed.`
        : `Training, guidelines & protocols, operational guides & SOP for ${service}. Open to everyone, no sign-in needed.`,
      ...fallback,
    };
  }
  return { title: LIBRARY_TITLE, description: LIBRARY_DESCRIPTION, ...fallback };
}

// Items store the service's key ("Small & Sick Newborn"); links use its slug.
const SERVICE_KEYS = {
  "IMNCI": "imnci", "ICCM": "iccm", "ETAT": "etat", "EENC": "eenc", "EmONC": "emonc",
  "Small & Sick Newborn": "ssnc", "IPC": "ipc",
  "Comprehensive Package For Community Midwives": "midwives", "Program Management": "program_management",
};
function serviceSlugOf(key) { return SERVICE_KEYS[key] || null; }

module.exports = { parseLibraryLink, libraryPreview, LIBRARY_SERVICES, LIBRARY_CATEGORIES, SERVICE_KEYS };
