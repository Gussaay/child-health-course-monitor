import { describe, it, expect, beforeAll, vi } from 'vitest';
import { initializeApp } from 'firebase/app';
import { getFirestore } from '@firebase/firestore';

// Writes never reach a server in these tests: the SDK's setDoc / deleteDoc
// resolve at once, so the wrapper's reporting can be checked.
vi.mock('@firebase/firestore', async (importOriginal) => ({
    ...(await importOriginal()),
    setDoc: vi.fn(() => Promise.resolve()),
    deleteDoc: vi.fn(() => Promise.resolve()),
}));

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
        // The address keeps the training link.
        expect(window.location.pathname).toBe('/training/course123');
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

describe('training activity', () => {
    it('turns a write into log lines and counters', async () => {
        const { activityFromWrite } = await import('../src/training/trainingRows.js');
        const { entries, counters } = activityFromWrite({ kind: 'save', targets: [
            { collection: 'participants', docId: 'p1' },
            { collection: 'participants', docId: 'p2' },
            { collection: 'courses', docId: 'c1' },
        ] });
        expect(entries).toEqual([
            { kind: 'save', collection: 'participants', docId: null, count: 2 },
            { kind: 'save', collection: 'courses', docId: 'c1', count: 1 },
        ]);
        expect(counters).toEqual({ saves: 3, 'collections.participants': 2, 'collections.courses': 1 });
        expect(activityFromWrite({ kind: 'delete', targets: [{ collection: 'cases', docId: 'x' }] }).counters).toEqual({ deletes: 1, 'collections.cases': 1 });
    });

    it('finds the sandbox collection a path belongs to', async () => {
        const { sandboxTarget } = await import('../src/training/firestoreShim.js');
        expect(sandboxTarget('c1', 'trainingSandboxes/c1/participants/p1')).toEqual({ collection: 'participants', docId: 'p1' });
        expect(sandboxTarget('c1', 'trainingSandboxes/c1/courses/x/sub/y')).toEqual({ collection: 'courses', docId: 'x' });
        expect(sandboxTarget('c1', 'users/u1')).toBeNull();
        expect(sandboxTarget('c1', 'trainingSandboxes/c2/courses/x')).toBeNull();
    });

    it('suggests the participant by e-mail, phone, then name', async () => {
        const { suggestParticipant } = await import('../src/training/trainingRows.js');
        const list = [
            { id: 'a', name: 'Amna Ali', email: 'AMNA@example.org', phone: '0912 345 678' },
            { id: 'b', name: 'Omer Hassan', phone: '+249 911 111 111' },
        ];
        expect(suggestParticipant(list, { email: 'amna@example.org' })?.id).toBe('a');
        expect(suggestParticipant(list, { phoneNumber: '+249911111111' })?.id).toBe('b');
        expect(suggestParticipant(list, { displayName: 'omer hassan ' })?.id).toBe('b');
        expect(suggestParticipant(list, { email: 'x@y.z', displayName: 'Nobody' })).toBeNull();
    });

    it('builds one dashboard row per participant, plus guests', async () => {
        const { buildTrainingRows } = await import('../src/training/trainingRows.js');
        const at = (h) => new Date(2026, 10, 12, h);
        const rows = buildTrainingRows(
            [{ id: 'a', name: 'Amna' }, { id: 'b', name: 'Omer' }],
            [
                { uid: 'u1', participantId: 'a', email: 'a@x', saves: 3, views: { courses: 2 }, collections: { participants: 3 }, firstSeen: at(8), lastSeen: at(9) },
                { uid: 'u2', participantId: 'a', email: 'a2@x', saves: 1, views: { courses: 1, skillsMentorship: 4 }, lastSeen: at(11) },
                { uid: 'u3', participantId: null, displayName: 'Trainer', saves: 2, lastSeen: at(10) },
            ],
        );
        expect(rows.map((r) => r.key)).toEqual(['p:a', 'g:u3', 'p:b']);
        const amna = rows[0];
        expect(amna.saves).toBe(4);
        expect(amna.views).toEqual({ courses: 3, skillsMentorship: 4 });
        expect(amna.lastSeen).toEqual(at(11));
        expect(amna.firstSeen).toEqual(at(8));
        expect(rows[1].guest).toBe(true);
        expect(rows[2].accounts).toEqual([]);
    });

    it('reports sandbox saves and deletes to the recorder, not account writes', async () => {
        vi.resetModules();
        sessionStorage.setItem('chm_training_course', 'course123');
        const shim = await import('../src/training/firestoreShim.js');
        const seen = [];
        shim.setTrainingActivityRecorder((r) => seen.push(r));
        const db = getFirestore(initializeApp({ projectId: 'demo-training2', apiKey: 'x' }, 'training-test-2'));
        await shim.setDoc(shim.doc(db, 'participants', 'p1'), { a: 1 });
        await shim.deleteDoc(shim.doc(db, 'cases', 'k1'));
        await shim.setDoc(shim.doc(db, 'users', 'u1'), { fcmToken: 'x' });
        shim.setTrainingActivityRecorder(null);
        expect(seen).toEqual([
            { kind: 'save', targets: [{ collection: 'participants', docId: 'p1' }] },
            { kind: 'delete', targets: [{ collection: 'cases', docId: 'k1' }] },
        ]);
    });
});

