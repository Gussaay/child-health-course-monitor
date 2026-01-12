// data.js
import { db, auth as firebaseAuth } from './firebase'; 
import {
    collection,
    query,
    where,
    getDocs as fbGetDocs,
    doc,
    setDoc as fbSetDoc,
    addDoc as fbAddDoc,
    deleteDoc as fbDeleteDoc,
    writeBatch as fbWriteBatch, 
    updateDoc as fbUpdateDoc,
    getDoc as fbGetDoc,
    increment, 
    serverTimestamp,
    orderBy,
    limit,
    Timestamp,
    startAfter
} from "firebase/firestore";
import { deleteField } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth'; 
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// --- USAGE TRACKING VARIABLES ---
let currentUser = null;
let sessionReads = 0;
let sessionWrites = 0;
let lastDbUpdateTime = 0; 
const UPDATE_INTERVAL = 30000; 
const UPDATE_THRESHOLD = 15; 
let updateTimeout = null; 

let localSessionDurationMs = 0; 
let durationIntervalId = null; 
const DURATION_TICK_MS = 60 * 1000; 
const LOCAL_STORAGE_KEY_DURATION = 'unsyncedAppDuration'; 

// --- INTERNAL HELPERS FOR USAGE TRACKING ---
const syncDurationToDb = (durationMs, userId) => {
    if (!userId || !durationMs || durationMs <= 0) return;

    const userUsageRef = doc(db, 'userUsageStats', userId);
    fbSetDoc(userUsageRef, {
        totalActiveDurationMs: increment(durationMs),
        lastUpdated: serverTimestamp() 
    }, { merge: true }).catch(e => console.error("Failed to sync duration:", e));
};

const tickLocalDuration = () => {
    if (!currentUser) {
        if (durationIntervalId) clearInterval(durationIntervalId);
        durationIntervalId = null;
        return;
    }
    localSessionDurationMs += DURATION_TICK_MS;
};

const saveDurationToLocalStorage = () => {
    if (localSessionDurationMs > 0) {
        const existingUnsyncedMs = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY_DURATION) || '0', 10);
        const totalUnsyncedMs = existingUnsyncedMs + localSessionDurationMs;
        localStorage.setItem(LOCAL_STORAGE_KEY_DURATION, totalUnsyncedMs.toString());
        localSessionDurationMs = 0;
    }
};

const updateUsageStatsInDb = () => {
    if (!currentUser || (sessionReads === 0 && sessionWrites === 0)) {
        if (updateTimeout) clearTimeout(updateTimeout);
        updateTimeout = null;
        lastDbUpdateTime = Date.now();
        return;
    }

    const userId = currentUser.uid;
    const userEmail = currentUser.email || 'unknown';
    const readsToUpdate = sessionReads;
    const writesToUpdate = sessionWrites;

    sessionReads = 0;
    sessionWrites = 0;
    lastDbUpdateTime = Date.now();
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = null;

    const userUsageRef = doc(db, 'userUsageStats', userId);

    fbSetDoc(userUsageRef, {
        totalReads: increment(readsToUpdate),
        totalWrites: increment(writesToUpdate),
        email: userEmail,
        lastUpdated: serverTimestamp()
    }, { merge: true }).catch(e => console.error("Failed to update stats:", e));
};

const dispatchOpEvent = (type, count = 1) => {
  if (count > 0 && currentUser) {
    window.dispatchEvent(new CustomEvent('firestoreOperation', { detail: { type, count } }));

    if (type === 'read') sessionReads += count;
    else sessionWrites += count;

    const totalOpsSinceLastUpdate = sessionReads + sessionWrites;
    const timeSinceLastUpdate = Date.now() - lastDbUpdateTime;

    if (updateTimeout && totalOpsSinceLastUpdate >= UPDATE_THRESHOLD) {
      clearTimeout(updateTimeout);
      updateTimeout = null;
      updateUsageStatsInDb();
    }
    else if (!updateTimeout && (timeSinceLastUpdate > UPDATE_INTERVAL || totalOpsSinceLastUpdate >= UPDATE_THRESHOLD)) {
       updateUsageStatsInDb();
    }
    else if (!updateTimeout) {
        const remainingTime = UPDATE_INTERVAL - timeSinceLastUpdate;
        updateTimeout = setTimeout(updateUsageStatsInDb, remainingTime > 0 ? remainingTime : 0);
    }
  }
};

// --- INITIALIZATION ---
export const initializeUsageTracking = () => {
  onAuthStateChanged(firebaseAuth, (user) => {
    if (!user) {
        if (durationIntervalId) clearInterval(durationIntervalId);
        durationIntervalId = null;
        if (updateTimeout) clearTimeout(updateTimeout);
        updateTimeout = null;
        window.removeEventListener('beforeunload', saveDurationToLocalStorage);
        if (currentUser && localSessionDurationMs > 0) {
            syncDurationToDb(localSessionDurationMs, currentUser.uid);
        }
        currentUser = null;
        localSessionDurationMs = 0;
        sessionReads = 0;
        sessionWrites = 0;
        localStorage.removeItem(LOCAL_STORAGE_KEY_DURATION);
        return;
    }

    if (user && !currentUser) { 
        currentUser = { uid: user.uid, email: user.email };
        const unsyncedMs = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY_DURATION) || '0', 10);
        if (unsyncedMs > 0) {
            syncDurationToDb(unsyncedMs, currentUser.uid);
            localStorage.removeItem(LOCAL_STORAGE_KEY_DURATION); 
        }
        localSessionDurationMs = 0;
        sessionReads = 0;
        sessionWrites = 0;
        lastDbUpdateTime = Date.now(); 
        durationIntervalId = setInterval(tickLocalDuration, DURATION_TICK_MS);
        window.addEventListener('beforeunload', saveDurationToLocalStorage);
    }
  });
};

// --- FIRESTORE WRAPPERS ---
export const getDocs = async (query, options) => {
  const snapshot = await fbGetDocs(query, options);
  if (options?.source !== 'cache') {
    dispatchOpEvent('read', 1 + (snapshot.docs.length || 0));
  }
  return snapshot;
};

export const getDoc = async (docRef, options) => {
  const snapshot = await fbGetDoc(docRef, options);
  if (options?.source !== 'cache' && snapshot.exists()) {
    dispatchOpEvent('read', 1);
  }
  return snapshot;
};

export const setDoc = async (docRef, data, options) => {
  await fbSetDoc(docRef, data, options);
  dispatchOpEvent('write', 1);
};

export const addDoc = async (collectionRef, data) => {
  const docRef = await fbAddDoc(collectionRef, data);
  dispatchOpEvent('write', 1);
  return docRef;
};

export const deleteDoc = async (docRef) => {
  await fbDeleteDoc(docRef);
  dispatchOpEvent('write', 1);
};

