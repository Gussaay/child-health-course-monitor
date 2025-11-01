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
    writeBatch as fbWriteBatch, // Ensure this is imported correctly
    updateDoc as fbUpdateDoc,
    getDoc as fbGetDoc,
    increment, // Import increment
    // --- END MODIFICATION ---
    serverTimestamp,
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
let localSessionDurationMs = 0; // In-memory counter for the current session
let durationIntervalId = null; // Timer for the local counter
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

    // Always increment the local counter as long as the interval is running
    localSessionDurationMs += DURATION_TICK_MS;
};

// --- NEW: Function to save duration to localStorage on browser close/refresh ---
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

        // 3. Sync any remaining duration from this session
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

        // 3. Start the local duration timer
        durationIntervalId = setInterval(tickLocalDuration, DURATION_TICK_MS);

        // 4. Add the "browser close" listener
        window.addEventListener('beforeunload', saveDurationToLocalStorage);
    }
  });
};


// --- NEW: Function to update Firestore (uses RAW functions) ---
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
    }, { merge: true })
    .catch(error => {
        console.error("Failed to update usage stats:", error);
    });
};


// --- MODIFIED: Global event dispatcher & usage tracker ---
const dispatchOpEvent = (type, count = 1) => {
  if (count > 0 && currentUser) {
    // 1. Dispatch browser event for real-time UI update (ResourceMonitor)
    window.dispatchEvent(new CustomEvent('firestoreOperation', { detail: { type, count } }));

    // 2. Update local session counts for reads/writes
    if (type === 'read') {
      sessionReads += count;
    } else {
      sessionWrites += count;
    }

    // 3. Check if we need to schedule a Firestore update
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

// --- Wrapped Firestore functions (Unchanged) ---
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
  batch.update = (docRef, data) => { // Correct signature
    writeCount++;
    return originalUpdate.call(batch, docRef, data); // Pass docRef and data
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
    try {
        const fileRef = ref(storage, fileUrl);
        await deleteObject(fileRef);
    } catch (error) {
       if (error.code !== 'storage/object-not-found') {
            console.error("Error deleting file:", error);
            throw error;
       } else {
            console.warn("Attempted to delete a file that does not exist:", fileUrl);
       }
    }
}


// --- MODIFIED: saveFacilitySnapshot ensures lastSnapshotAt is set ---
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

    // KEY CHANGE: Ensure lastSnapshotAt is set on every update to the main document to support incremental fetching
    const mainFacilityData = { ...payload, id: facilityId, lastSnapshotAt: serverTimestamp() };
    if (isNewFacility) mainFacilityData.createdAt = serverTimestamp();
    delete mainFacilityData.submissionId;
    delete mainFacilityData.status;
    delete mainFacilityData.submittedAt;
    batch.set(facilityRef, mainFacilityData, { merge: true });
    // --- END KEY CHANGE ---


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
        // Basic check, might need deep comparison for nested objects if they occur
        if (JSON.stringify(newData[key]) !== JSON.stringify(oldData[key])) return true;
    }
    // Check if keys were removed in newData
    for (const key of Object.keys(oldData)) {
         if (['id', 'lastSnapshotAt', 'createdAt', 'اخر تحديث', 'updated_by'].includes(key)) continue;
         if (!(key in newData)) return true; // Key removed
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
                    existingDocSnap = await getDoc(docRef); // Use wrapped getDoc
                    if (existingDocSnap.exists()) {
                         existingDocData = existingDocSnap.data();
                    }
                } else {
                    const { "الولاية": state, "المحلية": locality, "اسم_المؤسسة": facilityName } = facilityData;
                    if (state && locality && facilityName) {
                        const q = query(collection(db, "healthFacilities"), where("الولاية", "==", state), where("المحلية", "==", locality), where("اسم_المؤسسة", "==", facilityName), limit(1));
                        const snapshot = await getDocs(q); // Use wrapped getDocs
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
                    // Combine existing data with new data, ensuring ID is correct
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
                if (originalRowForError) {
                    failedRowsData.push(errorPayload);
                }
                // Don't re-throw, just record error and continue batch
            }
             // Report progress after attempting each row
             if (onProgress) {
                 onProgress({ processed: progressIndex + 1, total: facilities.length });
             }
        }
         try {
             await batch.commit(); // Commit batch
         } catch(commitError) {
             console.error(`Batch commit failed starting at index ${i}:`, commitError);
             // Mark all rows in this chunk as failed if commit fails
             for (let k = 0; k < chunk.length; k++) {
                 const progressIndex = i + k;
                 const originalRowForError = chunkOriginalRows ? chunkOriginalRows[k] : null;
                 // Avoid adding duplicate errors if individual row already failed
                 if (!errors.some(err => err.rowIndex === progressIndex)) {
                     const errorPayload = { message: `Batch commit failed: ${commitError.message}`, rowIndex: progressIndex, rowData: originalRowForError };
                     errors.push(errorPayload);
                      if (originalRowForError) {
                         failedRowsData.push(errorPayload);
                      }
                 }
             }
         }
    }
    return { successes, errors, failedRowsData };
}

