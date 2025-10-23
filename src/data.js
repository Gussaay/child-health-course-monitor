// data.js
import { db, auth as firebaseAuth } from './firebase'; // Import auth
import {
    collection,
    query,
    where,
    // --- MODIFICATION: Import Firebase functions with 'fb' prefix ---
    getDocs as fbGetDocs,
    doc,
    setDoc as fbSetDoc,
    addDoc as fbAddDoc,
    deleteDoc as fbDeleteDoc,
    writeBatch as fbWriteBatch,
    updateDoc as fbUpdateDoc,
    getDoc as fbGetDoc,
    increment, // Import increment
    // --- END MODIFICATION ---
    serverTimestamp,
    // increment, // Already imported above
    orderBy,
    limit,
    Timestamp,
    startAfter
} from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth'; // Import onAuthStateChanged
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// --- NEW: Usage Tracking Variables ---
let currentUser = null;
let sessionReads = 0;
let sessionWrites = 0;
let lastDbUpdateTime = 0; // Still used for debouncing op counts
const UPDATE_INTERVAL = 30000; // Update Firestore every 30 seconds
const UPDATE_THRESHOLD = 15; // Or update every 15 operations
let updateTimeout = null; // To debounce updates

// --- MODIFIED: Duration Tracking Variables ---
// --- REMOVED lastActivityTime dependency for duration ---
let localSessionDurationMs = 0; // In-memory counter for the current session
let durationIntervalId = null; // Timer for the local counter
// --- REMOVED ACTIVITY_TIMEOUT_MS ---
const DURATION_TICK_MS = 60 * 1000; // Update local duration every 1 minute
const LOCAL_STORAGE_KEY_DURATION = 'unsyncedAppDuration'; // Key for browser storage

// --- NEW: Function to sync duration to Firestore (uses RAW functions) ---
const syncDurationToDb = (durationMs, userId) => {
    if (!userId || !durationMs || durationMs <= 0) {
        return; // Nothing to sync
    }

    const userUsageRef = doc(db, 'userUsageStats', userId);
    // Use fbSetDoc directly to avoid recursive counting
    fbSetDoc(userUsageRef, {
        totalActiveDurationMs: increment(durationMs),
        lastUpdated: serverTimestamp() // Update lastUpdated when syncing duration too
    }, { merge: true })
    .then(() => {
        console.log(`Synced ${durationMs}ms of active time for user ${userId}.`);
    })
    .catch(error => {
        console.error("Failed to update active duration:", error);
    });
};

// --- MODIFIED: Function to update the local (in-memory) duration counter ---
const tickLocalDuration = () => {
    // If the user logs out, the interval is cleared by onAuthStateChanged
    if (!currentUser) {
        if (durationIntervalId) clearInterval(durationIntervalId);
        durationIntervalId = null;
        return;
    }

    // --- REMOVED inactivity check ---
    // Always increment the local counter as long as the interval is running
    localSessionDurationMs += DURATION_TICK_MS;
};

// --- NEW: Function to save duration to localStorage on browser close/refresh ---
// (Unchanged from previous version)
const saveDurationToLocalStorage = () => {
    if (localSessionDurationMs > 0) {
        // Add our current in-memory time to any time that might already be in storage
        const existingUnsyncedMs = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY_DURATION) || '0', 10);
        const totalUnsyncedMs = existingUnsyncedMs + localSessionDurationMs;
        
        localStorage.setItem(LOCAL_STORAGE_KEY_DURATION, totalUnsyncedMs.toString());
        
        // Reset in-memory counter to prevent double-counting if logout also fires
        localSessionDurationMs = 0; 
    }
};

// --- MODIFIED: Initialize Usage Tracking ---
export const initializeUsageTracking = () => {
  onAuthStateChanged(firebaseAuth, (user) => {
    // --- This block runs on LOGOUT ---
    if (!user) {
        // 1. Stop all timers
        if (durationIntervalId) clearInterval(durationIntervalId); // Stop duration timer
        durationIntervalId = null;
        if (updateTimeout) clearTimeout(updateTimeout); // Stop op count timer
        updateTimeout = null;

        // 2. Remove the "browser close" listener
        window.removeEventListener('beforeunload', saveDurationToLocalStorage);

        // 3. Sync any remaining duration from this session (this is the "Sign Out" event)
        // We check 'currentUser' because it still holds the user data from *before* logout
        if (currentUser && localSessionDurationMs > 0) {
            syncDurationToDb(localSessionDurationMs, currentUser.uid);
        }

        // 4. Clear all local state
        currentUser = null;
        localSessionDurationMs = 0;
        sessionReads = 0;
        sessionWrites = 0;
        
        // 5. Clear localStorage just in case (logout is a clean exit)
        localStorage.removeItem(LOCAL_STORAGE_KEY_DURATION);

        return;
    }

    // --- This block runs on LOGIN ---
    if (user && !currentUser) { // Check !currentUser to run only once on login
        currentUser = { uid: user.uid, email: user.email };
        
        // 1. Sync any duration left over from a previous *crashed* session
        const unsyncedMs = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY_DURATION) || '0', 10);
        if (unsyncedMs > 0) {
            syncDurationToDb(unsyncedMs, currentUser.uid);
            localStorage.removeItem(LOCAL_STORAGE_KEY_DURATION); // Clear it after syncing
        }

        // 2. Reset all local counters for the new session
        localSessionDurationMs = 0;
        sessionReads = 0;
        sessionWrites = 0;
        lastDbUpdateTime = Date.now(); // Reset op count timer base
        // --- lastActivityTime is no longer needed for duration ---

        // 3. Start the local duration timer (runs every minute unconditionally)
        durationIntervalId = setInterval(tickLocalDuration, DURATION_TICK_MS);

        // 4. Add the "browser close" listener
        window.addEventListener('beforeunload', saveDurationToLocalStorage);
    }
  });
};


