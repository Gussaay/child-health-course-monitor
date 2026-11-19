// Uploads the WHO distance learning Modules 1 to 9 course file into the live
// app, writing exactly what Online courses → Manage → Import → "Import a course
// file" (new course) writes: the exercises into exerciseDefinitions, then the
// course, its modules and sections into onlineCourses / onlineCourseItems.
//   node upload-modules.cjs            dry run (reads only, lists what would be written)
//   node upload-modules.cjs --commit   writes
//   node upload-modules.cjs --replace  the course is already uploaded: swaps its modules and sections for the
//                                      file's, and brings the exercises this upload wrote up to date with the file.
//                                      The course itself (its id, title, published or not) is left as it is.
//   node upload-modules.cjs --undo     removes what --commit or --replace wrote (by importBatch)
// A dry run says which of the two it would be.
//   --guide  works on the facilitator guide file instead (its own course, shown only to facilitators,
//            with its own importBatch tag, so commit, replace and undo never touch the learners' modules).
// KEY_FILE (or --key <file>) is the Firebase service-account JSON.
const path = require('path'), fs = require('fs');
const req = (m) => require(require.resolve(m, { paths: [process.cwd(), path.join(__dirname, '..', '..'), __dirname] }));
const admin = req('firebase-admin');
const a = process.argv.slice(2);
const keyPath = a.includes('--key') ? a[a.indexOf('--key') + 1] : process.env.KEY_FILE;
if (!keyPath || !fs.existsSync(keyPath)) { console.error('Pass --key <service-account.json> or set KEY_FILE'); process.exit(1); }
const COMMIT = a.includes('--commit'), UNDO = a.includes('--undo'), REPLACE = a.includes('--replace');
// The batch tag keeps the name of the first upload (Modules 1 and 2), so replace and undo still find it.
const GUIDE = a.includes('--guide');
const BATCH = GUIDE ? 'imnci-dimci-facilitator-guide-2026-11-17' : 'imnci-dimci-modules-1-2-2026-11-15';
const FILE = path.join(__dirname, '..', '..', 'course-packages', GUIDE ? 'who-dimci-facilitator-guide.imnci.json' : 'who-dimci-modules-1-9.imnci.json');

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
const db = admin.firestore(), now = () => admin.firestore.FieldValue.serverTimestamp();

// Same as coursePackage.js
const STORAGE_FIELDS = ['id', 'courseId', 'moduleId', 'createdAt', 'lastUpdatedAt', 'lastUpdatedAtLocal',
  'isDeleted', 'deletedAt', 'deletedBy', 'legacyKey', 'legacyModuleKey', 'isCustom', 'blocks', 'test'];
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => !STORAGE_FIELDS.includes(k) && v !== undefined));
const byOrder = (x, y) => (x.order || 0) - (y.order || 0);

// Same as upsertExerciseDefinition in data.js
const exerciseRecord = (e) => ({
  id: e.id, order: Number(e.order) || 0, title: e.title, titleAr: e.titleAr || '', subCourse: e.subCourse || '',
  kind: e.kind || 'case', formType: e.formType || 'child', passMark: Number(e.passMark) || 80,
  estimatedMinutes: Number(e.estimatedMinutes) || 15, draft: e.draft !== false, explain: e.explain || '',
  learningPointsJson: JSON.stringify(e.learningPoints || []), narrativeJson: JSON.stringify(e.narrative || []),
  narrativeArJson: JSON.stringify(e.narrativeAr || []), expectedJson: JSON.stringify(e.expected || {}),
  questionsJson: JSON.stringify(e.questions || []), isDeleted: false,
});
const CONTENT = ['title', 'titleAr', 'subCourse', 'kind', 'formType', 'passMark', 'estimatedMinutes', 'explain',
  'learningPointsJson', 'narrativeJson', 'narrativeArJson', 'expectedJson', 'questionsJson'];

async function undo() {
  let n = 0;
  for (const col of ['onlineCourseItems', 'onlineCourses', 'exerciseDefinitions']) {
    const s = await db.collection(col).where('importBatch', '==', BATCH).get();
    for (let i = 0; i < s.docs.length; i += 400) {
      const b = db.batch(); s.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit();
    }
    console.log(`Removed ${s.size} from ${col}`); n += s.size;
  }
  console.log(`Undo done: ${n} documents removed.`);
}

