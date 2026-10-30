// One build serves three Firebase Hosting sites in the same project, so they
// share data and logins:
//   imnci-courses-monitor.web.app and ch-sudan.web.app  the full app
//   emonc-sudan.web.app                                  Courses only, EmONC only
// The site is told apart by its address at run time, so every site gets the
// exact same files. `VITE_SITE=emonc npm run dev` shows the EmONC site locally.

const EMONC_HOSTS = ['emonc-sudan.web.app', 'emonc-sudan.firebaseapp.com'];

const hostname = typeof window !== 'undefined' ? window.location.hostname : '';

export const IS_EMONC_SITE = import.meta.env.VITE_SITE === 'emonc' || EMONC_HOSTS.includes(hostname);

export const EMONC_SITE_TITLE = 'Emergency Obstetrics and Newborn Care (EmONC)';

// The only course type the EmONC site shows. The main app's EmONC list also
// includes EENC courses (coursesForActiveType in Course.jsx); this site does not.
export const EMONC_COURSE_TYPES = ['EmONC'];

// Top-level modules the EmONC site does not offer. Anything not listed here is
// part of the Courses module (course pages, participants, monitoring, reports).
export const EMONC_SITE_HIDDEN_VIEWS = new Set([
    'landing', 'dashboard', 'humanResources', 'facilitators', 'programTeams', 'partnersPage',
    'facilitatorForm', 'facilitatorReport', 'childHealthServices', 'skillsMentorship', 'imciForm',
    'projects', 'meetings', 'planning', 'localityPlan', 'supplyManagement', 'supervision',
    'onlineCourses', 'downloads', 'admin', 'about',
]);