// --- NEW: Function to update Firestore (uses RAW functions) ---
// (Unchanged from previous version - only handles op counts)
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
        lastUpdated: serverTimestamp() // Op counts update lastUpdated
    }, { merge: true })
    .catch(error => {
        console.error("Failed to update usage stats:", error);
    });
};


// --- MODIFIED: Global event dispatcher & usage tracker ---
const dispatchOpEvent = (type, count = 1) => {
  if (count > 0 && currentUser) { // Added currentUser check
    // --- REMOVED: No need to update lastActivityTime for duration ---
    // --- REMOVED: No need to restart duration timer ---

    // 1. Dispatch browser event for real-time UI update (ResourceMonitor)
    window.dispatchEvent(new CustomEvent('firestoreOperation', { detail: { type, count } }));

    // 2. Update local session counts for reads/writes
    if (type === 'read') {
      sessionReads += count;
    } else {
      sessionWrites += count;
    }

    // 3. Check if we need to schedule a Firestore update (for op-counting only)
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
        // Calculate remaining time carefully
        const remainingTime = UPDATE_INTERVAL - timeSinceLastUpdate;
        updateTimeout = setTimeout(updateUsageStatsInDb, remainingTime > 0 ? remainingTime : 0);
    }
  }
};

// --- Wrapped Firestore functions (Unchanged from previous version) ---
// ... (rest of the file remains the same) ...

export const getDocs = async (query, options) => {
  const snapshot = await fbGetDocs(query, options);
  if (options?.source !== 'cache') {
    // Count 1 read for the query + 1 per doc
    dispatchOpEvent('read', 1 + (snapshot.docs.length || 0));
  }
  return snapshot;
};

export const getDoc = async (docRef, options) => {
    // Use the raw fbGetDoc to check existence without counting
    const preliminarySnap = await fbGetDoc(docRef, { source: 'cache' });
    let exists = preliminarySnap.exists(); // Check cache first

    if (!exists && options?.source !== 'cache') {
        // If not in cache and fetching from server, check server existence (raw)
         const serverSnap = await fbGetDoc(docRef, { source: 'server' });
         exists = serverSnap.exists();
    }

    // Only dispatch read event if the document actually exists and it wasn't a cache hit
    if (exists && options?.source !== 'cache') {
        dispatchOpEvent('read', 1);
        // Return the server snapshot if we fetched it, otherwise fetch properly if needed
        if (preliminarySnap.exists() && options?.source !== 'server') {
             return await fbGetDoc(docRef, options); // Fetch with original options if cached
        } else {
            const serverSnap = await fbGetDoc(docRef, { source: 'server' }); // Ensure we return data if server was checked
            return serverSnap;
        }

    } else if (preliminarySnap.exists()) {
        // It existed in cache, return the cached snapshot or refetch if options differ
         return await fbGetDoc(docRef, options);
    } else {
        // Document doesn't exist, return the non-existent snapshot (no read counted)
        if (options?.source === 'cache'){
             return preliminarySnap; // Return cache miss snapshot
        } else {
             return await fbGetDoc(docRef, { source: 'server'}); // Return server miss snapshot
        }
    }
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
  await fbUpdateDoc(docRef, { ...data }); // Use spread operator
  dispatchOpEvent('write', 1);

};

export const writeBatch = (firestore) => {
  const batch = fbWriteBatch(firestore);
  let writeCount = 0;

  // Wrap batch methods
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

  // Wrap commit
  const originalCommit = batch.commit;
  batch.commit = async () => {
    await originalCommit.call(batch);
    dispatchOpEvent('write', writeCount); // Dispatch total count AFTER commit succeeds
  };

  return batch;
};
// --- END WRAPPED FUNCTIONS ---


// getData uses wrapped getDocs
async function getData(query) {
    try {
        const snapshot = await getDocs(query, { source: 'cache' });
        if (!snapshot.empty) {
            return snapshot;
        }
    } catch (e) {
        console.log("Cache miss or error, fetching from server.");
    }
    return getDocs(query, { source: 'server' });
}

// uploadFile and deleteFile don't interact with Firestore directly
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
    const fileRef = ref(storage, fileUrl);
    try {
        await deleteObject(fileRef);
    } catch (error) {
        console.error("Error deleting file:", error);
        throw error;
    }
}


