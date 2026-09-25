import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
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

// =============================================================================
// Online courses. Anyone signed in may learn; only the federal level publishes.
// =============================================================================
describe('onlineCourses — everyone signed in learns, federal authors', () => {
    const course = { title: 'IMNCI', isPublished: true };
    const item = { courseId: 'c1', kind: 'section', title: 'Intro' };

    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();
            await setDoc(doc(db, 'onlineCourses', 'c1'), course);
            await setDoc(doc(db, 'onlineCourseItems', 'i1'), item);
        });
    });

    it('lets any signed-in user read the catalogue and its content', async () => {
        await assertSucceeds(getDocs(collection(as('plainUser'), 'onlineCourses')));
        await assertSucceeds(getDocs(collection(as('plainUser'), 'onlineCourseItems')));
    });

    it('lets a federal manager and a super user author', async () => {
        await assertSucceeds(setDoc(doc(as('federalManager'), 'onlineCourses', 'c2'), course));
        await assertSucceeds(setDoc(doc(as('superUser'), 'onlineCourseItems', 'i2'), item));
    });

    it('does NOT let a states manager or a facilitator publish content', async () => {
        await assertFails(setDoc(doc(as('statesManager'), 'onlineCourses', 'c3'), course));
        await assertFails(setDoc(doc(as('facilitator'), 'onlineCourseItems', 'i3'), item));
    });

    it('does NOT let an anonymous visitor read the courses', async () => {
        await assertFails(getDocs(collection(anonymous(), 'onlineCourses')));
    });

    // Progress is personal. One learner must not be able to read or rewrite
    // another's record.
    it('lets a learner read and write only their own progress', async () => {
        await assertSucceeds(setDoc(doc(as('plainUser'), 'onlineProgress', 'plainUser'), { completed: {} }));
        await assertSucceeds(getDoc(doc(as('plainUser'), 'onlineProgress', 'plainUser')));
    });

    it('does NOT let anyone touch another learner\'s progress', async () => {
        await assertFails(getDoc(doc(as('plainUser'), 'onlineProgress', 'facilitator')));
        await assertFails(setDoc(doc(as('plainUser'), 'onlineProgress', 'facilitator'), { completed: {} }));
        await assertFails(getDoc(doc(as('superUser'), 'onlineProgress', 'plainUser')));
    });
});

// =============================================================================
// Clinical protocols. Every clinician reads them; only the federal level may
// change the guidance they contain.
// =============================================================================
describe('imnciProtocols — everyone signed in reads, federal writes', () => {
    const protocol = { formType: 'child', version: '1.0', categories: {} };

    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'imnciProtocols', 'child'), protocol);
        });
    });

    // The assessment form classifies nothing without these, so a plain
    // clinician account has to be able to read them.
    it('lets any signed-in user read the protocol', async () => {
        await assertSucceeds(getDoc(doc(as('plainUser'), 'imnciProtocols', 'child')));
        await assertSucceeds(getDocs(collection(as('facilitator'), 'imnciProtocols')));
    });

    it('lets a federal manager and a super user edit it', async () => {
        await assertSucceeds(setDoc(doc(as('federalManager'), 'imnciProtocols', 'child'), protocol));
        await assertSucceeds(setDoc(doc(as('superUser'), 'imnciProtocols', 'dosages_child'), protocol));
    });

    it('does NOT let a states manager or a facilitator change the guidance', async () => {
        await assertFails(setDoc(doc(as('statesManager'), 'imnciProtocols', 'child'), protocol));
        await assertFails(setDoc(doc(as('facilitator'), 'imnciProtocols', 'child'), protocol));
    });

    it('does NOT let an anonymous visitor read or write', async () => {
        await assertFails(getDocs(collection(anonymous(), 'imnciProtocols')));
        await assertFails(setDoc(doc(anonymous(), 'imnciProtocols', 'child'), protocol));
    });
});

