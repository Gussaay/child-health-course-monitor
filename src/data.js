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
    increment,
    orderBy,
    limit,
    Timestamp // Import Timestamp for date queries
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

// --- HEALTH FACILITIES (REVISED LOGIC FOR HISTORICAL TRACKING) ---
export async function saveFacilitySnapshot(payload) {
    if (!payload.date_of_visit) {
        throw new Error("Cannot save a historical snapshot without a 'date_of_visit'. This date is required to track changes over time.");
    }

    let visitDate;
    const rawDate = payload.date_of_visit;

    try {
        if (typeof rawDate === 'number') {
            if (rawDate > 1 && rawDate < 100000) { 
                visitDate = new Date((rawDate - 25569) * 86400000);
            }
            else if (String(rawDate).length > 10) { 
                visitDate = new Date(rawDate);
            } else { 
                visitDate = new Date(rawDate * 1000);
            }
        } else if (typeof rawDate === 'string' || rawDate instanceof Date) {
            visitDate = new Date(rawDate);
        } else {
            throw new Error(`Unsupported date format: ${rawDate}`);
        }

        if (isNaN(visitDate.getTime())) {
            throw new Error(`Could not parse the provided date: '${rawDate}'`);
        }
    } catch (e) {
        throw new Error(`Failed to process date_of_visit ('${rawDate}'). Reason: ${e.message}`);
    }
    
    const batch = writeBatch(db);
    let facilityId = payload.id;
    let facilityRef;
    let isNewFacility = false;

    if (facilityId) {
        facilityRef = doc(db, "healthFacilities", facilityId);
    } else {
        const { "الولاية": state, "المحلية": locality, "اسم_المؤسسة": facilityName } = payload;
        if (!state || !locality || !facilityName) {
            throw new Error("State (الولاية), Locality (المحلية), and Facility Name (اسم_المؤسسة) are required to check for duplicates or create a new facility.");
        }
        const q = query(
            collection(db, "healthFacilities"),
            where("الولاية", "==", state),
            where("المحلية", "==", locality),
            where("اسم_المؤسسة", "==", facilityName)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const existingDoc = querySnapshot.docs[0];
            facilityId = existingDoc.id;
            facilityRef = existingDoc.ref;
        } else {
            isNewFacility = true;
            facilityRef = doc(collection(db, "healthFacilities"));
            facilityId = facilityRef.id;
        }
    }

    const snapshotRef = doc(collection(db, "facilitySnapshots"));
    const snapshotData = {
        ...payload,
        facilityId: facilityId, 
        id: facilityId,         
        snapshotCreatedAt: serverTimestamp(),
        effectiveDate: Timestamp.fromDate(visitDate)
    };
    delete snapshotData.submissionId;
    delete snapshotData.status;
    delete snapshotData.submittedAt;
    batch.set(snapshotRef, snapshotData);

    const mainFacilityData = {
        ...payload,
        id: facilityId,
        lastSnapshotAt: serverTimestamp()
    };
    if (isNewFacility) { 
        mainFacilityData.createdAt = serverTimestamp();
    }
    delete mainFacilityData.submissionId;
    delete mainFacilityData.status;
    delete mainFacilityData.submittedAt;
    batch.set(facilityRef, mainFacilityData, { merge: true });

    await batch.commit();
    return facilityId;
}

