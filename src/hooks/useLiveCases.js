// hooks/useLiveCases.js
// Live monitoring records for an entry form. The page loads its cases (and
// observations) as before; this listener then brings in cases that another
// device adds, edits or deletes for the same participant (or course), with
// their observations, while the form is open.
//
// Cost: the listener's first answer is the same records the page just loaded
// (one read each, as the page's own load costs). After that, each case
// changed on another device costs one read plus its observations. This
// device's own saves are not read again.
import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { listObservationsForCases } from './liveCourseCore.js';

const alive = (r) => r && r.isDeleted !== true && r.isDeleted !== 'true';

/**
 * courseId: required. participantId: optional (null = every case of the course).
 * setCases / setObservations: the page's state setters (setObservations optional).
 * keep(case): which cases belong on this page (default all).
 */
export function useLiveCases({ courseId, participantId = null, setCases, setObservations = null, keep = () => true }) {
    const keepRef = useRef(keep);
    keepRef.current = keep;
    useEffect(() => {
        if (!courseId) return undefined;
        const filters = [where('courseId', '==', courseId)];
        if (participantId) filters.push(where('participant_id', '==', participantId));
        const own = new Set();   // cases this device is saving: skip their confirmation
        let ready = false;       // the page already has everything up to the first server answer
        let stopped = false;
        const unsub = onSnapshot(query(collection(db, 'cases'), ...filters), async (snap) => {
            const changes = snap.docChanges();
            changes.forEach((ch) => { if (ch.doc.metadata.hasPendingWrites) own.add(ch.doc.id); });
            if (snap.metadata.fromCache) return;
            if (!ready) { ready = true; changes.forEach((ch) => own.delete(ch.doc.id)); return; }
            const remote = changes.filter((ch) => !ch.doc.metadata.hasPendingWrites && !own.delete(ch.doc.id));
            if (!remote.length) return;
            const upserts = remote.filter((ch) => ch.type !== 'removed').map((ch) => ({ id: ch.doc.id, ...ch.doc.data() }));
            const gone = new Set([
                ...remote.filter((ch) => ch.type === 'removed').map((ch) => ch.doc.id),
                ...upserts.filter((u) => !alive(u) || !keepRef.current(u)).map((u) => u.id),
            ]);
            const fresh = upserts.filter((u) => alive(u) && keepRef.current(u));
            let obs = [];
            if (setObservations && fresh.length) {
                try { obs = await listObservationsForCases(fresh.map((u) => u.id)); }
                catch (e) { console.warn('[live] observations read failed:', e?.message || e); return; }
            }
            if (stopped) return;
            setCases((prev) => {
                const map = new Map((prev || []).map((c) => [c.id, c]));
                gone.forEach((id) => map.delete(id));
                fresh.forEach((u) => map.set(u.id, { ...map.get(u.id), ...u }));
                return Array.from(map.values());
            });
            if (setObservations) {
                const touched = new Set([...gone, ...fresh.map((u) => u.id)]);
                setObservations((prev) => [...(prev || []).filter((o) => !touched.has(o.caseId)), ...obs.filter(alive)]);
            }
        }, (e) => console.warn('[live] cases listener stopped:', e?.code || e?.message || e));
        return () => { stopped = true; unsub(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [courseId, participantId]);
}
