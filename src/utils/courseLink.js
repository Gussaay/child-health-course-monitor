// src/utils/courseLink.js
//
// A link to ONE online course, to share on WhatsApp, SMS or e-mail:
//     https://<site>/learn/<courseId>
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
import { IS_EMONC_SITE } from '../siteMode';
import { publicBaseUrl, CH_LIVE_SITE } from './publicLink';

export const COURSE_LINK_PATH = /^\/learn\/([A-Za-z0-9_-]{1,128})\/?$/;
const STORAGE_KEY = 'chm_focus_course';

function readLink() {
    if (typeof window === 'undefined') return;
    try {
        const match = COURSE_LINK_PATH.exec(window.location.pathname);
        if (!match) return;
        sessionStorage.setItem(STORAGE_KEY, match[1]);
        const state = window.history.state || {};
        window.history.replaceState(state, '', `/online-courses?oc=${encodeURIComponent(match[1])}`);
    } catch { /* storage blocked: the course still opens, with the list */ }
}
readLink();

/** The course this tab was opened for by a course link, or null. */
export function focusedCourseId() {
    try { return sessionStorage.getItem(STORAGE_KEY) || null; } catch { return null; }
}

export function clearFocusedCourse() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* nothing kept */ }
}

/** The address to share for a course. */
export function courseShareUrl(courseId) {
    // The EmONC site does not show Online Courses, so its links use ch-sudan,
    // the online-course site.
    const base = IS_EMONC_SITE ? CH_LIVE_SITE : publicBaseUrl();
    return `${base}/learn/${encodeURIComponent(courseId)}`;
}

/**
 * Shares a course's link through the phone's share sheet (WhatsApp, SMS…),
 * or copies it where nothing can share. Returns 'shared', 'copied',
 * 'cancelled' or 'failed'.
 */
export async function shareCourseLink(course, { text = '' } = {}) {
    const url = courseShareUrl(course.id);
    const title = course.title || '';
    const message = text || title;
    const isCancel = (e) => e?.name === 'AbortError' || /cancel/i.test(e?.message || '');
    try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
            const { Share } = await import('@capacitor/share');
            await Share.share({ title, text: message, url, dialogTitle: title });
            return 'shared';
        }
        if (navigator.share) {
            await navigator.share({ title, text: message, url });
            return 'shared';
        }
    } catch (e) {
        if (isCancel(e)) return 'cancelled';
    }
    try {
        await navigator.clipboard.writeText(message ? `${message}\n${url}` : url);
        return 'copied';
    } catch {
        return 'failed';
    }
}
