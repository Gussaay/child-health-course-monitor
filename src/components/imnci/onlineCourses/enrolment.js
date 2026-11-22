// src/components/imnci/onlineCourses/enrolment.js
//
// Who may take a course, and in which group. The records are kept by the
// onlineEnrolment Cloud Function (functions/onlineEnrolment.js); this file
// calls it and decides, from what it returns, whether a learner can open a
// course.
//
// A course's `enrolment` is "approval" (the default, also when it is not set)
// or "open". In an approval course a learner asks to join, and a manager
// approves them and puts them in a group, or enrols them directly.
import { useCallback, useEffect, useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

export const callEnrolment = (action, data = {}) =>
    httpsCallable(getFunctions(), 'onlineEnrolment', { timeout: 70000 })({ action, ...data }).then((r) => r.data);

export const isOpenCourse = (course) => course?.enrolment === 'open';

/**
 * What the learner may do with a course:
 *   'open'      no enrolment needed
 *   'enrolled'  approved by a manager (or the person writes courses)
 *   'requested' asked to join, waiting for a manager
 *   'declined'  a manager said no
 *   'none'      needs to ask to join
 * Someone who had already started a course before enrolment existed keeps
 * their place in it (`started`).
 */
export function courseAccess(course, enrolment, { canManage = false, started = false } = {}) {
    if (!course) return 'none';
    if (canManage) return 'enrolled';
    if (isOpenCourse(course)) return 'open';
    if (enrolment?.status === 'approved') return 'enrolled';
    if (started) return 'enrolled';
    if (enrolment?.status === 'requested') return 'requested';
    if (enrolment?.status === 'declined') return 'declined';
    return 'none';
}

export const canStudy = (access) => access === 'open' || access === 'enrolled';

// The learner's last known enrolments, kept on the device so the course list
// opens offline with the right buttons.
const cacheKey = (uid) => `oc-enrolments-${uid || 'guest'}`;
function readCache(uid) {
    try { return JSON.parse(localStorage.getItem(cacheKey(uid)) || 'null'); } catch { return null; }
}
function writeCache(uid, value) {
    try { localStorage.setItem(cacheKey(uid), JSON.stringify(value)); } catch { /* private mode */ }
}

const ENROL_FRESH_MS = 6 * 60 * 60 * 1000;
const ENROL_WAITING_MS = 2 * 60 * 1000;

// How often a screen that stays open re-checks enrolment on its own. This
// is what makes enrolment feel live: a new request reaches the manager's
// list, and an approval opens the course for the learner, within seconds
// and without anyone reloading the page.
export const ENROL_LIVE_MS = 20 * 1000;

/** True while any of these enrolments is still waiting on a manager. */
export const enrolmentWaiting = (enrolments) => (enrolments || []).some((e) => e.status === 'requested');

/**
 * Run `refresh` every ENROL_LIVE_MS while `active` and the tab is visible,
 * and once more as soon as the tab is seen again. Pausing while the tab is
 * hidden keeps a forgotten page from calling the server all day.
 */
export function useEnrolmentLive(refresh, active = true) {
    useEffect(() => {
        if (!active || !refresh) return undefined;
        const tick = () => { if (!document.hidden) refresh(); };
        const id = setInterval(tick, ENROL_LIVE_MS);
        const onVisible = () => { if (!document.hidden) refresh(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
    }, [refresh, active]);
}

/** The signed-in learner's enrolments, by course, and the groups they are in. */
export function useMyEnrolments(uid) {
    const [state, setState] = useState(() => readCache(uid) || { enrolments: [], groups: [], loaded: false });
    const load = useCallback(async ({ ifStale = false } = {}) => {
        if (!uid) return;
        // Opening the course page reuses the saved answer while it is recent:
        // each check is a server call plus reads. A request still waiting for a
        // manager is checked more often, so an approval shows soon.
        if (ifStale) {
            const saved = readCache(uid);
            const waiting = enrolmentWaiting(saved?.enrolments);
            const age = Date.now() - (saved?.fetchedAt || 0);
            if (saved?.loaded && !saved.failed && age < (waiting ? ENROL_WAITING_MS : ENROL_FRESH_MS)) return;
        }
        try {
            const res = await callEnrolment('mine');
            const next = { enrolments: res.enrolments || [], groups: res.groups || [], loaded: true, fetchedAt: Date.now() };
            setState(next);
            writeCache(uid, next);
        } catch (e) {
            console.warn('Could not load enrolments:', e?.message || e);
            setState((s) => ({ ...s, loaded: true, failed: true }));
        }
    }, [uid]);
    useEffect(() => { load({ ifStale: true }); }, [load]);
    // While one of my requests is waiting, keep checking on the short live
    // cycle: the moment a manager approves it, this state changes, the
    // course's access flips to enrolled and the gate opens by itself.
    useEnrolmentLive(load, enrolmentWaiting(state.enrolments));
    const byCourse = Object.fromEntries((state.enrolments || []).map((e) => [e.courseId, e]));
    const groupById = Object.fromEntries((state.groups || []).map((g) => [g.id, g]));
    const request = useCallback(async (courseId) => {
        const res = await callEnrolment('request', { courseId });
        await load();
        return res;
    }, [load]);
    const cancel = useCallback(async (courseId) => {
        await callEnrolment('cancel', { courseId });
        await load();
    }, [load]);
    return { ...state, byCourse, groupById, reload: load, request, cancel };
}

export const groupName = (g, isArabic) => (g ? (isArabic && g.nameAr ? g.nameAr : g.name) : '');
