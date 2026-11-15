// Builds the EmONC site's start page and install manifest from the main ones
// (see emoncPage in vite.config.js). Kept apart from vite.config.js so the
// tests can import it.
const EMONC_TITLE = 'Emergency Obstetrics and Newborn Care (EmONC)';
const EMONC_DESCRIPTION = 'Emergency Obstetrics and Newborn Care (EmONC) - Course Monitoring System';
const EMONC_LOGO = '/emonc-logo.png'; // same file as EMONC_LOGO_URL in src/siteMode.js
export const makeEmoncHtml = (html) => {
  const out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${EMONC_TITLE}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${EMONC_DESCRIPTION}$2`)
    .replace(/(<link rel="icon"[^>]*href=")[^"]*(")/, `$1${EMONC_LOGO}$2`)
    .replace(/(<link rel="apple-touch-icon"[^>]*href=")[^"]*(")/, `$1${EMONC_LOGO}$2`)
    .replace(/(<link rel="manifest"[^>]*href=")[^"]*(")/, `$1/emonc.webmanifest$2`)
    .replace(/(<div class="boot-logo"><img src=")[^"]*(")/, `$1${EMONC_LOGO}$2`);
  if (/Child Health|NCHP/i.test(out)) throw new Error('emonc.html still mentions the Child Health Program');
  return out;
};

export const makeEmoncManifest = () => JSON.stringify({
  name: EMONC_TITLE,
  short_name: 'EmONC',
  description: EMONC_DESCRIPTION,
  start_url: '/',
  display: 'standalone',
  theme_color: '#1e293b',
  background_color: '#f8fafc',
  icons: [
    { src: EMONC_LOGO, sizes: '512x512', type: 'image/png' },
    { src: EMONC_LOGO, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2);