export async function getHistoricalComparison(metric, dateStr) {
    const targetDate = Timestamp.fromDate(new Date(`${dateStr}T23:59:59`));
    const snapshotsRef = collection(db, "facilitySnapshots");
    
    const q = query(snapshotsRef, where("effectiveDate", "<=", targetDate), orderBy("effectiveDate", "desc"));
    const querySnapshot = await getDocs(q);

    const latestSnapshots = new Map();
    querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.facilityId && !latestSnapshots.has(data.facilityId)) {
            latestSnapshots.set(data.facilityId, data);
        }
    });

    let count = 0;
    const allFacilityRecordsOnDate = Array.from(latestSnapshots.values());

    allFacilityRecordsOnDate.forEach(facility => {
        let match = false;
        switch (metric) {
            case 'functioning':
                if (facility['هل_المؤسسة_تعمل'] === 'Yes') match = true;
                break;
            case 'imnci_service':
                if (facility['وجود_العلاج_المتكامل_لامراض_الطفولة'] === 'Yes') match = true;
                break;
            case 'eenc_service':
                if (facility.eenc_provides_essential_care === 'Yes') match = true;
                break;
            default:
                break;
        }
        if (match) {
            count++;
        }
    });

    return { count, total: latestSnapshots.size };
}

export async function upsertHealthFacility(payload) {
    console.warn("DEPRECATED: upsertHealthFacility is being replaced by saveFacilitySnapshot for better historical tracking. Please update calls to use the new function.");
    if (!payload.date_of_visit) {
        payload.date_of_visit = new Date().toISOString().split('T')[0];
    }
    return await saveFacilitySnapshot(payload);
}

const isDataChanged = (newData, oldData) => {
    const keysToCompare = Object.keys(newData);
    if (keysToCompare.length === 0) {
        return false;
    }
    for (const key of keysToCompare) {
        if (['id', 'lastSnapshotAt', 'createdAt'].includes(key)) {
            continue;
        }
        const newValue = newData[key];
        const oldValue = oldData[key];
        if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
            return true;
        }
    }
    return false;
};

export async function importHealthFacilities(facilities, onProgress) {
    const errors = [];
    const createdFacilities = [];
    const updatedFacilities = [];

    for (let i = 0; i < facilities.length; i++) {
        const facilityData = facilities[i];
        try {
            if (!facilityData.date_of_visit) {
                errors.push(`Skipped '${facilityData['اسم_المؤسسة'] || 'Unknown Facility'}' because 'Date of Visit' was missing.`);
                continue;
            }
            let existingDoc = null;
            if (facilityData.id) {
                const docRef = doc(db, "healthFacilities", facilityData.id);
                existingDoc = await firestoreGetDoc(docRef);
            } else {
                const { "الولاية": state, "المحلية": locality, "اسم_المؤسسة": facilityName } = facilityData;
                if (state && locality && facilityName) {
                    const q = query(
                        collection(db, "healthFacilities"),
                        where("الولاية", "==", state),
                        where("المحلية", "==", locality),
                        where("اسم_المؤسسة", "==", facilityName),
                        limit(1)
                    );
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) {
                        existingDoc = snapshot.docs[0];
                    }
                }
            }
            if (!existingDoc || !existingDoc.exists()) {
                const newId = await saveFacilitySnapshot(facilityData);
                createdFacilities.push({ ...facilityData, id: newId });
            } else {
                const existingData = existingDoc.data();
                if (isDataChanged(facilityData, existingData)) {
                    const payload = { ...facilityData, id: existingDoc.id };
                    await saveFacilitySnapshot(payload);
                    updatedFacilities.push(payload);
                }
            }
        } catch (e) {
            errors.push(`Failed to import '${facilityData['اسم_المؤسسة'] || 'Unknown'}': ${e.message}`);
        }
        if (onProgress) {
            const latestError = errors.length > 0 ? errors[errors.length - 1] : null;
            onProgress(i + 1, latestError);
        }
    }
    return { createdFacilities, updatedFacilities, errors };
}

export async function approveFacilitySubmission(submission, approverEmail) {
    await saveFacilitySnapshot(submission);
    const submissionRef = doc(db, "facilitySubmissions", submission.submissionId);
    await updateDoc(submissionRef, {
        status: 'approved',
        approvedBy: approverEmail,
        approvedAt: serverTimestamp()
    });
}

