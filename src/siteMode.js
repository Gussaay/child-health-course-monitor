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
