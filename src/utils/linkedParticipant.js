// Which course participant is the person signed in to the app.
//
// A participant who opens a pre-test, post-test or exercise link from inside
// the app is usually signed in as themselves. Their participant record is
// found by the email or phone number they signed in with, or by the name they
// sent a test under last time for the same course on this phone, so the form
// opens with their name already chosen. Nothing is written to the participant:
// the link lives on the phone, under the signed-in account.
//
// A phone that sends tests for two different participants of one course is a
// facilitator's (or a shared) phone, so it stops guessing for that course.

const STORE_KEY = 'chm_linked_participants';
const SHARED = '*';

function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch { return {}; }
}

function writeStore(store) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* storage full or blocked */ }
}

const digits = (v) => String(v || '').replace(/\D/g, '');
// Sudanese numbers are written 0912..., 249912... and +249 912...: the last
// nine digits are the same in all of them.
export const samePhone = (a, b) => {
    const x = digits(a); const y = digits(b);
    return x.length >= 9 && y.length >= 9 && x.slice(-9) === y.slice(-9);
};
const sameEmail = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/** The participant in `participants` who is `user`, or null. */
export function findLinkedParticipant(participants, courseId, user) {
    if (!user || !Array.isArray(participants) || participants.length === 0) return null;
    const active = participants.filter((p) => p && p.isDeleted !== true && p.isDeleted !== 'true');
    const remembered = readStore()[user.uid]?.[courseId];
    if (remembered && remembered !== SHARED) {
        const hit = active.find((p) => p.id === remembered);
        if (hit) return hit;
    }
    if (user.email) {
        const byEmail = active.filter((p) => sameEmail(p.email, user.email));
        if (byEmail.length === 1) return byEmail[0];
    }
    if (user.phoneNumber) {
        const byPhone = active.filter((p) => samePhone(p.phone, user.phoneNumber));
        if (byPhone.length === 1) return byPhone[0];
    }
    return null;
}

/** Remembers that `user` is `participantId` in this course, on this phone. */
export function rememberLinkedParticipant(courseId, participantId, user) {
    if (!user?.uid || !courseId || !participantId || participantId === 'addNew') return;
    const store = readStore();
    const mine = store[user.uid] || {};
    const before = mine[courseId];
    if (before === participantId || before === SHARED) return;
    store[user.uid] = { ...mine, [courseId]: before ? SHARED : participantId };
    writeStore(store);
}
