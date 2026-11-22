// Brings the lessons of a course already in the app up to date with its course
// file, IN PLACE: each lesson keeps its id, so learners keep their progress
// (completed lessons stay completed). Only lessons whose content changed are
// written. A lesson is matched by its module number and its title.
//
//   node update-lessons.cjs <course>            dry run: lists what would change
//   node update-lessons.cjs <course> --commit   writes the changed lessons
//   node update-lessons.cjs <course> --undo     puts back what the last --commit replaced
//
// <course> is one of the keys of COURSES below. KEY_FILE (or --key <file>) is the
// Firebase service-account JSON. A lesson edited in the app since it was
// uploaded is left alone and listed, so an author's change is never lost.
const path = require('path'), fs = require('fs');
const req = (m) => require(require.resolve(m, { paths: [process.cwd(), path.join(__dirname, '..', '..'), __dirname] }));
const admin = req('firebase-admin');

const COURSES = {
  classic: { batch: 'imnci-sudan-classic-modules-1-3-2026-11-17', file: 'sudan-imnci-classic-modules-1-3.imnci.json' },
  dimci: { batch: 'imnci-dimci-modules-1-2-2026-11-15', file: 'who-dimci-modules-1-9.imnci.json' },
  etat: { batch: 'sudan-etat-training-2026-11-18', file: 'sudan-etat-training.imnci.json' },
  ssnb1: { batch: 'ssnb-m1-2026-11-21', file: 'ssnb-module-1-essential-emergency-newborn-care.imnci.json' },
  ssnb2: { batch: 'ssnb-m2-2026-11-21', file: 'ssnb-module-2-special-newborn-care.imnci.json' },
  ssnb3: { batch: 'ssnb-m3-2026-11-21', file: 'ssnb-module-3-intensive-newborn-care.imnci.json' },
  ssnbguide: { batch: 'ssnb-fg-2026-11-21', file: 'ssnb-facilitator-guide.imnci.json' },
};
const UPDATE_TAG = 'lesson-update-2026-11-22-sop-buttons';
const CONTENT = ['read', 'see', 'practise'];
// Lessons edited in the app that may still be overwritten (titles, one per line), after the author agreed.
const FORCE = (() => { try { return fs.readFileSync(path.join(__dirname, 'force.txt'), 'utf8').split('\n').map((x) => x.trim().toLowerCase()).filter(Boolean); } catch { return []; } })();

const a = process.argv.slice(2);
const which = a.find((x) => COURSES[x]);
if (!which) { console.error(`Name the course: ${Object.keys(COURSES).join(' | ')}`); process.exit(1); }
const keyPath = a.includes('--key') ? a[a.indexOf('--key') + 1] : process.env.KEY_FILE;
if (!keyPath || !fs.existsSync(keyPath)) { console.error('Pass --key <service-account.json> or set KEY_FILE'); process.exit(1); }
const COMMIT = a.includes('--commit'), UNDO = a.includes('--undo');
const C = COURSES[which];
const FILE = path.join(__dirname, '..', '..', 'course-packages', C.file);

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
const db = admin.firestore(), now = () => admin.firestore.FieldValue.serverTimestamp();
const byOrder = (x, y) => (x.order || 0) - (y.order || 0);
// Same as upsertExerciseDefinition in src/data.js (and the course upload scripts).
const exerciseRecord = (e) => ({
  id: e.id, order: Number(e.order) || 0, title: e.title, titleAr: e.titleAr || '', subCourse: e.subCourse || '',
  kind: e.kind || 'case', formType: e.formType || 'child', passMark: Number(e.passMark) || 80,
  estimatedMinutes: Number(e.estimatedMinutes) || 15, draft: e.draft !== false, arabicOn: e.arabicOn === true, explain: e.explain || '',
  learningPointsJson: JSON.stringify(e.learningPoints || []), narrativeJson: JSON.stringify(e.narrative || []),
  narrativeArJson: JSON.stringify(e.narrativeAr || []), expectedJson: JSON.stringify(e.expected || {}),
  questionsJson: JSON.stringify(e.questions || []), isDeleted: false,
});
const EX_CONTENT = ['order', 'title', 'titleAr', 'subCourse', 'kind', 'formType', 'passMark', 'estimatedMinutes', 'arabicOn', 'explain',
  'learningPointsJson', 'narrativeJson', 'narrativeArJson', 'expectedJson', 'questionsJson'];
