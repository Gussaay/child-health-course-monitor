// Uploads the Sick & Small Newborn courses (Sudan Training Manual 2026, Modules 1–3:
// one online course each) into the live app, writing exactly what Online courses →
// Manage → Import → "Import a course file" (new course) writes: the exercises into
// exerciseDefinitions, then the course, its modules and sections into onlineCourses /
// onlineCourseItems. The manuals' figures in ./figures go to Storage under online-courses/ssnb/.
// (Copied from scripts/etat-upload/upload-etat.cjs; one run per course, chosen by --course.)
//   node upload-ssnb.cjs --course m1            dry run (reads only, lists what would be written)
//   node upload-ssnb.cjs --course m1 --commit   writes
//   node upload-ssnb.cjs --course m1 --replace  the course is already uploaded: swaps its modules and sections
//                                                (lesson progress resets: use course-lesson-update for a live course)
//   node upload-ssnb.cjs --course m1 --undo     removes what --commit or --replace wrote (by importBatch), figures included
//   node upload-ssnb.cjs --course annex --withdraw [--commit]   lists [removes] the course, its lessons and exercises,
//                                                KEEPING its figures (other courses' lessons show them)
// KEY_FILE (or --key <file>) is the Firebase service-account JSON.
const path = require('path'), fs = require('fs');
const req = (m) => require(require.resolve(m, { paths: [process.cwd(), path.join(__dirname, '..', '..'), __dirname] }));
const admin = req('firebase-admin');
const a = process.argv.slice(2);
const keyPath = a.includes('--key') ? a[a.indexOf('--key') + 1] : process.env.KEY_FILE;
if (!keyPath || !fs.existsSync(keyPath)) { console.error('Pass --key <service-account.json> or set KEY_FILE'); process.exit(1); }
const COMMIT = a.includes('--commit'), UNDO = a.includes('--undo'), REPLACE = a.includes('--replace'), WITHDRAW = a.includes('--withdraw');
const COURSES = {
  m1: { batch: 'ssnb-m1-2026-11-21', file: 'ssnb-module-1-essential-emergency-newborn-care.imnci.json' },
  m2: { batch: 'ssnb-m2-2026-11-21', file: 'ssnb-module-2-special-newborn-care.imnci.json' },
  m3: { batch: 'ssnb-m3-2026-11-21', file: 'ssnb-module-3-intensive-newborn-care.imnci.json' },
  // The annex course is withdrawn (its SOPs now sit inside the lessons that use them); kept here only so --undo can remove it.
  annex: { batch: 'ssnb-annex-2026-11-21', file: 'ssnb-annex-neonatal-procedures-and-equipment.imnci.json' },
  guide: { batch: 'ssnb-fg-2026-11-21', file: 'ssnb-facilitator-guide.imnci.json' },
};
const which = a.includes('--course') ? a[a.indexOf('--course') + 1] : '';
if (!COURSES[which]) { console.error(`Pass --course ${Object.keys(COURSES).join('|')}`); process.exit(1); }
const BATCH = COURSES[which].batch;
const FILE = path.join(__dirname, '..', '..', 'course-packages', COURSES[which].file);
// Figures are shared by the three courses; each run uploads only the figures its lessons show.
const FIG_DIR = path.join(__dirname, 'figures'), FIG_ROOT = 'online-courses/ssnb/';
// The photograph booklet (Protocol management → Photograph booklet) is shared by every course and is
// already in Storage; this upload only checks that the photographs it shows are there, and never writes them.
const PHOTO_ROOT = 'online-courses/imnci-photos/';
const BUCKET = 'imnci-courses-monitor.firebasestorage.app';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
const bucket = admin.storage().bucket(BUCKET);
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
  estimatedMinutes: Number(e.estimatedMinutes) || 15, draft: e.draft !== false, arabicOn: e.arabicOn === true, explain: e.explain || '',
  learningPointsJson: JSON.stringify(e.learningPoints || []), narrativeJson: JSON.stringify(e.narrative || []),
  narrativeArJson: JSON.stringify(e.narrativeAr || []), expectedJson: JSON.stringify(e.expected || {}),
  questionsJson: JSON.stringify(e.questions || []), isDeleted: false,
});
const CONTENT = ['title', 'titleAr', 'subCourse', 'kind', 'formType', 'passMark', 'estimatedMinutes', 'explain',
  'learningPointsJson', 'narrativeJson', 'narrativeArJson', 'expectedJson', 'questionsJson'];

