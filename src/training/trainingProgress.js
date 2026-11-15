// src/training/trainingProgress.js
//
// Who is practising on a course's training link, and what they do there.
//
//   trainingProgress/{courseId}/trainees/{uid}
//       the signed-in account, the course participant it was linked to
//       ("Who are you?" on first use), first/last seen, and counters:
//       saves, deletes, views.{screen}, collections.{data type}
//   trainingProgress/{courseId}/activity/{autoId}
//       one line per save / delete / screen opened, for the timeline
//
// These sit outside the sandbox on purpose: trainees write only their own
// entries, and staff read them after the course from the Training tab.
// Written with the raw SDK, because the app's wrapped imports would send them
// into the sandbox.

import * as fs from '@firebase/firestore';
import { db } from '../firebase';
import { setTrainingActivityRecorder } from './firestoreShim.js';
import { isTrainingMode } from './trainingSession.js';
import { activityFromWrite, counterKey } from './trainingRows.js';

export const PROGRESS_ROOT = 'trainingProgress';

export const traineeRef = (courseId, uid) => fs.doc(db, PROGRESS_ROOT, courseId, 'trainees', uid);
const activityCol = (courseId) => fs.collection(db, PROGRESS_ROOT, courseId, 'activity');


export async function loadTrainee(courseId, uid) {
    const snap = await fs.getDoc(traineeRef(courseId, uid));
    return snap.exists() ? snap.data() : null;
}

/** The course's real participants, for the "Who are you?" list. */
export async function loadCourseParticipants(courseId) {
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'participants'), fs.where('courseId', '==', courseId)));
    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.isDeleted !== true)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

/**
 * Links the signed-in account to a participant (or to nobody: a guest), and
 * saves the link on the participant's course record (participants/{id}
 * .trainingLink) so the same account is linked straight away next time, on
 * any device. `method`: 'saved' | 'email' | 'phone' | 'chosen' | 'guest'.
 */
export async function linkTrainee(courseId, user, participant, existing, method = participant ? 'chosen' : 'guest') {
    const data = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        linked: true,
        linkMethod: method,
        participantId: participant?.id || null,
        participantName: participant?.name || '',
        participantPhone: participant?.phone || '',
        linkedAt: fs.serverTimestamp(),
        lastSeen: fs.serverTimestamp(),
    };
    if (!existing) data.firstSeen = fs.serverTimestamp();
    await fs.setDoc(traineeRef(courseId, user.uid), data, { merge: true });

    // The participant record: drop the link from the one chosen before, if it
    // changed, then save it on the new one. Best effort: the training itself
    // works without it.
    const previous = existing?.participantId;
    if (previous && previous !== participant?.id) {
        fs.updateDoc(fs.doc(db, 'participants', previous), { trainingLink: fs.deleteField() })
            .catch((e) => console.warn('[training] old participant link not cleared:', e?.code || e?.message));
    }
    if (participant?.id && participant.trainingLink?.uid !== user.uid) {
        fs.updateDoc(fs.doc(db, 'participants', participant.id), {
            trainingLink: { uid: user.uid, email: user.email || '', courseId, method, linkedAt: fs.serverTimestamp() },
        }).catch((e) => console.warn('[training] participant link not saved:', e?.code || e?.message));
    }
    return { ...(existing || {}), ...data };
}

// --- Recording ----------------------------------------------------------------

let session = null; // { courseId, uid, participantId, participantName }
let viewTimer = null;
let lastView = null;

function writeActivity(entries, counters) {
    if (!session) return;
    const { courseId, uid, participantId, participantName } = session;
    for (const entry of entries) {
        fs.addDoc(activityCol(courseId), { uid, participantId, participantName, ...entry, at: fs.serverTimestamp() })
            .catch((e) => console.warn('[training] activity not recorded:', e?.code || e?.message));
    }
    const update = { lastSeen: fs.serverTimestamp() };
    for (const [field, amount] of Object.entries(counters)) update[field] = fs.increment(amount);
    fs.updateDoc(traineeRef(courseId, uid), update)
        .catch((e) => console.warn('[training] counters not updated:', e?.code || e?.message));
}

export function startTrainingRecorder(courseId, user, trainee) {
    session = {
        courseId,
        uid: user.uid,
        participantId: trainee?.participantId || null,
        participantName: trainee?.participantName || '',
    };
    setTrainingActivityRecorder((report) => {
        const { entries, counters } = activityFromWrite(report);
        writeActivity(entries, counters);
    });
}

export function stopTrainingRecorder() {
    session = null;
    setTrainingActivityRecorder(null);
    clearTimeout(viewTimer);
}

/**
 * Called by the app whenever the main screen changes. Screens passed through
 * in under two seconds are not counted.
 */
export function recordTrainingView(view) {
    if (!isTrainingMode() || !view) return;
    clearTimeout(viewTimer);
    viewTimer = setTimeout(() => {
        if (!session || view === lastView) return;
        lastView = view;
        writeActivity([{ kind: 'view', view }], { [`views.${counterKey(view)}`]: 1 });
    }, 2000);
}
