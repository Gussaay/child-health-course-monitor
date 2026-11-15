// src/i18n.js
//
// THE TRANSLATIONS LIVE IN src/locales/en.json AND src/locales/ar.json.
// Edit those files to add or change text.
//
// They used to be one ~1 MB object in this file, so every visitor downloaded
// and parsed both languages (about 55% of the start-up JavaScript) before the
// first screen could appear; PageSpeed measured 9.8 s to the main content on a
// phone. Now each language is its own file (`locale-en` / `locale-ar` chunks,
// see vite.config.js) and a visitor downloads only theirs:
//   - index.html starts downloading the right one alongside the app code
//     (vite.config.js, preloadLocale), so it costs no extra round trip;
//   - main.jsx waits for it before the first render, so nobody sees the other
//     language flash first;
//   - Arabic has no fallback to English (it has every key English has, and for
//     plurals its own base key wins, as it did before), so Arabic users do not
//     also download the English file.
//   - JSON is parsed much faster than the same data written as a JS object.
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const LOCALES = {
  en: () => import('./locales/en.json'),
  ar: () => import('./locales/ar.json'),
};

// A minimal i18next backend that loads one language file on demand.
const lazyLocales = {
  type: 'backend',
  init() {},
  read(lng, _ns, callback) {
    const load = LOCALES[lng];
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
    fallbackLng: (code) => (String(code || '').startsWith('ar') ? [] : ['en']),
    // 'ar-SD' and 'en-US' use the 'ar' and 'en' files, as before, without a
    // request for a regional file that does not exist.
    load: 'languageOnly',
    interpolation: {
      escapeValue: false,
    },
    // No Suspense: there is no <Suspense> above the app root, so a component
    // that suspended on a language still loading (after i18nReady gave up
    // waiting, see below) would hold the whole app on the boot splash. Without
    // it, such a screen renders with the English text written next to each t()
    // call and re-renders in the right language once the file arrives.
    react: { useSuspense: false },
  });

// Resolves once the language in use is ready. Never rejects and never waits
// more than a few seconds: if the file cannot be fetched (offline on a device
// that never cached it), the app still starts, with the English text written
// next to each t() call.
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