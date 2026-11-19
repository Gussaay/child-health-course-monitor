// functions/courseLinkTags.js
// The pure part of courseLinkPage.js (no Firebase imports, so the tests can load it).
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

module.exports = { withCourseTags, clip };
