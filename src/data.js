// data.js
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
    getDoc
} from "firebase/firestore";

import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- FILE UPLOAD ---
export async function uploadFile(file) {
    if (!file) return null;

    const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);

    try {
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        console.log("File uploaded successfully:", downloadURL);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
    }
}


// --- FACILITATORS ---
export async function upsertFacilitator(payload) {
    if (payload.id) {
        // Update
        const facRef = doc(db, "facilitators", payload.id);
        await setDoc(facRef, payload, { merge: true });
        return payload.id;
    } else {
        // Create
        const { id, ...dataToSave } = payload;
        const newFacRef = await addDoc(collection(db, "facilitators"), dataToSave);
        return newFacRef.id;
    }
}

export async function listFacilitators() {
    const querySnapshot = await getDocs(collection(db, "facilitators"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deleteFacilitator(facilitatorId) {
    await deleteDoc(doc(db, "facilitators", facilitatorId));
    return true;
}

export async function listAllParticipants() {
    const allCourses = await listAllCourses();
    const allParticipants = [];

    for (const course of allCourses) {
        const participants = await listParticipants(course.id);
        // Enrich participants with course details before pushing
        participants.forEach(p => {
            allParticipants.push({
                ...p,
                course_type: course.course_type,
                state: course.state,
                locality: course.locality
            });
        });
    }
    return allParticipants;
}

// --- COURSES ---
export async function upsertCourse(payload) {
    if (payload.id) {
        // This is an UPDATE of an existing course
        const courseRef = doc(db, "courses", payload.id);
        await setDoc(courseRef, payload, { merge: true });
        return payload.id;
    } else {
        // This is a NEW course
        const { id, ...dataToSave } = payload;
        const newCourseRef = await addDoc(collection(db, "courses"), dataToSave);
        return newCourseRef.id;
    }
}

// --- PARTICIPANTS ---
export async function upsertParticipant(payload) {
    if (payload.id) {
        // This is an UPDATE of an existing participant
        const participantRef = doc(db, "participants", payload.id);
        await setDoc(participantRef, payload, { merge: true });
        return payload.id;
    } else {
        // This is a NEW participant
        const { id, ...dataToSave } = payload;
        const newParticipantRef = await addDoc(collection(db, "participants"), dataToSave);
        return newParticipantRef.id;
    }
}


// --- OTHER FUNCTIONS ---

export async function listCoursesByType(course_type) {
    const q = query(collection(db, "courses"), where("course_type", "==", course_type));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// +++ NEW: Function to get ALL courses for facilitator reports +++
export async function listAllCourses() {
    const querySnapshot = await getDocs(collection(db, "courses"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}


export async function deleteCourse(courseId) {
    const batch = writeBatch(db);
    batch.delete(doc(db, "courses", courseId));
    const participantsQuery = query(collection(db, "participants"), where("courseId", "==", courseId));
    const participantsSnap = await getDocs(participantsQuery);
    participantsSnap.forEach(d => batch.delete(d.ref));
    const observationsQuery = query(collection(db, "observations"), where("courseId", "==", courseId));
    const observationsSnap = await getDocs(observationsQuery);
    observationsSnap.forEach(d => batch.delete(d.ref));
    const casesQuery = query(collection(db, "cases"), where("courseId", "==", courseId));
    const casesSnap = await getDocs(casesQuery);
    casesSnap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return true;
}

export async function listParticipants(courseId) {
    if (!courseId) return [];
    const q = query(collection(db, "participants"), where("courseId", "==", courseId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deleteParticipant(participantId) {
    const batch = writeBatch(db);
    batch.delete(doc(db, "participants", participantId));
    const oq = query(collection(db, "observations"), where("participant_id", "==", participantId));
    const oSnap = await getDocs(oq);
    oSnap.forEach(d => batch.delete(d.ref));
    const cq = query(collection(db, "cases"), where("participant_id", "==", participantId));
    const cSnap = await getDocs(cq);
    cSnap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return true;
}

export async function listObservationsForParticipant(courseId, participantId) {
    const q = query(collection(db, "observations"), where("courseId", "==", courseId), where("participant_id", "==", participantId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listCasesForParticipant(courseId, participantId) {
    const q = query(collection(db, "cases"), where("courseId", "==", courseId), where("participant_id", "==", participantId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function upsertCaseAndObservations(caseData, observations, editingCaseId = null) {
    const batch = writeBatch(db);
    const caseId = editingCaseId || doc(collection(db, 'temp')).id;
    const caseRef = doc(db, "cases", caseId);

    if (editingCaseId) {
        const oldObsQuery = query(collection(db, "observations"), where("caseId", "==", editingCaseId));
        const oldObsSnapshot = await getDocs(oldObsQuery);
        oldObsSnapshot.forEach(doc => batch.delete(doc.ref));
    }

    batch.set(caseRef, { ...caseData, id: caseId });

    observations.forEach(obs => {
        const obsRef = doc(collection(db, "observations"));
        batch.set(obsRef, { ...obs, id: obsRef.id, caseId: caseId });
    });

    await batch.commit();
}

export async function deleteCaseAndObservations(caseId) {
    const batch = writeBatch(db);
    batch.delete(doc(db, "cases", caseId));

    const q = query(collection(db, "observations"), where("caseId", "==", caseId));
    const snapshot = await getDocs(q);
    snapshot.forEach(d => batch.delete(d.ref));

    await batch.commit();
}

export async function listAllDataForCourse(courseId) {
    const obsQuery = query(collection(db, "observations"), where("courseId", "==", courseId));
    const casesQuery = query(collection(db, "cases"), where("courseId", "==", courseId));

    const [obsSnap, casesSnap] = await Promise.all([
        getDocs(obsQuery),
        getDocs(casesQuery)
    ]);

    const allObs = obsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allCases = casesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return { allObs, allCases };
}