export const updateDoc = async (docRef, data) => {
  await fbUpdateDoc(docRef, { ...data }); 
  dispatchOpEvent('write', 1);
};

export const writeBatch = (firestore) => {
  const batch = fbWriteBatch(firestore);
  let writeCount = 0;
  const originalSet = batch.set;
  batch.set = (docRef, data, options) => {
    writeCount++;
    return originalSet.call(batch, docRef, data, options);
  };
  const originalUpdate = batch.update;
  batch.update = (docRef, data) => { 
    writeCount++;
    return originalUpdate.call(batch, docRef, data); 
  };
  const originalDelete = batch.delete;
  batch.delete = (docRef) => {
    writeCount++;
    return originalDelete.call(batch, docRef);
  };
  const originalCommit = batch.commit;
  batch.commit = async () => {
    await originalCommit.call(batch);
    dispatchOpEvent('write', writeCount); 
  };
  return batch;
};

async function getData(query, sourceOptions = {}) {
    try {
        const snapshot = await getDocs(query, sourceOptions); 
        return snapshot;
    } catch (e) {
        console.error(`getData query failed with options ${JSON.stringify(sourceOptions)}:`, e.message);
        throw e; 
    }
}

// --- STORAGE HELPERS ---
export async function uploadFile(file) {
    if (!file) return null;
    const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
    try {
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref);
    } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
    }
}

export async function deleteFile(fileUrl) {
    if (!fileUrl) return;
    try {
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
    } catch (error) {
       if (error.code !== 'storage/object-not-found') {
            console.error("Error deleting file:", error);
            throw error;
       }
    }
}

// --- FACILITY SNAPSHOTS & LISTING ---
export async function saveFacilitySnapshot(payload, externalBatch = null) {
    if (!payload.date_of_visit) {
        throw new Error("Cannot save a historical snapshot without a 'date_of_visit'.");
    }
    let visitDate;
    try {
        visitDate = new Date(payload.date_of_visit);
        if (isNaN(visitDate.getTime())) throw new Error(`Invalid date format.`);
    } catch (e) {
        throw new Error(`Failed to process date_of_visit ('${payload.date_of_visit}'). Reason: ${e.message}`);
    }

    const batch = externalBatch || writeBatch(db);
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
        const q = query(collection(db, "healthFacilities"), where("الولاية", "==", state), where("المحلية", "==", locality), where("اسم_المؤسسة", "==", facilityName));
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
    const snapshotData = { ...payload, facilityId, id: facilityId, snapshotCreatedAt: serverTimestamp(), effectiveDate: Timestamp.fromDate(visitDate) };
    delete snapshotData.submissionId;
    delete snapshotData.status;
    delete snapshotData.submittedAt;
    batch.set(snapshotRef, snapshotData);

    const mainFacilityData = { ...payload, id: facilityId, lastSnapshotAt: serverTimestamp() };
    if (isNewFacility) mainFacilityData.createdAt = serverTimestamp();
    delete mainFacilityData.submissionId;
    delete mainFacilityData.status;
    delete mainFacilityData.submittedAt;
    batch.set(facilityRef, mainFacilityData, { merge: true });

    if (!externalBatch) await batch.commit();
    return facilityId;
}

export async function upsertHealthFacility(payload) {
    if (!payload.date_of_visit) {
        payload.date_of_visit = new Date().toISOString().split('T')[0];
    }
    return await saveFacilitySnapshot(payload);
}

const isDataChanged = (newData, oldData) => {
    const keysToCompare = Object.keys(newData);
    for (const key of keysToCompare) {
        if (['id', 'lastSnapshotAt', 'createdAt', 'اخر تحديث', 'updated_by'].includes(key)) continue;
        if (JSON.stringify(newData[key]) !== JSON.stringify(oldData[key])) return true;
    }
    for (const key of Object.keys(oldData)) {
         if (['id', 'lastSnapshotAt', 'createdAt', 'اخر تحديث', 'updated_by'].includes(key)) continue;
         if (!(key in newData)) return true; 
    }
    return false;
};

export async function importHealthFacilities(facilities, originalRows, onProgress) {
    const errors = [];
    const successes = [];
    const failedRowsData = [];
    const BATCH_SIZE = 490;

    for (let i = 0; i < facilities.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = facilities.slice(i, i + BATCH_SIZE);
        const chunkOriginalRows = originalRows ? originalRows.slice(i, i + BATCH_SIZE) : null;

        for (let j = 0; j < chunk.length; j++) {
            const facilityData = chunk[j];
            const progressIndex = i + j;
            let existingDocSnap = null;
            let existingDocData = null;

            try {
                if (!facilityData.date_of_visit) throw new Error("Skipped due to missing 'Date of Visit'.");

                if (facilityData.id) {
                    const docRef = doc(db, "healthFacilities", facilityData.id);
                    existingDocSnap = await getDoc(docRef); 
                    if (existingDocSnap.exists()) {
                         existingDocData = existingDocSnap.data();
                    }
                } else {
                    const { "الولاية": state, "المحلية": locality, "اسم_المؤسسة": facilityName } = facilityData;
                    if (state && locality && facilityName) {
                        const q = query(collection(db, "healthFacilities"), where("الولاية", "==", state), where("المحلية", "==", locality), where("اسم_المؤسسة", "==", facilityName), limit(1));
                        const snapshot = await getDocs(q); 
                        if (!snapshot.empty) {
                             existingDocSnap = snapshot.docs[0];
                             existingDocData = existingDocSnap.data();
                        }
                    } else {
                         throw new Error("Missing State, Locality, or Name for new facility lookup.");
                    }
                }

                if (!existingDocSnap || !existingDocSnap.exists()) {
                    await saveFacilitySnapshot(facilityData, batch);
                    successes.push({ id: facilityData.id || 'new', action: 'created' });
                } else {
                    const payload = { ...existingDocData, ...facilityData, id: existingDocSnap.id };
                    if (isDataChanged(payload, existingDocData)) {
                        await saveFacilitySnapshot(payload, batch);
                        successes.push({ id: existingDocSnap.id, action: 'updated' });
                    } else {
                         successes.push({ id: existingDocSnap.id, action: 'skipped (no changes)' });
                    }
                }
            } catch (e) {
                const originalRowForError = chunkOriginalRows ? chunkOriginalRows[j] : null;
                const errorPayload = { message: e.message || 'Unknown error during import.', rowIndex: progressIndex, rowData: originalRowForError };
                errors.push(errorPayload);
                if (originalRowForError) failedRowsData.push(errorPayload);
            }
             if (onProgress) onProgress({ processed: progressIndex + 1, total: facilities.length });
        }
         try {
             await batch.commit(); 
         } catch(commitError) {
             console.error(`Batch commit failed starting at index ${i}:`, commitError);
             for (let k = 0; k < chunk.length; k++) {
                 const progressIndex = i + k;
                 const originalRowForError = chunkOriginalRows ? chunkOriginalRows[k] : null;
                 if (!errors.some(err => err.rowIndex === progressIndex)) {
                     const errorPayload = { message: `Batch commit failed: ${commitError.message}`, rowIndex: progressIndex, rowData: originalRowForError };
                     errors.push(errorPayload);
                      if (originalRowForError) failedRowsData.push(errorPayload);
                 }
             }
         }
    }
    return { successes, errors, failedRowsData };
}