export async function approveFacilitySubmission(submission, approverEmail) {
    const { submissionId, ...facilityData } = submission; // Separate submissionId
    await saveFacilitySnapshot(facilityData); // Save the actual data
    const submissionRef = doc(db, "facilitySubmissions", submissionId);
    await updateDoc(submissionRef, { status: 'approved', approvedBy: approverEmail, approvedAt: serverTimestamp() });
}
// --- MODIFIED: listHealthFacilities now supports incremental fetching ---
export async function listHealthFacilities(filters = {}) {
    let q = collection(db, "healthFacilities");
    const conditions = [];
    
    // Set a default order. This will be overwritten if more specific filters are used.
    let orderByClause = orderBy("الولاية"); 

    if (filters.state && filters.state !== 'NOT_ASSIGNED') conditions.push(where("الولاية", "==", filters.state));
    
    if (filters.locality) {
        conditions.push(where("المحلية", "==", filters.locality));
        // If we filter by locality, it's logical to sort by facility name.
        // This also fixes the invalid query error.
        orderByClause = orderBy("اسم_المؤسسة");
    }

    if (filters.facilityType) conditions.push(where("نوع_المؤسسةالصحية", "==", filters.facilityType));
    if (filters.functioningStatus && filters.functioningStatus !== 'NOT_SET') conditions.push(where("هل_المؤسسة_تعمل", "==", filters.functioningStatus));
    if (filters.project) conditions.push(where("project_name", "==", filters.project));

    // NEW TIMESTAMP FILTER LOGIC: Filter by 'lastSnapshotAt'
    if (filters.lastUpdatedAfter instanceof Date) { // Check if it's a Date object
        // lastUpdatedAfter is a JavaScript Date object, convert to Firestore Timestamp
        const timestamp = Timestamp.fromDate(filters.lastUpdatedAfter);
        // Query for documents where the last update time is *after* the provided timestamp
        conditions.push(where("lastSnapshotAt", ">", timestamp));
        
        // This is the primary order when fetching incrementally
        orderByClause = orderBy("lastSnapshotAt");
    }
    // END NEW TIMESTAMP FILTER LOGIC


    if (conditions.length > 0) q = query(q, ...conditions);

    // Apply the single, correct orderBy clause
    q = query(q, orderByClause);

    try {
        const querySnapshot = await getData(q);
        let facilities = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Post-query filtering (only needed for complex filters not supported by Firestore query)
        if (filters.state === 'NOT_ASSIGNED') facilities = facilities.filter(f => !f['الولاية']);
        if (filters.functioningStatus === 'NOT_SET') facilities = facilities.filter(f => f['هل_المؤسسة_تعمل'] == null || f['هل_المؤسسة_تعمل'] === '');

        return facilities;
    } catch (error) {
        console.error("Error fetching health facilities:", error);
        throw error;
    }
}
// --- END MODIFIED: listHealthFacilities ---

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
    const { id, ...dataToSubmit } = payload; // Separate original ID if exists
    const submissionData = {
         ...dataToSubmit,
         originalFacilityId: id || null, // Store original ID if updating
         submittedAt: serverTimestamp(),
         status: 'pending',
         updated_by: submitterIdentifier // Record who submitted
     };
     // Ensure no 'id' field is sent if it was undefined
     if (submissionData.id === undefined) {
         delete submissionData.id;
     }
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

// --- NEW FUNCTION TO ADD/UPDATE A HEALTH WORKER IN A FACILITY ---
/**
 * Adds a new health worker or updates an existing one in a facility's imnci_staff list.
 * This function creates a new facility snapshot.
 * @param {string} facilityId - The ID of the facility to update.
 * @param {object} newWorkerData - An object with { name, job_title, training_date, phone }.
 * @param {string} mentorIdentifier - The email or name of the user making the change.
 * @returns {Promise<boolean>} True on success.
 */
