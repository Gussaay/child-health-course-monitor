import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'node:fs';

// Run with:  npm run test:rules   (starts the Firestore emulator around them)
//
// Two jobs here, and the second matters as much as the first:
//
//   1. Prove the privilege-escalation path on users/{uid} is closed.
//   2. Prove every PUBLIC path the app depends on still works. An earlier
//      ruleset written from scratch quietly denied participant registration,
//      public course reports, online exercises and the sub-course catalogue.
//      Those are the tests that would have caught it.

let testEnv;

// The roles this app actually defines (src/components/permissions.js).
// There is no 'manager' role — isManager() in the rules means super_user,
// federal_manager or states_manager.
const PROFILES = {
    plainUser:      { role: 'user', roles: ['user'], permissions: {} },
    facilitator:    { role: 'facilitator', roles: ['facilitator'], permissions: { canViewCourse: true } },
    statesManager:  { role: 'states_manager', roles: ['states_manager'], permissions: { canManageCourse: true } },
    federalManager: { role: 'federal_manager', roles: ['federal_manager'], permissions: { canManageCourse: true } },
    superUser:      { role: 'super_user', roles: ['super_user'], permissions: { canViewAdmin: true } },
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
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        for (const [uid, profile] of Object.entries(PROFILES)) {
            await setDoc(doc(db, 'users', uid), { email: `${uid}@example.org`, ...profile });
        }
        await setDoc(doc(db, 'courses', 'publicCourse'), { isPublic: true, course_type: 'IMNCI' });
        await setDoc(doc(db, 'courses', 'privateCourse'), { isPublic: false, course_type: 'IMNCI' });
        await setDoc(doc(db, 'participants', 'p1'), { courseId: 'publicCourse', name: 'Test', phone: '0900000000' });
        await setDoc(doc(db, 'observations', 'o1'), { courseId: 'publicCourse', score: 3 });
        await setDoc(doc(db, 'course_sub_types', 's1'), { course_type: 'ETAT', name: 'ETAT TOT' });
        await setDoc(doc(db, 'appSettings', 'facilitatorApplication'), { isActive: true, openCount: 5 });
    });
});

const as = (uid) => testEnv.authenticatedContext(uid).firestore();
const anonymous = () => testEnv.unauthenticatedContext().firestore();

// =============================================================================
// The change: nobody can promote themselves.
// =============================================================================
describe('users/{uid} — privilege escalation is closed', () => {
    it('does NOT let a user grant themselves permissions', async () => {
        await assertFails(updateDoc(doc(as('plainUser'), 'users', 'plainUser'), {
            permissions: { canUseSuperUserAdvancedFeatures: true },
        }));
    });

    it('does NOT let a user change their own role or roles', async () => {
        await assertFails(updateDoc(doc(as('plainUser'), 'users', 'plainUser'), { role: 'super_user' }));
        await assertFails(updateDoc(doc(as('plainUser'), 'users', 'plainUser'), { roles: ['super_user'] }));
    });

    it('does NOT let a user widen their own geographic scope', async () => {
        await assertFails(updateDoc(doc(as('plainUser'), 'users', 'plainUser'), { assignedState: 'Khartoum' }));
        await assertFails(updateDoc(doc(as('plainUser'), 'users', 'plainUser'), { assignedLocality: 'Omdurman' }));
    });

    it('does NOT let a user set isAdmin on themselves', async () => {
        await assertFails(updateDoc(doc(as('plainUser'), 'users', 'plainUser'), { isAdmin: true }));
    });

    it('does NOT let a user create a fresh profile carrying privileges', async () => {
        await assertFails(setDoc(doc(as('plainUser'), 'users', 'plainUser'), {
            email: 'x@example.org', role: 'super_user',
        }));
    });

    it('does NOT let a facilitator promote themselves', async () => {
        await assertFails(updateDoc(doc(as('facilitator'), 'users', 'facilitator'), {
            permissions: { canViewAdmin: true },
        }));
    });
});

// =============================================================================
// ...without taking anything away from the people who legitimately had it.
// =============================================================================
describe('users/{uid} — legitimate access is unchanged', () => {
    it('lets a user update harmless fields on their own profile', async () => {
        await assertSucceeds(updateDoc(doc(as('plainUser'), 'users', 'plainUser'), {
            fcmToken: 'abc123', displayName: 'Dr Test', phone: '0900000001',
        }));
    });

    it('lets a user read their own profile', async () => {
        await assertSucceeds(getDoc(doc(as('plainUser'), 'users', 'plainUser')));
    });

    it('does not let a user read someone else\'s profile', async () => {
        await assertFails(getDoc(doc(as('plainUser'), 'users', 'superUser')));
    });

    // All three of these count as isManager() in the rules. A states_manager
    // losing admin rights is exactly the kind of silent regression a rules
    // rewrite causes.
    for (const admin of ['superUser', 'federalManager', 'statesManager']) {
        it(`lets a ${admin} administer another user's roles`, async () => {
            await assertSucceeds(updateDoc(doc(as(admin), 'users', 'plainUser'), {
                roles: ['facilitator'], permissions: { canViewCourse: true },
            }));
        });

        it(`lets a ${admin} read the user list`, async () => {
            await assertSucceeds(getDocs(collection(as(admin), 'users')));
        });
    }

    it('does not let a plain user read the user list', async () => {
        await assertFails(getDocs(collection(as('plainUser'), 'users')));
    });

    it('keeps the rate-limit collection off-limits to every client', async () => {
        await assertFails(getDoc(doc(as('superUser'), 'notificationRateLimits', 'superUser')));
        await assertFails(setDoc(doc(as('superUser'), 'notificationRateLimits', 'superUser'), { sentAt: [] }));
    });
});

