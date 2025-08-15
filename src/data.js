import { db } from './firebase';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    setDoc, 
    deleteDoc,
    writeBatch
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
    const batch = writeBatch(db);
    batch.delete(doc(db, "courses", courseId));

    const pq = query(collection(db, "participants"), where("courseId", "==", courseId));
    const pSnap = await getDocs(pq);
    pSnap.docs.forEach(d => batch.delete(d.ref));

    const oq = query(collection(db, "observations"), where("courseId", "==", courseId));
    const oSnap = await getDocs(oq);
    oSnap.docs.forEach(d => batch.delete(d.ref));

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
    batch.delete(doc(db, "participants", participantId));
    
    const oq = query(collection(db, "observations"), where("participant_id", "==", participantId));
    const oSnap = await getDocs(oq);
    oSnap.docs.forEach(d => batch.delete(d.ref));

    const cq = query(collection(db, "cases"), where("participant_id", "==", participantId));
    const cSnap = await getDocs(cq);
    cSnap.docs.forEach(d => batch.delete(d.ref));

    await batch.commit();
    return true;
}


// =============================================================================
// OBSERVATIONS & CASES (IMPLEMENTED)
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

    if (editingCaseId) {
        await deleteCaseAndObservations(editingCaseId);
    }
    
    const caseId = editingCaseId || uid();
    const caseRef = doc(db, "cases", caseId);
    batch.set(caseRef, { ...caseData, id: caseId });

    observations.forEach(obs => {
        const obsId = uid();
        const obsRef = doc(db, "observations", obsId);
        batch.set(obsRef, { ...obs, id: obsId, caseId: caseId });
    });

    await batch.commit();
}

export async function deleteCaseAndObservations(caseId) {
    const batch = writeBatch(db);

    batch.delete(doc(db, "cases", caseId));
    
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

// =============================================================================
// MIGRATION (PLACEHOLDER)
// =============================================================================

export async function migrateLocalToFirestore() {
    console.warn("Migration from localStorage is a complex, one-time operation that has been disabled.");
    alert("This migration feature is disabled.");
    return { courses: 0, participants: 0, observations: 0, cases: 0 };
}