describe('automatic participant link', () => {
    it('links by saved link, then a single e-mail or phone match, never by name alone', async () => {
        const { autoLinkParticipant } = await import('../src/training/trainingRows.js');
        const list = [
            { id: 'a', name: 'Amna Ali', email: 'amna@example.org', phone: '0912345678' },
            { id: 'b', name: 'Omer Hassan', phone: '+249 911 111 111', trainingLink: { uid: 'u-omer' } },
            { id: 'c', name: 'Twin', email: 'shared@example.org' },
            { id: 'd', name: 'Twin 2', email: 'shared@example.org' },
        ];
        expect(autoLinkParticipant(list, { uid: 'u-omer', email: 'other@x.org' })).toMatchObject({ participant: { id: 'b' }, method: 'saved' });
        expect(autoLinkParticipant(list, { uid: 'u1', email: 'AMNA@example.org' })).toMatchObject({ participant: { id: 'a' }, method: 'email' });
        expect(autoLinkParticipant(list, { uid: 'u2', phoneNumber: '+249912345678' })).toMatchObject({ participant: { id: 'a' }, method: 'phone' });
        expect(autoLinkParticipant(list, { uid: 'u3', email: 'shared@example.org' })).toBeNull();
        expect(autoLinkParticipant(list, { uid: 'u4', displayName: 'Amna Ali' })).toBeNull();
        expect(autoLinkParticipant(list, null)).toBeNull();
    });
});

describe('page addresses in a training tab', () => {
    it('keep the /training/<courseId> prefix and read it back', async () => {
        vi.resetModules();
        sessionStorage.setItem('chm_training_course', 'course123');
        window.history.pushState(null, '', '/training/course123');
        const { pagePath, pageFromLocation } = await import('../src/utils/pageAddress.js');
        expect(pagePath({ view: 'landing' }).path).toBe('/training/course123');
        expect(pagePath({ view: 'courses', tab: 'participants' }).path).toBe('/training/course123/courses/participants');
        expect(pageFromLocation('/training/course123', '')).toEqual({ view: 'landing' });
        expect(pageFromLocation('/training/course123/courses/participants', '?course=abc')).toMatchObject({ view: 'courses', tab: 'participants', course: 'abc' });
    });

    it('puts the prefix back if the tab is sent to a plain address', async () => {
        vi.resetModules();
        sessionStorage.setItem('chm_training_course', 'course123');
        window.history.pushState(null, '', '/courses?course=abc');
        const session = await import('../src/training/trainingSession.js');
        expect(session.trainingCourseId()).toBe('course123');
        expect(window.location.pathname + window.location.search).toBe('/training/course123/courses?course=abc');
    });
});
