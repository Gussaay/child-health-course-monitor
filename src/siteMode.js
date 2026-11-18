// One build serves three Firebase Hosting sites in the same project, so they
// share data and logins:
//   imnci-courses-monitor.web.app                        the full app
//   ch-sudan.web.app                                     only the modules chosen in Admin > Sites
//                                                        (default: Dashboard and Online Courses)
//   emonc-sudan.web.app                                  only the modules chosen in Admin > Sites
//                                                        (default: Courses and Surveys),
//                                                        and only the EmONC package in it
// The site is told apart by its address at run time, so every site gets the
// exact same files. `VITE_SITE=emonc npm run dev` shows the EmONC site locally.

const EMONC_HOSTS = ['emonc-sudan.web.app', 'emonc-sudan.firebaseapp.com'];

const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

export const IS_EMONC_SITE = import.meta.env.VITE_SITE === 'emonc' || EMONC_HOSTS.includes(hostname);

// ch-sudan shows the modules chosen in Admin > Sites; its Android app, its
// shared links and its "Get the app" button also differ. `VITE_SITE=ch` is the
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
    ch: { package: 'com.nchp.monitoring.ch', name: 'Child Health Sudan', versionFile: 'native-version-ch.json', updateManifest: 'latest-ch/update.json', apkFilePrefix: 'CH_Sudan_APP_v', downloadName: 'CH-Sudan' },
};
// What each app is called where it is offered (the get-the-app bar, the
// "Share app" message). The ch-sudan subtitle is the one Qusay chose.
export const SITE_APP_TEXT = {
    nchp: { title: 'National Child Health Program', titleAr: 'البرنامج القومي لصحة الطفل', subtitle: 'Program & Course Monitoring System', subtitleAr: 'نظام متابعة البرامج والدورات' },
    emonc: { title: 'EmONC', titleAr: 'EmONC', subtitle: 'Course Monitoring System', subtitleAr: 'نظام متابعة الدورات' },
    ch: { title: 'Child Health Sudan', titleAr: 'صحة الطفل السودان', subtitle: 'Online Course and Guidelines', subtitleAr: 'الدورة الإلكترونية والموجهات' },
};
export const NATIVE_APP_ID = IS_EMONC_SITE ? 'emonc' : IS_CH_SITE ? 'ch' : 'nchp';
export const NATIVE_APP = SITE_APPS[NATIVE_APP_ID];
export const NATIVE_APP_TEXT = SITE_APP_TEXT[NATIVE_APP_ID];

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

// --- Which modules each site shows ---------------------------------------
// The main site shows everything. What the EmONC and ch-sudan sites show is
// chosen by a super user in Admin > Sites on the main site and saved in
// meta/siteSettings as { sites: { emonc: { modules: [...] }, ch: { modules: [...] } } }.
// Until that document exists (or before sign-in, since meta/ needs a
// signed-in user) each site uses its default below.

// 'main', 'emonc' or 'ch'.
export const CURRENT_SITE = IS_EMONC_SITE ? 'emonc' : IS_CH_SITE ? 'ch' : 'main';

// The sites Admin > Sites manages, in the order shown there.
export const MANAGED_SITES = [
    { id: 'emonc', name: 'EmONC', host: 'emonc-sudan.web.app' },
    { id: 'ch', name: 'CH Sudan', host: 'ch-sudan.web.app' },
];

// Every module a site can show, with the pages that belong to it. A page not
// listed here (the home page, public links) is always shown. Admin is not
// listed: it is only on the main site, where sites are managed.
export const SITE_MODULES = [
    { id: 'dashboard', label: 'Dashboard', views: ['dashboard'] },
    { id: 'courses', label: 'Courses', views: ['courses', 'courseDetails', 'courseForm', 'courseReport', 'participants', 'participantForm', 'participantReport', 'participantMigration', 'observe', 'monitoring', 'reports', 'finalReport', 'attendanceManager', 'test-dashboard', 'enter-test-scores'] },
    { id: 'humanResources', label: 'Human Resources', views: ['humanResources', 'facilitators', 'programTeams', 'partnersPage', 'facilitatorForm', 'facilitatorReport'] },
    { id: 'childHealthServices', label: 'Child Health Services', views: ['childHealthServices'] },
    { id: 'skillsMentorship', label: 'Skills Mentorship', views: ['skillsMentorship'] },
    { id: 'imciForm', label: 'IMNCI Protocol', views: ['imciForm'] },
    { id: 'onlineCourses', label: 'Online Courses (online training)', views: ['onlineCourses'] },
    { id: 'supervision', label: 'Supervision', views: ['supervision'] },
    { id: 'survey', label: 'Surveys', views: ['survey'] },
    { id: 'supplyManagement', label: 'Supply Management', views: ['supplyManagement'] },
    { id: 'projects', label: 'Project Tracker', views: ['projects'] },
    { id: 'meetings', label: 'Meeting Tracker', views: ['meetings'] },
    { id: 'planning', label: 'Master Plan', views: ['planning'] },
    { id: 'localityPlan', label: 'Bottom-up Planning', views: ['localityPlan'] },
    { id: 'downloads', label: 'App Files & Downloads (Android app only)', views: ['downloads'] },
    { id: 'about', label: 'About Team', views: ['about'] },
];

// Pages that only the main site has, whatever is chosen (Course Manager and
// Protocol Manager are for federal managers and super users on the main site).
const MAIN_SITE_ONLY_VIEWS = ['admin', 'onlineCoursesManage', 'protocolManager'];

// What each site shows until a super user saves a choice in Admin > Sites.
export const DEFAULT_SITE_MODULES = {
    emonc: ['courses', 'survey'],
    ch: ['dashboard', 'onlineCourses'],
};

// The module ids a site shows, from the saved settings (or the default).
// Unknown ids in the saved list are ignored.
export function siteModulesFor(site, settings) {
    if (site === 'main') return SITE_MODULES.map(m => m.id);
    const saved = settings?.sites?.[site]?.modules;
    const list = Array.isArray(saved) ? saved : (DEFAULT_SITE_MODULES[site] || []);
    const known = new Set(SITE_MODULES.map(m => m.id));
    return list.filter(id => known.has(id));
}

// The pages a site hides: every page of every module it does not show, and
// the main-site-only pages. The main site hides nothing.
export function hiddenViewsFor(site, settings) {
    if (site === 'main') return new Set();
    const shown = new Set(siteModulesFor(site, settings));
    const hidden = new Set(MAIN_SITE_ONLY_VIEWS);
    SITE_MODULES.forEach(m => { if (!shown.has(m.id)) m.views.forEach(v => hidden.add(v)); });
    return hidden;
}
