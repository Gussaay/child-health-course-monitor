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
    updateDoc,
    getDoc as firestoreGetDoc
} from "firebase/firestore";

import { auth } from './firebase';
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

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

// NEW FUNCTION TO DELETE FILE
export async function deleteFile(fileUrl) {
    if (!fileUrl) return;

    const fileRef = ref(storage, fileUrl);

    try {
        await deleteObject(fileRef);
        console.log("File deleted successfully:", fileUrl);
    } catch (error) {
        console.error("Error deleting file:", error);
        throw error;
    }
}

// --- NEW PUBLIC DATA FETCHING FUNCTIONS ---

/**
 * Fetches a single course document by its ID.
 * Assumes security rules are in place for public/private access.
 * @param {string} courseId The ID of the course to fetch.
 * @param {string} source Cache preference ('default', 'server', 'cache').
 * @returns {Promise<object|null>} The course data or null if not found.
 */
export async function getCourseById(courseId, source = 'default') {
    const courseRef = doc(db, "courses", courseId);
    const courseSnap = await firestoreGetDoc(courseRef, { source });
    if (!courseSnap.exists()) {
        return null;
    }
    return { id: courseSnap.id, ...courseSnap.data() };
}

/**
 * Fetches a single participant document by its ID.
 * @param {string} participantId The ID of the participant to fetch.
 * @param {string} source Cache preference ('default', 'server', 'cache').
 * @returns {Promise<object|null>} The participant data or null if not found.
 */
export async function getParticipantById(participantId, source = 'default') {
    const participantRef = doc(db, "participants", participantId);
    const participantSnap = await firestoreGetDoc(participantRef, { source });
    if (!participantSnap.exists()) {
        return null;
    }
    return { id: participantSnap.id, ...participantSnap.data() };
}


/**
 * Fetches all necessary data for a public course report.
 * It first checks if the course is marked as public before fetching related data.
 * @param {string} courseId The ID of the course.
 * @returns {Promise<object>} An object containing all report data.
 * @throws {Error} If the report is not found or not public.
 */
export async function getPublicCourseReportData(courseId) {
    const course = await getCourseById(courseId, 'server'); // Force server read for public data
    
    if (!course) {
        throw new Error("Report not found.");
    }
    if (!course.isPublic) {
        throw new Error("This report is not publicly accessible.");
    }
    
    // Use existing functions to fetch related data.
    // Firebase security rules must allow these reads if the course is public.
    const participants = await listParticipants(courseId, 'server');
    const { allObs, allCases } = await listAllDataForCourse(courseId, 'server');
    const finalReport = await getFinalReportByCourseId(courseId, 'server');
    
    return {
        course,
        participants,
        allObs,
        allCases,
        finalReport,
    };
}


// --- ADMIN & USERS ---
export async function listUsers(source = 'default') {
    try {
        const querySnapshot = await getDocs(collection(db, "users"), { source });
        const users = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                email: data.email || '',
                isAdmin: data.isAdmin || false,
                access: data.access || {},
                lastLogin: data.lastLogin || null
            };
        });
        return users;
    } catch (error) {
        console.error("Error fetching users:", error);
        throw error;
    }
}

