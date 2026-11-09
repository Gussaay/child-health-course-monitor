// Adds the Kassala operational-guide participants to their course.
//   node add-participants.cjs --key <service-account.json>            dry run (reads only)
//   node add-participants.cjs --key <service-account.json> --commit   writes
//   node add-participants.cjs --key <service-account.json> --undo     removes what --commit wrote
const path = require('path'), fs = require('fs');
const req = (m) => require(require.resolve(m, { paths: [process.cwd(), path.join(__dirname, '..', '..'), __dirname] }));
const admin = req('firebase-admin');
const a = process.argv.slice(2);
const keyPath = a.includes('--key') ? a[a.indexOf('--key') + 1] : process.env.KEY_FILE;
if (!keyPath || !fs.existsSync(keyPath)) { console.error('Pass --key <service-account.json> or set KEY_FILE'); process.exit(1); }
const COMMIT = a.includes('--commit'), UNDO = a.includes('--undo');
const BATCH = 'kassala-operational-guide-2026-11-09';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(keyPath, 'utf8'))) });
const db = admin.firestore(), now = admin.firestore.FieldValue.serverTimestamp();
const people = JSON.parse(fs.readFileSync(path.join(__dirname, 'participants.json'), 'utf8'))
  .map(({ name_en, job_title_en, ...p }) => ({ ...p, importBatch: BATCH, notes: `${name_en} / ${job_title_en}`, _en: name_en }));
(async () => {
  if (UNDO) {
    const s = await db.collection('participants').where('importBatch', '==', BATCH).get();
    const b = db.batch(); s.docs.forEach((d) => b.delete(d.ref)); await b.commit();
    console.log(`Removed ${s.size}`); return;
  }
  const s = await db.collection('courses').where('course_type', '==', 'Program Management').get();
  const kas = s.docs.filter((d) => !d.data().isDeleted && JSON.stringify(d.data()).includes('Kassala'));
  kas.forEach((d) => { const x = d.data(); console.log(`candidate ${d.id}: ${x.state}/${x.locality} start ${x.start_date} sub ${JSON.stringify(x.course_sub_type || x.sub_type || x.program_management_sub_type || '')} title ${JSON.stringify(x.course_title || x.title || '')}`); });
  const m = s.docs.filter((d) => !d.data().isDeleted && /operational/i.test(JSON.stringify(d.data())) && (d.data().states || [d.data().state]).includes('Kassala'));
  if (m.length !== 1) { console.error(`Expected 1 matching course, found ${m.length}: ${m.map((d) => d.id)}`); process.exit(1); }
  const c = m[0];
  const have = await db.collection('participants').where('courseId', '==', c.id).get();
  const key = (v) => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const names = new Set(have.docs.map((d) => key(d.data().name)));
  have.docs.forEach((d) => console.log(`existing ${d.id}: ${d.data().name} | ${d.data().job_title} | ${d.data().locality}`));
  const fresh = people.filter((p) => !names.has(key(p.name)) && !names.has(key(p._en))).map(({ _en, ...p }) => p);
  console.log(`Course ${c.id} (${c.data().state}/${c.data().locality}), ${have.size} participants now; ${fresh.length} to add, ${people.length - fresh.length} already there.`);
  if (!COMMIT) return console.log('Dry run: nothing written. Add --commit.');
  const b = db.batch();
  fresh.forEach((p) => b.set(db.collection('participants').doc(), { ...p, courseId: c.id, lastUpdatedAt: now }));
  b.update(c.ref, { participants_count: have.size + fresh.length, lastUpdatedAt: now });
  await b.commit(); console.log(`Wrote ${fresh.length}.`);
})().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