// =============================================================================
// Supervision assessments.
// =============================================================================
describe('supervisionAssessments — supervising managers write, staff read', () => {
    const assessment = {
        checklistId: 'nicu_coe', facilityName: 'Test Hospital',
        stateKey: 'Gezira', status: 'draft', responses: {},
    };

    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'supervisionAssessments', 'a1'), assessment);
        });
    });

    it('lets the managers who supervise write an assessment', async () => {
        await assertSucceeds(setDoc(doc(as('federalManager'), 'supervisionAssessments', 'a2'), assessment));
        await assertSucceeds(setDoc(doc(as('statesManager'), 'supervisionAssessments', 'a3'), assessment));
    });

    it('lets staff read the findings', async () => {
        await assertSucceeds(getDocs(collection(as('facilitator'), 'supervisionAssessments')));
    });

    it('does NOT let a facilitator write an assessment', async () => {
        await assertFails(setDoc(doc(as('facilitator'), 'supervisionAssessments', 'a4'), assessment));
    });

    it('does NOT let a self-registered account read or write', async () => {
        await assertFails(getDocs(collection(as('plainUser'), 'supervisionAssessments')));
        await assertFails(setDoc(doc(as('plainUser'), 'supervisionAssessments', 'a5'), assessment));
    });

    it('does NOT let an anonymous visitor read them', async () => {
        await assertFails(getDocs(collection(anonymous(), 'supervisionAssessments')));
    });
});

// =============================================================================
// Population targets. These are the denominators every coverage figure and
// every supply forecast divides by, so a state needs to read its own while
// only the federal level may publish them.
//
// The operations here mirror exactly what src/data.js does: listPopulationTargets
// runs a collection query (a LIST, not a get), and the import writes a batch.
// =============================================================================
describe('populationTargets — federal writes, everyone signed in reads', () => {
    const target = {
        year: 2026, stateKey: 'Gezira', localityKey: 'Al Hasahisa',
        totalPopulation: 500000, under5: 80000,
    };
    const id = '2026__Gezira__Al Hasahisa';

    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'populationTargets', id), target);
        });
    });

    it('lets a signed-in user LIST the collection, which is how the app reads it', async () => {
        await assertSucceeds(getDocs(collection(as('plainUser'), 'populationTargets')));
    });

    it('lets a signed-in user read one target', async () => {
        await assertSucceeds(getDoc(doc(as('plainUser'), 'populationTargets', id)));
    });

    it('does NOT let an anonymous visitor read the targets', async () => {
        await assertFails(getDocs(collection(anonymous(), 'populationTargets')));
    });

    it('lets a federal manager and a super user import targets', async () => {
        await assertSucceeds(setDoc(doc(as('federalManager'), 'populationTargets', '2027__Gezira__Al Kamlin'), target));
        await assertSucceeds(setDoc(doc(as('superUser'), 'populationTargets', '2027__Gezira__Al Manaqil'), target));
    });

    it('does NOT let a states manager or a plain user publish targets', async () => {
        await assertFails(setDoc(doc(as('statesManager'), 'populationTargets', '2027__Gezira__Al Qurashi'), target));
        await assertFails(setDoc(doc(as('plainUser'), 'populationTargets', '2027__Gezira__Um Algura'), target));
    });

    // The locality "As Salam / Ar Rawat" contains a slash; data.js replaces it
    // so the id stays a single path segment. The sanitised id must be writable.
    it('accepts the sanitised id for a locality whose name contains a slash', async () => {
        await assertSucceeds(setDoc(
            doc(as('federalManager'), 'populationTargets', '2026__White Nile__As Salam - Ar Rawat'),
            { ...target, stateKey: 'White Nile', localityKey: 'As Salam / Ar Rawat' }
        ));
    });
});

