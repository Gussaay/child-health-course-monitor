// scripts/push-update.js
const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Admin SDK using your GitHub Secrets Service Account
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const bucket = admin.storage().bucket('imnci-courses-monitor.firebasestorage.app'); 

async function pushUpdate() {
  try {
    const rawData = fs.readFileSync('./public/native-version.json');
    const config = JSON.parse(rawData);
    
    // Ensure we have a valid version string to use as our Document ID
    const versionString = config.versionString || "Unknown";
    
    const payload = {
        latestNativeBuild: config.latestNativeBuild || 0,
        versionString: versionString,
        downloadUrl: `https://firebasestorage.googleapis.com/v0/b/imnci-courses-monitor.firebasestorage.app/o/apks%2FNational_Child_Health_Program_APP_v${versionString}.apk?alt=media`,
        mandatory: false, // Default to false so history shows it wasn't forced by the pipeline
        releaseNotes: `Automated GitHub Actions Deployment for v${versionString}`,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    };

    console.log(`Checking deployment status for v${versionString}...`);
    
    // ❌ REMOVED: db.collection('meta').doc('update_config').set(payload);
    // GitHub Actions will NO LONGER push the update live to users. 
    // It will sit safely in the database until the Admin Dashboard triggers it.

    // ====================================================================
    // 1. DEDUPLICATION LOGIC FOR HISTORY LOG
    // ====================================================================
    const historyDocRef = db.collection('update_history').doc(versionString);
    const historyDocSnap = await historyDocRef.get();

    if (!historyDocSnap.exists) {
        // Only add to history if this version does not already exist
        await historyDocRef.set(payload);
        console.log(`✅ Success! v${versionString} recorded in history log.`);
    } else {
        // If it exists, we skip adding a new document to prevent duplicates.
        const updatePayload = { ...payload };
        delete updatePayload.timestamp; 
        
        await historyDocRef.set(updatePayload, { merge: true });
        console.log(`⚠️ Note: v${versionString} already exists in history. Updated URL, but skipped duplicate creation.`);
    }

    // ====================================================================
    // 2. STORAGE & HISTORY CLEANUP: KEEP ONLY THE LATEST 10 VERSIONS
    // ====================================================================
    console.log("Running automated space cleanup...");
    
    const historySnapshot = await db.collection('update_history')
      .orderBy('timestamp', 'desc')
      .get();

    const allRecords = historySnapshot.docs;

    if (allRecords.length > 10) {
      const recordsToDelete = allRecords.slice(10);
      console.log(`Found ${recordsToDelete.length} old version(s) to delete.`);

      for (const doc of recordsToDelete) {
        const data = doc.data();
        
        if (data.versionString) {
          const filePath = `apks/National_Child_Health_Program_APP_v${data.versionString}.apk`;
          try {
            await bucket.file(filePath).delete();
            console.log(`✅ Deleted physical file from Storage: ${filePath}`);
          } catch (storageErr) {
            if (storageErr.code === 404 || storageErr.code === 'ENOENT') {
              console.log(`⚠️ File already missing from Storage: ${filePath}`);
            } else {
              console.error(`❌ Failed to delete file ${filePath}:`, storageErr);
            }
          }
        }

        // Delete the visual record from the Firestore database
        await db.collection('update_history').doc(doc.id).delete();
        console.log(`✅ Deleted Firestore history record: ${doc.id}`);
      }
      console.log("Cleanup complete. Storage optimized.");
    } else {
      console.log(`Current version count is ${allRecords.length}. No cleanup needed.`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Pipeline Error:", error);
    process.exit(1);
  }
}

pushUpdate();