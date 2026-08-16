// src/components/exercises/exerciseService.js
//
// Firestore access for exercise attempts. Follows the same style as data.js —
// you can either import from here directly, or re-export these from data.js:
//
//   export { upsertExerciseAttempt, listExerciseAttemptsForCourse,
//            listExerciseAttemptsForParticipant } from './components/exercises/exerciseService';
//
// Collection: exerciseAttempts
// Doc id:     `${courseId}__${participantId}__${exerciseId}__${attemptNo}`
//             Deterministic ids keep offline writes idempotent — a queued write
//             that replays after reconnect overwrites itself instead of duplicating.

import { db } from '../../firebase';
import {
    collection, doc, setDoc, getDocs, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';

const COLLECTION = 'exerciseAttempts';

const attemptDocId = (courseId, participantId, exerciseId, attemptNo) =>
    `${courseId}__${participantId}__${exerciseId}__${attemptNo}`;

/**
 * Save one attempt.
 * @param {object} p
 * @param {string} p.courseId
 * @param {string} p.participantId
 * @param {string} p.participantName
 * @param {string} p.exerciseId
 * @param {string} p.exerciseTitle
 * @param {string} p.subCourse
 * @param {number} p.attemptNo      1-based; caller passes previous count + 1
 * @param {number} p.percent
 * @param {number} p.earned
 * @param {number} p.possible
 * @param {boolean} p.passed
 * @param {number} p.durationSeconds
 * @param {object} p.responses      raw learner answers, for review
 * @param {object} p.results        per-step grading, for review
 * @param {string} p.source         'public' | 'facilitator'
 */
export async function upsertExerciseAttempt(p) {
    if (!p?.courseId || !p?.participantId || !p?.exerciseId) {
        throw new Error('courseId, participantId and exerciseId are required.');
    }
    const attemptNo = p.attemptNo || 1;
    const id = attemptDocId(p.courseId, p.participantId, p.exerciseId, attemptNo);

    const payload = {
        id,
        courseId: p.courseId,
        participantId: p.participantId,
        participantName: p.participantName || '',
        exerciseId: p.exerciseId,
        exerciseTitle: p.exerciseTitle || '',
        subCourse: p.subCourse || '',
        attemptNo,
        percent: Number(p.percent) || 0,
        earned: Number(p.earned) || 0,
        possible: Number(p.possible) || 0,
        passed: !!p.passed,
        durationSeconds: Number(p.durationSeconds) || 0,
        // Stored as JSON strings: Firestore rejects nested arrays and these blobs
        // are only ever read back whole for the review screen.
        responsesJson: JSON.stringify(p.responses || {}),
        resultsJson: JSON.stringify(p.results || {}),
        source: p.source || 'public',
        submittedAt: serverTimestamp(),
        submittedAtLocal: new Date().toISOString(),
    };

    // Firestore's offline queue handles the write when the device is offline —
    // do NOT await when offline or the promise never settles until reconnect.
    const ref = doc(db, COLLECTION, id);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setDoc(ref, payload, { merge: true });
        return { ...payload, queuedOffline: true };
    }
    await setDoc(ref, payload, { merge: true });
    return payload;
}

const hydrate = (d) => {
    const raw = d.data();
    let responses = {}, results = {};
    try { responses = JSON.parse(raw.responsesJson || '{}'); } catch { /* ignore */ }
    try { results = JSON.parse(raw.resultsJson || '{}'); } catch { /* ignore */ }
    return { ...raw, id: d.id, responses, results };
};

export async function listExerciseAttemptsForCourse(courseId) {
    if (!courseId) return [];
    const q = query(collection(db, COLLECTION), where('courseId', '==', courseId));
    const snap = await getDocs(q);
    return snap.docs.map(hydrate).sort((a, b) => (b.submittedAtLocal || '').localeCompare(a.submittedAtLocal || ''));
}

export async function listExerciseAttemptsForParticipant(courseId, participantId) {
    if (!courseId || !participantId) return [];
    const q = query(
        collection(db, COLLECTION),
        where('courseId', '==', courseId),
        where('participantId', '==', participantId),
    );
    const snap = await getDocs(q);
    return snap.docs.map(hydrate).sort((a, b) => (a.attemptNo || 0) - (b.attemptNo || 0));
}

/** Best percent per exercise, keyed by exerciseId. Used for the progress badges. */
export function bestByExercise(attempts = []) {
    return attempts.reduce((acc, a) => {
        if (!acc[a.exerciseId] || a.percent > acc[a.exerciseId].percent) acc[a.exerciseId] = a;
        return acc;
    }, {});
}
