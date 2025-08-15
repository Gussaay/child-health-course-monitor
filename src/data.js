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
    writeBatch
} from "firebase/firestore";

// Helper to generate unique IDs if needed (though Firestore does this automatically)
const uid = () => doc(collection(db, 'temp')).id;

// --- Courses ---
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
    // Note: This is a simple delete. For production, you'd want a Cloud Function 
    // to recursively delete subcollections (participants, observations).
    await deleteDoc(doc(db, "courses", courseId));
    
    // Simple deletion of related participants (less efficient but works)
    const participantsCol = collection(db, "participants");
    const q = query(participantsCol, where("courseId", "==", courseId));
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    return true;
}

// --- Participants ---
export async function listParticipants(courseId) {
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
    await deleteDoc(doc(db, "participants", participantId));
    return true;
}

// --- Observations & Cases ---
// These functions need to be implemented if you want to save this data to Firestore.
// For now, they can remain stubs.
export async function addObservations(rows) {
  console.log("addObservations to Firestore not implemented yet.", rows);
  return true; 
}

export async function addCase(c) {
  console.log("addCase to Firestore not implemented yet.", c);
  return true;
}