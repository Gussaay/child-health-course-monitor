// Pre-tests for the online courses (Qusay, 2026-11-19), written to the live app IN PLACE.
//
//  1. ETAT pre-test and post-test (exerciseDefinitions sudan-etat-pre-test / -post-test):
//     the questions become English; the Arabic is kept with each question
//     (questionAr, optionsAr) and the switch to Arabic stays off (arabicOn false).
//  2. IMNCI pre-test (exerciseDefinitions imnci-pre-test): the 20 questions of the
//     app's IMNCI Pre/Post Test, new.
//  3. Lessons, patched, never replaced, so app edits and learner progress are kept:
//     - ETAT Module 1 "Welcome to the course and pre-test": the sentence that said the
//       test is in Arabic now says English.
//     - Sudan IMNCI course and IMNCI distance learning modules, Module 1 "How to study
//       this course": the pre-test part (heading, paragraph, exercise) added at the end.
//
//   node pretests.cjs            dry run: shows what would change, writes nothing
//   node pretests.cjs --commit   writes it; every document touched is tagged
//   node pretests.cjs --undo     puts back what --commit changed (and removes imnci-pre-test)
//
// KEY_FILE (or --key <file>) is the Firebase service-account JSON.
const path = require('path'), fs = require('fs');
const req = (m) => require(require.resolve(m, { paths: [process.cwd(), path.join(__dirname, '..', '..'), __dirname] }));
const admin = req('firebase-admin');

const TAG = 'pretests-2026-11-19';
const PKG = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'course-packages', f), 'utf8'));
const COURSES = {
  etat: { batch: 'sudan-etat-training-2026-11-18', file: 'sudan-etat-training.imnci.json' },
  classic: { batch: 'imnci-sudan-classic-modules-1-3-2026-11-17', file: 'sudan-imnci-classic-modules-1-3.imnci.json' },
  dimci: { batch: 'imnci-dimci-modules-1-2-2026-11-15', file: 'who-dimci-modules-1-9.imnci.json' },
};
const OLD_ETAT_TEXT = 'It has the 20 questions of the ETAT pre/post test, in Arabic.';

const a = process.argv.slice(2);
const keyPath = a.includes('--key') ? a[a.indexOf('--key') + 1] : process.env.KEY_FILE;
if (!keyPath || !fs.existsSync(keyPath)) { console.error('Pass --key <service-account.json> or set KEY_FILE'); process.exit(1); }
const COMMIT = a.includes('--commit'), UNDO = a.includes('--undo');

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
const db = admin.firestore(), now = () => admin.firestore.FieldValue.serverTimestamp(), DEL = admin.firestore.FieldValue.delete();
const byOrder = (x, y) => (x.order || 0) - (y.order || 0);
const norm = (s) => String(s || '').trim().toLowerCase();
const plain = (b) => String(b?.text || b?.title || b?.exerciseId || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// Same fields as upsertExerciseDefinition in data.js. `draft` is not changed on an exercise already in the app.
const EX_FIELDS = ['title', 'titleAr', 'subCourse', 'kind', 'passMark', 'estimatedMinutes', 'arabicOn', 'narrativeJson', 'narrativeArJson', 'questionsJson'];
const exRecord = (e) => ({
  title: e.title, titleAr: e.titleAr || '', subCourse: e.subCourse || '', kind: e.kind || 'quiz',
  passMark: Number(e.passMark) || 80, estimatedMinutes: Number(e.estimatedMinutes) || 15, arabicOn: e.arabicOn === true,
  narrativeJson: JSON.stringify(e.narrative || []), narrativeArJson: JSON.stringify(e.narrativeAr || []),
  questionsJson: JSON.stringify(e.questions || []),
});

async function findCourse(key) {
  const s = await db.collection('onlineCourses').where('importBatch', '==', COURSES[key].batch).get();
  return s.docs.find((d) => !d.data().isDeleted) || null;
}
async function firstModuleLesson(courseId, title) {
  const items = (await db.collection('onlineCourseItems').where('courseId', '==', courseId).get()).docs.filter((d) => !d.data().isDeleted);
  const mod = items.filter((d) => d.data().kind === 'module').sort((x, y) => byOrder(x.data(), y.data()))[0];
  if (!mod) return null;
  const hit = items.filter((d) => d.data().kind === 'section' && d.data().moduleId === mod.id && norm(d.data().title) === norm(title));
  return hit.length === 1 ? hit[0] : null;
}

async function undo() {
  let n = 0;
  for (const col of ['exerciseDefinitions', 'onlineCourseItems']) {
    const s = await db.collection(col).where('pretestTag', '==', TAG).get();
    for (const d of s.docs) {
      const x = d.data();
      if (x.pretestCreated) { await d.ref.delete(); console.log(`  removed ${col}/${d.id}`); n++; continue; }
      const prev = JSON.parse(x.pretestPreviousJson || '{}');
      const back = Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, v === null ? DEL : v]));
      await d.ref.update({ ...back, pretestTag: DEL, pretestPreviousJson: DEL, lastUpdatedAt: now() });
      console.log(`  restored ${col}/${d.id} (${x.title || ''})`); n++;
    }
  }
  console.log(`Undo done: ${n} documents put back.`);
}

