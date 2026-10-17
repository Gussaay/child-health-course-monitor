// One-off import of the 19 courses found in the IMNCI course-reports folder.
//   node import-course-reports.cjs --key <service-account.json>            dry run (reads only)
//   node import-course-reports.cjs --key <service-account.json> --commit   writes courses + participants
//   node import-course-reports.cjs --key <service-account.json> --undo     removes what --commit wrote
// Every written document carries importBatch so --undo touches nothing else.
const path = require('path');
const fs = require('fs');
const req = (m) => require(require.resolve(m, { paths: [process.cwd(), path.join(__dirname, '..', '..'), __dirname] }));
const admin = req('firebase-admin');

const args = process.argv.slice(2);
const keyPath = args[args.indexOf('--key') + 1];
if (!args.includes('--key') || !keyPath || !fs.existsSync(keyPath)) {
  console.error('Pass the service-account file: --key C:\\path\\to\\key.json');
  process.exit(1);
}
const COMMIT = args.includes('--commit');
const UNDO = args.includes('--undo');
const BATCH = 'course-reports-2026-10-17';

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();
const items = JSON.parse(fs.readFileSync(path.join(__dirname, 'payload.json'), 'utf8'));

async function undo() {
  for (const col of ['participants', 'courses']) {
    const snap = await db.collection(col).where('importBatch', '==', BATCH).get();
    for (let i = 0; i < snap.docs.length; i += 450) {
      const b = db.batch();
      snap.docs.slice(i, i + 450).forEach((d) => b.delete(d.ref));
      await b.commit();
    }
    console.log(`Removed ${snap.size} ${col}`);
  }
}

async function run() {
  const already = await db.collection('courses').where('importBatch', '==', BATCH).get();
  if (already.size && COMMIT) {
    console.error(`This import already ran (${already.size} courses carry ${BATCH}). Run --undo first to redo it.`);
    process.exit(1);
  }
  let courses = 0, people = 0, skipped = 0;
  for (const it of items) {
    const c = it.course;
    const clash = await db.collection('courses')
      .where('start_date', '==', c.start_date).where('course_type', '==', c.course_type).get();
    const same = clash.docs.filter((d) => (d.data().states || [d.data().state]).includes(c.state) && !d.data().isDeleted);
    const tag = `${c.start_date} ${c.course_type} ${c.state} / ${c.locality}`.padEnd(48);
    if (same.length) {
      console.log(`SKIP  ${tag} already in app (${same.map((d) => d.id).join(', ')})`);
      skipped++; continue;
    }
    console.log(`${COMMIT ? 'ADD ' : 'WOULD ADD'}  ${tag} ${it.participants.length} participants`);
    if (!COMMIT) { courses++; people += it.participants.length; continue; }
    const ref = db.collection('courses').doc();
    const b = db.batch();
    b.set(ref, { ...c, createdAt: now, createdBy: 'Course reports import', lastUpdatedAt: now, updatedBy: 'Course reports import' });
    it.participants.forEach((p) => b.set(db.collection('participants').doc(), { ...p, courseId: ref.id, lastUpdatedAt: now }));
    await b.commit();
    courses++; people += it.participants.length;
  }
  console.log(`\n${COMMIT ? 'Wrote' : 'Dry run: would write'} ${courses} courses and ${people} participants; ${skipped} skipped.`);
  if (!COMMIT) console.log('Nothing was written. Add --commit to write.');
}

(UNDO ? undo() : run()).then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