// draft (published or not) is the manager's choice once an exercise is live, so an update never changes it.
const norm = (s) => String(s || '').trim().toLowerCase();
const plain = (b) => String(b?.text || b?.title || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

async function findCourse(pkg) {
  if (C.batch) {
    const s = await db.collection('onlineCourses').where('importBatch', '==', C.batch).get();
    const live = s.docs.filter((d) => !d.data().isDeleted);
    if (live.length) return live[0];
  }
  const s = await db.collection('onlineCourses').where('title', '==', pkg.course.title.trim()).get();
  const live = s.docs.filter((d) => !d.data().isDeleted);
  if (live.length > 1) throw new Error(`${live.length} courses are called "${pkg.course.title}"; add the import batch to COURSES.`);
  return live[0] || null;
}

(async () => {
  const pkg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const course = await findCourse(pkg);
  if (!course) throw new Error(`Course "${pkg.course.title}" is not in the app.`);
  const items = (await db.collection('onlineCourseItems').where('courseId', '==', course.id).get()).docs
    .filter((d) => !d.data().isDeleted);
  const mods = items.filter((d) => d.data().kind === 'module').sort((x, y) => byOrder(x.data(), y.data()));
  console.log(`Course ${course.id} "${course.data().title}" (${course.data().isPublished ? 'published' : 'not published'}): ` +
    `${mods.length} modules, ${items.length - mods.length} lessons in the app; file ${C.file}.`);

  if (UNDO) {
    const tagged = items.filter((d) => d.data().contentUpdateTag === UPDATE_TAG && d.data().previousContentJson);
    for (const d of tagged) {
      const prev = JSON.parse(d.data().previousContentJson);
      await d.ref.update({ ...prev, contentUpdateTag: admin.firestore.FieldValue.delete(),
        previousContentJson: admin.firestore.FieldValue.delete(), lastUpdatedAt: now() });
      console.log(`  restored "${d.data().title}"`);
    }
    // Only this course's exercises: both courses share the update tag.
    const ownIds = new Set((pkg.exercises || []).map((e) => e.id));
    const exs = (await db.collection('exerciseDefinitions').where('exerciseUpdateTag', '==', UPDATE_TAG).get()).docs
      .filter((d) => ownIds.has(d.id));
    for (const d of exs) {
      const prev = d.data().previousExerciseJson;
      const back = prev === 'new' ? { isDeleted: true } : JSON.parse(prev || '{}');
      await d.ref.update({ ...back, exerciseUpdateTag: admin.firestore.FieldValue.delete(),
        previousExerciseJson: admin.firestore.FieldValue.delete(), lastUpdatedAt: now(), lastUpdatedAtLocal: new Date().toISOString() });
      console.log(`  ${prev === 'new' ? 'removed added' : 'restored'} exercise ${d.id}`);
    }
    return console.log(`Undo done: ${tagged.length} lessons and ${exs.length} exercises put back.`);
  }

  const plan = [], kept = [], missing = [];
  [...pkg.modules].sort(byOrder).forEach((m, mi) => {
    const mod = mods[mi];
    if (!mod) { missing.push(`module ${mi + 1} "${m.title}"`); return; }
    const secs = items.filter((d) => d.data().kind === 'section' && d.data().moduleId === mod.id);
    [...m.sections].sort(byOrder).forEach((s) => {
      const hit = secs.filter((d) => norm(d.data().title) === norm(s.title));
      if (hit.length !== 1) { missing.push(`${mi + 1}: "${s.title}"${hit.length > 1 ? ' (title used twice)' : ''}`); return; }
      const cur = hit[0].data();
      const changed = CONTENT.filter((k) => JSON.stringify(cur[k] || []) !== JSON.stringify(s[k] || []));
      if (!changed.length) return;
      // Saved in the app after it was written by an upload or by this script? (The app sets only lastUpdatedAt;
      // the script also sets lastUpdatedAtLocal at the same moment.)
      const since = String(cur.contentUpdateTag || '').startsWith('lesson-update-') && cur.lastUpdatedAtLocal
        ? Date.parse(cur.lastUpdatedAtLocal) : cur.createdAt?.toMillis?.();
      const edited = cur.lastUpdatedAt && since && cur.lastUpdatedAt.toMillis() - since > 60000 && !FORCE.includes(norm(s.title));
      (edited ? kept : plan).push({ ref: hit[0].ref, mod: mi + 1, title: s.title, cur, next: s, changed });
    });
  });

  console.log(`\nLessons to update in place (${plan.length}). Each keeps its id, so learners keep their progress:`);
  plan.forEach(({ mod, title, cur, next }) => {
    const before = (cur.read || []).map((b) => b.type), after = (next.read || []).map((b) => b.type);
    console.log(`\n  Module ${mod} · "${title}": ${before.length} blocks -> ${after.length} blocks`);
    after.forEach((t, i) => console.log(`     ${String(i + 1).padStart(2)}. ${t.padEnd(9)} ${plain(next.read[i]).slice(0, 110)}`));
  });
  if (kept.length) {
    console.log(`\nChanged in the file but edited in the app since the upload, so LEFT AS THEY ARE (${kept.length}):`);
    kept.forEach(({ mod, title, cur }) => {
      const when = cur.lastUpdatedAt?.toDate?.().toISOString?.() || '';
      console.log(`\n  Module ${mod} · "${title}" (last saved in the app ${when}${cur.lastUpdatedBy ? ` by ${cur.lastUpdatedBy}` : ''}). What is in the app now:`);
      (cur.read || []).forEach((b, i) => console.log(`     ${String(i + 1).padStart(2)}. ${String(b.type).padEnd(9)} ${plain(b).slice(0, 110)}`));
    });
  }
  if (missing.length) console.log(`\nIn the file but not matched in the app (not written): ${missing.join('; ')}`);

  // Exercises of the course file: new ones are added; ones written by an upload or by this script are brought up to
  // date; one edited in the exercise manager since then is left as it is.
  const exPlan = [], exKept = [];
  for (const e of pkg.exercises || []) {
    const d = await db.collection('exerciseDefinitions').doc(e.id).get();
    const r = exerciseRecord(e);
    if (!d.exists || d.data().isDeleted) { exPlan.push({ e, r, ref: d.ref, isNew: true }); continue; }
    const cur = d.data();
    const diff = EX_CONTENT.filter((k) => JSON.stringify(cur[k] ?? '') !== JSON.stringify(r[k] ?? ''));
    if (!diff.length) continue;
    const since = cur.lastUpdatedAtLocal ? Date.parse(cur.lastUpdatedAtLocal) : null;
    const edited = !since || (cur.lastUpdatedAt && cur.lastUpdatedAt.toMillis() - since > 60000);
    (edited ? exKept : exPlan).push({ e, r, ref: d.ref, cur, diff });
  }
  console.log(`\nExercises to add or update (${exPlan.length}):`);
  exPlan.forEach(({ e, isNew, diff }) => console.log(`  ${isNew ? '+' : '^'} ${e.id}  "${e.title}"${isNew ? '' : `  changes: ${diff.join(', ')}`}` +
    `${(e.questions || []).some((q) => q.video) ? `  (${e.questions.filter((q) => q.video).length} video questions)` : ''}`));
  if (exKept.length) console.log(`Exercises changed in the file but edited in the exercise manager, LEFT AS THEY ARE: ${exKept.map(({ e }) => e.id).join(', ')}`);
  if (!COMMIT) return console.log('\nDry run: nothing written.');
  for (const x of exPlan) {
    const prev = x.isNew ? null : Object.fromEntries(EX_CONTENT.map((k) => [k, x.cur[k] ?? null]));
    const rest = { ...x.r }; delete rest.draft;
    await x.ref.set({ ...(x.isNew ? x.r : rest), ...(x.isNew ? { importBatch: C.batch, createdAt: now() } : {}),
      exerciseUpdateTag: UPDATE_TAG, previousExerciseJson: prev ? JSON.stringify(prev) : 'new',
      lastUpdatedAt: now(), lastUpdatedAtLocal: new Date().toISOString() }, { merge: true });
  }
  console.log(`Exercises written: ${exPlan.length}.`);

  for (const p of plan) {
    const prev = Object.fromEntries(CONTENT.map((k) => [k, p.cur[k] || []]));
    await p.ref.update({ read: p.next.read || [], see: p.next.see || [], practise: p.next.practise || [],
      previousContentJson: JSON.stringify(prev), contentUpdateTag: UPDATE_TAG, lastUpdatedAt: now(),
      lastUpdatedAtLocal: new Date().toISOString() });
  }
  console.log(`\nUpdated ${plan.length} lessons in place (tag ${UPDATE_TAG}; undo puts them back).`);
})().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
