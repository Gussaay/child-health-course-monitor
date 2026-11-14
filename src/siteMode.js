// One build serves three Firebase Hosting sites in the same project, so they
// share data and logins:
//   imnci-courses-monitor.web.app and ch-sudan.web.app  the full app
//   emonc-sudan.web.app                                  home page with only Courses and Surveys,
//                                                        and only the EmONC package in it
// The site is told apart by its address at run time, so every site gets the
// exact same files. `VITE_SITE=emonc npm run dev` shows the EmONC site locally.

const EMONC_HOSTS = ['emonc-sudan.web.app', 'emonc-sudan.firebaseapp.com'];

const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

export const IS_EMONC_SITE = import.meta.env.VITE_SITE === 'emonc' || EMONC_HOSTS.includes(hostname);

// ch-sudan is the full app like the main site; only its Android app, its
// shared links and its "Get the app" button differ. `VITE_SITE=ch` is the
// ch-sudan app's build.
const CH_HOSTS = ['ch-sudan.web.app', 'ch-sudan.firebaseapp.com'];
export const IS_CH_SITE = import.meta.env.VITE_SITE === 'ch' || CH_HOSTS.includes(hostname);

export const EMONC_SITE_TITLE = 'Emergency Obstetrics and Newborn Care (EmONC)';
// Shown in the header on phones and tablets, where the full name does not fit.
export const EMONC_SHORT_TITLE = 'EmONC';

// The EmONC site's logo, used instead of the Child Health Program logo in the
// header, the loading screen, the browser tab and the installed-app icon.
// To change it, replace public/emonc-logo.png (a square PNG, 512 px is best);
// nothing else needs editing. emonc.html (vite.config.js emoncPage) points at
// the same file.
export const EMONC_LOGO_URL = '/emonc-logo.png';

// Used where the main site shows "NCHP Logo".
export const EMONC_LOGO_ALT = 'EmONC logo';

// Each site has its own Android app (android/app/build.gradle productFlavors).
// The EmONC and ch-sudan apps are built from this same code with
// VITE_SITE=emonc / VITE_SITE=ch, so inside them IS_EMONC_SITE / IS_CH_SITE
// are true as well.
//   package        Android application id (intent:// links, App Links)
//   versionFile    native-version file the site's "Get the app" button reads
//   updateManifest live-update manifest the app checks (deploy.yml writes both)
//   apkFilePrefix  APK file names in Storage: <prefix><version>.apk
const NCHP_APK_PREFIX = 'National_Child_Health_Program_APP_v';
// deploy.yml SITE_APPS and android/app/build.gradle productFlavors list the same apps.
export const SITE_APPS = {
    nchp: { package: 'com.nchp.monitoring.app', name: 'NCHP', versionFile: 'native-version.json', updateManifest: 'latest/update.json', apkFilePrefix: NCHP_APK_PREFIX, downloadName: 'NCHP' },
    emonc: { package: 'com.nchp.monitoring.emonc', name: 'EmONC', versionFile: 'native-version-emonc.json', updateManifest: 'latest-emonc/update.json', apkFilePrefix: 'EmONC_APP_v', downloadName: 'EmONC' },
    ch: { package: 'com.nchp.monitoring.ch', name: 'CH Sudan', versionFile: 'native-version-ch.json', updateManifest: 'latest-ch/update.json', apkFilePrefix: 'CH_Sudan_APP_v', downloadName: 'CH-Sudan' },
};
export const NATIVE_APP = IS_EMONC_SITE ? SITE_APPS.emonc : IS_CH_SITE ? SITE_APPS.ch : SITE_APPS.nchp;

// meta/update_config names the NCHP APK of a release. All the apps are built
// in the same release with the same version, so another app's APK of that
// release is the same address with that app's file name.
export function siteApkUrl(url, app = NATIVE_APP) {
    if (!url || app.apkFilePrefix === NCHP_APK_PREFIX) return url || '';
    return url.split(NCHP_APK_PREFIX).join(app.apkFilePrefix);
}

// The only course type the EmONC site shows. The main app's EmONC list also
// includes EENC courses (coursesForActiveType in Course.jsx); this site does not.
export const EMONC_COURSE_TYPES = ['EmONC'];

// Top-level modules the EmONC site does not offer. Anything not listed here is
// the home page or part of the Courses module (course pages, participants,
// monitoring, reports).
export const EMONC_SITE_HIDDEN_VIEWS = new Set([
    'dashboard', 'humanResources', 'facilitators', 'programTeams', 'partnersPage',
    'facilitatorForm', 'facilitatorReport', 'childHealthServices', 'skillsMentorship', 'imciForm',
    'projects', 'meetings', 'planning', 'localityPlan', 'supplyManagement', 'supervision',
    'onlineCourses', 'downloads', 'admin', 'about',
]);