export async function listHealthFacilities(filters = {}, source = 'default') {
    let q = collection(db, "healthFacilities");
    const conditions = [];
    if (filters.state) {
        conditions.push(where("الولاية", "==", filters.state));
    }
    if (filters.locality) {
        conditions.push(where("المحلية", "==", filters.locality));
    }
    if (conditions.length > 0) {
        q = query(q, ...conditions);
    }
    try {
        const querySnapshot = await getDocs(q, { source });
        return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error("Error fetching health facilities:", error);
        throw error;
    }
}

export async function getHealthFacilityById(facilityId) {
    const docRef = doc(db, "healthFacilities", facilityId);
    const docSnap = await firestoreGetDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
}

export async function deleteHealthFacility(facilityId) {
    await deleteDoc(doc(db, "healthFacilities", facilityId));
    return true;
}

export async function deleteFacilitiesBatch(facilityIds) {
    if (!facilityIds || facilityIds.length === 0) {
        return 0;
    }
    const BATCH_SIZE = 500;
    let deletedCount = 0;
    for (let i = 0; i < facilityIds.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = facilityIds.slice(i, i + BATCH_SIZE);
        chunk.forEach(facilityId => {
            const docRef = doc(db, "healthFacilities", facilityId);
            batch.delete(docRef);
        });
        await batch.commit();
        deletedCount += chunk.length;
    }
    return deletedCount;
}

export async function submitFacilityDataForApproval(payload) {
    const dataToSubmit = {
        ...payload,
        submittedAt: serverTimestamp(),
        status: 'pending'
    };
    const newSubmissionRef = await addDoc(collection(db, "facilitySubmissions"), dataToSubmit);
    return newSubmissionRef.id;
}

