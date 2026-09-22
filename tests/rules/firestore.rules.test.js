import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'node:fs';

// Run with:  npm run test:rules
// (starts the Firestore emulator via `firebase emulators:exec`)

let testEnv;

const PROFILES = {
    plainUser: { role: 'user', roles: ['user'], permissions: {} },
    courseManager: {
        role: 'manager', roles: ['manager'],
        permissions: { canManageCourse: true, canViewCourse: true },
    },
    superUser: {
        role: 'super_user', roles: ['super_user'],
        permissions: { canManageCourse: true, canManageFacilities: true, canViewAdmin: true },
    },
};

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'imnci-courses-monitor-test',
        firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') },
    });
});

afterAll(async () => {
    await testEnv?.cleanup();
});

beforeEach(async () => {
    await testEnv.clearFirestore();
    // Seed the profiles and a course with admin privileges, bypassing rules.
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        for (const [uid, profile] of Object.entries(PROFILES)) {
            await setDoc(doc(db, 'users', uid), { email: `${uid}@example.org`, ...profile });
        }
        await setDoc(doc(db, 'courses', 'publicCourse'), { isPublic: true, course_type: 'IMNCI' });
        await setDoc(doc(db, 'courses', 'privateCourse'), { isPublic: false, course_type: 'IMNCI' });
        await setDoc(doc(db, 'participants', 'p1'), { courseId: 'privateCourse', name: 'Test', phone: '0900000000' });
    });
});

const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonymous = () => testEnv.unauthenticatedContext().firestore();

describe('users/{uid}', () => {
    it('lets a user read their own profile', async () => {
        await assertSucceeds(getDoc(doc(as('plainUser'), 'users', 'plainUser')));
    });

    it('does not let a user read someone else\'s profile', async () => {
        await assertFails(getDoc(doc(as('plainUser'), 'users', 'courseManager')));
    });

    // The escalation this whole change exists to close.
    it('does NOT let a user grant themselves permissions', async () => {
        await assertFails(updateDoc(doc(as('plainUser'), 'users', 'plainUser'), {
            permissions: { canUseSuperUserAdvancedFeatures: true },
        }));
    });

    it('does NOT let a user change their own role', async () => {
        await assertFails(updateDoc(doc(as('plainUser'), 'users', 'plainUser'), { role: 'super_user' }));
        await assertFails(updateDoc(doc(as('plainUser'), 'users', 'plainUser'), { roles: ['super_user'] }));
    });

    it('does NOT let a user assign themselves a wider geographic scope', async () => {
        await assertFails(updateDoc(doc(as('plainUser'), 'users', 'plainUser'), { assignedState: 'Khartoum' }));
    });

    it('lets a user update a harmless field on their own profile', async () => {
        await assertSucceeds(updateDoc(doc(as('plainUser'), 'users', 'plainUser'), { fcmToken: 'abc123' }));
    });

    it('does not let the client create a profile at all', async () => {
        await assertFails(setDoc(doc(as('plainUser'), 'users', 'brandNew'), { role: 'super_user' }));
    });

    it('lets an admin read the user list', async () => {
        await assertSucceeds(getDocs(collection(as('superUser'), 'users')));
    });

    it('does not let a plain user read the user list', async () => {
        await assertFails(getDocs(collection(as('plainUser'), 'users')));
    });
});

describe('courses', () => {
    it('lets anyone read a course that was explicitly shared', async () => {
        await assertSucceeds(getDoc(doc(anonymous(), 'courses', 'publicCourse')));
    });

    it('does not let an anonymous visitor read an unshared course', async () => {
        await assertFails(getDoc(doc(anonymous(), 'courses', 'privateCourse')));
    });

    it('does not let an anonymous visitor list every course', async () => {
        await assertFails(getDocs(collection(anonymous(), 'courses')));
    });

    it('lets a course manager create a course', async () => {
        await assertSucceeds(setDoc(doc(as('courseManager'), 'courses', 'new'), { course_type: 'ETAT' }));
    });

    it('does not let a plain user create a course', async () => {
        await assertFails(setDoc(doc(as('plainUser'), 'courses', 'new'), { course_type: 'ETAT' }));
    });
});

describe('participants', () => {
    // Participant records carry names and phone numbers.
    it('does not let an anonymous visitor read a participant of a private course', async () => {
        await assertFails(getDoc(doc(anonymous(), 'participants', 'p1')));
    });

    it('lets a signed-in user read participants', async () => {
        await assertSucceeds(getDoc(doc(as('plainUser'), 'participants', 'p1')));
    });

    it('does not let a plain user delete a participant', async () => {
        await assertFails(
            setDoc(doc(as('plainUser'), 'participants', 'p1'), { name: 'Changed' })
        );
    });
});

describe('default deny', () => {
    it('refuses a collection the rules do not mention', async () => {
        await assertFails(getDoc(doc(as('superUser'), 'someCollectionNobodyDefined', 'x')));
    });
});