// =============================================================================
// Supply Management. The essential lists drive the national forecast, so
// writing them is a federal decision; reading them is not, because a state or
// locality has to see what it is expected to stock.
// =============================================================================
describe('supplyItems — federal writes, everyone signed in reads', () => {
    const item = { category: 'drugs', service: 'IMNCI', name: 'Amoxicillin DT', unit: 'Tablet' };

    it('lets a federal manager and a super user maintain the list', async () => {
        await assertSucceeds(setDoc(doc(as('federalManager'), 'supplyItems', 'i1'), item));
        await assertSucceeds(setDoc(doc(as('superUser'), 'supplyItems', 'i2'), item));
    });

    it('does NOT let a states manager or a facilitator write the list', async () => {
        await assertFails(setDoc(doc(as('statesManager'), 'supplyItems', 'i3'), item));
        await assertFails(setDoc(doc(as('facilitator'), 'supplyItems', 'i4'), item));
    });

    it('does NOT let a self-registered account write the list', async () => {
        await assertFails(setDoc(doc(as('plainUser'), 'supplyItems', 'i5'), item));
    });

    it('lets any signed-in user read the list', async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'supplyItems', 'i6'), item);
        });
        await assertSucceeds(getDoc(doc(as('plainUser'), 'supplyItems', 'i6')));
    });

    it('does NOT let an anonymous visitor read the list', async () => {
        await assertFails(getDocs(collection(anonymous(), 'supplyItems')));
    });
});

// =============================================================================
// Identifiable clinical data about children. Both read and create used to be
// `if true`, so the collection could be downloaded by anyone holding the
// project id — which ships in the client bundle.
// =============================================================================
describe('imnciPatientRecords — clinical data is not public', () => {
    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'imnciPatientRecords', 'r1'), {
                childName: 'Test Child', age: 3, classification: 'pneumonia',
            });
        });
    });

    it('does NOT let an anonymous visitor read a patient record', async () => {
        await assertFails(getDoc(doc(anonymous(), 'imnciPatientRecords', 'r1')));
    });

    it('does NOT let an anonymous visitor list the collection', async () => {
        await assertFails(getDocs(collection(anonymous(), 'imnciPatientRecords')));
    });

    it('does NOT let an anonymous visitor create a patient record', async () => {
        await assertFails(setDoc(doc(anonymous(), 'imnciPatientRecords', 'r2'), { childName: 'X', age: 1 }));
    });

    it('does NOT let a brand-new account create a patient record', async () => {
        await assertFails(setDoc(doc(as('plainUser'), 'imnciPatientRecords', 'r3'), { childName: 'X', age: 1 }));
    });

    it('lets clinical staff read and write records', async () => {
        await assertSucceeds(getDoc(doc(as('facilitator'), 'imnciPatientRecords', 'r1')));
        await assertSucceeds(setDoc(doc(as('facilitator'), 'imnciPatientRecords', 'r4'), { childName: 'Y', age: 2 }));
    });
});

// =============================================================================
// Sign-up is open to the public, so `request.auth != null` on a write rule
// meant "anyone who filled in the sign-up form". Programme data now needs a
// real role.
// =============================================================================
describe('a self-registered account cannot write programme data', () => {
    const collectionsNeedingStaff = [
        'facilitators', 'federalCoordinators', 'stateCoordinators', 'localityCoordinators',
        'coordinators', 'funders', 'skillMentorship', 'courses', 'exerciseDefinitions',
    ];

    for (const name of collectionsNeedingStaff) {
        it(`does NOT let a plain user write ${name}`, async () => {
            await assertFails(setDoc(doc(as('plainUser'), name, 'x1'), { name: 'Injected' }));
        });

        it(`still lets a facilitator write ${name}`, async () => {
            await assertSucceeds(setDoc(doc(as('facilitator'), name, 'x2'), { name: 'Legitimate' }));
        });
    }

    it('does NOT let a plain user delete a participant', async () => {
        await assertFails(deleteDoc(doc(as('plainUser'), 'participants', 'p1')));
    });

    it('does NOT let a plain user reconfigure the application', async () => {
        await assertFails(updateDoc(doc(as('plainUser'), 'appSettings', 'facilitatorApplication'), {
            isActive: false,
        }));
    });

    it('does NOT let a plain user read the facilitator application queue', async () => {
        await assertFails(getDocs(collection(as('plainUser'), 'facilitatorSubmissions')));
    });
});

