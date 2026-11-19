// Puts recorded video links into the IMNCI distance learning course's video cards.
// links.json lists { script, url, chapters } — script is the narration id on the card (for example "V1.2").
//   node set-video-links.cjs           dry run: shows each card it would change, writes nothing
//   node set-video-links.cjs --commit  writes the url (and chapters) into those cards only
//   node set-video-links.cjs --undo    empties the url and chapters again on cards that still hold the url from links.json
// Only the course in COURSE_ID is touched; other blocks and fields of the section are written back unchanged.
const path = require('path'), fs = require('fs');
const admin = require(require.resolve('firebase-admin', { paths: [process.cwd(), __dirname] }));
const a = process.argv.slice(2), COMMIT = a.includes('--commit'), UNDO = a.includes('--undo');
const COURSE_ID = 'obSeKZdIIiZZ5fBQlUHK';
const links = JSON.parse(fs.readFileSync(path.join(__dirname, 'links.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(process.env.KEY_FILE, 'utf8'))) });
const db = admin.firestore();
const TABS = ['read', 'see', 'practise'];

(async () => {
  const course = await db.collection('onlineCourses').doc(COURSE_ID).get();
  if (!course.exists) throw new Error(`Course ${COURSE_ID} not found`);
  console.log(`Course ${COURSE_ID} "${course.data().title}" (${course.data().isPublished ? 'published' : 'not published'})`);
  const items = (await db.collection('onlineCourseItems').where('courseId', '==', COURSE_ID).get()).docs
    .filter((d) => d.data().kind === 'section' && !d.data().isDeleted);
  console.log(`${items.length} sections\n`);
  let changes = 0;
  for (const L of links) {
    let found = 0;
    for (const d of items) {
      const x = d.data(), update = {};
      for (const tab of TABS) {
        const blocks = x[tab] || [];
        let touched = false;
        const next = blocks.map((b) => {
          if (b.type !== 'video' || b.script !== L.script) return b;
          found++;
          if (UNDO) {
            if (b.url !== L.url) { console.log(`  ${L.script} in "${x.title}": url is "${b.url || ''}", not the one in links.json — left as it is`); return b; }
            touched = true; console.log(`  ${L.script} in "${x.title}" (${tab}): url "${b.url}" -> "" , chapters removed`);
            const rest = { ...b }; delete rest.chapters; return { ...rest, url: '' };
          }
          if (b.url === L.url && JSON.stringify(b.chapters || []) === JSON.stringify(L.chapters || [])) { console.log(`  ${L.script} in "${x.title}": already set`); return b; }
          touched = true;
          console.log(`  ${L.script} in "${x.title}" (${tab}): url "${b.url || ''}" -> "${L.url}", ${(L.chapters || []).length} chapters`);
          return { ...b, url: L.url, ...(L.chapters ? { chapters: L.chapters } : {}) };
        });
        if (touched) update[tab] = next;
      }
      if (Object.keys(update).length) {
        changes++;
        if (COMMIT || UNDO) await d.ref.update({ ...update, lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    }
    if (!found) console.log(`  ${L.script}: no video card with this script in the course`);
  }
  console.log(`\n${changes} section(s) ${COMMIT || UNDO ? 'written' : 'would change'}.${COMMIT || UNDO ? '' : ' Dry run: nothing written.'}`);
})().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
