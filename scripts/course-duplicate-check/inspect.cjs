// Read-only: lists every online course's modules, flags module titles that appear
// more than once, and counts learner progress saved against each module's lessons.
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require(process.env.KEY_FILE)) });
const db = admin.firestore();
const t = (x) => (x && x.toDate ? x.toDate().toISOString().slice(0, 16) : '-');
(async () => {
  const [courses, items, prog] = await Promise.all([
    db.collection('onlineCourses').get(), db.collection('onlineCourseItems').get(), db.collection('onlineProgress').get()]);
  const learnersBySection = new Map();
  prog.docs.forEach((d) => {
    const p = d.data();
    new Set([...Object.keys(p.completed || {}), ...Object.keys(p.activities || {})]).forEach((sid) => {
      if (!learnersBySection.has(sid)) learnersBySection.set(sid, new Set());
      learnersBySection.get(sid).add(d.id);
    });
  });
  const all = items.docs.map((d) => ({ id: d.id, ...d.data() }));
  const ids = new Set(all.map((i) => i.id));
  console.log(`Courses ${courses.size}, items ${all.length}, progress docs ${prog.size}`);
  console.log(`Progress keys pointing at sections that no longer exist: ${[...learnersBySection.keys()].filter((k) => !ids.has(k)).length}`);
  for (const c of courses.docs) {
    const cd = c.data();
    const mods = all.filter((i) => i.courseId === c.id && i.kind === 'module').sort((a, b) => (a.order || 0) - (b.order || 0));
    const titles = {}; mods.filter((m) => !m.isDeleted).forEach((m) => { titles[m.title] = (titles[m.title] || 0) + 1; });
    const dup = Object.values(titles).some((n) => n > 1);
    console.log(`\n${dup ? '!! DUPLICATE MODULE TITLES ' : ''}Course ${c.id} "${cd.title}" ${cd.isDeleted ? '(deleted) ' : ''}${cd.isPublished ? '(published) ' : ''}batch=${cd.importBatch || '-'}`);
    const orphanSecs = all.filter((i) => i.courseId === c.id && i.kind === 'section' && !mods.some((m) => m.id === i.moduleId));
    if (orphanSecs.length) console.log(`  sections whose module is missing: ${orphanSecs.length}`);
    for (const m of mods) {
      const secs = all.filter((i) => i.kind === 'section' && i.moduleId === m.id);
      const live = secs.filter((s) => !s.isDeleted);
      const learners = new Set(); secs.forEach((s) => (learnersBySection.get(s.id) || []).forEach((u) => learners.add(u)));
      console.log(`  [${m.order}] ${m.id} "${m.title}" ${m.isDeleted ? 'DELETED ' : ''}${m.isPublished === false ? 'unpublished ' : ''}` +
        `sections ${live.length}${secs.length - live.length ? ` (+${secs.length - live.length} deleted)` : ''} batch=${m.importBatch || '-'} source=${m.source || '-'} created=${t(m.createdAt)} updated=${t(m.lastUpdatedAt)} learners=${learners.size}`);
    }
  }
})().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
