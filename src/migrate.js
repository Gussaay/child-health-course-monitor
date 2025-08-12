import { db } from './firebase';
import { writeBatch, doc } from 'firebase/firestore';

const LS_COURSES = "imci_courses_v9";
const LS_PARTS   = "imci_participants_v9";
const LS_OBS     = "imci_observations_v9";
const LS_CASES   = "imci_cases_v2";

const readLS = (k, d=[]) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };

export async function migrateLocalToFirestore() {
  const courses = readLS(LS_COURSES, []);
  const parts   = readLS(LS_PARTS,   []);
  const obs     = readLS(LS_OBS,     []);
  const cases   = readLS(LS_CASES,   []);

  const all = [
    ...courses.map(c => ({ col:'courses', id:c.id, data:c })),
    ...parts.map(p   => ({ col:'participants', id:p.id, data:p })),
    ...obs.map(o     => ({ col:'observations', id:o.id ?? `${o.courseId}_${o.participant_id}_${o.domain}_${o.classification_recorded}_${o.encounter_date}_${o.case_serial??'x'}`, data:o })),
    ...cases.map(k   => ({ col:'cases', id:`${k.courseId}_${k.participant_id}_${k.encounter_date}_${k.case_serial}`, data:k })),
  ];

  const CHUNK = 450; // < 500 write limit
  for (let i=0; i<all.length; i+=CHUNK) {
    const batch = writeBatch(db);
    for (const {col,id,data} of all.slice(i,i+CHUNK)) {
      const safeId = String(id || crypto.randomUUID().slice(0,16)).replace(/\//g,'_');
      batch.set(doc(db,col,safeId), data, { merge:true });
    }
    await batch.commit();
  }
  return { courses:courses.length, participants:parts.length, observations:obs.length, cases:cases.length };
}
