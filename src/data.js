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
    getDoc as firestoreGetDoc,
    serverTimestamp,
    increment
} from "firebase/firestore";

import { auth } from './firebase';
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const getDoc = firestoreGetDoc; // Alias to avoid naming conflicts

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

// --- PUBLIC DATA FETCHING FUNCTIONS ---
export async function getCourseById(courseId, source = 'default') {
    const courseRef = doc(db, "courses", courseId);
    const courseSnap = await getDoc(courseRef, { source });
    if (!courseSnap.exists()) {
        return null;
    }
    return { id: courseSnap.id, ...courseSnap.data() };
}

export async function getParticipantById(participantId, source = 'default') {
    const participantRef = doc(db, "participants", participantId);
    const participantSnap = await getDoc(participantRef, { source });
    if (!participantSnap.exists()) {
        return null;
    }
    return { id: participantSnap.id, ...participantSnap.data() };
}

export async function getPublicCourseReportData(courseId) {
    const course = await getCourseById(courseId, 'server');
    
    if (!course) {
        throw new Error("Report not found.");
    }
    if (!course.isPublic) {
        throw new Error("This report is not publicly accessible.");
    }
    
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
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                email: data.email || '',
                isAdmin: data.isAdmin || false,
                access: data.access || {},
                lastLogin: data.lastLogin || null
            };
        });
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
        const facRef = doc(db, "facilitators", payload.id);
        await setDoc(facRef, payload, { merge: true });
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newFacRef = await addDoc(collection(db, "facilitators"), dataToSave);
        return newFacRef.id;
    }
}

