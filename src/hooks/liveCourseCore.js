// hooks/liveCourseCore.js
// Live listeners (open course, approval queues, problem reports, daily
// evaluation days). Loaded only when a page needs them, so they stay out of
// the first-load bundle.
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { getDocs, deltaChanges, listAllDataForCourse, listAllParticipantsForCourse, listParticipantTestsForCourse, servedByServer, dispatchOpEvent } from '../data.js';
import { newestServerStamp } from '../DataContext.jsx';

// --- LIVE COURSE RECORDS ---
// One open course is kept current by listeners that ask the server only for
// its records changed after a server-time mark (same idea as
// subscribeListDelta). An unchanged course costs nothing; each record another
// device adds or edits costs one read per device that has the course open.
// Each needs a composite index (courseId + the stamp field, see
// firestore.indexes.json). Without it the server refuses the listener and
// onError runs, so callers fall back to a one-off full read.
export function subscribeCourseRecords(col, courseId, sinceMs, onChange, onError, stampField = 'lastUpdatedAt') {
    if (!courseId) return () => {};
    const q = query(
        collection(db, col),
        where("courseId", "==", courseId),
        where(stampField, ">", Timestamp.fromMillis(Math.max(0, sinceMs || 0))),
    );
    return onSnapshot(q, (snap) => {
        const changes = deltaChanges(snap, undefined, undefined, col);
        if (changes.upserts.length || changes.removed.length) onChange(changes, snap.metadata?.fromCache === true);
    }, onError);
}

// The observations of some cases, from the server. A case edit replaces its
// observations (the old ones are deleted), so a changed case's observations
// are read again as a set instead of being listened to one by one.
export async function listObservationsForCases(caseIds = []) {
    const ids = [...new Set(caseIds.filter(Boolean))];
    const out = [];
    for (let i = 0; i < ids.length; i += 30) {
        const q = query(collection(db, "observations"), where("caseId", "in", ids.slice(i, i + 30)));
        const snap = await getDocs(q);
        snap.docs.forEach(d => out.push({ id: d.id, ...d.data() }));
    }
    return out;
}

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
export const LISTS = [
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


// Fallback when the live listeners can't run (index not built, rules): one
// full server read of the open course, as the app did before.
async function refreshCourseFromServer(courseId, setCourseDetailsCache) {
    try {
        const [participants, participantTests, data] = await Promise.all([
            listAllParticipantsForCourse(courseId, { source: 'server' }),
            listParticipantTestsForCourse(courseId, { source: 'server' }),
            listAllDataForCourse(courseId, { source: 'server' }),
        ]);
        setCourseDetailsCache((prev) => ({ ...prev, [courseId]: { ...(prev[courseId] || {}),
            participants: (participants || []).filter(alive), participantTests: (participantTests || []).filter(alive),
            allObs: (data?.allObs || []).filter(alive), allCases: (data?.allCases || []).filter(alive) } }));
    } catch (e) {
        console.warn('[live course] server refresh failed:', e?.message || e);
    }
}

export function startLiveCourse({ courseId, base, loaded, setCourseDetailsCache }) {
    const onFallback = (id) => refreshCourseFromServer(id, setCourseDetailsCache);
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
}

/**
 * Live pending approval queue (status == "pending") of one submissions
 * collection. The queue is small, so the first answer costs one read per
 * pending request and each new, approved or rejected request one more.
 * idField: "submissionId" for facility submissions, "id" for the others.
 * Returns the unsubscribe; call it on unmount.
 */
export function subscribePendingSubmissions(col, onRows, onError, idField = 'id') {
    const q = query(collection(db, col), where("status", "==", "pending"));
    let first = true;
    return onSnapshot(q, (snap) => {
        if (servedByServer(snap)) {
            const changed = snap.docChanges().filter(ch => !ch.doc.metadata.hasPendingWrites).length;
            dispatchOpEvent('read', first ? Math.max(1, changed) : changed, col, 'live');
            first = false;
        }
        onRows(snap.docs.map(d => ({ [idField]: d.id, ...d.data() })));
    }, onError);
}

// New problem reports as they arrive: only reports sent after sinceMs are
// read (one read each), so an open Admin tab costs nothing while none come in.
export function subscribeNewProblemReports(sinceMs, onRows, onError) {
    const q = query(collection(db, "problemReports"), where("createdAt", ">", Timestamp.fromMillis(Math.max(0, sinceMs || 0))));
    return onSnapshot(q, (snap) => {
        if (servedByServer(snap)) dispatchOpEvent('read', snap.docChanges().length, 'problemReports', 'live');
        const rows = snap.docChanges().filter(ch => ch.type !== 'removed' && !ch.doc.metadata.hasPendingWrites).map(ch => ({ id: ch.doc.id, ...ch.doc.data() }));
        if (rows.length) onRows(rows);
    }, onError);
}

// The course's daily evaluation days, live. A course has a handful (one per
// day), so the first answer costs that many reads and each change one more.
export function subscribeDailyEvalForms(courseId, onRows, onError) {
    const q = query(collection(db, "dailyEvalForms"), where("courseId", "==", courseId));
    return onSnapshot(q, (snap) => {
        if (servedByServer(snap)) dispatchOpEvent('read', Math.max(1, snap.docChanges().length), 'dailyEvalForms', 'live');
        onRows(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(f => !f.isDeleted));
    }, onError);
}

// Approval queues kept live in DataContext once loaded: a new request, or one
// approved or rejected on another device, shows at once. Only pending
// requests are read, so the cost is the size of each queue.
const PENDING_LIVE = { pendingFacilitatorSubmissions: 'facilitatorSubmissions', pendingFederalSubmissions: 'federalCoordinatorSubmissions', pendingStateSubmissions: 'coordinatorSubmissions', pendingLocalitySubmissions: 'localityCoordinatorSubmissions' };
export function startPendingQueues(keys, onRows) {
    const unsubs = keys.filter((k) => PENDING_LIVE[k]).map((k) => {
        try {
            return subscribePendingSubmissions(PENDING_LIVE[k], (rows) => onRows(k, rows),
                (e) => console.warn(`[live] ${k} listener stopped:`, e?.code || e?.message || e));
        } catch { return null; }
    });
    return () => unsubs.forEach((u) => { try { u?.(); } catch { /* closed */ } });
}