// Withdraws a course this upload wrote: its course, modules, lessons and exercises, by importBatch. Its figures stay
// in Storage, because the SOP lessons placed inside the other courses show the same figures.
async function withdraw() {
  let n = 0;
  console.log(COMMIT ? 'WITHDRAWING (figures kept):' : 'DRY RUN: would withdraw (figures kept; nothing is written):');
  for (const col of ['onlineCourses', 'onlineCourseItems', 'exerciseDefinitions']) {
    const s = await db.collection(col).where('importBatch', '==', BATCH).get();
    console.log(`  ${col}: ${s.size}` + (col === 'onlineCourses' ? ' ' + s.docs.map((d) => `${d.id} "${d.data().title}"${d.data().isPublished ? ' (PUBLISHED)' : ' (not published)'}`).join(', ') : ''));
    if (COMMIT) for (let i = 0; i < s.docs.length; i += 400) {
      const b = db.batch(); s.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit();
    }
    n += s.size;
  }
  console.log(COMMIT ? `Withdrawn: ${n} documents removed; figures kept.` : `Would remove ${n} documents; figures kept.`);
}

async function undo() {
  let n = 0;
  for (const col of ['onlineCourseItems', 'onlineCourses', 'exerciseDefinitions']) {
    const s = await db.collection(col).where('importBatch', '==', BATCH).get();
    for (let i = 0; i < s.docs.length; i += 400) {
      const b = db.batch(); s.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit();
    }
    console.log(`Removed ${s.size} from ${col}`); n += s.size;
  }
  const [files] = await bucket.getFiles({ prefix: FIG_ROOT });
  for (const f of files) {
    const [meta] = await f.getMetadata();
    if ((meta.metadata || {}).importBatch === BATCH) { await f.delete(); n += 1; console.log(`Removed figure ${f.name}`); }
  }
  console.log(`Undo done: ${n} documents and figures removed.`);
}