(async () => {
  if (UNDO) return undo();
  const pkg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  if (pkg.format !== 'imnci-course-package' || pkg.version !== 1) throw new Error('Not a course file v1');
  console.log(`File: ${path.basename(FILE)} — course "${pkg.course.title}", ${pkg.modules.length} modules, ` +
    `${pkg.modules.reduce((n, m) => n + m.sections.length, 0)} sections, ${pkg.exercises.length} exercises`);

  // What is already there
  const already = await db.collection('onlineCourses').where('importBatch', '==', BATCH).get();
  const existing = already.docs[0] || null;
  if (existing && COMMIT) { console.error(`This upload was already written (course ${existing.id}). Use replace to bring it up to date.`); process.exit(1); }
  if (!existing && REPLACE) { console.error('Nothing to replace: this upload is not in the app. Use commit.'); process.exit(1); }
  let oldItems = [];
  if (existing) {
    const c = existing.data();
    oldItems = (await db.collection('onlineCourseItems').where('courseId', '==', existing.id).get()).docs;
    const mine = oldItems.filter((d) => d.data().importBatch === BATCH);
    const edited = mine.filter((d) => { const x = d.data(); return x.lastUpdatedAt && x.createdAt && x.lastUpdatedAt.toMillis() - x.createdAt.toMillis() > 60000; });
    console.log(`\nALREADY UPLOADED: course ${existing.id} "${c.title}" (${c.isPublished ? 'PUBLISHED' : 'not published'}${c.isDeleted ? ', deleted' : ''}).`);
    console.log(`  It has ${oldItems.length} modules/sections: ${mine.length} from this upload, ${oldItems.length - mine.length} added in the app since.`);
    console.log(`  Edited in the app since the upload: ${edited.length}${edited.length ? ' — ' + edited.map((d) => `"${d.data().title}"`).join(', ') : ''}`);
    console.log('  Replace removes the modules and sections from this upload and writes the ones below. Anything added in the app since is kept.');
    oldItems = mine;
  }
  const courses = await db.collection('onlineCourses').get();
  console.log(`\nOnline courses now in the app (${courses.size}):`);
  courses.docs.forEach((d) => { const c = d.data(); console.log(`  ${d.id}  "${c.title}"${c.isDeleted ? ' (deleted)' : ''}${c.isPublished ? ' (published)' : ''}`); });
  const same = courses.docs.filter((d) => !d.data().isDeleted && String(d.data().title).trim() === pkg.course.title);
  if (same.length) console.log(`  NOTE: ${same.length} course(s) already called "${pkg.course.title}" — this upload adds a separate new course.`);

  // Exercises: new ones are written; ones already in the app are left as they are (same as the Import dialog without "replace").
  const exNew = [], exSame = [], exDiff = [], exUpdate = [];
  for (const e of pkg.exercises) {
    const d = await db.collection('exerciseDefinitions').doc(e.id).get();
    if (!d.exists || d.data().isDeleted) { exNew.push(e); continue; }
    const r = exerciseRecord(e), cur = d.data();
    const diff = CONTENT.filter((k) => JSON.stringify(cur[k] ?? '') !== JSON.stringify(r[k] ?? ''));
    // An exercise this upload wrote is brought up to date; one that was in the app before is never touched.
    if (diff.length && existing && cur.importBatch === BATCH) exUpdate.push({ e, diff });
    else (diff.length ? exDiff : exSame).push({ e, diff });
  }
  console.log(`\nExercises: ${exNew.length} new to write, ${exUpdate.length} from this upload to bring up to date, ${exSame.length} already in the app (identical), ${exDiff.length} already in the app but different (kept as they are):`);
  exNew.forEach((e) => console.log(`  + ${e.id}  ${e.kind || 'case'}  "${e.title}"`));
  exUpdate.forEach(({ e, diff }) => console.log(`  ^ ${e.id}  "${e.title}"  changes: ${diff.join(', ')}`));
  exSame.forEach(({ e }) => console.log(`  = ${e.id}  "${e.title}"`));
  exDiff.forEach(({ e, diff }) => console.log(`  ~ ${e.id}  "${e.title}"  differs in: ${diff.join(', ')}`));

  // Course, modules, sections (packagePlan + bulkUpsertOnlineCourseContent, new course)
  const courseRef = existing ? existing.ref : db.collection('onlineCourses').doc();
  const course = { ...clean(pkg.course), title: pkg.course.title.trim(), isPublished: false, source: 'file' };
  const writes = [];
  [...pkg.modules].sort(byOrder).forEach((m, mi) => {
    const { sections = [], ...mod } = JSON.parse(JSON.stringify(m));
    const mref = db.collection('onlineCourseItems').doc();
    const key = `file-${Date.now().toString(36)}-${mi + 1}`;
    writes.push({ ref: mref, data: { ...clean(mod), kind: 'module', order: mi + 1, isPublished: mod.isPublished !== false, legacyKey: key, source: 'file', id: mref.id, courseId: courseRef.id } });
    console.log(`\nModule ${mi + 1}: "${mod.title}"  (${sections.length} sections)`);
    [...sections].sort(byOrder).forEach((s, si) => {
      const sec = clean(s), sref = db.collection('onlineCourseItems').doc();
      const blocks = [...(sec.read || []), ...(sec.see || []), ...(sec.practise || [])];
      const types = {}; blocks.forEach((b) => { types[b.type] = (types[b.type] || 0) + 1; });
      writes.push({ ref: sref, data: { ...sec, kind: 'section', order: si + 1, legacyModuleKey: key, source: 'file',
        read: sec.read || [], see: sec.see || [], practise: sec.practise || [], isPublished: sec.isPublished !== false,
        id: sref.id, courseId: courseRef.id, moduleId: mref.id } });
      console.log(`  ${mi + 1}.${si + 1} "${sec.title}"  ${blocks.length} blocks: ${Object.entries(types).map(([k, v]) => `${v} ${k}`).join(', ')}`);
    });
  });
  const missing = writes.flatMap((w) => [...(w.data.read || []), ...(w.data.see || []), ...(w.data.practise || [])])
    .filter((b) => b.type === 'exercise' && !pkg.exercises.some((e) => e.id === b.exerciseId));
  if (missing.length) throw new Error(`Sections link to exercises not in the file: ${missing.map((b) => b.exerciseId)}`);

  if (existing) console.log(`\nPlan (replace): in course ${existing.id}, remove ${oldItems.length} modules/sections from this upload and write ` +
    `${writes.filter((w) => w.data.kind === 'module').length} modules and ${writes.filter((w) => w.data.kind === 'section').length} sections; ` +
    `update ${exUpdate.length} exercises, add ${exNew.length}. The course record is not changed. Lesson progress saved against the old sections does not carry over.`);
  else console.log(`\nPlan: 1 new course "${course.title}" (unpublished until you publish it in Manage), ` +
    `${writes.filter((w) => w.data.kind === 'module').length} modules, ${writes.filter((w) => w.data.kind === 'section').length} sections, ` +
    `${exNew.length} new exercises. Every document is tagged importBatch=${BATCH}. Nothing already in the app is changed.`);
  if (!COMMIT && !REPLACE) return console.log('\nDry run: nothing written.');

  for (let i = 0; i < oldItems.length; i += 400) {
    const b = db.batch(); oldItems.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit();
  }
  // Devices sync lessons by what changed, so they cannot see these deletions; this stamp makes the
  // app download the course's lessons in full once (courses.jsx, itemsResetAt).
  if (existing && oldItems.length) await existing.ref.update({ itemsResetAt: now(), lastUpdatedAt: now() });
  for (const e of [...exNew, ...exUpdate.map((x) => x.e)]) {
    await db.collection('exerciseDefinitions').doc(e.id).set({ ...exerciseRecord(e), importBatch: BATCH, lastUpdatedAt: now(), lastUpdatedAtLocal: new Date().toISOString() }, { merge: true });
  }
  if (!existing) await courseRef.set({ ...course, id: courseRef.id, isDeleted: false, importBatch: BATCH, createdAt: now(), lastUpdatedAt: now() });
  for (let i = 0; i < writes.length; i += 400) {
    const b = db.batch();
    writes.slice(i, i + 400).forEach((w) => b.set(w.ref, { ...w.data, isDeleted: false, importBatch: BATCH, createdAt: now(), lastUpdatedAt: now() }));
    await b.commit();
  }
  console.log(`\n${existing ? 'Replaced in' : 'Wrote'} course ${courseRef.id}: ${writes.length} modules/sections written, ${oldItems.length} removed, ${exNew.length} exercises added, ${exUpdate.length} updated.`);
})().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