(async () => {
  if (UNDO) return undo();
  const plan = [];   // { ref, label, create?, set, prev }
  const notes = [];

  // ---- 1 and 2: exercises
  const etatPkg = PKG(COURSES.etat.file), classicPkg = PKG(COURSES.classic.file);
  const wanted = [
    ...etatPkg.exercises.filter((e) => ['sudan-etat-pre-test', 'sudan-etat-post-test'].includes(e.id)),
    ...classicPkg.exercises.filter((e) => e.id === 'imnci-pre-test'),
  ];
  if (wanted.length !== 3) throw new Error(`Expected 3 exercises in the course files, found ${wanted.map((e) => e.id)}`);
  for (const e of wanted) {
    const ref = db.collection('exerciseDefinitions').doc(e.id);
    const d = await ref.get();
    const rec = exRecord(e);
    if (!d.exists || d.data().isDeleted) {
      plan.push({ ref, label: `NEW exercise ${e.id} "${e.title}" (${e.questions.length} questions, draft like the other course exercises)`,
        create: true, set: { id: e.id, order: Number(e.order) || 0, formType: 'child', draft: e.draft !== false, explain: '',
          learningPointsJson: '[]', expectedJson: '{}', isDeleted: false, ...rec, importBatch: TAG } });
      continue;
    }
    const cur = d.data();
    // The ETAT questions in the app should still be the Arabic ones uploaded on 2026-11-18. If someone
    // changed them in Manage Exercises, they are left alone and listed.
    if (e.id.startsWith('sudan-etat')) {
      const asUploaded = JSON.stringify(e.questions.map((q) => ({ id: q.id, type: q.type, question: q.questionAr, options: q.optionsAr, correct: q.correct, explain: q.explain })));
      if (cur.questionsJson !== asUploaded && cur.questionsJson !== rec.questionsJson) {
        notes.push(`exercise ${e.id}: its questions were changed in the app since the upload, so it is LEFT AS IT IS.`);
        continue;
      }
    }
    const changed = EX_FIELDS.filter((k) => JSON.stringify(cur[k] ?? null) !== JSON.stringify(rec[k]));
    if (!changed.length) { notes.push(`exercise ${e.id}: already up to date.`); continue; }
    plan.push({ ref, label: `exercise ${e.id} "${cur.title}" (draft: ${cur.draft === true}, kept): ${changed.join(', ')}`,
      set: Object.fromEntries(changed.map((k) => [k, rec[k]])), prev: Object.fromEntries(changed.map((k) => [k, cur[k] ?? null])),
      show: () => e.questions.slice(0, 3).map((q, i) => `       Q${i + 1} ${q.question}  |  ${q.options.join(' / ')}`) });
  }

  // ---- 3: lessons
  const etat = await findCourse('etat');
  if (!etat) notes.push('ETAT course not found in the app.');
  else {
    const L = await firstModuleLesson(etat.id, 'Welcome to the course and pre-test');
    if (!L) notes.push('ETAT: lesson "Welcome to the course and pre-test" not found in Module 1.');
    else {
      const file = etatPkg.modules.sort(byOrder)[0].sections.find((s) => norm(s.title) === 'welcome to the course and pre-test');
      const newText = (file.read || []).find((b) => b.type === 'paragraph' && b.text.includes('pre/post test, in English')).text;
      const read = L.data().read || [];
      const i = read.findIndex((b) => b.type === 'paragraph' && String(b.text || '').includes(OLD_ETAT_TEXT));
      if (i < 0) notes.push(read.some((b) => String(b.text || '').includes('in English')) ? 'ETAT welcome lesson: already says English.'
        : 'ETAT welcome lesson: the sentence about the Arabic test is not there (edited in the app?), so the lesson is left as it is.');
      else {
        const next = read.map((b, k) => (k === i ? { ...b, text: newText } : b));
        plan.push({ ref: L.ref, label: `ETAT course ${etat.id}, Module 1 "${L.data().title}": block ${i + 1} text`,
          set: { read: next }, prev: { read }, show: () => [`       was: ${plain(read[i])}`, `       now: ${newText}`] });
      }
    }
  }
  for (const key of ['classic', 'dimci']) {
    const c = await findCourse(key);
    if (!c) { notes.push(`${key}: course not found in the app.`); continue; }
    const L = await firstModuleLesson(c.id, 'How to study this course');
    if (!L) { notes.push(`${key}: lesson "How to study this course" not found in Module 1.`); continue; }
    const read = L.data().read || [];
    if (read.some((b) => b.type === 'exercise' && b.exerciseId === 'imnci-pre-test')) { notes.push(`${key}: pre-test already in "How to study this course".`); continue; }
    const pkg = PKG(COURSES[key].file);
    const file = pkg.modules.sort(byOrder)[0].sections.find((s) => norm(s.title) === 'how to study this course');
    const at = (file.read || []).findIndex((b) => b.type === 'heading' && /pre-test/i.test(b.text));
    const add = file.read.slice(at);
    const intro = file.read[0];
    const next = [...read, ...add];
    // The "In this lesson" note now mentions the pre-test, if it is still the one uploaded.
    const ni = next.findIndex((b) => b.type === 'note' && b.label === 'In this lesson' && /This lesson takes about 5 minutes\./.test(b.text || ''));
    if (ni >= 0) next[ni] = { ...next[ni], text: intro.text };
    plan.push({ ref: L.ref, label: `${c.data().title} (${c.id}), Module 1 "${L.data().title}": ${read.length} blocks -> ${next.length}`,
      set: { read: next }, prev: { read },
      show: () => [...(ni >= 0 ? [`       note "In this lesson" now: ${intro.text}`] : []), ...add.map((b) => `       + ${b.type.padEnd(9)} ${plain(b).slice(0, 120)}`)] });
  }

  console.log(`Changes (${plan.length}). Lessons keep their ids, so learners keep their progress:`);
  plan.forEach((p) => { console.log(`\n  ${p.label}`); (p.show?.() || []).forEach((l) => console.log(l)); });
  if (notes.length) console.log(`\nNot changed:\n  ${notes.join('\n  ')}`);
  if (!COMMIT) return console.log('\nDry run: nothing written.');

  for (const p of plan) {
    if (p.create) await p.ref.set({ ...p.set, pretestTag: TAG, pretestCreated: true, createdAt: now(), lastUpdatedAt: now(), lastUpdatedAtLocal: new Date().toISOString() });
    else await p.ref.update({ ...p.set, pretestTag: TAG, pretestPreviousJson: JSON.stringify(p.prev), lastUpdatedAt: now(), lastUpdatedAtLocal: new Date().toISOString() });
  }
  console.log(`\nWrote ${plan.length} documents (tag ${TAG}; undo puts them back).`);
})().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