// All following functions use the wrapped Firestore functions implicitly
// ... (rest of the functions remain unchanged) ...
export async function saveFacilitySnapshot(payload, externalBatch = null) {
    if (!payload.date_of_visit) {
        throw new Error("Cannot save a historical snapshot without a 'date_of_visit'.");
    }

    let visitDate;
    try {
        visitDate = new Date(payload.date_of_visit);
        if (isNaN(visitDate.getTime())) {
            throw new Error(`Invalid date format.`);
        }
    } catch (e) {
        throw new Error(`Failed to process date_of_visit ('${payload.date_of_visit}'). Reason: ${e.message}`);
    }

    const batch = externalBatch || writeBatch(db); // Uses our wrapped writeBatch
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
        const querySnapshot = await getDocs(q); // Uses our wrapped getDocs
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

    if (!externalBatch) await batch.commit(); // This will trigger the op count
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
    return false;
};
export async function importHealthFacilities(facilities, onProgress, originalRows) {
    const errors = [];
    let createdCount = 0;
    let updatedCount = 0;
    const BATCH_SIZE = 490;

    for (let i = 0; i < facilities.length; i += BATCH_SIZE) {
        const batch = writeBatch(db); // Uses wrapped writeBatch
        const chunk = facilities.slice(i, i + BATCH_SIZE);

        for (let j = 0; j < chunk.length; j++) {
            const facilityData = chunk[j];
            const progressIndex = i + j;
            try {
                if (!facilityData.date_of_visit) throw new Error("Skipped due to missing 'Date of Visit'.");

                let existingDoc = null;
                if (facilityData.id) {
                    existingDoc = await getDoc(doc(db, "healthFacilities", facilityData.id)); // Uses wrapped getDoc
                } else {
                    const { "الولاية": state, "المحلية": locality, "اسم_المؤسسة": facilityName } = facilityData;
                    if (state && locality && facilityName) {
                        const q = query(collection(db, "healthFacilities"), where("الولاية", "==", state), where("المحلية", "==", locality), where("اسم_المؤسسة", "==", facilityName), limit(1));
                        const snapshot = await getDocs(q); // Uses wrapped getDocs
                        if (!snapshot.empty) existingDoc = snapshot.docs[0];
                    }
                }

                if (!existingDoc || !existingDoc.exists()) {
                    await saveFacilitySnapshot(facilityData, batch);
                    createdCount++;
                } else {
                    if (isDataChanged(facilityData, existingDoc.data())) {
                        const payload = { ...existingDoc.data(), ...facilityData, id: existingDoc.id };
                        await saveFacilitySnapshot(payload, batch);
                        updatedCount++;
                    }
                }
            } catch (e) {
                const originalRowForError = originalRows ? originalRows[progressIndex] : null;
                errors.push({ message: e.message, rowIndex: progressIndex, rowData: originalRowForError });
            }
            if (onProgress) onProgress(progressIndex + 1, errors.length > 0 ? errors[errors.length - 1] : null);
        }
        await batch.commit(); // Triggers op count
    }
    return { created: createdCount, updated: updatedCount, errors };
}
export async function approveFacilitySubmission(submission, approverEmail) {
    await saveFacilitySnapshot(submission);
    const submissionRef = doc(db, "facilitySubmissions", submission.submissionId);
    await updateDoc(submissionRef, { status: 'approved', approvedBy: approverEmail, approvedAt: serverTimestamp() }); // Uses wrapped updateDoc
}
export async function listHealthFacilities(filters = {}) {
    let q = collection(db, "healthFacilities");
    const conditions = [];

    if (filters.state && filters.state !== 'NOT_ASSIGNED') conditions.push(where("الولاية", "==", filters.state));
    if (filters.locality) conditions.push(where("المحلية", "==", filters.locality));
    if (filters.facilityType) conditions.push(where("نوع_المؤسسةالصحية", "==", filters.facilityType));
    if (filters.functioningStatus && filters.functioningStatus !== 'NOT_SET') conditions.push(where("هل_المؤسسة_تعمل", "==", filters.functioningStatus));
    if (filters.project) conditions.push(where("project_name", "==", filters.project));

    if (conditions.length > 0) q = query(q, ...conditions);

    try {
        const querySnapshot = await getData(q); // Uses our wrapped getData
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
    const docSnap = await getDoc(docRef); // Uses wrapped getDoc
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
    return null;
}
export async function deleteHealthFacility(facilityId) {
    await deleteDoc(doc(db, "healthFacilities", facilityId)); // Uses wrapped deleteDoc
    return true;
}
export async function deleteFacilitiesBatch(facilityIds) {
    if (!facilityIds || facilityIds.length === 0) return 0;
    const BATCH_SIZE = 500;
    let deletedCount = 0;
    for (let i = 0; i < facilityIds.length; i += BATCH_SIZE) {
        const batch = writeBatch(db); // Uses wrapped writeBatch
        const chunk = facilityIds.slice(i, i + BATCH_SIZE);
        chunk.forEach(id => batch.delete(doc(db, "healthFacilities", id)));
        await batch.commit(); // Triggers op count
        deletedCount += chunk.length;
    }
    return deletedCount;
}
export async function submitFacilityDataForApproval(payload) {
    const submissionData = { ...payload, submittedAt: serverTimestamp(), status: 'pending' };
    if (submissionData.id === undefined) {
        delete submissionData.id;
    }
    const newSubmissionRef = await addDoc(collection(db, "facilitySubmissions"), submissionData); // Uses wrapped addDoc
    return newSubmissionRef.id;
}
export async function listPendingFacilitySubmissions() {
    const q = query(collection(db, "facilitySubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q); // Uses wrapped getDocs
    return snapshot.docs.map(doc => ({ submissionId: doc.id, ...doc.data() }));
}
export async function rejectFacilitySubmission(submissionId, rejectorEmail) {
    await updateDoc(doc(db, "facilitySubmissions", submissionId), { status: 'rejected', rejectedBy: rejectorEmail, rejectedAt: serverTimestamp() }); // Uses wrapped updateDoc
}
export async function getCourseById(courseId, source = 'default') {
    const courseRef = doc(db, "courses", courseId);
    const courseSnap = await getDoc(courseRef, { source }); // Uses wrapped getDoc
    if (!courseSnap.exists()) {
        return null;
    }
    return { id: courseSnap.id, ...courseSnap.data() };
}
export async function getParticipantById(participantId, source = 'default') {
    const participantRef = doc(db, "participants", participantId);
    const participantSnap = await getDoc(participantRef, { source }); // Uses wrapped getDoc
    if (!participantSnap.exists()) {
        return null;
    }
    return { id: participantSnap.id, ...participantSnap.data() };
}
export async function getPublicCourseReportData(courseId) {
    const course = await getCourseById(courseId, 'server'); // Uses wrapped getCourseById

    if (!course) {
        throw new Error("Report not found.");
    }
    if (!course.isPublic) {
        throw new Error("This report is not publicly accessible.");
    }

    const listAllParticipantsForCourse = async (courseId) => {
        let allParticipants = [];
        let lastVisible = null;
        let hasMore = true;

        while(hasMore) {
            const result = await listParticipants(courseId, lastVisible, 'server');
            if (result.participants && result.participants.length > 0) {
                allParticipants = allParticipants.concat(result.participants);
            }
            lastVisible = result.lastVisible;
            if (!lastVisible) {
                hasMore = false;
            }
        }
        return allParticipants;
    };

    const [participants, { allObs, allCases }, finalReport] = await Promise.all([
        listAllParticipantsForCourse(courseId),
        listAllDataForCourse(courseId, 'server'), // Uses wrapped listAllDataForCourse
        getFinalReportByCourseId(courseId, 'server') // Uses wrapped getFinalReportByCourseId
    ]);

    return {
        course,
        participants,
        allObs,
        allCases,
        finalReport,
    };
}
export async function listUsers(source = 'default') {
    try {
        const querySnapshot = await getDocs(collection(db, "users"), { source }); // Uses wrapped getDocs
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
        await setDoc(userRef, { // Uses wrapped setDoc
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
    await updateDoc(facilitatorRef, { // Uses wrapped updateDoc
        role: newRole
    });
}
export async function getFacilitatorByEmail(email) {
    if (!email) return null;
    try {
        const q = query(
            collection(db, "facilitators"),
            where("email", "==", email),
            limit(1)
        );
        const snapshot = await getDocs(q); // Uses wrapped getDocs
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
        await setDoc(facRef, payload, { merge: true }); // Uses wrapped setDoc
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newFacRef = await addDoc(collection(db, "facilitators"), dataToSave); // Uses wrapped addDoc
        return newFacRef.id;
    }
}
export async function importFacilitators(facilitators) {
    const batch = writeBatch(db); // Uses wrapped writeBatch
    facilitators.forEach(fac => {
        if (fac.id) {
            const facRef = doc(db, "facilitators", fac.id);
            batch.update(facRef, fac);
        } else {
            const facRef = doc(collection(db, "facilitators"));
            batch.set(facRef, fac);
        }
    });
    await batch.commit(); // Triggers op count
    return true;
}
export async function listFacilitators() { // Removed userStates parameter
    try {
        let q = collection(db, "facilitators");
        // Filtering by userStates is removed here, handled in App.jsx if needed
        const querySnapshot = await getData(q); // Uses our wrapped getData
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error in listFacilitators:", error);
        throw error;
    }
}
export async function deleteFacilitator(facilitatorId) {
    await deleteDoc(doc(db, "facilitators", facilitatorId)); // Uses wrapped deleteDoc
    return true;
}
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

        const querySnapshot = await getDocs(q); // Uses wrapped getDocs

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
    const newSubmissionRef = await addDoc(collection(db, "facilitatorSubmissions"), dataToSave); // Uses wrapped addDoc
    return newSubmissionRef.id;
}
export async function listPendingFacilitatorSubmissions() {
    const q = query(collection(db, "facilitatorSubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q); // Uses wrapped getDocs
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function approveFacilitatorSubmission(submission, approverEmail) {
    const { id: submissionId, status, submittedAt, ...facilitatorData } = submission;
    const batch = writeBatch(db); // Uses wrapped writeBatch
    const newFacRef = doc(collection(db, "facilitators"));
    batch.set(newFacRef, facilitatorData);
    const submissionRef = doc(db, "facilitatorSubmissions", submissionId);
    batch.update(submissionRef, {
        status: 'approved',
        approvedBy: approverEmail,
        approvedAt: serverTimestamp()
    });
    await batch.commit(); // Triggers op count
}
export async function rejectFacilitatorSubmission(submissionId, rejectorEmail) {
    const submissionRef = doc(db, "facilitatorSubmissions", submissionId);
    await updateDoc(submissionRef, { // Uses wrapped updateDoc
        status: 'rejected',
        rejectedBy: rejectorEmail,
        rejectedAt: serverTimestamp()
    });
}
export async function getFacilitatorApplicationSettings() {
    const settingsRef = doc(db, "settings", "facilitatorApplication");
    const docSnap = await getDoc(settingsRef); // Uses wrapped getDoc
    if (docSnap.exists()) {
        return docSnap.data();
    }
    return { isActive: false, openCount: 0 };
}
export async function updateFacilitatorApplicationStatus(isActive) {
    const settingsRef = doc(db, "settings", "facilitatorApplication");
    await setDoc(settingsRef, { isActive }, { merge: true }); // Uses wrapped setDoc
}
export async function incrementFacilitatorApplicationOpenCount() {
    const settingsRef = doc(db, "settings", "facilitatorApplication");
    await setDoc(settingsRef, { openCount: increment(1) }, { merge: true }); // Uses wrapped setDoc
}
export async function getCoordinatorApplicationSettings() {
    const docRef = doc(db, 'appSettings', 'coordinatorApplication');
    const docSnap = await getDoc(docRef); // Uses wrapped getDoc
    if (docSnap.exists()) {
        return docSnap.data();
    }
    return { isActive: false, openCount: 0 };
}
export async function updateCoordinatorApplicationStatus(isActive) {
    const docRef = doc(db, 'appSettings', 'coordinatorApplication');
    await setDoc(docRef, { isActive }, { merge: true }); // Uses wrapped setDoc
}
export async function incrementCoordinatorApplicationOpenCount() {
    const docRef = doc(db, 'appSettings', 'coordinatorApplication');
    await setDoc(docRef, { openCount: increment(1) }, { merge: true }); // Uses wrapped setDoc
}
export async function submitCoordinatorApplication(payload) {
    const submissionsRef = collection(db, 'coordinatorSubmissions');
    await addDoc(submissionsRef, { // Uses wrapped addDoc
        ...payload,
        status: 'pending',
        submittedAt: serverTimestamp()
    });
}
export async function listPendingCoordinatorSubmissions() {
    const q = query(collection(db, "coordinatorSubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q); // Uses wrapped getDocs
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function approveCoordinatorSubmission(submission, approverEmail) {
    const { id: submissionId, status, submittedAt, ...coordinatorData } = submission;
    const usersRef = collection(db, "users");
    const userQuery = query(usersRef, where("email", "==", submission.email));
    const userSnapshot = await getDocs(userQuery); // Uses wrapped getDocs
    const batch = writeBatch(db); // Uses wrapped writeBatch
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
    await batch.commit(); // Triggers op count
}
export async function rejectCoordinatorSubmission(submissionId, rejectorEmail) {
    const submissionRef = doc(db, "coordinatorSubmissions", submissionId);
    await updateDoc(submissionRef, { // Uses wrapped updateDoc
        status: 'rejected',
        rejectedBy: rejectorEmail,
        rejectedAt: serverTimestamp()
    });
}
export async function submitFederalApplication(payload) {
    const submissionsRef = collection(db, 'federalCoordinatorSubmissions');
    await addDoc(submissionsRef, { ...payload, status: 'pending', submittedAt: serverTimestamp() }); // Uses wrapped addDoc
}
export async function listPendingFederalSubmissions() {
    const q = query(collection(db, "federalCoordinatorSubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q); // Uses wrapped getDocs
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function approveFederalSubmission(submission, approverEmail) {
    const { id: submissionId, ...coordinatorData } = submission;
    const usersRef = collection(db, "users");
    const userQuery = query(usersRef, where("email", "==", submission.email));
    const userSnapshot = await getDocs(userQuery); // Uses wrapped getDocs
    const batch = writeBatch(db); // Uses wrapped writeBatch
    const newCoordinatorRef = doc(collection(db, "federalCoordinators"));
    batch.set(newCoordinatorRef, coordinatorData);
    const submissionRef = doc(db, "federalCoordinatorSubmissions", submissionId);
    batch.update(submissionRef, { status: 'approved', approvedBy: approverEmail, approvedAt: serverTimestamp() });
    if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        batch.update(userDoc.ref, { role: 'federal_manager' });
    }
    await batch.commit(); // Triggers op count
}
export async function rejectFederalSubmission(submissionId, rejectorEmail) {
    const submissionRef = doc(db, "federalCoordinatorSubmissions", submissionId);
    await updateDoc(submissionRef, { status: 'rejected', rejectedBy: rejectorEmail, rejectedAt: serverTimestamp() }); // Uses wrapped updateDoc
}
export async function submitLocalityApplication(payload) {
    const submissionsRef = collection(db, 'localityCoordinatorSubmissions');
    await addDoc(submissionsRef, { ...payload, status: 'pending', submittedAt: serverTimestamp() }); // Uses wrapped addDoc
}
export async function listPendingLocalitySubmissions() {
    const q = query(collection(db, "localityCoordinatorSubmissions"), where("status", "==", "pending"));
    const snapshot = await getDocs(q); // Uses wrapped getDocs
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function approveLocalitySubmission(submission, approverEmail) {
    const { id: submissionId, ...coordinatorData } = submission;
    const batch = writeBatch(db); // Uses wrapped writeBatch
    const newCoordinatorRef = doc(collection(db, "localityCoordinators"));
    batch.set(newCoordinatorRef, coordinatorData);
    const submissionRef = doc(db, "localityCoordinatorSubmissions", submissionId);
    batch.update(submissionRef, { status: 'approved', approvedBy: approverEmail, approvedAt: serverTimestamp() });
    await batch.commit(); // Triggers op count
}
export async function rejectLocalitySubmission(submissionId, rejectorEmail) {
    const submissionRef = doc(db, "localityCoordinatorSubmissions", submissionId);
    await updateDoc(submissionRef, { status: 'rejected', rejectedBy: rejectorEmail, rejectedAt: serverTimestamp() }); // Uses wrapped updateDoc
}
export async function upsertCoordinator(payload) {
    if (payload.id) {
        const coordinatorRef = doc(db, "coordinators", payload.id);
        await setDoc(coordinatorRef, payload, { merge: true }); // Uses wrapped setDoc
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newRef = await addDoc(collection(db, "coordinators"), dataToSave); // Uses wrapped addDoc
        return newRef.id;
    }
}
export async function listCoordinators() {
    const q = query(collection(db, "coordinators"));
    const snapshot = await getData(q); // Uses our wrapped getData
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function deleteCoordinator(coordinatorId) {
    await deleteDoc(doc(db, "coordinators", coordinatorId)); // Uses wrapped deleteDoc
    return true;
}
export async function upsertStateCoordinator(payload) {
    if (payload.id) {
        const coordinatorRef = doc(db, "stateCoordinators", payload.id);
        await setDoc(coordinatorRef, payload, { merge: true }); // Uses wrapped setDoc
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newRef = await addDoc(collection(db, "stateCoordinators"), dataToSave); // Uses wrapped addDoc
        return newRef.id;
    }
}
export async function listStateCoordinators() {
    const q = query(collection(db, "stateCoordinators"));
    const snapshot = await getData(q); // Uses our wrapped getData
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function deleteStateCoordinator(coordinatorId) {
    await deleteDoc(doc(db, "stateCoordinators", coordinatorId)); // Uses wrapped deleteDoc
    return true;
}
export async function upsertFederalCoordinator(payload) {
    if (payload.id) {
        const coordinatorRef = doc(db, "federalCoordinators", payload.id);
        await setDoc(coordinatorRef, payload, { merge: true }); // Uses wrapped setDoc
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newRef = await addDoc(collection(db, "federalCoordinators"), dataToSave); // Uses wrapped addDoc
        return newRef.id;
    }
}
export async function listFederalCoordinators() {
    const q = query(collection(db, "federalCoordinators"));
    const snapshot = await getData(q); // Uses our wrapped getData
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function deleteFederalCoordinator(coordinatorId) {
    await deleteDoc(doc(db, "federalCoordinators", coordinatorId)); // Uses wrapped deleteDoc
    return true;
}
export async function upsertLocalityCoordinator(payload) {
    if (payload.id) {
        const coordinatorRef = doc(db, "localityCoordinators", payload.id);
        await setDoc(coordinatorRef, payload, { merge: true }); // Uses wrapped setDoc
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newRef = await addDoc(collection(db, "localityCoordinators"), dataToSave); // Uses wrapped addDoc
        return newRef.id;
    }
}
export async function listLocalityCoordinators() {
    const q = query(collection(db, "localityCoordinators"));
    const snapshot = await getData(q); // Uses our wrapped getData
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function deleteLocalityCoordinator(coordinatorId) {
    await deleteDoc(doc(db, "localityCoordinators", coordinatorId)); // Uses wrapped deleteDoc
    return true;
}
export async function upsertFunder(payload) {
    if (payload.id) {
        const funderRef = doc(db, "funders", payload.id);
        await setDoc(funderRef, payload, { merge: true }); // Uses wrapped setDoc
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newRef = await addDoc(collection(db, "funders"), dataToSave); // Uses wrapped addDoc
        return newRef.id;
    }
}
export async function listFunders() {
    const q = query(collection(db, "funders"));
    const snapshot = await getData(q); // Uses our wrapped getData
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function deleteFunder(funderId) {
    await deleteDoc(doc(db, "funders", funderId)); // Uses wrapped deleteDoc
    return true;
}
export async function upsertCourse(payload) {
    if (payload.id) {
        const courseRef = doc(db, "courses", payload.id);
        await setDoc(courseRef, payload, { merge: true }); // Uses wrapped setDoc
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newCourseRef = await addDoc(collection(db, "courses"), dataToSave); // Uses wrapped addDoc
        return newCourseRef.id;
    }
}
export async function updateCourseSharingSettings(courseId, settings) {
    if (!courseId) {
        throw new Error("Course ID is required.");
    }
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, { // Uses wrapped updateDoc
        isPublic: settings.isPublic,
        sharedWith: settings.sharedWith
    });
}
export async function updateCoursePublicStatus(courseId, isPublic) {
    if (!courseId) {
        throw new Error("Course ID is required.");
    }
    const courseRef = doc(db, "courses", courseId);
    await updateDoc(courseRef, { // Uses wrapped updateDoc
        isPublic: isPublic
    });
}
export async function listCoursesByType(course_type, userStates) {
    try {
        let q = query(collection(db, "courses"), where("course_type", "==", course_type));
        if (userStates && userStates.length > 0) {
            q = query(q, where("state", "in", userStates));
        }
        const querySnapshot = await getData(q); // Uses our wrapped getData
        const courses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return courses;
    } catch (error) {
        console.error("Error in listCoursesByType:", error);
        throw error;
    }
}
export async function listAllCourses() { // Removed userStates parameter
    try {
        let q = collection(db, "courses");
        const querySnapshot = await getData(q); // Uses our wrapped getData
        const courses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return courses;
    } catch (error) {
        console.error("Error in listAllCourses:", error);
        throw error;
    }
}
export async function deleteCourse(courseId) {
    const batch = writeBatch(db); // Uses wrapped writeBatch
    batch.delete(doc(db, "courses", courseId));
    const participantsQuery = query(collection(db, "participants"), where("courseId", "==", courseId));
    const participantsSnap = await getDocs(participantsQuery); // Uses wrapped getDocs
    participantsSnap.forEach(d => batch.delete(d.ref));
    const observationsQuery = query(collection(db, "observations"), where("courseId", "==", courseId));
    const observationsSnap = await getDocs(observationsQuery); // Uses wrapped getDocs
    observationsSnap.forEach(d => batch.delete(d.ref));
    const casesQuery = query(collection(db, "cases"), where("courseId", "==", courseId));
    const casesSnap = await getDocs(casesQuery); // Uses wrapped getDocs
    casesSnap.forEach(d => batch.delete(d.ref));
    await batch.commit(); // Triggers op count
    return true;
}
export async function upsertParticipant(payload) {
    if (payload.id) {
        const participantRef = doc(db, "participants", payload.id);
        await setDoc(participantRef, payload, { merge: true }); // Uses wrapped setDoc
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newParticipantRef = await addDoc(collection(db, "participants"), dataToSave); // Uses wrapped addDoc
        return newParticipantRef.id;
    }
}
export async function updateParticipantSharingSettings(participantId, settings) {
    if (!participantId) {
        throw new Error("Participant ID is required.");
    }
    const participantRef = doc(db, "participants", participantId);
    await updateDoc(participantRef, { // Uses wrapped updateDoc
        isPublic: settings.isPublic,
        sharedWith: settings.sharedWith
    });
}
export async function importParticipants(participants) {
    const batch = writeBatch(db); // Uses wrapped writeBatch
    participants.forEach(participant => {
        if (participant.id) {
            const participantRef = doc(db, "participants", participant.id);
            batch.update(participantRef, participant);
        } else {
            const participantRef = doc(collection(db, "participants"));
            batch.set(participantRef, participant);
        }
    });
    await batch.commit(); // Triggers op count
    return true;
}
export async function listParticipants(courseId, lastVisible = null, source = 'default') {
    if (!courseId) return { participants: [], lastVisible: null };

    const PAGE_SIZE = 25;

    let q = query(
        collection(db, "participants"),
        where("courseId", "==", courseId),
        orderBy("name"),
        limit(PAGE_SIZE)
    );

    if (lastVisible) {
        q = query(q, startAfter(lastVisible));
    }

    const documentSnapshots = await getDocs(q, { source }); // Uses wrapped getDocs

    const participants = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const newLastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];

    return { participants, lastVisible: newLastVisible };
}
export async function listAllParticipants() { // No userStates needed
    try {
        const q = collection(db, "participants");
        const querySnapshot = await getData(q); // Uses our wrapped getData
        const participants = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return participants;
    } catch (error) {
        console.error("Error in listAllParticipants:", error);
        throw error;
    }
}
export async function deleteParticipant(participantId) {
    const batch = writeBatch(db); // Uses wrapped writeBatch
    batch.delete(doc(db, "participants", participantId));
    const oq = query(collection(db, "observations"), where("participant_id", "==", participantId));
    const oSnap = await getDocs(oq); // Uses wrapped getDocs
    oSnap.forEach(d => batch.delete(d.ref));
    const cq = query(collection(db, "cases"), where("participant_id", "==", participantId));
    const cSnap = await getDocs(cq); // Uses wrapped getDocs
    cSnap.forEach(d => batch.delete(d.ref));
    await batch.commit(); // Triggers op count
    return true;
}
export async function saveParticipantAndSubmitFacilityUpdate(participantData, facilityUpdateData) {
    const participantId = await upsertParticipant(participantData); // Uses wrapped upsert
    if (facilityUpdateData) {
        await submitFacilityDataForApproval(facilityUpdateData); // Uses wrapped submit
    }
    return participantId;
}
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

            if (options.dryRun) {
                 summary.previewPayloads.push({
                    participantId: participantId,
                    targetFacilityId: targetFacilityId
                });
                continue;
            }

            // --- Live Run Logic ---
            const batch = writeBatch(db); // Uses wrapped writeBatch

            const participantRef = doc(db, "participants", participantId);
            batch.update(participantRef, {
                state: targetState,
                locality: targetLocality,
                center_name: targetFacilityName
            });

            const participant = await getParticipantById(participantId); // Uses wrapped get
            if (!participant) throw new Error(`Participant with ID ${participantId} not found during live run.`);

            const [facility, course] = await Promise.all([
                getHealthFacilityById(targetFacilityId), // Uses wrapped get
                getCourseById(participant.courseId) // Uses wrapped get
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

            await batch.commit(); // Triggers op count
            summary.submitted++;

        } catch (error) {
            console.error(`Error migrating participant ${mapping.participantId}:`, error);
            summary.errors++;
            summary.errorDetails.push(`Participant ID ${mapping.participantId}: ${error.message}`);
        }
    }

    return summary;
}
export async function listObservationsForParticipant(courseId, participantId, source = 'default') {
    const q = query(collection(db, "observations"), where("courseId", "==", courseId), where("participant_id", "==", participantId));
    const snapshot = await getDocs(q, { source }); // Uses wrapped getDocs
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function listCasesForParticipant(courseId, participantId, source = 'default') {
    const q = query(collection(db, "cases"), where("courseId", "==", courseId), where("participant_id", "==", participantId));
    const snapshot = await getDocs(q, { source }); // Uses wrapped getDocs
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function upsertCaseAndObservations(caseData, observations, editingCaseId = null) {
    const batch = writeBatch(db); // Uses wrapped writeBatch
    const caseId = editingCaseId || doc(collection(db, 'temp')).id;
    const caseRef = doc(db, "cases", caseId);

    if (editingCaseId) {
        const oldObsQuery = query(collection(db, "observations"), where("caseId", "==", editingCaseId));
        const oldObsSnapshot = await getDocs(oldObsQuery); // Uses wrapped getDocs
        oldObsSnapshot.forEach(doc => batch.delete(doc.ref));
    }

    batch.set(caseRef, { ...caseData, id: caseId });

    observations.forEach(obs => {
        const obsRef = doc(collection(db, "observations"));
        batch.set(obsRef, { ...obs, id: obsRef.id, caseId: caseId });
    });

    await batch.commit(); // Triggers op count
}
export async function deleteCaseAndObservations(caseId) {
    const batch = writeBatch(db); // Uses wrapped writeBatch
    batch.delete(doc(db, "cases", caseId));

    const q = query(collection(db, "observations"), where("caseId", "==", caseId));
    const snapshot = await getDocs(q); // Uses wrapped getDocs
    snapshot.forEach(d => batch.delete(d.ref));

    await batch.commit(); // Triggers op count
}
export async function listAllDataForCourse(courseId, source = 'default') {
    const obsQuery = query(collection(db, "observations"), where("courseId", "==", courseId));
    const casesQuery = query(collection(db, "cases"), where("courseId", "==", courseId));

    const [obsSnap, casesSnap] = await Promise.all([
        getDocs(obsQuery, { source }), // Uses wrapped getDocs
        getDocs(casesQuery, { source }) // Uses wrapped getDocs
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
export async function upsertFinalReport(payload) {
    if (payload.id) {
        const finalReportRef = doc(db, "finalReports", payload.id);
        await setDoc(finalReportRef, payload, { merge: true }); // Uses wrapped setDoc
        return payload.id;
    } else {
        const { id, ...dataToSave } = payload;
        const newRef = await addDoc(collection(db, "finalReports"), dataToSave); // Uses wrapped addDoc
        return newRef.id;
    }
}
export async function getFinalReportByCourseId(courseId, source = 'default') {
    if (!courseId) return null;
    const q = query(collection(db, "finalReports"), where("courseId", "==", courseId));
    const snapshot = await getDocs(q, { source }); // Uses wrapped getDocs
    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }
    return null;
}
export async function listFinalReport(source = 'default') {
    try {
        const querySnapshot = await getDocs(collection(db, "finalReports"), { source }); // Uses wrapped getDocs
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
        await deleteDoc(doc(db, "finalReports", reportId)); // Uses wrapped deleteDoc
        return true;
    } catch (error) {
        console.error("Error deleting final report:", error);
        throw error;
    }
}