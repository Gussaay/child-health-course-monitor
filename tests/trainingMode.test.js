import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initializeApp } from 'firebase/app';
import { getFirestore } from '@firebase/firestore';

// Training links (src/training/): the Firestore wrapper must send every app
// read and write to the course's sandbox, keep reference data real and
// read-only, and refuse any write outside the sandbox.

describe('training session', () => {
    it('works out the practice window from start date and duration', async () => {
        const { courseTrainingWindow } = await import('../src/training/trainingSession.js');
        const w = courseTrainingWindow({ start_date: '2026-11-10', course_duration: 5 });
        expect(w.start.getFullYear()).toBe(2026);
        expect(w.start.getMonth()).toBe(10);
        expect(w.start.getDate()).toBe(10);
        expect(w.start.getHours()).toBe(0);
        // Ends at midnight after the fifth day (10, 11, 12, 13, 14).
        expect(w.end.getDate()).toBe(15);
        expect(w.end.getHours()).toBe(0);
        expect(courseTrainingWindow({ start_date: '2026-11-10' })).toBeNull();
        expect(courseTrainingWindow({ course_duration: 3 })).toBeNull();
        expect(courseTrainingWindow({ start_date: 'soon', course_duration: 3 })).toBeNull();
    });

    it('reports the link status from the stamped window', async () => {
        const { trainingStatus } = await import('../src/training/trainingSession.js');
        const at = (ms) => new Date(ms);
        const course = { training: { enabled: true, startsAt: at(1000), endsAt: at(2000) } };
        expect(trainingStatus(course, 500)).toBe('not_started');
        expect(trainingStatus(course, 1000)).toBe('open');
        expect(trainingStatus(course, 1999)).toBe('open');
        expect(trainingStatus(course, 2000)).toBe('expired');
        expect(trainingStatus({ training: { ...course.training, enabled: false } }, 1500)).toBe('disabled');
        expect(trainingStatus({}, 1500)).toBe('disabled');
        expect(trainingStatus({ ...course, isDeleted: true }, 1500)).toBe('disabled');
    });
});

describe('sandbox paths', () => {
    it('sandboxes programme data and leaves reference and account data real', async () => {
        const { sandboxSegments } = await import('../src/training/firestoreShim.js');
        expect(sandboxSegments('c1', ['courses'])).toEqual(['trainingSandboxes', 'c1', 'courses']);
        expect(sandboxSegments('c1', ['participants', 'p1'])).toEqual(['trainingSandboxes', 'c1', 'participants', 'p1']);
        expect(sandboxSegments('c1', ['courses/x/sub'])).toEqual(['trainingSandboxes', 'c1', 'courses', 'x', 'sub']);
        expect(sandboxSegments('c1', ['users', 'u1'])).toBeNull();
        expect(sandboxSegments('c1', ['imnciProtocols'])).toBeNull();
        expect(sandboxSegments('c1', ['trainingSandboxes', 'c1'])).toBeNull();
        expect(sandboxSegments(null, ['courses'])).toBeNull();
    });

    it('allows writes only to its own sandbox and account records', async () => {
        const { isWritableInTraining } = await import('../src/training/firestoreShim.js');
        expect(isWritableInTraining('c1', 'trainingSandboxes/c1/courses/x')).toBe(true);
        expect(isWritableInTraining('c1', 'trainingSandboxes/c2/courses/x')).toBe(false);
        expect(isWritableInTraining('c1', 'courses/x')).toBe(false);
        expect(isWritableInTraining('c1', 'imnciProtocols/x')).toBe(false);
        expect(isWritableInTraining('c1', 'users/u1')).toBe(true);
        expect(isWritableInTraining(null, 'courses/x')).toBe(true);
    });
});

describe('Firestore wrapper in a training tab', () => {
    let shim;
    let db;

    beforeAll(async () => {
        vi.resetModules();
        sessionStorage.clear();
        window.history.pushState(null, '', '/training/course123');
        shim = await import('../src/training/firestoreShim.js');
        db = getFirestore(initializeApp({ projectId: 'demo-training', apiKey: 'x' }, 'training-test'));
    });

    it('enters training mode from the link and clears the address', async () => {
        const session = await import('../src/training/trainingSession.js');
        expect(session.trainingCourseId()).toBe('course123');
        expect(window.location.pathname).toBe('/');
        expect(sessionStorage.getItem('chm_training_course')).toBe('course123');
    });

    it('points app references at the sandbox', () => {
        expect(shim.collection(db, 'courses').path).toBe('trainingSandboxes/course123/courses');
        expect(shim.doc(db, 'participants', 'p1').path).toBe('trainingSandboxes/course123/participants/p1');
        expect(shim.doc(shim.collection(db, 'courses'), 'c9').path).toBe('trainingSandboxes/course123/courses/c9');
        expect(shim.doc(db, 'imnciProtocols', 'x').path).toBe('imnciProtocols/x');
        expect(shim.doc(db, 'users', 'u1').path).toBe('users/u1');
    });

    it('refuses writes to real data', async () => {
        const real = shim.doc(db, 'imnciProtocols', 'x');
        await expect(shim.setDoc(real, { a: 1 })).rejects.toMatchObject({ code: 'training/read-only' });
        await expect(shim.updateDoc(real, { a: 1 })).rejects.toMatchObject({ code: 'training/read-only' });
        await expect(shim.deleteDoc(real)).rejects.toMatchObject({ code: 'training/read-only' });
        await expect(shim.addDoc(shim.collection(db, 'meta'), { a: 1 })).rejects.toMatchObject({ code: 'training/read-only' });
        const batch = shim.writeBatch(db);
        expect(() => batch.set(real, { a: 1 })).toThrow(/Training mode/);
        expect(batch.set(shim.doc(db, 'courses', 'c1'), { a: 1 })).toBe(batch);
    });

    it('keeps form drafts and visit counters apart from the real app', () => {
        localStorage.setItem('courseFormDraft:IMNCI', 'practice');
        localStorage.setItem('language', 'ar');
        expect(Object.keys(localStorage)).toContain('training_course123_courseFormDraft:IMNCI');
        expect(Object.keys(localStorage)).toContain('language');
        expect(localStorage.getItem('courseFormDraft:IMNCI')).toBe('practice');
    });
});

describe('Cloud Functions wrapper in a training tab', () => {
    it('skips the functions that notify or change real people', async () => {
        const { httpsCallable, BLOCKED_IN_TRAINING } = await import('../src/training/functionsShim.js');
        expect(BLOCKED_IN_TRAINING.has('sendFCMNotification')).toBe(true);
        const call = httpsCallable({}, 'sendFCMNotification');
        await expect(call({ title: 'x' })).resolves.toEqual({ data: {} });
    });
});
