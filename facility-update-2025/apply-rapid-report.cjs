// Applies the Feb–Mar 2025 rapid facility report.
//   node apply-rapid-report.cjs --key <service-account.json>            dry run (reads only)
//   node apply-rapid-report.cjs --key <service-account.json> --commit   writes
//   node apply-rapid-report.cjs --key <service-account.json> --undo     removes what --commit wrote
//   add --payload payload-darfur-kordofan.json to any of these for the second batch
// Status changes go to facilitySubmissions as pending submissions, the same
// way a field update does, so they wait for approval in Child Health Services.
// Each one is the facility as it is now with only هل_المؤسسة_تعمل changed.
// New facilities (Central/East/West Darfur, South Kordofan) are added
// directly with IMNCI status 'Unknown' so coverage leaves them out.
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
const payloadFile = args.includes('--payload') ? args[args.indexOf('--payload') + 1] : 'payload.json';
const SUBMITTER = 'Rapid report Feb-Mar 2025 (Qusay Eltayeb)';
const FN = 'هل_المؤسسة_تعمل';
const IMNCI = 'وجود_العلاج_المتكامل_لامراض_الطفولة';
const DROP = ['id', 'createdAt', 'lastSnapshotAt', '_mergedSubmissionIds', 'status', 'submittedAt', 'submissionId', 'originalFacilityId'];

admin.initializeApp({ credential: admin.credential.cert(require(path.resolve(keyPath))) });
const db = admin.firestore();
const { FieldValue, Timestamp } = admin.firestore;
const payload = JSON.parse(fs.readFileSync(path.join(__dirname, payloadFile), 'utf8'));
// A second payload (Darfur/Kordofan facilities last updated in 2026) has its own batch name and may include 2026 records.
const BATCH = payload.batch || 'rapid-report-2025-03';

async function commitAll(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach((w) => w(batch));
    await batch.commit();
  }
}

async function undo() {
  let n = 0;
  for (const col of ['facilitySubmissions', 'healthFacilities', 'facilitySnapshots']) {
    const snap = await db.collection(col).where('importBatch', '==', BATCH).get();
    // Approving a submission copies importBatch onto the existing facility and
    // its new snapshot; those carry originalFacilityId and must never be deleted.
    const docs = col === 'facilitySubmissions'
      ? snap.docs.filter((d) => d.data().status === 'pending')
      : snap.docs.filter((d) => !d.data().originalFacilityId);
    if (col === 'facilitySubmissions' && docs.length < snap.size) console.log(`${snap.size - docs.length} submissions were already approved or rejected and are left as they are.`);
    await commitAll(docs.map((d) => (b) => b.delete(d.ref)));
    console.log(`${col}: removed ${docs.length}`);
    n += docs.length;
  }
  console.log(`Done, ${n} documents removed.`);
}

async function main() {
  if (UNDO) return undo();
  const done = await db.collection('facilitySubmissions').where('importBatch', '==', BATCH).limit(1).get();
  if (COMMIT && !done.empty) { console.error('This report was already sent. Run --undo first to send it again.'); process.exit(1); }

  const writes = [];
  const skipped = [];
  let submissions = 0;
  for (const s of payload.submissions) {
    const ref = db.collection('healthFacilities').doc(s.id);
    const doc = await ref.get();
    if (!doc.exists) { skipped.push(`${s.name}: no longer in the app`); continue; }
    const f = doc.data();
    if (f[FN] !== s.from_fn && !(s.from_fn === '' && (f[FN] == null || f[FN] === ''))) { skipped.push(`${s.name}: status changed since the export`); continue; }
    if (!payload.allow2026 && String(f.date_of_visit || '').startsWith('2026')) { skipped.push(`${s.name}: updated in 2026`); continue; }
    const data = { ...f };
    DROP.forEach((k) => delete data[k]);
    Object.assign(data, {
      [FN]: s.to_fn,
      originalFacilityId: s.id,
      submittedAt: FieldValue.serverTimestamp(),
      status: 'pending',
      updated_by: SUBMITTER,
      importBatch: BATCH,
    });
    const sub = db.collection('facilitySubmissions').doc();
    writes.push((b) => b.set(sub, data));
    submissions++;
  }

  let added = 0;
  for (const nf of payload.newFacilities) {
    const dup = await db.collection('healthFacilities')
      .where('الولاية', '==', nf['الولاية']).where('المحلية', '==', nf['المحلية']).where('اسم_المؤسسة', '==', nf['اسم_المؤسسة']).limit(1).get();
    if (!dup.empty) { skipped.push(`${nf['اسم_المؤسسة']}: already in the app`); continue; }
    const ref = db.collection('healthFacilities').doc();
    const data = { ...nf, [IMNCI]: 'Unknown', id: ref.id, updated_by: SUBMITTER, importBatch: BATCH };
    writes.push((b) => b.set(ref, { ...data, createdAt: FieldValue.serverTimestamp(), lastSnapshotAt: FieldValue.serverTimestamp() }));
    const snapRef = db.collection('facilitySnapshots').doc();
    writes.push((b) => b.set(snapRef, { ...data, facilityId: ref.id, snapshotCreatedAt: FieldValue.serverTimestamp(), effectiveDate: Timestamp.fromDate(new Date(nf.date_of_visit)) }));
    added++;
  }

  console.log(`Status changes to send for approval: ${submissions}`);
  console.log(`New facilities to add: ${added}`);
  if (skipped.length) console.log(`Skipped ${skipped.length}:\n  ` + skipped.join('\n  '));
  if (!COMMIT) { console.log('\nDry run, nothing written. Add --commit to write.'); return; }
  await commitAll(writes);
  console.log('\nWritten. Status changes are waiting in Child Health Services > pending approvals.');
}
main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
