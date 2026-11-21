// src/utils/courseLink.js
//
// A link to ONE online course, to share on WhatsApp, SMS or e-mail:
//     https://<site>/learn/<courseId>
//     https://<site>/learn/<courseId>/<moduleId>             (one module)
//     https://<site>/learn/<courseId>/<moduleId>/<lessonId>  (one lesson)
// It opens in the installed app (Android App Links, AndroidManifest.xml of
// each app) or in the browser, and shows only that course: the course list
// and the "All courses" step are hidden, so the person who receives it never
// sees the other courses. Enrolment rules still apply: an Open course starts
// straight away, a course that needs approval shows "Ask to join".
//
// At start-up (main.jsx imports this first) the link is turned into the
// normal Online Courses address, /online-courses?oc=<courseId>, and the
// course is remembered for this tab (sessionStorage), so sign-in, refresh
// and the app's own address changes keep it. Leaving Online Courses (going
// to the home page) ends it, and the full list is back the next time.
const ID = '([A-Za-z0-9_-]{1,128})';
export const COURSE_LINK_PATH = new RegExp(`^/learn/${ID}(?:/${ID})?(?:/${ID})?/?$`);
const STORAGE_KEY = 'chm_focus_course';

function readLink() {
    if (typeof window === 'undefined') return;
    const match = COURSE_LINK_PATH.exec(window.location.pathname);
    if (!match) return;
    // The address is changed even when storage is blocked: the app knows
    // /online-courses, not /learn/, so the course still opens (with the list).
    try { sessionStorage.setItem(STORAGE_KEY, match[1]); } catch { /* storage blocked */ }
    // A module or lesson link opens that module or lesson inside the course.
    const params = new URLSearchParams({ oc: match[1] });
    if (match[2]) params.set('mod', match[2]);
    if (match[2] && match[3]) params.set('sec', match[3]);
    window.history.replaceState(window.history.state || {}, '', `/online-courses?${params.toString()}`);
}
readLink();

/** The course this tab was opened for by a course link, or null. */
export function focusedCourseId() {
    try { return sessionStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
}

export function clearFocusedCourse() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* nothing kept */ }
}

