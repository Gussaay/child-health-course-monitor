// scripts/push-update.js
const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const BUCKET = 'imnci-courses-monitor.firebasestorage.app';
const bucket = admin.storage().bucket(BUCKET);

const KEEP_VERSIONS = 10;

const apkPathFor = (versionString) =>
  `apks/National_Child_Health_Program_APP_v${versionString}.apk`;

const apkUrlFor = (versionString) =>
  `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(
    apkPathFor(versionString)
  )}?alt=media`;

async function pushUpdate() {
  const config = JSON.parse(fs.readFileSync('./public/native-version.json', 'utf8'));

  const versionString = config.versionString;
  if (!versionString || versionString === 'Unknown') {
    // The old script fell back to "Unknown" and then happily wrote a history
    // record pointing at an APK named ..._vUnknown.apk, which does not exist.
    throw new Error('versionString is missing from public/native-version.json');
  }

  const downloadUrl = apkUrlFor(versionString);

  const payload = {
    latestNativeBuild: config.latestNativeBuild || 0,
    versionString,

    // The app reads `apkUrl` (useAppUpdate.jsx). The old payload only had
    // `downloadUrl`, so when the dashboard promoted a record to
    // meta/update_config the Download button had no link and did nothing.
    // Both names are written so old and new readers work.
    apkUrl: downloadUrl,
    downloadUrl,

    // Was hard-coded to false, which threw away the [force-update] decision
    // made in the workflow.
    mandatory: config.mandatory === true,

    message: config.message || `New version ${versionString} is available.`,
    releaseNotes: config.releaseNotes || `Automated deployment for v${versionString}`,
  };

  // Confirms the APK really is in Storage before recording it. Without this a
  // history record can point at a file the upload step failed to write.
  const [apkExists] = await bucket.file(apkPathFor(versionString)).exists();
  if (!apkExists) {
    throw new Error(`APK not found in Storage: ${apkPathFor(versionString)}`);
  }

  // ====================================================================
  // 1. HISTORY LOG
  // GitHub Actions still does NOT write meta/update_config. The release goes
  // live only when the Admin Dashboard promotes this record.
  // ====================================================================
  const historyRef = db.collection('update_history').doc(versionString);
  const existing = await historyRef.get();

  if (existing.exists) {
    await historyRef.set(payload, { merge: true }); // keep the original timestamp
    console.log(`⚠️ v${versionString} already existed. Fields updated.`);
  } else {
    await historyRef.set({
      ...payload,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ v${versionString} recorded in the history log.`);
  }

  // ====================================================================
  // 2. CLEANUP
  // ====================================================================
  console.log('Running cleanup...');

  // The live release must never be deleted. The old script could delete the
  // APK that meta/update_config was still telling users to download, so the
  // Download button returned "file not found" for everyone.
  let liveVersion = null;
  let liveBuild = 0;
  try {
    const liveSnap = await db.collection('meta').doc('update_config').get();
    if (liveSnap.exists) {
      liveVersion = liveSnap.data().versionString || null;
      liveBuild = parseInt(liveSnap.data().latestNativeBuild, 10) || 0;
    }
  } catch (e) {
    console.warn('Could not read meta/update_config, keeping everything:', e.message);
    return;
  }

  // Ordering by latestNativeBuild instead of timestamp. Records written before
  // the timestamp field existed were skipped entirely by orderBy('timestamp'),
  // so they were never counted and never cleaned up.
  const snapshot = await db.collection('update_history').get();
  const records = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.latestNativeBuild || 0) - (a.latestNativeBuild || 0));

  const toDelete = records.slice(KEEP_VERSIONS).filter((r) => {
    if (r.versionString === versionString) return false;      // the build just made
    if (liveVersion && r.versionString === liveVersion) return false; // the live release
    if (liveBuild && (r.latestNativeBuild || 0) >= liveBuild) return false;
    return true;
  });

  if (!toDelete.length) {
    console.log(`Keeping all ${records.length} record(s). Nothing to clean up.`);
    return;
  }

  console.log(`Deleting ${toDelete.length} old version(s).`);
  for (const record of toDelete) {
    if (record.versionString) {
      const path = apkPathFor(record.versionString);
      try {
        await bucket.file(path).delete();
        console.log(`✅ Deleted from Storage: ${path}`);
      } catch (err) {
        if (err.code === 404) console.log(`⚠️ Already gone: ${path}`);
        else console.error(`❌ Could not delete ${path}:`, err.message);
      }
    }
    await db.collection('update_history').doc(record.id).delete();
    console.log(`✅ Deleted history record: ${record.id}`);
  }
  console.log('Cleanup complete.');
}

pushUpdate()
  .then(() => process.exit(0))
  .catch((error) => {
    // The old version caught everything and could exit 0 on a real failure,
    // so a broken release looked like a green build.
    console.error('Pipeline error:', error);
    process.exit(1);
  });
