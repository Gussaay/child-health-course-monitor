// src/utils/courseShare.js
//
// The course page's "Share link" button (onlineCourses/CoursePage.jsx). Kept
// out of courseLink.js, which loads with the app's first screen.
import { IS_EMONC_SITE } from '../siteMode';
import { publicBaseUrl, CH_LIVE_SITE } from './publicLink';

/** The address to share for a course, or for one module or lesson of it. */
export function courseShareUrl(courseId, moduleId = null, sectionId = null) {
    // The EmONC site does not show Online Courses, so its links use ch-sudan,
    // the online-course site.
    const base = IS_EMONC_SITE ? CH_LIVE_SITE : publicBaseUrl();
    const parts = [courseId, moduleId, moduleId && sectionId].filter(Boolean).map(encodeURIComponent);
    return `${base}/learn/${parts.join('/')}`;
}

/**
 * Shares a course's link through the phone's share sheet (WhatsApp, SMS…),
 * or copies it where nothing can share. Returns 'shared', 'copied',
 * 'cancelled' or 'failed'.
 */
export async function shareCourseLink(course, { text = '', moduleId = null, sectionId = null, title: name = '' } = {}) {
    const url = courseShareUrl(course.id, moduleId, sectionId);
    const title = name || course.title || '';
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