export async function approveFacilitySubmission(submission, approverEmail) {
    const { submissionId, ...facilityData } = submission; 
    await saveFacilitySnapshot(facilityData); 
    const submissionRef = doc(db, "facilitySubmissions", submissionId);
    await updateDoc(submissionRef, { status: 'approved', approvedBy: approverEmail, approvedAt: serverTimestamp() });
}

/**
 * Fetches all health facilities for a specific locality.
 * Used for the Locality Bulk Update public view.
 */
export async function listFacilitiesByLocality(state, locality) {
    try {
        const q = query(
            collection(db, "healthFacilities"), 
            where("الولاية", "==", state), 
            where("المحلية", "==", locality)
        );
        const snapshot = await getDocs(q); // Uses the existing dispatchOpEvent tracking
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching facilities by locality:", error);
        throw error;
    }
}

/**
 * Submits a batch of facility updates for approval.
 */
export async function submitLocalityBatchUpdate(updates, localityName) {
    const batch = writeBatch(db); // Uses the tracked writeBatch wrapper
    const submissionDate = serverTimestamp();
    
    for (const update of updates) {
        const submissionData = {
            ...update,
            submittedAt: submissionDate,
            status: 'pending',
            updated_by: `Locality Bulk Update: ${localityName}`
        };
        const submissionRef = doc(collection(db, "facilitySubmissions"));
        batch.set(submissionRef, submissionData);
    }
    
    await batch.commit(); // Dispatches 'write' op events
    return true;
}


export async function listHealthFacilities(filters = {}) {
    let q = collection(db, "healthFacilities");
    const conditions = [];
    let orderByClause = orderBy("الولاية"); 

    if (filters.state && filters.state !== 'NOT_ASSIGNED') conditions.push(where("الولاية", "==", filters.state));
    if (filters.locality) {
        conditions.push(where("المحلية", "==", filters.locality));
        orderByClause = orderBy("اسم_المؤسسة");
    }
    if (filters.facilityType) conditions.push(where("نوع_المؤسسةالصحية", "==", filters.facilityType));
    if (filters.functioningStatus && filters.functioningStatus !== 'NOT_SET') conditions.push(where("هل_المؤسسة_تعمل", "==", filters.functioningStatus));
    if (filters.project) conditions.push(where("project_name", "==", filters.project));

    if (filters.lastUpdatedAfter instanceof Date) { 
        const timestamp = Timestamp.fromDate(filters.lastUpdatedAfter);
        conditions.push(where("lastSnapshotAt", ">", timestamp));
        orderByClause = orderBy("lastSnapshotAt");
    }

    if (conditions.length > 0) q = query(q, ...conditions);
    q = query(q, orderByClause);

    try {
        const sourceOptions = {};
        const querySnapshot = await getData(q, sourceOptions);
        let facilities = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (filters.state === 'NOT_ASSIGNED') facilities = facilities.filter(f => !f['الولاية']);
        if (filters.functioningStatus === 'NOT_SET') facilities = facilities.filter(f => f['هل_المؤسسة_تعمل'] == null || f['هل_المؤسسة_تعمل'] === '');

        return facilities;
    } catch (error) {
        console.error("Error fetching health facilities:", error);
        throw error;
    }
}

