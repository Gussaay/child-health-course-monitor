// src/training/firestoreShim.js
//
// Every `import … from 'firebase/firestore'` in the app resolves to this file
// (alias in vite.config.js). Outside training mode it is the real SDK: the
// wrappers below hand straight through.
//
// In training mode (see trainingSession.js) it re-points the app's data:
//
//  * SANDBOXED (the default): collection(db, 'courses') becomes
//    trainingSandboxes/<courseId>/courses, doc(db, 'participants', id) becomes
//    trainingSandboxes/<courseId>/participants/<id>, and so on, so trainees
//    use every screen but only ever read and write practice data.
//  * READ_ONLY_REAL: reference material the app needs to work (protocols,
//    settings, online courses, certificate templates…). Read from the real
//    collection; any write is refused.
//  * ACCOUNT_REAL: the person's own account and usage records (profile,
//    sign-in usage, AI logs). These stay real because they are about the
//    person, not programme data, and the security rules already limit them.
//
// As a last guard, every write (setDoc, updateDoc, deleteDoc, addDoc, batch,
// transaction) is checked: in training mode nothing outside the sandbox or
// ACCOUNT_REAL can be written, whatever path a screen builds.

import * as real from '@firebase/firestore';
import { trainingCourseId, SANDBOX_ROOT } from './trainingSession.js';

export * from '@firebase/firestore';

export const READ_ONLY_REAL = new Set([
    'meta', 'settings', 'appSettings', 'update_history',
    'imnciProtocols', 'exerciseDefinitions',
    'onlineCourses', 'onlineCourseItems',
    'aiBooks', 'aiSectionNotes',
    'certificateTemplates', 'course_sub_types',
    'populationTargets',
]);

export const ACCOUNT_REAL = new Set([
    'users', 'userUsageStats', 'usageMonthly', 'usageBills',
    'aiLog', 'aiUsage', 'claudeAccessLog', 'notificationRateLimits',
]);

const isFirestoreInstance = (x) => !!x && x.type === 'firestore';

/** The sandboxed path segments for a top-level path, or null when it stays real. */
export function sandboxSegments(courseId, segments) {
    const parts = segments
        .flatMap((s) => String(s).split('/'))
        .filter((s) => s.length > 0);
    if (!courseId || parts.length === 0) return null;
    const top = parts[0];
    if (top === SANDBOX_ROOT || READ_ONLY_REAL.has(top) || ACCOUNT_REAL.has(top)) return null;
    return [SANDBOX_ROOT, courseId, ...parts];
}

/** May a document at this path be written in training mode? */
export function isWritableInTraining(courseId, path) {
    if (!courseId) return true;
    const parts = String(path || '').split('/').filter(Boolean);
    if (parts[0] === SANDBOX_ROOT) return parts[1] === courseId;
    return ACCOUNT_REAL.has(parts[0]);
}

export class TrainingWriteBlockedError extends Error {
    constructor(path) {
        super(`Training mode: "${path}" is real data and cannot be changed from a training link.`);
        this.name = 'TrainingWriteBlockedError';
        this.code = 'training/read-only';
    }
}

function guard(ref) {
    const courseId = trainingCourseId();
    if (!courseId) return;
    const path = ref?.path;
    if (!isWritableInTraining(courseId, path)) throw new TrainingWriteBlockedError(path);
}

// --- References ------------------------------------------------------------

export function collection(parent, ...segments) {
    if (isFirestoreInstance(parent)) {
        const sandboxed = sandboxSegments(trainingCourseId(), segments);
        if (sandboxed) return real.collection(parent, ...sandboxed);
    }
    return real.collection(parent, ...segments);
}

export function doc(parent, ...segments) {
    if (isFirestoreInstance(parent) && segments.length > 0) {
        const sandboxed = sandboxSegments(trainingCourseId(), segments);
        if (sandboxed) return real.doc(parent, ...sandboxed);
    }
    return real.doc(parent, ...segments);
}

// --- Activity ----------------------------------------------------------------
// TrainingGate registers a recorder (trainingProgress.js) so the course's
// Training activity dashboard can show what each trainee saved. Only writes
// inside the sandbox count; account records and reference data never do.

let activityRecorder = null;

export function setTrainingActivityRecorder(fn) {
    activityRecorder = typeof fn === 'function' ? fn : null;
}

/** { collection, docId } of a sandbox document path, or null. */
export function sandboxTarget(courseId, path) {
    const parts = String(path || '').split('/').filter(Boolean);
    if (!courseId || parts[0] !== SANDBOX_ROOT || parts[1] !== courseId || parts.length < 3) return null;
    return { collection: parts[2], docId: parts.length >= 4 ? parts[3] : null };
}

function report(kind, paths) {
    if (!activityRecorder) return;
    const courseId = trainingCourseId();
    const targets = paths.map((p) => sandboxTarget(courseId, p)).filter(Boolean);
    if (targets.length === 0) return;
    try { activityRecorder({ kind, targets }); } catch { /* never break a save */ }
}

function tracked(promise, kind, paths) {
    if (!trainingCourseId()) return promise;
    return promise.then((result) => { report(kind, paths); return result; });
}

// --- Writes ----------------------------------------------------------------

export function setDoc(ref, ...rest) {
    try { guard(ref); } catch (e) { return Promise.reject(e); }
    return tracked(real.setDoc(ref, ...rest), 'save', [ref.path]);
}

export function updateDoc(ref, ...rest) {
    try { guard(ref); } catch (e) { return Promise.reject(e); }
    return tracked(real.updateDoc(ref, ...rest), 'save', [ref.path]);
}

export function deleteDoc(ref) {
    try { guard(ref); } catch (e) { return Promise.reject(e); }
    return tracked(real.deleteDoc(ref), 'delete', [ref.path]);
}

export function addDoc(ref, data) {
    try { guard(real.doc(ref)); } catch (e) { return Promise.reject(e); }
    if (!trainingCourseId()) return real.addDoc(ref, data);
    return real.addDoc(ref, data).then((created) => { report('save', [created.path]); return created; });
}

function guardWrites(target, written) {
    if (!trainingCourseId()) return target;
    for (const method of ['set', 'update', 'delete']) {
        const original = target[method].bind(target);
        target[method] = (ref, ...rest) => {
            guard(ref);
            original(ref, ...rest);
            written?.push({ kind: method === 'delete' ? 'delete' : 'save', path: ref.path });
            return target;
        };
    }
    return target;
}

function reportAll(written) {
    const saves = written.filter((w) => w.kind === 'save').map((w) => w.path);
    const deletes = written.filter((w) => w.kind === 'delete').map((w) => w.path);
    if (saves.length) report('save', saves);
    if (deletes.length) report('delete', deletes);
}

export function writeBatch(firestore) {
    const batch = real.writeBatch(firestore);
    if (!trainingCourseId()) return batch;
    const written = [];
    guardWrites(batch, written);
    const commit = batch.commit.bind(batch);
    batch.commit = () => commit().then((result) => { reportAll(written); return result; });
    return batch;
}

export function runTransaction(firestore, updateFunction, options) {
    if (!trainingCourseId()) return real.runTransaction(firestore, updateFunction, options);
    let written = [];
    return real.runTransaction(firestore, (tx) => {
        written = []; // a retried transaction starts over
        return updateFunction(guardWrites(tx, written));
    }, options).then((result) => { reportAll(written); return result; });
}
