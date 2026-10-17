// Read-only: saves a slim copy of healthFacilities to facilities-export.json (nothing is written to Firestore).
//   cd C:\Users\Lenovo\imci-app
//   node facility-update-2025\export-facilities.cjs
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
const admin = require(path.join(root, 'node_modules', 'firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(path.join(root, 'service-account-key.json'))) });
(async () => {
  const snap = await admin.firestore().collection('healthFacilities').get();
  const rows = snap.docs.map(d => {
    const f = d.data();
    return { id: d.id, state: f['الولاية'] ?? null, locality: f['المحلية'] ?? null, name: f['اسم_المؤسسة'] ?? null,
      type: f['نوع_المؤسسةالصحية'] ?? null, functioning: f['هل_المؤسسة_تعمل'] ?? null, owner: f.facility_ownership ?? null,
      date_of_visit: f.date_of_visit ?? null, updated_by: f.updated_by ?? null };
  });
  fs.writeFileSync(path.join(__dirname, 'facilities-export.json'), JSON.stringify(rows));
  console.log(`Saved ${rows.length} facilities to facility-update-2025\\facilities-export.json`);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
