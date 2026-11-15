// src/training/trainingSeed.js
//
// Fills a course's practice copy (trainingSandboxes/{courseId}) with copies of
// real reference data: every health facility, facilitators, coordinators and
// partners. Run by staff when they share the training link (TrainingLinkShare),
// so trainees normally find it ready; TrainingGate runs it too as a fallback.
// Uses the raw SDK on purpose: the app's wrapped imports would read the
// (empty) sandbox instead of the real lists.

import * as fs from '@firebase/firestore';
import { db } from '../firebase';
import { SANDBOX_ROOT } from './trainingSession.js';

// Raise when the seed copies more. A sandbox seeded by an older version gets
// only what was added since (copying again would overwrite practice edits).
export const SEED_VERSION = 3;
const MAX_BATCH_DOCS = 400;
const MAX_BATCH_BYTES = 8 * 1024 * 1024; // Firestore refuses commits over 10 MB

// The people and organisation lists the forms pick from (facilitators,
// coordinators, partners/funders). Copied whole: trainees choose real names
// in their practice courses and can add or edit them in the copy.
const SEED_LISTS = ['facilitators', 'funders', 'federalCoordinators', 'stateCoordinators', 'localityCoordinators', 'coordinators'];

async function copyDocs(courseId, collectionName, docs, onProgress) {
    let batch = fs.writeBatch(db);
    let count = 0;
    let bytes = 0;
    for (const d of docs) {
        const data = d.data();
        const size = (() => { try { return JSON.stringify(data).length; } catch { return 50000; } })();
        if (count > 0 && (count >= MAX_BATCH_DOCS || bytes + size > MAX_BATCH_BYTES)) {
            await batch.commit();
            batch = fs.writeBatch(db);
            count = 0;
            bytes = 0;
        }
        batch.set(fs.doc(db, SANDBOX_ROOT, courseId, collectionName, d.id), data);
        count += 1;
        bytes += size;
        onProgress?.();
    }
    if (count > 0) await batch.commit();
    return docs.length;
}

// Fills the course's sandbox with copies of real reference data, once.
// Uses the raw SDK on purpose: the app's wrapped imports would read the
// (empty) sandbox instead of the real lists.
export async function seedSandbox(courseId, course, onProgress) {
    const markerRef = fs.doc(db, SANDBOX_ROOT, courseId);
    const marker = await fs.getDoc(markerRef);
    const done = marker.exists() ? (marker.data()?.seedVersion || (marker.data()?.seededAt ? 1 : 0)) : 0;
    if (done >= SEED_VERSION) return done;

    const counts = {};
    // Version 3: every health facility in Sudan (version 1 copied only the
    // course's state, and a national course or a participant from another
    // state then found no facility to pick). Facilities already in the copy
    // are left alone, so practice edits are kept.
    if (done < 3) {
        const [real, existing] = await Promise.all([
            fs.getDocs(fs.collection(db, 'healthFacilities')),
            fs.getDocs(fs.collection(db, SANDBOX_ROOT, courseId, 'healthFacilities')),
        ]);
        const have = new Set(existing.docs.map((d) => d.id));
        const todo = real.docs.filter((d) => !have.has(d.id) && d.data()?.isDeleted !== true);
        let n = 0;
        onProgress?.(0, todo.length);
        counts.healthFacilities = await copyDocs(courseId, 'healthFacilities', todo, () => { n += 1; if (n % 200 === 0) onProgress?.(n, todo.length); });
    }
    // Version 2: facilitators, coordinators and partners.
    if (done < 2) {
        for (const name of SEED_LISTS) {
            try {
                const snap = await fs.getDocs(fs.collection(db, name));
                counts[name] = await copyDocs(courseId, name, snap.docs);
            } catch (e) {
                console.warn(`[training] could not copy ${name}:`, e?.code || e?.message);
            }
        }
    }
    await fs.setDoc(markerRef, {
        courseId,
        courseType: course.course_type || '',
        state: course.state || '',
        ...(counts.healthFacilities !== undefined ? { facilitiesCopied: counts.healthFacilities } : {}),
        copied: counts,
        seedVersion: SEED_VERSION,
        seededAt: fs.serverTimestamp(),
    }, { merge: true });
    return SEED_VERSION;
}

// The device keeps its own cached copy of the practice data with sync marks
// (DataContext, keys prefixed training_<courseId>_). Records copied in by a
// newer seed are older than those marks and would never be fetched, so the
// cached copy is dropped whenever the sandbox's seed version changes.
export function refreshDeviceCache(courseId, seedVersion) {
    const prefix = `training_${courseId}_`;
    const key = `chm_training_cache_seed_${courseId}`;
    try {
        if (localStorage.getItem(key) === String(seedVersion)) return;
        Object.keys(localStorage).filter((k) => k.startsWith(prefix)).forEach((k) => localStorage.removeItem(k));
        try { indexedDB.deleteDatabase(`AppDataCache_${prefix}`); } catch { /* no IndexedDB */ }
        localStorage.setItem(key, String(seedVersion));
    } catch { /* storage blocked */ }
}