// =============================================================================
// Public paths the app depends on. These must keep working.
// =============================================================================
describe('public flows still work', () => {
    it('lets an anonymous visitor register as a participant', async () => {
        await assertSucceeds(setDoc(doc(anonymous(), 'participants', 'newSignup'), {
            courseId: 'publicCourse', name: 'Walk-in', phone: '0911111111',
        }));
    });

    it('lets an anonymous visitor read participants', async () => {
        await assertSucceeds(getDoc(doc(anonymous(), 'participants', 'p1')));
    });

    it('lets an anonymous visitor read any course', async () => {
        await assertSucceeds(getDoc(doc(anonymous(), 'courses', 'publicCourse')));
        await assertSucceeds(getDoc(doc(anonymous(), 'courses', 'privateCourse')));
    });

    it('lets an anonymous visitor read observations of a public course', async () => {
        await assertSucceeds(getDoc(doc(anonymous(), 'observations', 'o1')));
    });

    it('lets an anonymous visitor submit a course test', async () => {
        await assertSucceeds(setDoc(doc(anonymous(), 'participantTests', 't1'), {
            courseId: 'publicCourse', participantId: 'p1', score: 80,
        }));
    });

    it('lets an anonymous visitor read the sub-course catalogue', async () => {
        await assertSucceeds(getDoc(doc(anonymous(), 'course_sub_types', 's1')));
    });

    it('lets an anonymous visitor read health facilities', async () => {
        await assertSucceeds(getDocs(collection(anonymous(), 'healthFacilities')));
    });

    it('lets an anonymous visitor submit a facility update', async () => {
        await assertSucceeds(setDoc(doc(anonymous(), 'facilitySubmissions', 'sub1'), {
            facilityId: 'f1', status: 'pending',
        }));
    });

    it('lets an anonymous visitor submit a facilitator application', async () => {
        await assertSucceeds(setDoc(doc(anonymous(), 'facilitatorSubmissions', 'fa1'), {
            name: 'A', phone: '09', email: 'a@b.c', status: 'pending',
        }));
    });

    it('lets an anonymous visitor read the clinical record form data', async () => {
        await assertSucceeds(setDoc(doc(anonymous(), 'imnciPatientRecords', 'r1'), { age: 3 }));
    });

    it('lets an anonymous visitor increment the application open counter', async () => {
        await assertSucceeds(updateDoc(doc(anonymous(), 'appSettings', 'facilitatorApplication'), {
            openCount: 6,
        }));
    });
});

// =============================================================================
// Restrictions that were already in the live rules and must survive.
// =============================================================================
describe('existing restrictions are preserved', () => {
    it('only a federal manager or super user may add a sub-course', async () => {
        const entry = { course_type: 'ETAT', name: 'New TOT' };
        await assertSucceeds(setDoc(doc(as('federalManager'), 'course_sub_types', 'new1'), entry));
        await assertFails(setDoc(doc(as('statesManager'), 'course_sub_types', 'new2'), entry));
        await assertFails(setDoc(doc(as('plainUser'), 'course_sub_types', 'new3'), entry));
    });

    it('rejects a sub-course entry carrying an unexpected field', async () => {
        await assertFails(setDoc(doc(as('federalManager'), 'course_sub_types', 'new4'), {
            course_type: 'ETAT', name: 'X', sortOrder: 1,
        }));
    });

    it('validates that an exercise attempt id matches its own contents', async () => {
        const body = { courseId: 'c1', participantId: 'p1', exerciseId: 'e1', attemptNo: 1, percent: 90 };
        await assertSucceeds(setDoc(doc(anonymous(), 'exerciseAttempts', 'c1__p1__e1__1'), body));
        // An anonymous caller must not be able to write into someone else's attempt.
        await assertFails(setDoc(doc(anonymous(), 'exerciseAttempts', 'someone__else__e1__1'), body));
    });

    it('keeps the email queue unreadable', async () => {
        await assertFails(getDoc(doc(as('superUser'), 'mail', 'm1')));
    });

    it('only a super user may write meta and update history', async () => {
        await assertSucceeds(setDoc(doc(as('superUser'), 'meta', 'update_config'), { apkUrl: 'x' }));
        await assertFails(setDoc(doc(as('federalManager'), 'meta', 'update_config'), { apkUrl: 'x' }));
    });

    it('only a manager may write health facilities', async () => {
        await assertSucceeds(setDoc(doc(as('statesManager'), 'healthFacilities', 'f1'), { name: 'X' }));
        await assertFails(setDoc(doc(as('plainUser'), 'healthFacilities', 'f2'), { name: 'Y' }));
    });
});
