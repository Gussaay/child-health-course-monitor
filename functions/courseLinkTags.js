// functions/courseLinkTags.js
// The pure part of courseLinkPage.js (no Firebase imports, so the tests can load it).
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clip = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/**
 * `html` with its title, description and link-preview tags set for a course
 * (or a library page). `imageSize` is [width, height] of the picture; pass
 * null when it is not known (a library item's own photo).
 */
function withCourseTags(html, { title, description, siteName, image, url, imageSize = [1200, 630] }) {
  const full = `${title} - ${siteName}`;
  const tags = [
    ["og:type", "website"], ["og:site_name", siteName], ["og:title", full], ["og:description", description],
    ["og:image", image], ["og:image:secure_url", image],
    ...(imageSize ? [["og:image:width", String(imageSize[0])], ["og:image:height", String(imageSize[1])]] : []),
    ["og:url", url],
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