export async function addHealthWorkerToFacility(facilityId, newWorkerData, mentorIdentifier = 'Unknown User') {
    if (!facilityId) throw new Error("Facility ID is required.");
    if (!newWorkerData || !newWorkerData.name) throw new Error("New worker data (at least name) is required.");

    // 1. Get the latest facility data
    const facility = await getHealthFacilityById(facilityId); // Uses wrapped getDoc
    if (!facility) throw new Error(`Facility with ID ${facilityId} not found.`);

    // 2. Prepare the new staff member object
    const newWorker = {
        name: newWorkerData.name.trim(),
        job_title: newWorkerData.job_title || '',
        training_date: newWorkerData.training_date || '', // Date from form
        phone: newWorkerData.phone || '',
        // Mark as trained if a training date is provided
        is_trained: newWorkerData.training_date ? 'Yes' : 'No' 
    };

    // 3. Get existing staff list, parsing if necessary
    let existingStaff = [];
    if (facility.imnci_staff) {
        try {
            existingStaff = typeof facility.imnci_staff === 'string'
                ? JSON.parse(facility.imnci_staff)
                // Deep copy if already object to avoid modifying cached data
                : JSON.parse(JSON.stringify(facility.imnci_staff)); 
            if (!Array.isArray(existingStaff)) existingStaff = []; // Fallback
        } catch (e) {
            console.error("Error parsing existing imnci_staff, starting fresh list.", e);
            existingStaff = [];
        }
    }

    // 4. Check if worker exists (by name or phone) and update or add
    const staffIndex = existingStaff.findIndex(s =>
        s.name === newWorker.name || (s.phone && newWorker.phone && s.phone === newWorker.phone)
    );

    if (staffIndex !== -1) {
        // Update existing worker
        existingStaff[staffIndex] = newWorker;
    } else {
        // Add new worker
        existingStaff.push(newWorker);
    }

    // 5. Prepare payload for saveFacilitySnapshot
    const payload = {
        ...facility, // Spread existing data
        id: facilityId, // Ensure ID is correct
        imnci_staff: existingStaff, // Set the updated staff list
        date_of_visit: new Date().toISOString().split('T')[0], // Use today's date for the snapshot
        updated_by: mentorIdentifier // Record who made the change
    };

    // 6. Save using saveFacilitySnapshot to create historical record and update main doc
    // This will also automatically update 'lastSnapshotAt'
    await saveFacilitySnapshot(payload);

    return true; // Indicate success
}
// --- END NEW FUNCTION ---


// ... (Course, Participant, Facilitator, Coordinator, Funder, etc. functions remain the same) ...
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

    // --- MODIFICATION: Use exported listAllParticipantsForCourse ---
    const [participants, { allObs, allCases }, finalReport] = await Promise.all([
        listAllParticipantsForCourse(courseId, 'server'), // Use exported function
        listAllDataForCourse(courseId, 'server'),
        getFinalReportByCourseId(courseId, 'server')
    ]);
    // --- END MODIFICATION ---

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
        const querySnapshot = await getDocs(collection(db, "users"), { source });
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                email: data.email || '',
                isAdmin: data.isAdmin || false, // Consider removing if role is primary
                role: data.role || 'user', // Add role
                permissions: data.permissions || {}, // Add permissions
                assignedState: data.assignedState || '', // Add assignedState
                assignedLocalities: data.assignedLocalities || [], // Add assignedLocalities
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
export async function listFacilitators() {
    try {
        let q = collection(db, "facilitators");
        const querySnapshot = await getData(q);
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
            // Check correct property access (docs, not doc)
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
            role: 'states_manager', // Consider standardizing role names (e.g., state_manager)
            assignedState: submission.state // Use assignedState for consistency
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
    const { id: submissionId, status, submittedAt, ...coordinatorData } = submission; // Remove unused variables
    const usersRef = collection(db, "users");
    const userQuery = query(usersRef, where("email", "==", submission.email));
    const userSnapshot = await getDocs(userQuery);
    const batch = writeBatch(db);
    const newCoordinatorRef = doc(collection(db, "federalCoordinators"));
    batch.set(newCoordinatorRef, coordinatorData); // Save coordinator data
    const submissionRef = doc(db, "federalCoordinatorSubmissions", submissionId);
    batch.update(submissionRef, { status: 'approved', approvedBy: approverEmail, approvedAt: serverTimestamp() });
    if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        batch.update(userDoc.ref, { role: 'federal_manager' }); // Use consistent role name
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
    const { id: submissionId, status, submittedAt, ...coordinatorData } = submission; // Remove unused vars
    const usersRef = collection(db, "users"); // Get users collection ref
    const userQuery = query(usersRef, where("email", "==", submission.email)); // Query for user by email
    const userSnapshot = await getDocs(userQuery); // Execute query

    const batch = writeBatch(db);
    const newCoordinatorRef = doc(collection(db, "localityCoordinators"));
    batch.set(newCoordinatorRef, coordinatorData); // Save coordinator data
    const submissionRef = doc(db, "localityCoordinatorSubmissions", submissionId);
    batch.update(submissionRef, { status: 'approved', approvedBy: approverEmail, approvedAt: serverTimestamp() });

    // Update user role and assigned localities if user exists
    if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        batch.update(userDoc.ref, {
            role: 'locality_manager', // Use consistent role name
            assignedState: submission.state, // Also store the state
            assignedLocalities: [submission.locality] // Store locality in the array
        });
    }

    await batch.commit();
}