export async function importFacilitators(facilitators) {
    const batch = writeBatch(db);
    facilitators.forEach(fac => {
        if (fac.id) {
            const facRef = doc(db, "facilitators", fac.id);
            batch.update(facRef, fac);
        } else {
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

// --- FACILITATOR SUBMISSIONS ---
export async function submitFacilitatorApplication(payload) {
    const dataToSave = { ...payload, submittedAt: serverTimestamp(), status: 'pending' };
    const newSubmissionRef = await addDoc(collection(db, "facilitatorSubmissions"), dataToSave);
    return newSubmissionRef.id;
}

export async function listPendingFacilitatorSubmissions() {
    const q = query(collection(db, "facilitatorSubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function approveFacilitatorSubmission(submission, approverEmail) {
    const { id: submissionId, status, submittedAt, ...facilitatorData } = submission;
    const batch = writeBatch(db);
    const newFacRef = doc(collection(db, "facilitators"));
    batch.set(newFacRef, facilitatorData);
    const submissionRef = doc(db, "facilitatorSubmissions", submissionId);
    batch.update(submissionRef, { 
        status: 'approved',
        approvedBy: approverEmail,
        approvedAt: serverTimestamp()
    });
    await batch.commit();
}

export async function rejectFacilitatorSubmission(submissionId, rejectorEmail) {
    const submissionRef = doc(db, "facilitatorSubmissions", submissionId);
    await updateDoc(submissionRef, {
        status: 'rejected',
        rejectedBy: rejectorEmail,
        rejectedAt: serverTimestamp()
    });
}

// --- FACILITATOR SUBMISSION LINK CONTROLS ---
export async function getFacilitatorApplicationSettings() {
    const settingsRef = doc(db, "settings", "facilitatorApplication");
    const docSnap = await getDoc(settingsRef);
    if (docSnap.exists()) {
        return docSnap.data();
    }
    return { isActive: false, openCount: 0 };
}

export async function updateFacilitatorApplicationStatus(isActive) {
    const settingsRef = doc(db, "settings", "facilitatorApplication");
    await setDoc(settingsRef, { isActive }, { merge: true });
}

export async function incrementFacilitatorApplicationOpenCount() {
    const settingsRef = doc(db, "settings", "facilitatorApplication");
    await setDoc(settingsRef, { openCount: increment(1) }, { merge: true });
}


// --- COORDINATOR PUBLIC APPLICATION & SUBMISSIONS (ALL LEVELS) ---
export async function getCoordinatorApplicationSettings(level = 'state') {
    const docRef = doc(db, 'appSettings', `${level}CoordinatorApplication`);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data();
    }
    return { isActive: false, openCount: 0 };
}

export async function updateCoordinatorApplicationStatus(level = 'state', isActive) {
    const docRef = doc(db, 'appSettings', `${level}CoordinatorApplication`);
    await setDoc(docRef, { isActive }, { merge: true });
}

export async function incrementCoordinatorApplicationOpenCount(level = 'state') {
    const docRef = doc(db, 'appSettings', `${level}CoordinatorApplication`);
    await setDoc(docRef, { openCount: increment(1) }, { merge: true });
}

// State Submission
export async function submitCoordinatorApplication(payload) {
    const submissionsRef = collection(db, 'coordinatorSubmissions');
    await addDoc(submissionsRef, {
        ...payload,
        status: 'pending',
        submittedAt: serverTimestamp()
    });
}

export async function listPendingCoordinatorSubmissions() {
    const q = query(collection(db, "coordinatorSubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function approveCoordinatorSubmission(submission, approverEmail) {
    const { id: submissionId, status, submittedAt, ...coordinatorData } = submission;

    const usersRef = collection(db, "users");
    const userQuery = query(usersRef, where("email", "==", submission.email));
    const userSnapshot = await getDocs(userQuery);

    const batch = writeBatch(db);
    const newCoordinatorRef = doc(collection(db, "stateCoordinators"));
    batch.set(newCoordinatorRef, coordinatorData);
    const submissionRef = doc(db, "coordinatorSubmissions", submissionId);
    batch.update(submissionRef, {
        status: 'approved',
        approvedBy: approverEmail,
        approvedAt: serverTimestamp()
    });
    if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        batch.update(userDoc.ref, {
            role: 'states_manager',
            assignedState: submission.state
        });
    }
    await batch.commit();
}

export async function rejectCoordinatorSubmission(submissionId, rejectorEmail) {
    const submissionRef = doc(db, "coordinatorSubmissions", submissionId);
    await updateDoc(submissionRef, {
        status: 'rejected',
        rejectedBy: rejectorEmail,
        rejectedAt: serverTimestamp()
    });
}

// Federal Submission
export async function submitFederalApplication(payload) {
    const submissionsRef = collection(db, 'federalCoordinatorSubmissions');
    await addDoc(submissionsRef, { ...payload, status: 'pending', submittedAt: serverTimestamp() });
}
export async function listPendingFederalSubmissions() {
    const q = query(collection(db, "federalCoordinatorSubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function approveFederalSubmission(submission, approverEmail) {
    const { id: submissionId, ...coordinatorData } = submission;
    const usersRef = collection(db, "users");
    const userQuery = query(usersRef, where("email", "==", submission.email));
    const userSnapshot = await getDocs(userQuery);
    const batch = writeBatch(db);
    const newCoordinatorRef = doc(collection(db, "federalCoordinators"));
    batch.set(newCoordinatorRef, coordinatorData);
    const submissionRef = doc(db, "federalCoordinatorSubmissions", submissionId);
    batch.update(submissionRef, { status: 'approved', approvedBy: approverEmail, approvedAt: serverTimestamp() });
    if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        batch.update(userDoc.ref, { role: 'federal_manager' });
    }
    await batch.commit();
}
export async function rejectFederalSubmission(submissionId, rejectorEmail) {
    const submissionRef = doc(db, "federalCoordinatorSubmissions", submissionId);
    await updateDoc(submissionRef, { status: 'rejected', rejectedBy: rejectorEmail, rejectedAt: serverTimestamp() });
}

// Locality Submission
export async function submitLocalityApplication(payload) {
    const submissionsRef = collection(db, 'localityCoordinatorSubmissions');
    await addDoc(submissionsRef, { ...payload, status: 'pending', submittedAt: serverTimestamp() });
}
export async function listPendingLocalitySubmissions() {
    const q = query(collection(db, "localityCoordinatorSubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function approveLocalitySubmission(submission, approverEmail) {
    const { id: submissionId, ...coordinatorData } = submission;
    const batch = writeBatch(db);
    const newCoordinatorRef = doc(collection(db, "localityCoordinators"));
    batch.set(newCoordinatorRef, coordinatorData);
    const submissionRef = doc(db, "localityCoordinatorSubmissions", submissionId);
    batch.update(submissionRef, { status: 'approved', approvedBy: approverEmail, approvedAt: serverTimestamp() });
    await batch.commit();
}
export async function rejectLocalitySubmission(submissionId, rejectorEmail) {
    const submissionRef = doc(db, "localityCoordinatorSubmissions", submissionId);
    await updateDoc(submissionRef, { status: 'rejected', rejectedBy: rejectorEmail, rejectedAt: serverTimestamp() });
}


// --- COURSE COORDINATORS (Handles the 'coordinators' collection) ---
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

// --- STATE COORDINATORS (Handles the 'stateCoordinators' collection) ---
export async function upsertStateCoordinator(payload) {
    if (payload.id) {
        const coordinatorRef = doc(db, "stateCoordinators", payload.id);
        await setDoc(coordinatorRef, payload, { merge: true });
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newRef = await addDoc(collection(db, "stateCoordinators"), dataToSave);
        return newRef.id;
    }
}

export async function listStateCoordinators(source = 'default') {
    const q = query(collection(db, "stateCoordinators"));
    const snapshot = await getDocs(q, { source });
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deleteStateCoordinator(coordinatorId) {
    await deleteDoc(doc(db, "stateCoordinators", coordinatorId));
    return true;
}

// --- FEDERAL COORDINATORS (Handles the 'federalCoordinators' collection) ---
export async function upsertFederalCoordinator(payload) {
    if (payload.id) {
        const coordinatorRef = doc(db, "federalCoordinators", payload.id);
        await setDoc(coordinatorRef, payload, { merge: true });
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newRef = await addDoc(collection(db, "federalCoordinators"), dataToSave);
        return newRef.id;
    }
}
export async function listFederalCoordinators(source = 'default') {
    const q = query(collection(db, "federalCoordinators"));
    const snapshot = await getDocs(q, { source });
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function deleteFederalCoordinator(coordinatorId) {
    await deleteDoc(doc(db, "federalCoordinators", coordinatorId));
    return true;
}

// --- LOCALITY COORDINATORS (Handles the 'localityCoordinators' collection) ---
export async function upsertLocalityCoordinator(payload) {
    if (payload.id) {
        const coordinatorRef = doc(db, "localityCoordinators", payload.id);
        await setDoc(coordinatorRef, payload, { merge: true });
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newRef = await addDoc(collection(db, "localityCoordinators"), dataToSave);
        return newRef.id;
    }
}
export async function listLocalityCoordinators(source = 'default') {
    const q = query(collection(db, "localityCoordinators"));
    const snapshot = await getDocs(q, { source });
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function deleteLocalityCoordinator(coordinatorId) {
    await deleteDoc(doc(db, "localityCoordinators", coordinatorId));
    return true;
}


// --- FUNDERS ---
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
        let q = query(collection(db, "courses"), where("course_type", "==", course_type));
        if (userStates && userStates.length > 0) {
            q = query(q, where("state", "in", userStates));
        }
        const querySnapshot = await getDocs(q, { source });
        const courses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return courses;
    } catch (error) {
        console.error("Error in listCoursesByType:", error);
        throw error;
    }
}

export async function listAllCourses(userStates, source = 'default') {
    try {
        let q = collection(db, "courses");
        if (userStates && userStates.length > 0) {
            q = query(q, where("state", "in", userStates));
        }
        const querySnapshot = await getDocs(q, { source });
        const courses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            const participantRef = doc(db, "participants", participant.id);
            batch.update(participantRef, participant);
        } else {
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

// --- FINAL REPORTS ---
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