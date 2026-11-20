// Puts the rebuilt course videos in Firebase Storage for "Download for offline".
//   node upload.cjs dry     -> shows what would be uploaded, and the bucket's CORS
//   node upload.cjs commit  -> uploads out/<id>.mp4 and course-videos/index.json
//   node upload.cjs undo    -> deletes everything under course-videos/
// Each file gets a download token, so the app fetches it without signing in and
// the storage rules stay as they are. The index's token is fixed (index-token.txt)
// because the app has it built in.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const MODE = process.argv[2] || 'dry';
const BUCKET = 'imnci-courses-monitor.firebasestorage.app';
const BATCH = 'course-videos-2026-11-20';
const key = JSON.parse(fs.readFileSync(process.env.KEY_FILE, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(key), storageBucket: BUCKET });
const bucket = admin.storage().bucket();
const url = (p, token) => `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(p)}?alt=media&token=${token}`;

(async () => {
    const [meta] = await bucket.getMetadata();
    console.log('Bucket CORS now:', JSON.stringify(meta.cors || []));

    if (MODE === 'undo') {
        const [files] = await bucket.getFiles({ prefix: 'course-videos/' });
        for (const f of files) { await f.delete(); console.log('deleted', f.name); }
        console.log(`${files.length} files deleted`);
        return;
    }

    const builtPath = path.join(__dirname, 'out', 'built.json');
    if (!fs.existsSync(builtPath)) { console.log('Nothing built (list mode or build skipped).'); return; }
    const built = JSON.parse(fs.readFileSync(builtPath, 'utf8'));
    const ids = Object.keys(built);
    const total = ids.reduce((s, id) => s + built[id].bytes, 0);
    console.log(`${ids.length} videos, ${(total / 1048576).toFixed(1)} MB`);
    if (MODE !== 'commit') { console.log('Dry run: nothing uploaded.'); return; }

    // The app reads the files with fetch(), which needs the bucket to allow
    // cross-site GET. Add that if no rule allows it yet; keep existing rules.
    const cors = meta.cors || [];
    const allowsAll = cors.some((c) => (c.origin || []).includes('*') && (c.method || []).includes('GET'));
    if (!allowsAll) {
        const next = [...cors, { origin: ['*'], method: ['GET', 'HEAD'], responseHeader: ['Content-Type', 'Content-Length', 'Content-Range'], maxAgeSeconds: 3600 }];
        await bucket.setMetadata({ cors: next });
        console.log('Bucket CORS set to:', JSON.stringify(next));
    }

    const index = { importBatch: BATCH, updatedAt: new Date().toISOString(), videos: {} };
    for (const id of ids) {
        const dest = `course-videos/${id}.mp4`;
        const token = crypto.randomUUID();
        await bucket.upload(path.join(__dirname, 'out', `${id}.mp4`), {
            destination: dest,
            metadata: {
                contentType: 'video/mp4',
                cacheControl: 'public, max-age=31536000',
                metadata: { firebaseStorageDownloadTokens: token, importBatch: BATCH, title: built[id].title },
            },
        });
        index.videos[id] = { url: url(dest, token), bytes: built[id].bytes, seconds: built[id].seconds };
        console.log('uploaded', dest, `${(built[id].bytes / 1048576).toFixed(1)} MB`);
    }
    const indexToken = fs.readFileSync(path.join(__dirname, 'index-token.txt'), 'utf8').trim();
    await bucket.file('course-videos/index.json').save(JSON.stringify(index), {
        contentType: 'application/json',
        metadata: { cacheControl: 'no-cache', metadata: { firebaseStorageDownloadTokens: indexToken, importBatch: BATCH } },
    });
    console.log('index.json written:', url('course-videos/index.json', indexToken));
})().catch((e) => { console.error(e); process.exit(1); });