export async function getHealthFacilityById(facilityId) {
    const docRef = doc(db, "healthFacilities", facilityId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
    return null;
}
export async function deleteHealthFacility(facilityId) {
    await deleteDoc(doc(db, "healthFacilities", facilityId));
    return true;
}
export async function deleteFacilitiesBatch(facilityIds) {
    if (!facilityIds || facilityIds.length === 0) return 0;
    const BATCH_SIZE = 500;
    let deletedCount = 0;
    for (let i = 0; i < facilityIds.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = facilityIds.slice(i, i + BATCH_SIZE);
        chunk.forEach(id => batch.delete(doc(db, "healthFacilities", id)));
        await batch.commit();
        deletedCount += chunk.length;
    }
    return deletedCount;
}
export async function submitFacilityDataForApproval(payload, submitterIdentifier = 'Unknown User') {
    const { id, ...dataToSubmit } = payload; 
    const submissionData = {
         ...dataToSubmit,
         originalFacilityId: id || null, 
         submittedAt: serverTimestamp(),
         status: 'pending',
         updated_by: submitterIdentifier 
     };
     if (submissionData.id === undefined) delete submissionData.id;
    const newSubmissionRef = await addDoc(collection(db, "facilitySubmissions"), submissionData);
    return newSubmissionRef.id;
}
export async function listPendingFacilitySubmissions() {
    const q = query(collection(db, "facilitySubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ submissionId: doc.id, ...doc.data() }));
}
export async function rejectFacilitySubmission(submissionId, rejectorEmail) {
    await updateDoc(doc(db, "facilitySubmissions", submissionId), { status: 'rejected', rejectedBy: rejectorEmail, rejectedAt: serverTimestamp() });
}

export async function addHealthWorkerToFacility(facilityId, newWorkerData, mentorIdentifier = 'Unknown User') {
    if (!facilityId) throw new Error("Facility ID is required.");
    if (!newWorkerData || !newWorkerData.name) throw new Error("New worker data (at least name) is required.");

    const facility = await getHealthFacilityById(facilityId); 
    if (!facility) throw new Error(`Facility with ID ${facilityId} not found.`);

    const newWorker = {
        name: newWorkerData.name.trim(),
        job_title: newWorkerData.job_title || '',
        training_date: newWorkerData.training_date || '', 
        phone: newWorkerData.phone || '',
        is_trained: newWorkerData.training_date ? 'Yes' : 'No' 
    };

    let existingStaff = [];
    if (facility.imnci_staff) {
        try {
            existingStaff = typeof facility.imnci_staff === 'string'
                ? JSON.parse(facility.imnci_staff)
                : JSON.parse(JSON.stringify(facility.imnci_staff)); 
            if (!Array.isArray(existingStaff)) existingStaff = []; 
        } catch (e) {
            console.error("Error parsing existing imnci_staff, starting fresh list.", e);
            existingStaff = [];
        }
    }

    const staffIndex = existingStaff.findIndex(s =>
        s.name === newWorker.name || (s.phone && newWorker.phone && s.phone === newWorker.phone)
    );

    if (staffIndex !== -1) existingStaff[staffIndex] = newWorker;
    else existingStaff.push(newWorker);

    const payload = {
        ...facility, 
        id: facilityId, 
        imnci_staff: existingStaff, 
        date_of_visit: new Date().toISOString().split('T')[0], 
        updated_by: mentorIdentifier 
    };

    await saveFacilitySnapshot(payload);
    return true; 
}

// --- COURSES & PARTICIPANTS ---
export async function getCourseById(courseId, source = 'default') {
    const courseRef = doc(db, "courses", courseId);
    const sourceOptions = source === 'default' ? {} : { source };
    const courseSnap = await getDoc(courseRef, sourceOptions);
    if (!courseSnap.exists()) return null;
    return { id: courseSnap.id, ...courseSnap.data() };
}
export async function getParticipantById(participantId, source = 'default') {
    const participantRef = doc(db, "participants", participantId);
    const sourceOptions = source === 'default' ? {} : { source };
    const participantSnap = await getDoc(participantRef, sourceOptions);
    if (!participantSnap.exists()) return null;
    return { id: participantSnap.id, ...participantSnap.data() };
}
export async function getPublicCourseReportData(courseId) {
    const course = await getCourseById(courseId, 'server');
    if (!course) throw new Error("Report not found.");
    if (!course.isPublic) throw new Error("This report is not publicly accessible.");

    const [participants, { allObs, allCases }, finalReport] = await Promise.all([
        listAllParticipantsForCourse(courseId, { source: 'server' }), 
        listAllDataForCourse(courseId, { source: 'server' }),
        getFinalReportByCourseId(courseId, { source: 'server' })
    ]);

    return { course, participants, allObs, allCases, finalReport };
}

export async function listUsers(sourceOptions = {}) {
    try {
        const querySnapshot = await getDocs(collection(db, "users"), sourceOptions);
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                email: data.email || '',
                isAdmin: data.isAdmin || false,
                role: data.role || 'user', 
                permissions: data.permissions || {}, 
                assignedState: data.assignedState || '', 
                assignedLocalities: data.assignedLocalities || [], 
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
            access: { [module]: newAccess }
        }, { merge: true });
        return true;
    } catch (error) {
        console.error("Error updating user access:", error);
        throw error;
    }
}
export async function updateFacilitatorRole(facilitatorId, newRole) {
    if (!facilitatorId || !newRole) throw new Error("Facilitator ID and new role are required.");
    const facilitatorRef = doc(db, 'facilitators', facilitatorId);
    await updateDoc(facilitatorRef, { role: newRole });
}
export async function getFacilitatorByEmail(email) {
    if (!email) return null;
    try {
        const q = query(collection(db, "facilitators"), where("email", "==", email), limit(1));
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
export async function listFacilitators(sourceOptions = {}) {
    try {
        let q = collection(db, "facilitators");
        const querySnapshot = await getData(q, sourceOptions);
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
export async function getFacilitatorSubmissionByEmail(email) {
    if (!email) return null;
    try {
        const submissionsRef = collection(db, "facilitatorSubmissions");
        const q = query(submissionsRef, where("email", "==", email), orderBy("submittedAt", "desc"), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            return { id: docSnap.id, ...docSnap.data() };
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
export async function listPendingFacilitatorSubmissions(sourceOptions = {}) {
    const q = query(collection(db, "facilitatorSubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q, sourceOptions);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function approveFacilitatorSubmission(submission, approverEmail) {
    const { id: submissionId, status, submittedAt, ...facilitatorData } = submission;
    const batch = writeBatch(db);
    const newFacRef = doc(collection(db, "facilitators"));
    batch.set(newFacRef, facilitatorData);
    const submissionRef = doc(db, "facilitatorSubmissions", submissionId);
    batch.update(submissionRef, { status: 'approved', approvedBy: approverEmail, approvedAt: serverTimestamp() });
    await batch.commit();
}
export async function rejectFacilitatorSubmission(submissionId, rejectorEmail) {
    const submissionRef = doc(db, "facilitatorSubmissions", submissionId);
    await updateDoc(submissionRef, { status: 'rejected', rejectedBy: rejectorEmail, rejectedAt: serverTimestamp() });
}
export async function getFacilitatorApplicationSettings(sourceOptions = {}) {
    const settingsRef = doc(db, "settings", "facilitatorApplication");
    const docSnap = await getDoc(settingsRef, sourceOptions);
    if (docSnap.exists()) return docSnap.data();
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
export async function getCoordinatorApplicationSettings(sourceOptions = {}) {
    const docRef = doc(db, 'appSettings', 'coordinatorApplication');
    const docSnap = await getDoc(docRef, sourceOptions);
    if (docSnap.exists()) return docSnap.data();
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
    await addDoc(submissionsRef, { ...payload, status: 'pending', submittedAt: serverTimestamp() });
}
export async function listPendingCoordinatorSubmissions(sourceOptions = {}) {
    const q = query(collection(db, "coordinatorSubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q, sourceOptions);
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
    batch.update(submissionRef, { status: 'approved', approvedBy: approverEmail, approvedAt: serverTimestamp() });
    if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        batch.update(userDoc.ref, { role: 'states_manager', assignedState: submission.state });
    }
    await batch.commit();
}
export async function rejectCoordinatorSubmission(submissionId, rejectorEmail) {
    const submissionRef = doc(db, "coordinatorSubmissions", submissionId);
    await updateDoc(submissionRef, { status: 'rejected', rejectedBy: rejectorEmail, rejectedAt: serverTimestamp() });
}
export async function submitFederalApplication(payload) {
    const submissionsRef = collection(db, 'federalCoordinatorSubmissions');
    await addDoc(submissionsRef, { ...payload, status: 'pending', submittedAt: serverTimestamp() });
}
export async function listPendingFederalSubmissions(sourceOptions = {}) {
    const q = query(collection(db, "federalCoordinatorSubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q, sourceOptions);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function approveFederalSubmission(submission, approverEmail) {
    const { id: submissionId, status, submittedAt, ...coordinatorData } = submission; 
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
export async function listPendingLocalitySubmissions(sourceOptions = {}) {
    const q = query(collection(db, "localityCoordinatorSubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q, sourceOptions);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function approveLocalitySubmission(submission, approverEmail) {
    const { id: submissionId, status, submittedAt, ...coordinatorData } = submission; 
    const usersRef = collection(db, "users"); 
    const userQuery = query(usersRef, where("email", "==", submission.email)); 
    const userSnapshot = await getDocs(userQuery); 

    const batch = writeBatch(db);
    const newCoordinatorRef = doc(collection(db, "localityCoordinators"));
    batch.set(newCoordinatorRef, coordinatorData); 
    const submissionRef = doc(db, "localityCoordinatorSubmissions", submissionId);
    batch.update(submissionRef, { status: 'approved', approvedBy: approverEmail, approvedAt: serverTimestamp() });

    if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        batch.update(userDoc.ref, {
            role: 'locality_manager', 
            assignedState: submission.state, 
            assignedLocalities: [submission.locality] 
        });
    }
    await batch.commit();
}
export async function rejectLocalitySubmission(submissionId, rejectorEmail) {
    const submissionRef = doc(db, "localityCoordinatorSubmissions", submissionId);
    await updateDoc(submissionRef, { status: 'rejected', rejectedBy: rejectorEmail, rejectedAt: serverTimestamp() });
}
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
export async function listCoordinators(sourceOptions = {}) { 
    const q = query(collection(db, "coordinators"));
    const snapshot = await getData(q, sourceOptions);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function deleteCoordinator(coordinatorId) { 
    await deleteDoc(doc(db, "coordinators", coordinatorId));
    return true;
}
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
export async function listStateCoordinators(sourceOptions = {}) {
    const q = query(collection(db, "stateCoordinators"));
    const snapshot = await getData(q, sourceOptions);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function deleteStateCoordinator(coordinatorId) {
    await deleteDoc(doc(db, "stateCoordinators", coordinatorId));
    return true;
}
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
export async function listFederalCoordinators(sourceOptions = {}) {
    const q = query(collection(db, "federalCoordinators"));
    const snapshot = await getData(q, sourceOptions);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function deleteFederalCoordinator(coordinatorId) {
    await deleteDoc(doc(db, "federalCoordinators", coordinatorId));
    return true;
}
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
export async function listLocalityCoordinators(sourceOptions = {}) {
    const q = query(collection(db, "localityCoordinators"));
    const snapshot = await getData(q, sourceOptions);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function deleteLocalityCoordinator(coordinatorId) {
    await deleteDoc(doc(db, "localityCoordinators", coordinatorId));
    return true;
}
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
export async function listFunders(sourceOptions = {}) {
    const q = query(collection(db, "funders"));
    const snapshot = await getData(q, sourceOptions);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function deleteFunder(funderId) {
    await deleteDoc(doc(db, "funders", funderId));
    return true;
}
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
    if (!courseId) throw new Error("Course ID is required.");
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, {
        isPublic: settings.isPublic,
        sharedWith: settings.sharedWith
    });
}
export async function updateCoursePublicStatus(courseId, isPublic) {
    if (!courseId) throw new Error("Course ID is required.");
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, { isPublic: isPublic });
}
export async function listCoursesByType(course_type, userStates, sourceOptions = {}) {
    try {
        let conditions = [where("course_type", "==", course_type)];
        if (userStates && userStates.length > 0) {
            conditions.push(where("state", "in", userStates));
        }
         conditions.push(orderBy("start_date", "desc"));

        let q = query(collection(db, "courses"), ...conditions);

        const querySnapshot = await getData(q, sourceOptions);
        const courses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return courses;
    } catch (error) {
        console.error("Error in listCoursesByType:", error);
        throw error;
    }
}
export async function listAllCourses(sourceOptions = {}) {
    try {
        let q = query(collection(db, "courses"), orderBy("start_date", "desc"));
        const querySnapshot = await getData(q, sourceOptions);
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
    const finalReportQuery = query(collection(db, "finalReports"), where("courseId", "==", courseId));
    const finalReportSnap = await getDocs(finalReportQuery);
    finalReportSnap.forEach(d => batch.delete(d.ref));

    await batch.commit();
    return true;
}

// --- CERTIFICATE APPROVAL FUNCTIONS ---
export async function approveCourseCertificates(courseId, managerName, signatureUrl = null) {
    if (!courseId || !managerName) {
        throw new Error("Course ID and Manager Name are required.");
    }

    const courseRef = doc(db, "courses", courseId);
    const updateData = {
        isCertificateApproved: true,
        approvedByManagerName: managerName,
        certificateApprovedAt: serverTimestamp()
    };

    // Only set the signature URL if one was provided (or explicitly null to clear)
    if (signatureUrl !== undefined) {
        updateData.approvedByManagerSignatureUrl = signatureUrl;
    }

    await updateDoc(courseRef, updateData);
    
    return true;
}

export async function unapproveCourseCertificates(courseId) {
    if (!courseId) throw new Error("Course ID is required.");
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, {
        isCertificateApproved: false,
        approvedByManagerName: null, 
        approvedByManagerSignatureUrl: null, 
        certificateApprovedAt: null
    });
    return true;
}
// -------------------------------------

export async function upsertParticipant(payload) {
    if (payload.id) {
        const participantRef = doc(db, "participants", payload.id);
        if (payload.phone && payload.courseId) {
            const q = query(collection(db, "participants"), where("courseId", "==", payload.courseId), where("phone", "==", payload.phone), limit(1));
            const snapshot = await getDocs(q); 
            if (!snapshot.empty) {
                const existingDoc = snapshot.docs[0];
                if (existingDoc.id !== payload.id) throw new Error(`A participant with phone number '${payload.phone}' already exists in this course.`);
            }
        }
        await setDoc(participantRef, payload, { merge: true }); 
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        if (!dataToSave.phone || !dataToSave.courseId) throw new Error("Phone number and Course ID are required to check for duplicates.");
        const q = query(collection(db, "participants"), where("courseId", "==", dataToSave.courseId), where("phone", "==", dataToSave.phone), limit(1));
        const snapshot = await getDocs(q); 
        if (!snapshot.empty) throw new Error(`A participant with phone number '${dataToSave.phone}' already exists in this course.`);
        const newParticipantRef = await addDoc(collection(db, "participants"), dataToSave); 
        return newParticipantRef.id;
    }
}

export async function updateParticipantSharingSettings(participantId, settings) {
    if (!participantId) throw new Error("Participant ID is required.");
    const participantRef = doc(db, "participants", participantId);
    await updateDoc(participantRef, {
        isPublic: settings.isPublic,
        sharedWith: settings.sharedWith
    });
}

export async function importParticipants(participants) {
    if (!participants || participants.length === 0) return true; 
    const batch = writeBatch(db); 
    const phoneCourseSet = new Set(); 
    const courseId = participants[0]?.courseId;
    if (!courseId) throw new Error("Course ID not found on participants for import.");
    
    const existingParticipantsQuery = query(collection(db, "participants"), where("courseId", "==", courseId));
    const existingSnapshot = await getDocs(existingParticipantsQuery); 
    const existingPhones = new Map(existingSnapshot.docs.map(doc => {
        const data = doc.data();
        return data.phone ? [data.phone, doc.id] : [null, doc.id];
    }));

    for (const participant of participants) {
        if (!participant.phone) throw new Error(`Participant '${participant.name || 'N/A'}' is missing a phone number.`);
        const cleanPhone = String(participant.phone).trim();
        if (phoneCourseSet.has(cleanPhone)) throw new Error(`Duplicate phone number '${cleanPhone}' (for ${participant.name}) found within the import file.`);
        
        const existingDocId = existingPhones.get(cleanPhone);
        if (existingDocId) {
            if (participant.id && participant.id === existingDocId) {
                // Update correct participant
            } else if (participant.id) {
                throw new Error(`Phone number '${cleanPhone}' (for ${participant.name}) already belongs to another participant in this course.`);
            } else {
                throw new Error(`Participant '${participant.name}' has a phone number ('${cleanPhone}') that already exists in this course.`);
            }
        }
        phoneCourseSet.add(cleanPhone); 

        if (participant.id) {
            const participantRef = doc(db, "participants", participant.id);
            batch.update(participantRef, participant);
        } else {
            const participantRef = doc(collection(db, "participants"));
            batch.set(participantRef, participant);
        }
    }
    await batch.commit();
    return true;
}

export async function listParticipants(courseId, lastVisible = null, sourceOptions = {}) {
    if (!courseId) return { participants: [], lastVisible: null };
    const PAGE_SIZE = 50; 
    let q = query(collection(db, "participants"), where("courseId", "==", courseId), orderBy("name"), limit(PAGE_SIZE));
    if (lastVisible) q = query(q, startAfter(lastVisible));
    const documentSnapshots = await getDocs(q, sourceOptions);
    const participants = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const newLastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];
    return { participants, lastVisible: newLastVisible };
}

export async function listAllParticipants(sourceOptions = {}) {
    try {
        const q = collection(db, "participants");
        const querySnapshot = await getData(q, sourceOptions);
        const participants = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return participants;
    } catch (error) {
        console.error("Error in listAllParticipants:", error);
        throw error;
    }
}

export async function listAllParticipantsForCourse(courseId, sourceOptions = {}) {
    if (!courseId) return [];
    let allParticipants = [];
    let lastVisible = null;
    let hasMore = true;

    while(hasMore) {
        const result = await listParticipants(courseId, lastVisible, sourceOptions); 
        if (result.participants && result.participants.length > 0) {
            allParticipants = allParticipants.concat(result.participants);
        }
        lastVisible = result.lastVisible;
        if (!lastVisible) hasMore = false;
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
        const user = firebaseAuth.currentUser; 
        const submitter = user ? (user.displayName || user.email) : 'Participant Form';
        await submitFacilityDataForApproval(facilityUpdateData, submitter);
    }
    return participantId;
}

export async function bulkMigrateFromMappings(mappings, options = { dryRun: false }) {
    if (!mappings || mappings.length === 0) return { message: "No mappings provided." };

    const summary = {
        totalProcessed: mappings.length,
        submitted: 0,
        skipped: 0,
        errors: 0,
        errorDetails: [],
        previewPayloads: []
    };
    const currentUser = firebaseAuth.currentUser; 
    const submitterIdentifier = currentUser ? (currentUser.displayName || currentUser.email) : 'Bulk Migration'; 

    for (const mapping of mappings) {
        try {
            const { participantId, targetFacilityId, targetState, targetLocality, targetFacilityName } = mapping;

            if (!participantId || !targetFacilityId || !targetState || !targetLocality || !targetFacilityName) {
                summary.skipped++;
                summary.errorDetails.push(`Participant ID ${participantId || 'N/A'}: Skipped due to incomplete mapping data.`);
                continue;
            }

            if (options.dryRun) {
                 summary.previewPayloads.push({ participantId: participantId, targetFacilityId: targetFacilityId });
                continue;
            }

            const participant = await getParticipantById(participantId);
            if (!participant) throw new Error(`Participant with ID ${participantId} not found during live run.`);

            const [facility, course] = await Promise.all([
                getHealthFacilityById(targetFacilityId),
                getCourseById(participant.courseId)
            ]);
            if (!facility) throw new Error(`Target facility with ID ${targetFacilityId} not found.`);
            if (!course) throw new Error(`Course for participant ${participantId} not found.`);

            const participantUpdate = { state: targetState, locality: targetLocality, center_name: targetFacilityName };

            const participantAsStaff = {
                name: participant.name,
                job_title: participant.job_title,
                is_trained: 'Yes',
                training_date: course.start_date || '',
                phone: participant.phone || ''
            };
             let existingStaff = [];
             if (facility.imnci_staff) {
                 try {
                     existingStaff = typeof facility.imnci_staff === 'string' ? JSON.parse(facility.imnci_staff) : JSON.parse(JSON.stringify(facility.imnci_staff));
                     if (!Array.isArray(existingStaff)) existingStaff = []; 
                 } catch (e) {
                     console.error("Error parsing existing staff, starting fresh:", e);
                     existingStaff = [];
                 }
             }

            const staffIndex = existingStaff.findIndex(s => s.name === participant.name || (s.phone && participant.phone && s.phone === participant.phone));
            if (staffIndex !== -1) existingStaff[staffIndex] = participantAsStaff;
            else existingStaff.push(participantAsStaff);
             const numTrained = existingStaff.filter(s => s.is_trained === 'Yes').length;

            const facilityUpdatePayload = {
                ...facility, 
                id: targetFacilityId, 
                imnci_staff: existingStaff,
                "وجود_العلاج_المتكامل_لامراض_الطفولة": 'Yes',
                "وجود_كتيب_لوحات": 'Yes',
                "وجود_سجل_علاج_متكامل": 'Yes',
                "date_of_visit": new Date().toISOString().split('T')[0], 
                "updated_by": `Migrated from Participant ${participantId}`,
                'growth_monitoring_service_exists': participant.has_growth_monitoring ? 'Yes' : (facility.growth_monitoring_service_exists || 'No'),
                nutrition_center_exists: participant.has_nutrition_service ? 'Yes' : (facility.nutrition_center_exists || 'No'),
                nearest_nutrition_center: participant.nearest_nutrition_center || facility.nearest_nutrition_center || '',
                immunization_office_exists: participant.has_immunization_service ? 'Yes' : (facility.immunization_office_exists || 'No'),
                nearest_immunization_center: participant.nearest_immunization_center || facility.nearest_immunization_center || '',
                'غرفة_إرواء': participant.has_ors_room ? 'Yes' : (facility['غرفة_إرواء'] || 'No'),
                'العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين': participant.num_other_providers ?? (facility['العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين'] ?? existingStaff.length),
                'العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل': participant.num_other_providers_imci ?? (facility['العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل'] ?? numTrained),
            };

            await upsertParticipant({ id: participantId, ...participantUpdate }); 
            await submitFacilityDataForApproval(facilityUpdatePayload, submitterIdentifier); 
            summary.submitted++;

        } catch (error) {
            console.error(`Error migrating participant ${mapping.participantId}:`, error);
            summary.errors++;
            summary.errorDetails.push(`Participant ID ${mapping.participantId}: ${error.message}`);
        }
    }
    return summary;
}

export async function listObservationsForParticipant(courseId, participantId, sourceOptions = {}) {
    const q = query(collection(db, "observations"), where("courseId", "==", courseId), where("participant_id", "==", participantId));
    const snapshot = await getDocs(q, sourceOptions);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function listCasesForParticipant(courseId, participantId, sourceOptions = {}) {
    const q = query(collection(db, "cases"), where("courseId", "==", courseId), where("participant_id", "==", participantId));
    const snapshot = await getDocs(q, sourceOptions);
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

    const savedCase = { ...caseData, id: caseId };
    batch.set(caseRef, savedCase); 

    const savedObservations = [];
    observations.forEach(obs => {
        const obsRef = doc(collection(db, "observations")); 
        const finalObs = { ...obs, id: obsRef.id, caseId: caseId }; 
        batch.set(obsRef, finalObs); 
        savedObservations.push(finalObs); 
    });

    await batch.commit(); 
    return { savedCase, savedObservations };
}

export async function deleteCaseAndObservations(caseId) {
    const batch = writeBatch(db);
    batch.delete(doc(db, "cases", caseId));
    const q = query(collection(db, "observations"), where("caseId", "==", caseId));
    const snapshot = await getDocs(q); 
    snapshot.forEach(d => batch.delete(d.ref));
    await batch.commit(); 
}
export async function listAllDataForCourse(courseId, sourceOptions = {}) {
    const obsQuery = query(collection(db, "observations"), where("courseId", "==", courseId));
    const casesQuery = query(collection(db, "cases"), where("courseId", "==", courseId));

    const [obsSnap, casesSnap] = await Promise.all([
        getDocs(obsQuery, sourceOptions), 
        getDocs(casesQuery, sourceOptions) 
    ]);

    const allObs = obsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allCases = casesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const allCasesWithCorrectness = allCases.map(caseItem => {
        const caseObservations = allObs.filter(obs => obs.caseId === caseItem.id);
        const is_correct = caseObservations.length > 0 && caseObservations.every(obs => Number(obs.item_correct) > 0);
        return { ...caseItem, is_correct };
    });

    return { allObs, allCases: allCasesWithCorrectness };
}
export async function upsertFinalReport(payload) {
    if (payload.id) {
        const finalReportRef = doc(db, "finalReports", payload.id);
        await setDoc(finalReportRef, payload, { merge: true });
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newRef = await addDoc(collection(db, "finalReports"), dataToSave);
        return newRef.id;
    }
}
export async function getFinalReportByCourseId(courseId, sourceOptions = {}) {
    if (!courseId) return null;
    const q = query(collection(db, "finalReports"), where("courseId", "==", courseId));
    const snapshot = await getDocs(q, sourceOptions);
    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }
    return null;
}
export async function listFinalReport(sourceOptions = {}) {
    try {
        const querySnapshot = await getDocs(collection(db, "finalReports"), sourceOptions);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching final reports:", error);
        throw error;
    }
}
export async function deleteFinalReport(reportId) {
    try {
        if (!reportId) throw new Error("Report ID is required to delete a final report.");
        await deleteDoc(doc(db, "finalReports", reportId));
        return true;
    } catch (error) {
        console.error("Error deleting final report:", error);
        throw error;
    }
}

export async function saveMentorshipSession(payload, sessionId = null, externalBatch = null) {
    try {
        const sessionData = {
            ...payload,
            ...( !sessionId ? { createdAt: serverTimestamp() } : { lastUpdatedAt: serverTimestamp() } ),
        };
        const docRef = sessionId ? doc(db, "skillMentorship", sessionId) : doc(collection(db, "skillMentorship")); 
        if (externalBatch) {
            externalBatch.set(docRef, sessionData, { merge: !!sessionId }); 
            return docRef.id; 
        } else {
            await setDoc(docRef, sessionData, { merge: !!sessionId });
            return docRef.id;
        }
    } catch (error) {
        console.error("Error saving mentorship session:", error);
        throw error;
    }
}

export async function listMentorshipSessions(sourceOptions = {}) {
    try {
        const q = query(collection(db, "skillMentorship"), orderBy("effectiveDate", "desc"));
        const snapshot = await getData(q, sourceOptions);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching mentorship sessions:", error);
        throw error;
    }
}

export async function importMentorshipSessions(sessions, originalRows, onProgress) {
    const errors = [];
    const successes = [];
    const failedRowsData = [];
    const BATCH_SIZE = 490; 

    for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
        const batch = writeBatch(db); 
        const chunk = sessions.slice(i, i + BATCH_SIZE);
        const chunkOriginalRows = originalRows ? originalRows.slice(i, i + BATCH_SIZE) : null;

        for (let j = 0; j < chunk.length; j++) {
            const sessionData = chunk[j];
            const progressIndex = i + j;
            try {
                if (!sessionData.effectiveDate || !(sessionData.effectiveDate instanceof Timestamp)) throw new Error("Invalid or missing 'session_date'. Expected YYYY-MM-DD.");
                 if (!sessionData.facilityId) throw new Error(`Facility '${sessionData.facilityName}' in ${sessionData.locality}, ${sessionData.state} not found.`);
                 if (!sessionData.state || !sessionData.locality) throw new Error("Missing State or Locality Key.");
                 if (!sessionData.healthWorkerName) throw new Error("Missing Health Worker Name.");

                await saveMentorshipSession(sessionData, null, batch);
                successes.push({ rowIndex: progressIndex }); 

            } catch (e) {
                const originalRowForError = chunkOriginalRows ? chunkOriginalRows[j] : null;
                const errorPayload = { message: e.message || 'Unknown import error.', rowIndex: progressIndex, rowData: originalRowForError };
                errors.push(errorPayload);
                if (originalRowForError) failedRowsData.push(errorPayload);
            }
            if (onProgress) onProgress({ processed: progressIndex + 1, total: sessions.length });
        }

        try {
            await batch.commit(); 
        } catch (commitError) {
             console.error(`Batch commit failed starting at index ${i}:`, commitError);
             for (let k = 0; k < chunk.length; k++) {
                 const progressIndex = i + k;
                 if (!errors.some(err => err.rowIndex === progressIndex)) {
                     const originalRowForError = chunkOriginalRows ? chunkOriginalRows[k] : null;
                     const errorPayload = { message: `Batch commit failed: ${commitError.message}`, rowIndex: progressIndex, rowData: originalRowForError };
                     errors.push(errorPayload);
                      if (originalRowForError && !failedRowsData.some(fr => fr.rowIndex === progressIndex)) failedRowsData.push(errorPayload);
                 }
             }
        }
    }
    return { successes, errors, failedRowsData };
}

export async function deleteMentorshipSession(sessionId) {
    if (!sessionId) throw new Error("Session ID is required to delete.");
    const sessionRef = doc(db, "skillMentorship", sessionId);
    await deleteDoc(sessionRef); 
    return true;
}

export async function saveIMNCIVisitReport(payload, reportId = null) {
    try {
        const sessionData = {
            ...payload,
            ...( !reportId ? { createdAt: serverTimestamp() } : { lastUpdatedAt: serverTimestamp() } ),
        };
        const docRef = reportId ? doc(db, "imnciVisitReports", reportId) : doc(collection(db, "imnciVisitReports")); 
        await setDoc(docRef, sessionData, { merge: !!reportId });
        return docRef.id;
    } catch (error) {
        console.error("Error saving IMNCI visit report:", error);
        throw error;
    }
}

export async function listIMNCIVisitReports(sourceOptions = {}) {
    try {
        const q = query(collection(db, "imnciVisitReports"), orderBy("visit_date", "desc"));
        const snapshot = await getData(q, sourceOptions);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching IMNCI visit reports:", error);
        throw error;
    }
}

export async function deleteIMNCIVisitReport(reportId) {
    if (!reportId) throw new Error("Report ID is required to delete.");
    const sessionRef = doc(db, "imnciVisitReports", reportId);
    await deleteDoc(sessionRef); 
    return true;
}

export async function saveEENCVisitReport(payload, reportId = null) {
    try {
        const sessionData = {
            ...payload,
            ...( !reportId ? { createdAt: serverTimestamp() } : { lastUpdatedAt: serverTimestamp() } ),
        };
        const docRef = reportId ? doc(db, "eencVisitReports", reportId) : doc(collection(db, "eencVisitReports")); 
        await setDoc(docRef, sessionData, { merge: !!reportId });
        return docRef.id;
    } catch (error) {
        console.error("Error saving EENC visit report:", error);
        throw error;
    }
}

export async function listEENCVisitReports(sourceOptions = {}) {
    try {
        const q = query(collection(db, "eencVisitReports"), orderBy("visit_date", "desc"));
        const snapshot = await getData(q, sourceOptions);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching EENC visit reports:", error);
        throw error;
    }
}

export async function deleteEENCVisitReport(reportId) {
    if (!reportId) throw new Error("Report ID is required to delete.");
    const sessionRef = doc(db, "eencVisitReports", reportId);
    await deleteDoc(sessionRef); 
    return true;
}

async function getFacilitatorById(facilitatorId, sourceOptions = {}) {
    if (!facilitatorId) return null;
    const docRef = doc(db, "facilitators", facilitatorId);
    const docSnap = await getDoc(docRef, sourceOptions);
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
    return null;
}

export async function getPublicFacilitatorReportData(facilitatorId) {
    const sourceOptions = { source: 'server' }; 
    const facilitator = await getFacilitatorById(facilitatorId, sourceOptions);
    if (!facilitator) throw new Error("Facilitator report not found.");
    const courses = await listAllCourses(sourceOptions);
    return { facilitator, allCourses: courses || [] };
}

async function getStateCoordinatorById(id, sourceOptions = {}) {
    if (!id) return null;
    const docRef = doc(db, "stateCoordinators", id);
    const docSnap = await getDoc(docRef, sourceOptions);
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
    return null;
}

async function getFederalCoordinatorById(id, sourceOptions = {}) {
    if (!id) return null;
    const docRef = doc(db, "federalCoordinators", id);
    const docSnap = await getDoc(docRef, sourceOptions);
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
    return null;
}

async function getLocalityCoordinatorById(id, sourceOptions = {}) {
    if (!id) return null;
    const docRef = doc(db, "localityCoordinators", id);
    const docSnap = await getDoc(docRef, sourceOptions);
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
    return null;
}

export async function getPublicTeamMemberProfileData(level, memberId) {
    const sourceOptions = { source: 'server' }; 
    let member = null;
    try {
        if (level === 'federal') member = await getFederalCoordinatorById(memberId, sourceOptions);
        else if (level === 'state') member = await getStateCoordinatorById(memberId, sourceOptions);
        else if (level === 'locality') member = await getLocalityCoordinatorById(memberId, sourceOptions);
        else throw new Error("Invalid team member level.");

        if (!member) throw new Error("Team member profile not found.");
        return { member, level };
    } catch (error) {
        console.error("Error fetching public team member data:", error);
        throw error;
    }
}

export async function upsertParticipantTest(payload) {
    const { participantId, testType, percentage } = payload;
    if (!participantId || !testType) throw new Error("Participant ID and Test Type are required.");
    const scoreFieldToUpdate = testType === 'pre-test' ? 'pre_test_score' : 'post_test_score';
    const participantRef = doc(db, "participants", participantId);
    const testRecordId = `${participantId}_${testType}`;
    const testRecordRef = doc(db, "participantTests", testRecordId);
    const batch = writeBatch(db); 
    batch.update(participantRef, { [scoreFieldToUpdate]: percentage });
    batch.set(testRecordRef, payload);
    await batch.commit();
}

export async function listParticipantTestsForCourse(courseId, sourceOptions = {}) {
    if (!courseId) return [];
    try {
        const q = query(collection(db, "participantTests"), where("courseId", "==", courseId));
        const snapshot = await getData(q, sourceOptions);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
        console.error("Error fetching participant tests for course:", error);
        throw error;
    }
}

export async function deleteParticipantTest(courseId, participantId, testType) {
    if (!participantId || !testType) throw new Error("Participant ID and Test Type are required.");
    const testRecordId = `${participantId}_${testType}`;
    const testRecordRef = doc(db, "participantTests", testRecordId);
    const participantRef = doc(db, "participants", participantId);
    const scoreFieldToReset = testType === 'pre-test' ? 'pre_test_score' : 'post_test_score';
    const batch = writeBatch(db);
    batch.delete(testRecordRef);
    batch.update(participantRef, { [scoreFieldToReset]: deleteField() });
    await batch.commit();
}

export const queueCertificateEmail = async (participant, link, language) => {
    if (!participant.email) return { success: false, error: "No email address found for participant." };

    const subject = language === 'ar' 
        ? `شهادة إكمال الدورة - ${participant.name}`
        : `Course Completion Certificate - ${participant.name}`;

    const body = language === 'ar' 
        ? `<p>عزيزي/عزيزتي <strong>${participant.name}</strong>،</p>
           <p>تهانينا على إكمال الدورة التدريبية.</p>
           <p>يمكنك تحميل شهادتك مباشرة من الرابط أدناه:</p>
           <p><a href="${link}">اضغط هنا لتحميل الشهادة</a></p>
           <br/>
           <p>البرنامج القومي لصحة الطفل</p>`
        : `<p>Dear <strong>${participant.name}</strong>,</p>
           <p>Congratulations on completing the training course.</p>
           <p>You can download your certificate directly from the link below:</p>
           <p><a href="${link}">Click here to download certificate</a></p>
           <br/>
           <p>National Child Health Program</p>`;

    try {
        await addDoc(collection(db, 'mail'), {
            to: participant.email,
            message: {
                subject: subject,
                html: body
            }
        });
        return { success: true };
    } catch (error) {
        console.error("Error queuing email:", error);
        return { success: false, error: error.message };
    }
};