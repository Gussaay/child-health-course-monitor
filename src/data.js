<<<<<<< HEAD
import { db } from './firebase';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    setDoc, 
    addDoc, 
    deleteDoc,
    writeBatch,
    Timestamp
} from "firebase/firestore";

// Helper to generate unique IDs for new documents
const uid = () => doc(collection(db, 'temp')).id;

// =============================================================================
// COURSES
// =============================================================================

export async function listCoursesByType(course_type) {
    const coursesCol = collection(db, "courses");
    const q = query(coursesCol, where("course_type", "==", course_type));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function upsertCourse(payload) {
    const courseId = payload.id || uid();
    const courseRef = doc(db, "courses", courseId);
    await setDoc(courseRef, { ...payload, id: courseId }, { merge: true });
    return courseId;
}

export async function deleteCourse(courseId) {
    // Note: Deleting a course should also delete all its sub-data.
    // This is best done with a Firebase Cloud Function for reliability.
    // The code below is a client-side attempt to clean up.
    const batch = writeBatch(db);

    // Delete the course itself
    batch.delete(doc(db, "courses", courseId));

    // Find and delete related participants
    const pq = query(collection(db, "participants"), where("courseId", "==", courseId));
    const pSnap = await getDocs(pq);
    pSnap.docs.forEach(d => batch.delete(d.ref));

    // Find and delete related observations
    const oq = query(collection(db, "observations"), where("courseId", "==", courseId));
    const oSnap = await getDocs(oq);
    oSnap.docs.forEach(d => batch.delete(d.ref));

    // Find and delete related cases
    const cq = query(collection(db, "cases"), where("courseId", "==", courseId));
    const cSnap = await getDocs(cq);
    cSnap.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();
    return true;
}


// =============================================================================
// PARTICIPANTS
// =============================================================================

export async function listParticipants(courseId) {
    if (!courseId) return [];
    const participantsCol = collection(db, "participants");
    const q = query(participantsCol, where("courseId", "==", courseId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function upsertParticipant(p) {
    const participantId = p.id || uid();
    const participantRef = doc(db, "participants", participantId);
    await setDoc(participantRef, { ...p, id: participantId }, { merge: true });
    return participantId;
}

export async function deleteParticipant(participantId) {
    const batch = writeBatch(db);

    // Delete the participant
    batch.delete(doc(db, "participants", participantId));
    
    // Find and delete related observations
    const oq = query(collection(db, "observations"), where("participant_id", "==", participantId));
    const oSnap = await getDocs(oq);
    oSnap.docs.forEach(d => batch.delete(d.ref));

    // Find and delete related cases
    const cq = query(collection(db, "cases"), where("participant_id", "==", participantId));
    const cSnap = await getDocs(cq);
    cSnap.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();
    return true;
}


// =============================================================================
// OBSERVATIONS & CASES
// =============================================================================

export async function listObservationsForParticipant(courseId, participantId) {
    const q = query(
        collection(db, "observations"),
        where("courseId", "==", courseId),
        where("participant_id", "==", participantId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data());
}

export async function listCasesForParticipant(courseId, participantId) {
    const q = query(
        collection(db, "cases"),
        where("courseId", "==", courseId),
        where("participant_id", "==", participantId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data());
}

export async function upsertCaseAndObservations(caseData, observations, editingCaseId = null) {
    const batch = writeBatch(db);

    // If editing, first delete the old case and its observations
    if (editingCaseId) {
        await deleteCaseAndObservations(editingCaseId);
    }
    
    // Add the new case document
    const caseId = editingCaseId || uid();
    const caseRef = doc(db, "cases", caseId);
    batch.set(caseRef, { ...caseData, id: caseId });

    // Add each new observation document
    observations.forEach(obs => {
        const obsId = uid();
        const obsRef = doc(db, "observations", obsId);
        batch.set(obsRef, { ...obs, id: obsId, caseId: caseId });
    });

    await batch.commit();
}


export async function deleteCaseAndObservations(caseId) {
    const batch = writeBatch(db);

    // Delete the case document
    batch.delete(doc(db, "cases", caseId));
    
    // Find and delete all observations linked to this case
    const q = query(collection(db, "observations"), where("caseId", "==", caseId));
    const snapshot = await getDocs(q);
    snapshot.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();
}

// =============================================================================
// REPORTING
// =============================================================================

export async function listAllDataForCourse(courseId) {
    const obsQuery = query(collection(db, "observations"), where("courseId", "==", courseId));
    const casesQuery = query(collection(db, "cases"), where("courseId", "==", courseId));

    const [obsSnap, casesSnap] = await Promise.all([
        getDocs(obsQuery),
        getDocs(casesQuery)
    ]);

    const allObs = obsSnap.docs.map(d => d.data());
    const allCases = casesSnap.docs.map(d => d.data());

    return { allObs, allCases };
}

// Migration function is complex and specific to your old data structure.
// This is a placeholder showing the concept.
export async function migrateLocalToFirestore() {
    alert("Migration from localStorage is a complex, one-time operation. This feature needs to be carefully implemented to avoid data duplication.");
    return { courses: 0, participants: 0, observations: 0, cases: 0 };
}
=======
import {
  collection, doc, getDocs, addDoc, setDoc, query, where, orderBy,
  writeBatch, serverTimestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';

// Courses
export async function listCoursesByType(courseType) {
  const q = query(collection(db,'courses'), where('course_type','==',courseType));
  const s = await getDocs(q); return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function upsertCourse(c) {
  const payload = { ...c, createdAt: serverTimestamp(), createdByUid: auth.currentUser?.uid || null, createdByEmail: auth.currentUser?.email || null };
  if (c.id) { await setDoc(doc(db,'courses',c.id), payload, { merge:true }); return c.id; }
  const ref = await addDoc(collection(db,'courses'), payload); return ref.id;
}

// Participants
export async function listParticipants(courseId) {
  const q = query(collection(db,'participants'), where('courseId','==',courseId), orderBy('name'));
  const s = await getDocs(q); return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function upsertParticipant(p) {
  const id = p.id ?? crypto.randomUUID().slice(0,12);
  await setDoc(doc(db,'participants',id), p, { merge:true }); return id;
}

// Observations (bulk)
export async function addObservations(rows) {
  const batch = writeBatch(db);
  for (const r of rows) {
    const id = r.id ?? crypto.randomUUID().slice(0,16);
    batch.set(doc(db,'observations',id), r, { merge:true });
  }
  await batch.commit();
}

// Cases
export async function addCase(c) {
  const id = c.id ?? `${c.courseId}_${c.participant_id}_${c.encounter_date}_${c.case_serial}`;
  await setDoc(doc(db,'cases',id), c, { merge:true }); return id;
}
>>>>>>> 2721d1f7321ee81f1f040962e0f5c156b71ac7cb