export async function rejectLocalitySubmission(submissionId, rejectorEmail) {
    const submissionRef = doc(db, "localityCoordinatorSubmissions", submissionId);
    await updateDoc(submissionRef, { status: 'rejected', rejectedBy: rejectorEmail, rejectedAt: serverTimestamp() });
}
export async function upsertCoordinator(payload) { // Generic coordinator - might deprecate
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
export async function listCoordinators() { // Generic coordinator - might deprecate
    const q = query(collection(db, "coordinators"));
    const snapshot = await getData(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
export async function deleteCoordinator(coordinatorId) { // Generic coordinator - might deprecate
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
export async function listStateCoordinators() {
    const q = query(collection(db, "stateCoordinators"));
    const snapshot = await getData(q);
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
export async function listFederalCoordinators() {
    const q = query(collection(db, "federalCoordinators"));
    const snapshot = await getData(q);
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
export async function listLocalityCoordinators() {
    const q = query(collection(db, "localityCoordinators"));
    const snapshot = await getData(q);
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
export async function listFunders() {
    const q = query(collection(db, "funders"));
    const snapshot = await getData(q);
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
export async function listCoursesByType(course_type, userStates) {
    try {
        let conditions = [where("course_type", "==", course_type)];
        if (userStates && userStates.length > 0) {
            conditions.push(where("state", "in", userStates));
        }
         // Add ordering for consistency, e.g., by start date descending
         conditions.push(orderBy("start_date", "desc"));

        let q = query(collection(db, "courses"), ...conditions);

        const querySnapshot = await getData(q);
        const courses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return courses;
    } catch (error) {
        console.error("Error in listCoursesByType:", error);
        throw error;
    }
}
export async function listAllCourses() {
    try {
         // Add ordering for consistency
        let q = query(collection(db, "courses"), orderBy("start_date", "desc"));
        const querySnapshot = await getData(q);
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
    // Also delete final report if exists
    const finalReportQuery = query(collection(db, "finalReports"), where("courseId", "==", courseId));
    const finalReportSnap = await getDocs(finalReportQuery);
    finalReportSnap.forEach(d => batch.delete(d.ref));

    await batch.commit();
    return true;
}

// --- MODIFIED: upsertParticipant ---
export async function upsertParticipant(payload) {
    if (payload.id) {
        // This is an UPDATE.
        const participantRef = doc(db, "participants", payload.id);

        // Check if the phone number is being changed to one that already exists.
        if (payload.phone && payload.courseId) {
            const q = query(
                collection(db, "participants"),
                where("courseId", "==", payload.courseId),
                where("phone", "==", payload.phone),
                limit(1)
            );
            const snapshot = await getDocs(q); // Use wrapped getDocs
            if (!snapshot.empty) {
                const existingDoc = snapshot.docs[0];
                // If a doc was found and it's NOT the one we are currently editing, it's a duplicate.
                if (existingDoc.id !== payload.id) {
                    throw new Error(`A participant with phone number '${payload.phone}' already exists in this course.`);
                }
            }
        }
        // No collision, or phone not changed, or it's the same doc. Proceed with update.
        await setDoc(participantRef, payload, { merge: true }); // Uses wrapped setDoc
        return payload.id;

    } else {
        // This is a CREATE.
        const { id, ...dataToSave } = payload;

        // Phone and courseId are required for the check.
        if (!dataToSave.phone || !dataToSave.courseId) {
            throw new Error("Phone number and Course ID are required to check for duplicates.");
        }

        // Check for phone number collision on CREATE.
        const q = query(
            collection(db, "participants"),
            where("courseId", "==", dataToSave.courseId),
            where("phone", "==", dataToSave.phone),
            limit(1)
        );

        const snapshot = await getDocs(q); // Use wrapped getDocs

        if (!snapshot.empty) {
            // A duplicate was found.
            throw new Error(`A participant with phone number '${dataToSave.phone}' already exists in this course.`);
        }

        // No duplicate found, proceed to create.
        const newParticipantRef = await addDoc(collection(db, "participants"), dataToSave); // Uses wrapped addDoc
        return newParticipantRef.id;
    }
}
// --- END MODIFIED: upsertParticipant ---


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

// --- MODIFIED: importParticipants ---
export async function importParticipants(participants) {
    if (!participants || participants.length === 0) {
        return true; // Nothing to import
    }

    const batch = writeBatch(db); // Use wrapped writeBatch
    const phoneCourseSet = new Set(); // To track duplicates *within the batch itself*

    // Fetch existing participants for this course to check against.
    const courseId = participants[0]?.courseId;
    if (!courseId) {
        throw new Error("Course ID not found on participants for import.");
    }
    
    const existingParticipantsQuery = query(collection(db, "participants"), where("courseId", "==", courseId));
    const existingSnapshot = await getDocs(existingParticipantsQuery); // Use wrapped getDocs
    
    // Map existing phones to their document IDs for quick lookup.
    const existingPhones = new Map(existingSnapshot.docs.map(doc => {
        const data = doc.data();
        return data.phone ? [data.phone, doc.id] : [null, doc.id];
    }));


    for (const participant of participants) {
        // --- Duplicate Check Logic ---
        if (!participant.phone) {
            throw new Error(`Participant '${participant.name || 'N/A'}' is missing a phone number.`);
        }

        const cleanPhone = String(participant.phone).trim();

        if (phoneCourseSet.has(cleanPhone)) {
            // Duplicate within the batch
            throw new Error(`Duplicate phone number '${cleanPhone}' (for ${participant.name}) found within the import file.`);
        }
        
        const existingDocId = existingPhones.get(cleanPhone);
        if (existingDocId) {
            // Phone number exists in DB
            if (participant.id && participant.id === existingDocId) {
                // This is an update to the *correct* participant, allow it.
            } else if (participant.id) {
                // This is an update, but it's trying to set a phone number that *another* participant already has.
                throw new Error(`Phone number '${cleanPhone}' (for ${participant.name}) already belongs to another participant in this course.`);
            } else {
                // This is a new participant, but their phone number is already in use.
                throw new Error(`Participant '${participant.name}' has a phone number ('${cleanPhone}') that already exists in this course.`);
            }
        }
        // --- END Duplicate Check Logic ---

        // If we are here, it's safe to add to batch
        phoneCourseSet.add(cleanPhone); // Add to set for intra-batch check

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
// --- END MODIFIED: importParticipants ---

export async function listParticipants(courseId, lastVisible = null, source = 'default') {
    if (!courseId) return { participants: [], lastVisible: null };

    const PAGE_SIZE = 50; // Increased page size slightly

    let q = query(
        collection(db, "participants"),
        where("courseId", "==", courseId),
        orderBy("name"),
        limit(PAGE_SIZE)
    );

    if (lastVisible) {
        q = query(q, startAfter(lastVisible));
    }

    const documentSnapshots = await getDocs(q, { source });

    const participants = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const newLastVisible = documentSnapshots.docs[documentSnapshots.docs.length - 1];

    return { participants, lastVisible: newLastVisible };
}
export async function listAllParticipants() {
    try {
        const q = collection(db, "participants");
        const querySnapshot = await getData(q);
        const participants = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return participants;
    } catch (error) {
        console.error("Error in listAllParticipants:", error);
        throw error;
    }
}

// --- NEW: listAllParticipantsForCourse ---
/**
 * Fetches all participants for a specific course, handling pagination automatically.
 * @param {string} courseId - The ID of the course.
 * @param {string} source - 'default', 'cache', or 'server'.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of all participant objects.
 */
export async function listAllParticipantsForCourse(courseId, source = 'default') {
    if (!courseId) return [];
    let allParticipants = [];
    let lastVisible = null;
    let hasMore = true;

    while(hasMore) {
        // listParticipants is the paginated function defined above
        const result = await listParticipants(courseId, lastVisible, source); 
        if (result.participants && result.participants.length > 0) {
            allParticipants = allParticipants.concat(result.participants);
        }
        lastVisible = result.lastVisible;
        if (!lastVisible) {
            hasMore = false;
        }
    }
    return allParticipants;
}
// --- END NEW FUNCTION ---

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
        // Assume submitterIdentifier is needed, get from auth or pass as arg
        // const auth = getAuth(); // <- CORRECTED
        const user = firebaseAuth.currentUser; // <- CORRECTED
        const submitter = user ? (user.displayName || user.email) : 'Participant Form';
        await submitFacilityDataForApproval(facilityUpdateData, submitter);
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
    // const auth = getAuth(); // Get auth instance // <- CORRECTED
    const currentUser = firebaseAuth.currentUser; // Get current user // <- CORRECTED
    const submitterIdentifier = currentUser ? (currentUser.displayName || currentUser.email) : 'Bulk Migration'; // Set submitter


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
            // Fetch necessary data first (using wrapped functions)
            const participant = await getParticipantById(participantId);
            if (!participant) throw new Error(`Participant with ID ${participantId} not found during live run.`);

            const [facility, course] = await Promise.all([
                getHealthFacilityById(targetFacilityId),
                getCourseById(participant.courseId)
            ]);
            if (!facility) throw new Error(`Target facility with ID ${targetFacilityId} not found.`);
            if (!course) throw new Error(`Course for participant ${participantId} not found.`);

            // Prepare participant update
            const participantUpdate = {
                state: targetState,
                locality: targetLocality,
                center_name: targetFacilityName
            };

            // Prepare facility update payload
            const participantAsStaff = {
                name: participant.name,
                job_title: participant.job_title,
                is_trained: 'Yes',
                training_date: course.start_date || '',
                phone: participant.phone || ''
            };
            // Deep copy to avoid modifying cache, handle stringified JSON
             let existingStaff = [];
             if (facility.imnci_staff) {
                 try {
                     existingStaff = typeof facility.imnci_staff === 'string'
                         ? JSON.parse(facility.imnci_staff)
                         : JSON.parse(JSON.stringify(facility.imnci_staff));
                     if (!Array.isArray(existingStaff)) existingStaff = []; // Fallback if parse result isn't array
                 } catch (e) {
                     console.error("Error parsing existing staff, starting fresh:", e);
                     existingStaff = [];
                 }
             }

            const staffIndex = existingStaff.findIndex(s => s.name === participant.name || (s.phone && participant.phone && s.phone === participant.phone));

            if (staffIndex !== -1) {
                existingStaff[staffIndex] = participantAsStaff;
            } else {
                existingStaff.push(participantAsStaff);
            }
             const numTrained = existingStaff.filter(s => s.is_trained === 'Yes').length;

            const facilityUpdatePayload = {
                ...facility, // Start with existing facility data
                id: targetFacilityId, // Ensure ID is included
                imnci_staff: existingStaff,
                "وجود_العلاج_المتكامل_لامراض_الطفولة": 'Yes',
                "وجود_كتيب_لوحات": 'Yes',
                "وجود_سجل_علاج_متكامل": 'Yes',
                "date_of_visit": new Date().toISOString().split('T')[0], // Use today's date for snapshot
                "updated_by": `Migrated from Participant ${participantId}`,
                'growth_monitoring_service_exists': participant.has_growth_monitoring ? 'Yes' : (facility.growth_monitoring_service_exists || 'No'),
                nutrition_center_exists: participant.has_nutrition_service ? 'Yes' : (facility.nutrition_center_exists || 'No'),
                nearest_nutrition_center: participant.nearest_nutrition_center || facility.nearest_nutrition_center || '',
                immunization_office_exists: participant.has_immunization_service ? 'Yes' : (facility.immunization_office_exists || 'No'),
                nearest_immunization_center: participant.nearest_immunization_center || facility.nearest_immunization_center || '',
                'غرفة_إرواء': participant.has_ors_room ? 'Yes' : (facility['غرفة_إرواء'] || 'No'),
                'العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين': participant.num_other_providers ?? (facility['العدد_الكلي_للكوادر_طبية_العاملة_أطباء_ومساعدين'] ?? existingStaff.length),
                 // Update trained count based on actual staff list
                'العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل': participant.num_other_providers_imci ?? (facility['العدد_الكلي_للكودار_المدربة_على_العلاج_المتكامل'] ?? numTrained),
            };

            // Use separate operations instead of batch to avoid complexity with potential partial failures
            await upsertParticipant({ id: participantId, ...participantUpdate }); // Update participant
            await submitFacilityDataForApproval(facilityUpdatePayload, submitterIdentifier); // Submit facility update

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
    const snapshot = await getDocs(q, { source });
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function listCasesForParticipant(courseId, participantId, source = 'default') {
    const q = query(collection(db, "cases"), where("courseId", "==", courseId), where("participant_id", "==", participantId));
    const snapshot = await getDocs(q, { source });
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// --- MODIFICATION: Added return statement ---
export async function upsertCaseAndObservations(caseData, observations, editingCaseId = null) {

    // --- DUPLICATE CHECK REMOVED ---
    // The client-side hash check in MonitoringView.jsx is now the primary
    // mechanism for warning about duplicate *content*. The server-side
    // check for case_serial collisions has been removed per request.
    // --- END DUPLICATE CHECK REMOVED ---

    const batch = writeBatch(db);
    const caseId = editingCaseId || doc(collection(db, 'temp')).id; // Generate ID locally
    const caseRef = doc(db, "cases", caseId);

    // If editing, delete old observations first
    if (editingCaseId) {
        const oldObsQuery = query(collection(db, "observations"), where("caseId", "==", editingCaseId));
        const oldObsSnapshot = await getDocs(oldObsQuery); // Use wrapped getDocs
        oldObsSnapshot.forEach(doc => batch.delete(doc.ref));
    }

    // Set/overwrite the case data
    // --- FIX: Create the object to be returned ---
    const savedCase = { ...caseData, id: caseId };
    batch.set(caseRef, savedCase); // Ensure ID is part of the data

    // Add new observations
    // --- FIX: Create the array to be returned ---
    const savedObservations = [];
    observations.forEach(obs => {
        const obsRef = doc(collection(db, "observations")); // Generate new ID for each observation
        const finalObs = { ...obs, id: obsRef.id, caseId: caseId }; // Create the full object
        batch.set(obsRef, finalObs); // Ensure obs ID and caseId link are set
        savedObservations.push(finalObs); // Add to the array
    });

    await batch.commit(); // Commit the batch
    
    // --- FIX: Return the saved objects so the frontend can use them ---
    return { savedCase, savedObservations };
}
// --- END MODIFICATION ---

export async function deleteCaseAndObservations(caseId) {
    const batch = writeBatch(db);
    batch.delete(doc(db, "cases", caseId));

    const q = query(collection(db, "observations"), where("caseId", "==", caseId));
    const snapshot = await getDocs(q); // Use wrapped getDocs
    snapshot.forEach(d => batch.delete(d.ref));

    await batch.commit(); // Commit the batch
}
export async function listAllDataForCourse(courseId, source = 'default') {
    const obsQuery = query(collection(db, "observations"), where("courseId", "==", courseId));
    const casesQuery = query(collection(db, "cases"), where("courseId", "==", courseId));

    const [obsSnap, casesSnap] = await Promise.all([
        getDocs(obsQuery, { source }), // Use wrapped getDocs
        getDocs(casesQuery, { source })  // Use wrapped getDocs
    ]);

    const allObs = obsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allCases = casesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Calculate correctness within this function
    const allCasesWithCorrectness = allCases.map(caseItem => {
        const caseObservations = allObs.filter(obs => obs.caseId === caseItem.id);
        // Ensure item_correct is treated as a number for comparison
        const is_correct = caseObservations.length > 0 && caseObservations.every(obs => Number(obs.item_correct) > 0);
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
        const { id, ...dataToSave } = payload;
        const newRef = await addDoc(collection(db, "finalReports"), dataToSave);
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

// --- NEW MENTORSHIP FUNCTIONS ---

/**
 * Saves a new skill mentorship session or updates an existing one (if sessionId is provided).
 * Can be used with a batch or as a standalone operation.
 * @param {object} payload - The mentorship session data.
 * @param {string|null} sessionId - The ID of the session to update, or null to create new.
 * @param {object|null} externalBatch - An optional Firestore write batch.
 * @returns {string} The ID of the created or updated document.
 */
export async function saveMentorshipSession(payload, sessionId = null, externalBatch = null) {
    try {
        const sessionData = {
            ...payload,
            // Add createdAt only if it's a new document
            ...( !sessionId ? { createdAt: serverTimestamp() } : { lastUpdatedAt: serverTimestamp() } ),
        };

        const docRef = sessionId 
            ? doc(db, "skillMentorship", sessionId) // Get ref to existing doc
            : doc(collection(db, "skillMentorship")); // Create ref for new doc

        if (externalBatch) {
            // Use set with merge:true for updates, or set for new
            externalBatch.set(docRef, sessionData, { merge: !!sessionId }); 
            return docRef.id; 
        } else {
            // Use the wrapped setDoc for standalone operations
            await setDoc(docRef, sessionData, { merge: !!sessionId });
            return docRef.id;
        }
    } catch (error) {
        console.error("Error saving mentorship session:", error);
        throw error;
    }
}


/**
 * Lists all skill mentorship sessions from Firestore.
 * @returns {Array<object>} A list of mentorship session documents.
 */
export async function listMentorshipSessions() {
    try {
        const q = query(collection(db, "skillMentorship"), orderBy("effectiveDate", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching mentorship sessions:", error);
        throw error;
    }
}

// --- NEW MENTORSHIP IMPORT FUNCTION ---
/**
 * Imports a batch of mentorship sessions from processed Excel data.
 * @param {Array<object>} sessions - Array of session payloads to import.
 * @param {Array<Array<any>>} originalRows - The original raw Excel rows for error reporting.
 * @param {function} onProgress - Callback function for progress updates. ({ processed: number, total: number })
 * @returns {object} An object containing successes, errors, and failedRowsData.
 */
export async function importMentorshipSessions(sessions, originalRows, onProgress) {
    const errors = [];
    const successes = [];
    const failedRowsData = [];
    const BATCH_SIZE = 490; // Firestore batch limit is 500

    for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
        const batch = writeBatch(db); // Use wrapped batch
        const chunk = sessions.slice(i, i + BATCH_SIZE);
        const chunkOriginalRows = originalRows ? originalRows.slice(i, i + BATCH_SIZE) : null;


        for (let j = 0; j < chunk.length; j++) {
            const sessionData = chunk[j];
            const progressIndex = i + j;
            try {
                // Basic validation before adding to batch
                if (!sessionData.effectiveDate || !(sessionData.effectiveDate instanceof Timestamp)) {
                    throw new Error("Invalid or missing 'session_date'. Expected YYYY-MM-DD.");
                }
                 if (!sessionData.facilityId) {
                     // Attempted lookup failed in the modal, flag as error here.
                     throw new Error(`Facility '${sessionData.facilityName}' in ${sessionData.locality}, ${sessionData.state} not found.`);
                }
                 if (!sessionData.state || !sessionData.locality) {
                     throw new Error("Missing State or Locality Key.");
                 }
                 if (!sessionData.healthWorkerName) {
                    throw new Error("Missing Health Worker Name.");
                 }

                // Call saveMentorshipSession with the batch (passing null for sessionId)
                await saveMentorshipSession(sessionData, null, batch);
                successes.push({ rowIndex: progressIndex }); // Record success by index

            } catch (e) {
                const originalRowForError = chunkOriginalRows ? chunkOriginalRows[j] : null;
                const errorPayload = { message: e.message || 'Unknown import error.', rowIndex: progressIndex, rowData: originalRowForError };
                errors.push(errorPayload);
                if (originalRowForError) {
                    failedRowsData.push(errorPayload);
                }
                 // Continue to next item in chunk even if one fails
            }

            // Report progress after attempting each row
            if (onProgress) {
                onProgress({ processed: progressIndex + 1, total: sessions.length });
            }
        }

        try {
            await batch.commit(); // Commit the processed chunk
        } catch (commitError) {
             console.error(`Batch commit failed starting at index ${i}:`, commitError);
             // Mark all rows in this chunk *that haven't already failed* as failed due to commit error
             for (let k = 0; k < chunk.length; k++) {
                 const progressIndex = i + k;
                 // Check if this row index already has an error recorded
                 if (!errors.some(err => err.rowIndex === progressIndex)) {
                     const originalRowForError = chunkOriginalRows ? chunkOriginalRows[k] : null;
                     const errorPayload = { message: `Batch commit failed: ${commitError.message}`, rowIndex: progressIndex, rowData: originalRowForError };
                     errors.push(errorPayload);
                      if (originalRowForError && !failedRowsData.some(fr => fr.rowIndex === progressIndex)) {
                         failedRowsData.push(errorPayload);
                      }
                 }
             }
        }
    }

    return { successes, errors, failedRowsData };
}
// --- END NEW MENTORSHIP IMPORT FUNCTION ---

// --- NEW FUNCTION TO DELETE A MENTORSHIP SESSION ---
/**
 * Deletes a skill mentorship session from Firestore.
 * @param {string} sessionId - The ID of the session to delete.
 * @returns {Promise<boolean>} True on success.
 */
export async function deleteMentorshipSession(sessionId) {
    if (!sessionId) {
        throw new Error("Session ID is required to delete.");
    }
    const sessionRef = doc(db, "skillMentorship", sessionId);
    await deleteDoc(sessionRef); // Use the wrapped deleteDoc
    return true;
}
// --- END NEW FUNCTION ---
// --- END NEW MENTORSHIP FUNCTIONS ---