(async () => {
  if (WITHDRAW) return withdraw();
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
  let oldItems = [], orphans = [];
  if (existing) {
    const c = existing.data();
    oldItems = (await db.collection('onlineCourseItems').where('courseId', '==', existing.id).get()).docs;
    const mine = oldItems.filter((d) => d.data().importBatch === BATCH);
    const edited = mine.filter((d) => { const x = d.data(); return x.lastUpdatedAt && x.createdAt && x.lastUpdatedAt.toMillis() - x.createdAt.toMillis() > 60000; });
    console.log(`\nALREADY UPLOADED: course ${existing.id} "${c.title}" (${c.isPublished ? 'PUBLISHED' : 'not published'}${c.isDeleted ? ', deleted' : ''}).`);
    console.log(`  It has ${oldItems.length} modules/sections: ${mine.length} from this upload, ${oldItems.length - mine.length} added in the app since.`);
    console.log(`  Edited in the app since the upload: ${edited.length}${edited.length ? ' — ' + edited.map((d) => `"${d.data().title}"`).join(', ') : ''}`);
    console.log('  Replace removes the modules and sections from this upload and writes the ones below. Anything added in the app since is kept.');
    // Lessons added in the app under a module this upload wrote: moved to the new module with the same number.
    const oldMods = new Map(mine.filter((d) => d.data().kind === 'module').map((d) => [d.id, d.data().order]));
    orphans = oldItems.filter((d) => d.data().importBatch !== BATCH && d.data().kind === 'section' && oldMods.has(d.data().moduleId))
      .map((d) => ({ ref: d.ref, title: d.data().title, order: oldMods.get(d.data().moduleId) }));
    if (orphans.length) console.log(`  Lessons added in the app inside this upload's modules (moved to the new module with the same number): ${orphans.map((o) => `"${o.title}" (module ${o.order})`).join(', ')}`);
    oldItems = mine;
  }
  const courses = await db.collection('onlineCourses').get();
  console.log(`\nOnline courses now in the app (${courses.size}):`);
  courses.docs.forEach((d) => { const c = d.data(); console.log(`  ${d.id}  "${c.title}"${c.isDeleted ? ' (deleted)' : ''}${c.isPublished ? ' (published)' : ''}`); });
  const same = courses.docs.filter((d) => d.id !== existing?.id && !d.data().isDeleted && String(d.data().title).trim() === pkg.course.title);
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
  // Figures
  const all = fs.readdirSync(FIG_DIR).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
  const pics = writes.flatMap((w) => w.data.read || []).filter((b) => (b.type === 'image' || b.type === 'page') && b.path);
  const used = new Set(pics.filter((b) => b.path.startsWith('ssnb/')).map((b) => b.path.replace(/^ssnb\//, '')));
  const figs = all.filter((f) => used.has(f)), unused = [];
  const lacking = [...used].filter((f) => !all.includes(f));
  if (lacking.length) throw new Error(`Lessons show figures that are not in figures/: ${lacking}`);
  const figPlan = [];
  for (const f of figs) {
    const [exists] = await bucket.file(FIG_ROOT + f).exists();
    figPlan.push({ f, exists });
  }
  console.log(`\nFigures for Storage (${FIG_ROOT}): ${figPlan.filter((x) => !x.exists).length} new, ${figPlan.filter((x) => x.exists).length} already there (overwritten)` +
    `${unused.length ? `; not used by any lesson: ${unused.join(', ')}` : ''}`);
  figPlan.forEach(({ f, exists }) => console.log(`  ${exists ? '^' : '+'} ${FIG_ROOT}${f}  ${Math.round(fs.statSync(path.join(FIG_DIR, f)).size / 1024)} KB`));
  // Photograph booklet
  const photoUsed = [...new Set(pics.filter((b) => b.path.startsWith('imnci-photos/')).map((b) => b.path.replace(/^imnci-photos\//, '')))].sort();
  const [inStorage] = await bucket.getFiles({ prefix: PHOTO_ROOT });
  const have = new Set(inStorage.map((f) => f.name.slice(PHOTO_ROOT.length)));
  const photoLacking = photoUsed.filter((f) => !have.has(f));
  console.log(`\nPhotograph booklet (${PHOTO_ROOT}, not written by this upload): lessons show ${photoUsed.length} photographs, ` +
    `${photoUsed.length - photoLacking.length} found in Storage${photoLacking.length ? `, MISSING: ${photoLacking.join(', ')}` : ''}.`);
  if (photoLacking.length && (COMMIT || REPLACE)) throw new Error('Upload the missing photographs to the photograph booklet first.');
  const blank = writes.flatMap((w) => w.data.read || []).filter((b) => b.type === 'image' && !b.path).length;
  if (blank) console.log(`  ${blank} pictures have no file and show as "not uploaded".`);
  if (!COMMIT && !REPLACE) return console.log('\nDry run: nothing written.');

  const crypto = require('crypto');
  for (const { f } of figPlan) {
    await bucket.upload(path.join(FIG_DIR, f), { destination: FIG_ROOT + f, metadata: {
      contentType: /\.png$/i.test(f) ? 'image/png' : 'image/jpeg', cacheControl: 'public, max-age=3600',
      metadata: { firebaseStorageDownloadTokens: crypto.randomUUID(), importBatch: BATCH } } });
  }

  for (let i = 0; i < oldItems.length; i += 400) {
    const b = db.batch(); oldItems.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit();
  }
  for (const e of [...exNew, ...exUpdate.map((x) => x.e)]) {
    await db.collection('exerciseDefinitions').doc(e.id).set({ ...exerciseRecord(e), importBatch: BATCH, lastUpdatedAt: now(), lastUpdatedAtLocal: new Date().toISOString() }, { merge: true });
  }
  if (!existing) await courseRef.set({ ...course, id: courseRef.id, isDeleted: false, importBatch: BATCH, createdAt: now(), lastUpdatedAt: now() });
  for (let i = 0; i < writes.length; i += 400) {
    const b = db.batch();
    writes.slice(i, i + 400).forEach((w) => b.set(w.ref, { ...w.data, isDeleted: false, importBatch: BATCH, createdAt: now(), lastUpdatedAt: now() }));
    await b.commit();
  }
  for (const o of orphans) {
    const mod = writes.find((w) => w.data.kind === 'module' && w.data.order === o.order);
    if (mod) await o.ref.update({ moduleId: mod.ref.id, legacyModuleKey: mod.data.legacyKey, lastUpdatedAt: now() });
    else console.log(`  WARNING: no module ${o.order} in the file for "${o.title}"; it was left as it is.`);
  }
  console.log(`\n${existing ? 'Replaced in' : 'Wrote'} course ${courseRef.id}: ${writes.length} modules/sections written, ${oldItems.length} removed, ${exNew.length} exercises added, ${exUpdate.length} updated.`);
})().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
