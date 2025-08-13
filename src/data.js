import {
  collection, doc, getDocs, addDoc, setDoc, query, where, orderBy,
  writeBatch, serverTimestamp
} from 'firebase/firestore';
import { db, auth } from './firebase';

// Courses
export async function listCoursesByType(courseType) {
  const q = query(collection(db,'courses'), where('course_type','==',courseType));
  const s = await getDocs(q); return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function upsertCourse(c) {
  const payload = { ...c, createdAt: serverTimestamp(), createdByUid: auth.currentUser?.uid || null, createdByEmail: auth.currentUser?.email || null };
  if (c.id) { await setDoc(doc(db,'courses',c.id), payload, { merge:true }); return c.id; }
  const ref = await addDoc(collection(db,'courses'), payload); return ref.id;
}

// Participants
export async function listParticipants(courseId) {
  const q = query(collection(db,'participants'), where('courseId','==',courseId), orderBy('name'));
  const s = await getDocs(q); return s.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function upsertParticipant(p) {
  const id = p.id ?? crypto.randomUUID().slice(0,12);
  await setDoc(doc(db,'participants',id), p, { merge:true }); return id;
}

// Observations (bulk)
export async function addObservations(rows) {
  const batch = writeBatch(db);
  for (const r of rows) {
    const id = r.id ?? crypto.randomUUID().slice(0,16);
    batch.set(doc(db,'observations',id), r, { merge:true });
  }
  await batch.commit();
}

// Cases
export async function addCase(c) {
  const id = c.id ?? `${c.courseId}_${c.participant_id}_${c.encounter_date}_${c.case_serial}`;
  await setDoc(doc(db,'cases',id), c, { merge:true }); return id;
}
