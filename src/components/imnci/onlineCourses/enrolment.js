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

/** The signed-in learner's enrolments, by course, and the groups they are in. */
export function useMyEnrolments(uid) {
    const [state, setState] = useState(() => readCache(uid) || { enrolments: [], groups: [], loaded: false });
    const load = useCallback(async () => {
        if (!uid) return;
        try {
            const res = await callEnrolment('mine');
            const next = { enrolments: res.enrolments || [], groups: res.groups || [], loaded: true };
            setState(next);
            writeCache(uid, next);
        } catch (e) {
            console.warn('Could not load enrolments:', e?.message || e);
            setState((s) => ({ ...s, loaded: true, failed: true }));
        }
    }, [uid]);
    useEffect(() => { load(); }, [load]);
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
