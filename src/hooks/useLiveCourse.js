// hooks/useLiveCourse.js
// Keeps the open course's details (App.jsx courseDetailsCache) current while
// it is on screen: participants, pre/post test scores, and monitoring cases
// with their observations (clinical monitoring and operational guide
// exercises). A change entered on any device shows here within seconds.
//
// Cost: each listener asks the server only for this course's records changed
// after a server-time mark kept on this device (data.js
// subscribeCourseRecords). Opening a course again costs nothing if nothing
// changed; each record another device adds or edits costs one read. The first
// time a device opens a course (no mark yet) it reads the course once in full,
// as a normal open already did.
//
// Listeners run only while signed in, online and with the app on screen, and
// close when the course is left. A listener the server refuses (index not
// built yet, rules) is dropped for this session and onFallback runs once, so
// the page still gets one full server read.
import { useEffect, useRef, useState } from 'react';
import { subscribeCourseRecords, listObservationsForCases, listAllDataForCourse } from '../data.js';
import { newestServerStamp } from '../DataContext.jsx';

const LIVE_OVERLAP_MS = 1000;
const alive = (r) => r && r.isDeleted !== true && r.isDeleted !== 'true';
const markKey = (col, courseId) => `liveCourseMark_v1_${col}_${courseId}`;
const readMark = (col, courseId) => {
    try { return JSON.parse(localStorage.getItem(markKey(col, courseId)) || 'null') || { at: 0, n: 0 }; } catch { return { at: 0, n: 0 }; }
};
const writeMark = (col, courseId, at, n) => {
    try { localStorage.setItem(markKey(col, courseId), JSON.stringify({ at, n })); } catch { /* storage full */ }
};
// Listeners refused this session (missing index, rules): don't retry them.
const refused = new Set();

// field in courseDetailsCache <- Firestore collection
const LISTS = [
    { field: 'participants', col: 'participants' },
    { field: 'participantTests', col: 'participantTests' },
    { field: 'allCases', col: 'cases' },
];

const mergeList = (list, upserts, removedIds) => {
    const map = new Map((list || []).map((i) => [i.id, i]));
    removedIds.forEach((id) => map.delete(id));
    upserts.forEach((u) => { if (alive(u)) map.set(u.id, { ...map.get(u.id), ...u }); else map.delete(u.id); });
    return Array.from(map.values());
};

const withCorrectness = (cases, obs) => cases.map((c) => {
    const mine = obs.filter((o) => o.caseId === c.id);
    return { ...c, is_correct: mine.length > 0 && mine.every((o) => Number(o.item_correct) > 0) };
});

function useAppActive() {
    const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
    const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
    useEffect(() => {
        const onVis = () => setVisible(document.visibilityState !== 'hidden');
        const onOn = () => setOnline(true);
        const onOff = () => setOnline(false);
        document.addEventListener('visibilitychange', onVis);
        window.addEventListener('online', onOn);
        window.addEventListener('offline', onOff);
        return () => {
            document.removeEventListener('visibilitychange', onVis);
            window.removeEventListener('online', onOn);
            window.removeEventListener('offline', onOff);
        };
    }, []);
    return visible && online;
}

