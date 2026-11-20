// Read-only: where this month's Firestore reads went (usageMonthly), and how big
// the online-course collections are that a device may download.
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require(process.env.KEY_FILE)) });
const db = admin.firestore();
const top = (o, n = 25) => Object.entries(o).sort((a, b) => b[1].r - a[1].r).slice(0, n)
  .map(([k, v]) => `  ${String(v.r).padStart(9)} r ${String(v.w).padStart(7)} w  ${k}`).join('\n');
(async () => {
  for (const month of (process.env.MONTHS || '2026-11,2026-10').split(',')) {
    const snap = await db.collection('usageMonthly').where('month', '==', month).get();
    const g = { byCollection: {}, byView: {}, bySource: {} }; let reads = 0; const users = [];
    snap.docs.forEach((d) => {
      const x = d.data(); reads += x.reads || 0; users.push([x.reads || 0, (x.email || '').replace(/^(.).*@/, '$1***@')]);
      Object.keys(g).forEach((k) => Object.entries(x[k] || {}).forEach(([n, v]) => {
        const row = g[k][n] || (g[k][n] = { r: 0, w: 0 }); row.r += v.r || 0; row.w += v.w || 0; }));
    });
    console.log(`\n=== ${month}: ${snap.size} users, ${reads} reads`);
    console.log('top users:', users.sort((a, b) => b[0] - a[0]).slice(0, 10).map((u) => `${u[1]} ${u[0]}`).join(', '));
    for (const k of Object.keys(g)) console.log(`-- ${k}\n${top(g[k])}`);
  }
  for (const col of ['onlineCourses', 'onlineCourseItems', 'exerciseDefinitions', 'onlineProgress', 'imnciProtocols']) {
    const s = await db.collection(col).get();
    let bytes = 0, noStamp = 0, deleted = 0;
    s.docs.forEach((d) => { const x = d.data(); bytes += JSON.stringify(x).length; if (!x.lastUpdatedAt) noStamp++; if (x.isDeleted) deleted++; });
    console.log(`${col}: ${s.size} docs, ~${Math.round(bytes / 1024)} KB, without lastUpdatedAt ${noStamp}, soft-deleted ${deleted}`);
  }
})().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