export async function updateUserAccess(userId, module, newAccess) {
    try {
        const userRef = doc(db, "users", userId);
        await setDoc(userRef, {
            access: {
                [module]: newAccess
            }
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error updating user access:", error);
        throw error;
    }
}

/**
 * Updates a facilitator's role in Firestore.
 * @param {string} facilitatorId The ID of the facilitator to update.
 * @param {string} newRole The new role for the facilitator ('facilitator' or 'course_director').
 */
export async function updateFacilitatorRole(facilitatorId, newRole) {
    if (!facilitatorId || !newRole) {
        throw new Error("Facilitator ID and new role are required.");
    }
    const facilitatorRef = doc(db, 'facilitators', facilitatorId);
    await updateDoc(facilitatorRef, {
        role: newRole
    });
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

export async function importFacilitators(facilitators) {
    const batch = writeBatch(db);
    facilitators.forEach(fac => {
        if (fac.id) {
            // Update existing facilitator
            const facRef = doc(db, "facilitators", fac.id);
            batch.update(facRef, fac);
        } else {
            // Add new facilitator
            const facRef = doc(collection(db, "facilitators"));
            batch.set(facRef, fac);
        }
    });
    await batch.commit();
    return true;
}


export async function listFacilitators(userStates, source = 'default') {
    try {
        let q = collection(db, "facilitators");
        if (userStates && userStates.length > 0) {
            q = query(q, where("currentState", "in", userStates));
        }
        const querySnapshot = await getDocs(q, { source });
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error in listFacilitators:", error);
        throw error;
    }
}

export async function deleteFacilitator(facilitatorId) {
    await deleteDoc(doc(db, "facilitators", facilitatorId));
    return true;
}

// --- NEW: COORDINATORS ---
export async function upsertCoordinator(payload) {
    if (payload.id) {
        const coordinatorRef = doc(db, "coordinators", payload.id);
        await setDoc(coordinatorRef, payload, { merge: true });
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newRef = await addDoc(collection(db, "coordinators"), dataToSave);
        return newRef.id;
    }
}

export async function listCoordinators(source = 'default') {
    const q = query(collection(db, "coordinators"));
    const snapshot = await getDocs(q, { source });
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deleteCoordinator(coordinatorId) {
    await deleteDoc(doc(db, "coordinators", coordinatorId));
    return true;
}

// --- NEW: FUNDERS ---
export async function upsertFunder(payload) {
    if (payload.id) {
        const funderRef = doc(db, "funders", payload.id);
        await setDoc(funderRef, payload, { merge: true });
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newRef = await addDoc(collection(db, "funders"), dataToSave);
        return newRef.id;
    }
}

export async function listFunders(source = 'default') {
    const q = query(collection(db, "funders"));
    const snapshot = await getDocs(q, { source });
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deleteFunder(funderId) {
    await deleteDoc(doc(db, "funders", funderId));
    return true;
}

// --- COURSES ---
export async function upsertCourse(payload) {
    if (payload.id) {
        const courseRef = doc(db, "courses", payload.id);
        await setDoc(courseRef, payload, { merge: true });
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newCourseRef = await addDoc(collection(db, "courses"), dataToSave);
        return newCourseRef.id;
    }
}

/**
 * Updates the sharing settings of a course.
 * @param {string} courseId The ID of the course to update.
 * @param {object} settings An object containing isPublic (boolean) and sharedWith (array of emails).
 */
export async function updateCourseSharingSettings(courseId, settings) {
    if (!courseId) {
        throw new Error("Course ID is required.");
    }
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, {
        isPublic: settings.isPublic,
        sharedWith: settings.sharedWith
    });
}

/**
 * Updates the public access status of a course.
 * @param {string} courseId The ID of the course to update.
 * @param {boolean} isPublic The new public status.
 */
export async function updateCoursePublicStatus(courseId, isPublic) {
    if (!courseId) {
        throw new Error("Course ID is required.");
    }
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, {
        isPublic: isPublic
    });
}


export async function listCoursesByType(course_type, userStates, source = 'default') {
    try {
        console.log(`Fetching courses of type: ${course_type}`);
        let q = query(collection(db, "courses"), where("course_type", "==", course_type));
        if (userStates && userStates.length > 0) {
            q = query(q, where("state", "in", userStates));
        }
        const querySnapshot = await getDocs(q, { source });
        const courses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Found ${courses.length} courses of type ${course_type}`);
        return courses;
    } catch (error) {
        console.error("Error in listCoursesByType:", error);
        throw error;
    }
}

export async function listAllCourses(userStates, source = 'default') {
    try {
        console.log("Fetching all courses...");
        let q = collection(db, "courses");
        if (userStates && userStates.length > 0) {
            q = query(q, where("state", "in", userStates));
        }
        const querySnapshot = await getDocs(q, { source });
        const courses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`Found ${courses.length} courses`);
        return courses;
    } catch (error) {
        console.error("Error in listAllCourses:", error);
        throw error;
    }
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

// --- PARTICIPANTS ---
export async function upsertParticipant(payload) {
    if (payload.id) {
        const participantRef = doc(db, "participants", payload.id);
        await setDoc(participantRef, payload, { merge: true });
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newParticipantRef = await addDoc(collection(db, "participants"), dataToSave);
        return newParticipantRef.id;
    }
}

/**
 * Updates the sharing settings of a participant.
 * @param {string} participantId The ID of the participant to update.
 * @param {object} settings An object containing isPublic (boolean) and sharedWith (array of emails).
 */
export async function updateParticipantSharingSettings(participantId, settings) {
    if (!participantId) {
        throw new Error("Participant ID is required.");
    }
    const participantRef = doc(db, "participants", participantId);
    await updateDoc(participantRef, {
        isPublic: settings.isPublic,
        sharedWith: settings.sharedWith
    });
}


export async function importParticipants(participants) {
    const batch = writeBatch(db);
    participants.forEach(participant => {
        if (participant.id) {
            // Update existing participant
            const participantRef = doc(db, "participants", participant.id);
            batch.update(participantRef, participant);
        } else {
            // Add new participant
            const participantRef = doc(collection(db, "participants"));
            batch.set(participantRef, participant);
        }
    });
    await batch.commit();
    return true;
}


export async function listParticipants(courseId, source = 'default') {
    if (!courseId) return [];
    const q = query(collection(db, "participants"), where("courseId", "==", courseId));
    const querySnapshot = await getDocs(q, { source });
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function listAllParticipants(userStates, source = 'default') {
    const allCourses = await listAllCourses(userStates, source);
    const allParticipants = [];
    for (const course of allCourses) {
        const participants = await listParticipants(course.id, source);
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

// --- OBSERVATIONS & CASES ---
export async function listObservationsForParticipant(courseId, participantId, source = 'default') {
    const q = query(collection(db, "observations"), where("courseId", "==", courseId), where("participant_id", "==", participantId));
    const snapshot = await getDocs(q, { source });
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listCasesForParticipant(courseId, participantId, source = 'default') {
    const q = query(collection(db, "cases"), where("courseId", "==", courseId), where("participant_id", "==", participantId));
    const snapshot = await getDocs(q, { source });
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

export async function listAllDataForCourse(courseId, source = 'default') {
    const obsQuery = query(collection(db, "observations"), where("courseId", "==", courseId));
    const casesQuery = query(collection(db, "cases"), where("courseId", "==", courseId));

    const [obsSnap, casesSnap] = await Promise.all([
        getDocs(obsQuery, { source }),
        getDocs(casesQuery, { source })
    ]);

    const allObs = obsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allCases = casesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // New Logic: Map observations to cases to determine case correctness
    const allCasesWithCorrectness = allCases.map(caseItem => {
        const caseObservations = allObs.filter(obs => obs.caseId === caseItem.id);
        const is_correct = caseObservations.length > 0 && caseObservations.every(obs => obs.item_correct > 0);
        return {
            ...caseItem,
            is_correct
        };
    });

    return { allObs, allCases: allCasesWithCorrectness };
}
export async function upsertFinalReport(payload) {
    if (payload.id) {
        const finalReportRef = doc(db, "finalReports", payload.id);
        await setDoc(finalReportRef, payload, { merge: true });
        return payload.id;
    } else {
        const newRef = await addDoc(collection(db, "finalReports"), payload);
        return newRef.id;
    }
}
export async function getFinalReportByCourseId(courseId, source = 'default') {
    if (!courseId) return null;
    const q = query(collection(db, "finalReports"), where("courseId", "==", courseId));
    const snapshot = await getDocs(q, { source });
    if (!snapshot.empty) {
        // Assuming there is only one final report per course
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }
    return null;
}
export async function listFinalReport(source = 'default') {
    try {
        const querySnapshot = await getDocs(collection(db, "finalReports"), { source });
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching final reports:", error);
        throw error;
    }
}
// This function was missing and caused the error.
// It deletes a final report document from the "finalReports" collection.
export async function deleteFinalReport(reportId) {
    try {
        if (!reportId) {
            throw new Error("Report ID is required to delete a final report.");
        }
        await deleteDoc(doc(db, "finalReports", reportId));
        return true;
    } catch (error) {
        console.error("Error deleting final report:", error);
        throw error;
    }
}