// =============================================================================
// The Trigger Email extension delivers whatever lands in /mail from the
// programme's verified sender address.
// =============================================================================
describe('mail queue is not an open relay', () => {
    const wellFormed = {
        to: 'participant@example.org',
        message: { subject: 'Your certificate', html: '<p>Hello</p>' },
    };

    it('does NOT let a self-registered account queue an email', async () => {
        await assertFails(setDoc(doc(as('plainUser'), 'mail', 'm1'), wellFormed));
    });

    it('lets staff queue a certificate email', async () => {
        await assertSucceeds(setDoc(doc(as('facilitator'), 'mail', 'm2'), wellFormed));
    });

    it('rejects a message carrying extra delivery fields', async () => {
        await assertFails(setDoc(doc(as('facilitator'), 'mail', 'm3'), {
            ...wellFormed, bcc: 'everyone@example.org',
        }));
        await assertFails(setDoc(doc(as('facilitator'), 'mail', 'm4'), {
            to: 'a@b.c', message: { subject: 'S', html: '<p>x</p>', attachments: [] },
        }));
    });
});

// =============================================================================
// Exercise scores feed certificates, so they must not be rewritable by whoever
// can guess an attempt id.
// =============================================================================
describe('exercise attempts cannot be re-scored anonymously', () => {
    const body = { courseId: 'c1', participantId: 'p1', exerciseId: 'e1', attemptNo: 1, percent: 40 };

    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'exerciseAttempts', 'c1__p1__e1__1'), body);
        });
    });

    it('does NOT let an anonymous caller raise an existing score', async () => {
        await assertFails(setDoc(doc(anonymous(), 'exerciseAttempts', 'c1__p1__e1__1'), {
            ...body, percent: 100,
        }));
    });

    it('still lets the offline queue replay an identical write', async () => {
        await assertSucceeds(setDoc(doc(anonymous(), 'exerciseAttempts', 'c1__p1__e1__1'), body));
    });

    it('still lets a fresh attempt be created anonymously', async () => {
        await assertSucceeds(setDoc(doc(anonymous(), 'exerciseAttempts', 'c1__p1__e1__2'), {
            ...body, attemptNo: 2, percent: 95,
        }));
    });
});

// =============================================================================
// The public /public/meeting/{id} link marks attendance without signing in.
// =============================================================================
describe('unitMeetings — the anonymous link only marks attendance', () => {
    beforeEach(async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), 'unitMeetings', 'm1'), {
                title: 'Federal review', invitees: ['a', 'b'], attendance: {},
            });
        });
    });

    it('lets an anonymous invitee mark attendance', async () => {
        await assertSucceeds(updateDoc(doc(anonymous(), 'unitMeetings', 'm1'), {
            attendance: { a: ['2026-01-01'] },
        }));
    });

    it('does NOT let an anonymous visitor rewrite the meeting itself', async () => {
        await assertFails(updateDoc(doc(anonymous(), 'unitMeetings', 'm1'), { title: 'Hijacked' }));
        await assertFails(updateDoc(doc(anonymous(), 'unitMeetings', 'm1'), { invitees: [] }));
    });
});

// =============================================================================
// AdminDashboard writes users/{uid} straight from the browser, so the
// setUserRoles Cloud Function's guards were never in the path.
// =============================================================================
describe('only a super user may grant super_user', () => {
    it('does NOT let a federal manager mint a super user', async () => {
        await assertFails(updateDoc(doc(as('federalManager'), 'users', 'plainUser'), {
            role: 'super_user', roles: ['super_user'],
        }));
    });

    it('does NOT let a states manager mint a super user', async () => {
        await assertFails(updateDoc(doc(as('statesManager'), 'users', 'plainUser'), {
            role: 'super_user', roles: ['super_user'],
        }));
    });

    it('lets a super user grant super_user', async () => {
        await assertSucceeds(updateDoc(doc(as('superUser'), 'users', 'plainUser'), {
            role: 'super_user', roles: ['super_user'],
        }));
    });

    it('still lets a manager assign the non-admin roles they administer', async () => {
        await assertSucceeds(updateDoc(doc(as('federalManager'), 'users', 'plainUser'), {
            role: 'facilitator', roles: ['facilitator'],
        }));
    });

    it('still lets a manager edit an existing super user without demoting them', async () => {
        await assertSucceeds(updateDoc(doc(as('federalManager'), 'users', 'superUser'), {
            assignedState: 'Khartoum',
        }));
    });
});