export async function listPendingFacilitySubmissions() {
    const q = query(collection(db, "facilitySubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ submissionId: doc.id, ...doc.data() }));
}

export async function rejectFacilitySubmission(submissionId, rejectorEmail) {
    const submissionRef = doc(db, "facilitySubmissions", submissionId);
    await updateDoc(submissionRef, {
        status: 'rejected',
        rejectedBy: rejectorEmail,
        rejectedAt: serverTimestamp()
    });
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
export async function getFacilitatorByEmail(email) {
    if (!email) return null;
    try {
        const q = query(
            collection(db, "facilitators"), 
            where("email", "==", email), 
            limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        console.error("Error fetching facilitator by email:", error);
        return null;
    }
}

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
export async function getFacilitatorSubmissionByEmail(email) {
    if (!email) {
        return null;
    }
    try {
        const submissionsRef = collection(db, "facilitatorSubmissions");
        const q = query(
            submissionsRef,
            where("email", "==", email),
            orderBy("submittedAt", "desc"),
            limit(1)
        );

        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            return { id: doc.id, ...doc.data() };
        }
        
        return null;
    } catch (error) {
        console.error("Error fetching facilitator submission by email:", error);
        return null;
    }
}

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
export async function getCoordinatorApplicationSettings() {
    const docRef = doc(db, 'appSettings', 'coordinatorApplication');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data();
    }
    return { isActive: false, openCount: 0 };
}

export async function updateCoordinatorApplicationStatus(isActive) {
    const docRef = doc(db, 'appSettings', 'coordinatorApplication');
    await setDoc(docRef, { isActive }, { merge: true });
}

export async function incrementCoordinatorApplicationOpenCount() {
    const docRef = doc(db, 'appSettings', 'coordinatorApplication');
    await setDoc(docRef, { openCount: increment(1) }, { merge: true });
}

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

export async function saveParticipantAndSubmitFacilityUpdate(participantData, facilityUpdateData) {
    const participantId = await upsertParticipant(participantData);
    if (facilityUpdateData) {
        await submitFacilityDataForApproval(facilityUpdateData);
    }
    return participantId;
}

// --- ENHANCED BULK MIGRATION LOGIC ---
export async function bulkMigrateFromMappings(mappings, options = { dryRun: false }) {
    if (!mappings || mappings.length === 0) {
        return { message: "No mappings provided." };
    }

    const summary = {
        totalProcessed: mappings.length,
        submitted: 0,
        skipped: 0,
        errors: 0,
        errorDetails: [],
        previewPayloads: []
    };

    for (const mapping of mappings) {
        try {
            const { participantId, targetFacilityId, targetState, targetLocality, targetFacilityName } = mapping;

            if (!participantId || !targetFacilityId || !targetState || !targetLocality || !targetFacilityName) {
                summary.skipped++;
                summary.errorDetails.push(`Participant ID ${participantId || 'N/A'}: Skipped due to incomplete mapping data.`);
                continue;
            }

            // For dry run, we gather info to show what *would* happen
            if (options.dryRun) {
                // The frontend expects a payload that helps it find the participant and facility names again
                 summary.previewPayloads.push({
                    participantId: participantId,
                    targetFacilityId: targetFacilityId
                });
                continue; 
            }

            // --- Live Run Logic ---
            const batch = writeBatch(db);

            // 1. Update the Participant's document with new State, Locality, and Facility Name
            const participantRef = doc(db, "participants", participantId);
            batch.update(participantRef, {
                state: targetState,
                locality: targetLocality,
                center_name: targetFacilityName
            });

            // 2. Prepare and submit the facility update
            const participant = await getParticipantById(participantId);
            if (!participant) throw new Error(`Participant with ID ${participantId} not found during live run.`);

            const [facility, course] = await Promise.all([
                getHealthFacilityById(targetFacilityId),
                getCourseById(participant.courseId)
            ]);
            if (!facility) throw new Error(`Target facility with ID ${targetFacilityId} not found.`);
            if (!course) throw new Error(`Course for participant ${participantId} not found.`);

            const participantAsStaff = {
                name: participant.name,
                job_title: participant.job_title,
                is_trained: 'Yes',
                training_date: course.start_date || '',
                phone: participant.phone || ''
            };
            const existingStaff = facility.imnci_staff ? JSON.parse(JSON.stringify(facility.imnci_staff)) : [];
            const staffIndex = existingStaff.findIndex(s => s.name === participant.name || (s.phone && participant.phone && s.phone === participant.phone));
            
            if (staffIndex !== -1) {
                existingStaff[staffIndex] = participantAsStaff;
            } else {
                existingStaff.push(participantAsStaff);
            }

            const facilityUpdatePayload = {
                ...facility,
                imnci_staff: existingStaff,
                "وجود_العلاج_المتكامل_لامراض_الطفولة": 'Yes',
                "وجود_كتيب_لوحات": 'Yes',
                "وجود_سجل_علاج_متكامل": 'Yes',
                "date_of_visit": new Date().toISOString().split('T')[0],
                "updated_by": `Migrated from Participant ${participantId}`,
                'growth_monitoring_service_exists': participant.has_growth_monitoring ? 'Yes' : 'No',
                nutrition_center_exists: participant.has_nutrition_service ? 'Yes' : 'No',
                nearest_nutrition_center: participant.nearest_nutrition_center || facility.nearest_nutrition_center || '',
                immunization_office_exists: participant.has_immunization_service ? 'Yes' : 'No',
                nearest_immunization_center: participant.nearest_immunization_center || facility.nearest_immunization_center || '',
                'غرفة_إرواء': participant.has_ors_room ? 'Yes' : 'No',
                'العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين': participant.num_other_providers ?? existingStaff.length,
                'العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل': participant.num_other_providers_imci ?? existingStaff.filter(s => s.is_trained === 'Yes').length,
            };

            const submissionRef = doc(collection(db, "facilitySubmissions"));
            batch.set(submissionRef, {
                ...facilityUpdatePayload,
                submittedAt: serverTimestamp(),
                status: 'pending'
            });

            await batch.commit();
            summary.submitted++;

        } catch (error) {
            console.error(`Error migrating participant ${mapping.participantId}:`, error);
            summary.errors++;
            summary.errorDetails.push(`Participant ID ${mapping.participantId}: ${error.message}`);
        }
    }

    return summary;
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