export function useLiveCourseDetails({ courseId, details, user, setCourseDetailsCache, onFallback }) {
    const active = useAppActive();
    const detailsRef = useRef(details);
    detailsRef.current = details;
    // Which lists are loaded, so the effect re-runs only when one is loaded,
    // not on every change inside one.
    const loaded = LISTS.filter((l) => Array.isArray(details?.[l.field])).map((l) => l.field).join(',')
        + (Array.isArray(details?.allObs) ? ',allObs' : '');

    useEffect(() => {
        if (!courseId || !user || !active || !loaded) return undefined;
        let stopped = false;
        const unsubs = [];
        const stopAll = () => { unsubs.splice(0).forEach((u) => { try { u(); } catch { /* closed */ } }); };
        const fields = new Set(loaded.split(','));

        const patch = (fn) => setCourseDetailsCache((prev) => {
            const cur = prev[courseId];
            if (!cur) return prev;
            return { ...prev, [courseId]: { ...cur, ...fn(cur) } };
        });
        let fellBack = false;
        const fail = (col) => (error) => {
            console.warn(`[live course] ${col} listener stopped:`, error?.code || error?.message || error);
            refused.add(`${col}:${courseId}`);
            stopAll();
            if (!fellBack && !stopped) { fellBack = true; onFallback?.(courseId); }
        };

        // Base lists come from the device cache. If the device has fewer
        // records than when the mark was saved (cache cleared or evicted),
        // start again from zero so nothing older than the mark is missed.
        const base = detailsRef.current;

        // A list refused earlier this session gets one full read per open instead.
        if (LISTS.some(({ field, col }) => fields.has(field) && refused.has(`${col}:${courseId}`))) {
            fellBack = true;
            onFallback?.(courseId);
        }
        LISTS.forEach(({ field, col }) => {
            if (!fields.has(field) || refused.has(`${col}:${courseId}`)) return;
            if (field === 'allCases' && !fields.has('allObs')) return;
            const mark = readMark(col, courseId);
            const ids = new Set((Array.isArray(base?.[field]) ? base[field] : []).map((r) => r.id));
            const since = ids.size >= mark.n ? mark.at : 0;

            const onChange = async ({ upserts, removed }, fromCache) => {
                if (stopped) return;
                const gone = [...removed, ...upserts.filter((u) => !alive(u)).map((u) => u.id)];
                if (field !== 'allCases') {
                    patch((cur) => ({ [field]: mergeList(cur[field], upserts, removed) }));
                } else {
                    // A changed case brings its observations, read again as a set.
                    const changedIds = upserts.filter(alive).map((u) => u.id);
                    let obs = [];
                    // A copy from the device cache already has its observations
                    // in the cached base; only server changes are read again.
                    if (fromCache) {
                        patch((cur) => ({ allCases: mergeList(cur.allCases, upserts, removed) }));
                        return;
                    }
                    try {
                        if (changedIds.length > 300) {
                            const wanted = new Set(changedIds);
                            obs = (await listAllDataForCourse(courseId)).allObs.filter((o) => wanted.has(o.caseId));
                        } else {
                            obs = await listObservationsForCases(changedIds);
                        }
                    } catch (e) {
                        // Keep the old observations and the old mark, so these
                        // cases are read again next time the course opens.
                        console.warn('[live course] observations read failed:', e?.message || e);
                        if (!stopped) patch((cur) => ({ allCases: mergeList(cur.allCases, upserts, removed) }));
                        return;
                    }
                    if (stopped) return;
                    const touched = new Set([...changedIds, ...gone]);
                    patch((cur) => {
                        const allObs = [...(cur.allObs || []).filter((o) => !touched.has(o.caseId)), ...obs.filter(alive)];
                        const changed = new Set(changedIds);
                        const allCases = mergeList(cur.allCases, upserts, removed);
                        const fresh = withCorrectness(allCases.filter((c) => changed.has(c.id)), allObs);
                        return { allObs, allCases: mergeList(allCases, fresh, []) };
                    });
                }
                upserts.filter(alive).forEach((u) => ids.add(u.id));
                gone.forEach((id) => ids.delete(id));
                if (fromCache) return;
                const newest = newestServerStamp(upserts);
                if (newest > readMark(col, courseId).at) writeMark(col, courseId, newest, ids.size);
            };
            try {
                unsubs.push(subscribeCourseRecords(col, courseId, Math.max(0, since - (since ? LIVE_OVERLAP_MS : 0)), onChange, fail(col)));
            } catch (e) { fail(col)(e); }
        });

        return () => { stopped = true; stopAll(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId, user, active, loaded]);
}
