// src/i18n.js
//
// THE TRANSLATIONS LIVE IN src/locales/en.json AND src/locales/ar.json.
// Edit those files to add or change text.
//
// They used to be one ~1 MB object in this file, so every visitor downloaded
// and parsed both languages (about 55% of the start-up JavaScript) before the
// first screen could appear; PageSpeed measured 9.8 s to the main content on a
// phone. Now:
//   - English is its own file (the `locale-en` chunk, see vite.config.js). It is
//     always loaded, because it is the fallback for any key Arabic lacks, and the
//     page preloads it alongside the app.
//   - Arabic loads only for people using Arabic, before the first render
//     (main.jsx waits for `i18nReady`), so there is no flash of English.
//   - JSON is parsed much faster than the same data written as a JS object.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';

const LAZY_LOCALES = {
  ar: () => import('./locales/ar.json'),
};

// A minimal i18next backend: English is bundled (see `resources` below), so
// i18next only asks this for the other languages.
const lazyLocales = {
  type: 'backend',
  init() {},
  read(lng, _ns, callback) {
    const load = LAZY_LOCALES[lng];
    if (!load) return callback(null, {});
    load().then(
      (mod) => callback(null, mod.default || mod),
      (err) => callback(err, null),
    );
  },
};

const initDone = i18n
  .use(lazyLocales)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    partialBundledLanguages: true,
    fallbackLng: 'en',
    // 'ar-SD' and 'en-US' use the 'ar' and 'en' files, as before, without a
    // request for a regional file that does not exist.
    load: 'languageOnly',
    interpolation: {
      escapeValue: false,
    },
  });

// Resolves once the language in use is ready. Never rejects and never waits
// more than a few seconds: if Arabic cannot be fetched (offline on a device
// that never cached it), the app still starts, in English.
export const i18nReady = Promise.race([
  Promise.resolve(initDone).catch((e) => console.warn('Translations failed to load:', e)),
  new Promise((resolve) => setTimeout(resolve, 6000)),
]);

// --- Arabic typography guard -------------------------------------------------
// Tailwind's tracking-* utilities apply letter-spacing. Arabic is a cursive
// script: inserting space BETWEEN glyphs breaks the joins, and html2canvas
// (used by the "Copy as Image" button) then lays those disconnected glyphs out
// in the wrong order, which is what produced the scrambled Arabic titles in
// exported images. Force letter-spacing off whenever the document is RTL.
const injectRtlTypographyGuard = () => {
  const ID = 'rtl-typography-guard';
  if (document.getElementById(ID)) return;
  const style = document.createElement('style');
  style.id = ID;
  style.textContent = `
    html[dir="rtl"], html[dir="rtl"] * {
      letter-spacing: normal !important;
      word-spacing: normal !important;
    }
    /* text-transform: uppercase is meaningless for Arabic and can confuse
       canvas-based exporters. Neutralise it in RTL. */
    html[dir="rtl"] .uppercase { text-transform: none !important; }
    /* Keep numeric fractions (e.g. 17261 / 23008) in logical LTR order. */
    html[dir="rtl"] [dir="ltr"] { unicode-bidi: isolate; }
  `;
  document.head.appendChild(style);
};
injectRtlTypographyGuard();

i18n.on('languageChanged', (lng) => {
  document.documentElement.setAttribute('dir', i18n.dir(lng));
  document.documentElement.setAttribute('lang', lng);
  localStorage.setItem('app_language', lng);
});

document.documentElement.setAttribute('dir', i18n.dir(i18n.language));
document.documentElement.setAttribute('lang', i18n.language);

export default i18n;