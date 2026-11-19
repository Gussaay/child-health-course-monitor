// Builds the ch-sudan site's start page and install manifest from the main
// ones (see chPage in vite.config.js), and the link-preview tags every site's
// start page carries. Kept apart from vite.config.js so the tests can import it.
//
// Link previews (WhatsApp, Facebook, Telegram...) are made by crawlers that do
// not run JavaScript, so the title, description and picture must be in the
// HTML itself. A course link (/learn/<id>) is answered by the courseLinkPage
// Cloud Function (functions/courseLinkPage.js), which puts the course's own
// title into the same tags.
export const CH_TITLE = 'Sudan Child Health Online Training and Guidelines'; // same as CH_SITE_TITLE in src/siteMode.js
export const CH_DESCRIPTION = 'Sudan Child Health Online Training and Guidelines - the National Child Health Program online courses and clinical guidelines.';
// Link-preview pictures need a full address.
export const CH_IMAGE = 'https://ch-sudan.web.app/og-ch.png';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The Open Graph and Twitter tags for a page. `image` is a path on the site. */
export const socialTags = ({ siteName, title, description, image }) => [
  `<meta property="og:type" content="website" />`,
  `<meta property="og:site_name" content="${esc(siteName)}" />`,
  `<meta property="og:title" content="${esc(title)}" />`,
  `<meta property="og:description" content="${esc(description)}" />`,
  `<meta property="og:image" content="${esc(image)}" />`,
  `<meta property="og:image:width" content="1200" />`,
  `<meta property="og:image:height" content="630" />`,
  `<meta name="twitter:card" content="summary_large_image" />`,
  `<meta name="twitter:title" content="${esc(title)}" />`,
  `<meta name="twitter:description" content="${esc(description)}" />`,
  `<meta name="twitter:image" content="${esc(image)}" />`,
].join('\n    ');

/** Adds (or replaces) the social tags just before </head>. */
export const withSocialTags = (html, tags) => html
  .replace(/\s*<meta (property="og:|name="twitter:)[^>]*>/g, '')
  .replace('</head>', `    ${socialTags(tags)}\n  </head>`);

export const makeChHtml = (html) => {
  const out = withSocialTags(html
    .replace(/<title>[^<]*<\/title>/, `<title>${CH_TITLE}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${CH_DESCRIPTION}$2`)
    .replace(/(<link rel="manifest"[^>]*href=")[^"]*(")/, `$1/ch.webmanifest$2`),
  { siteName: CH_TITLE, title: CH_TITLE, description: CH_DESCRIPTION, image: CH_IMAGE });
  if (/Child Health Program Monitoring/i.test(out)) throw new Error('ch.html still has the main site title');
  return out;
};

export const makeChManifest = () => JSON.stringify({
  name: CH_TITLE,
  short_name: 'Sudan Child Health',
  description: CH_DESCRIPTION,
  start_url: '/',
  display: 'standalone',
  theme_color: '#1e293b',
  background_color: '#f8fafc',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2);
