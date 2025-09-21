// set-first-admin.js
const admin = require('firebase-admin');

// Initialize with your service account
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Set admin claims for a user
async function setAdmin(uid) {
  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log(`Successfully set admin claims for user ${uid}`);
    
    // Also update Firestore
    await admin.firestore().collection('users').doc(uid).set({
      isAdmin: true,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'setup-script'
    }, { merge: true });
    
    console.log('Firestore user document updated');
  } catch (error) {
    console.error('Error setting admin claims:', error);
  }
}

// Replace with your user UID
const userUid = 'y2AAFL1mxYOyd8LGejYATZeHIjX2';
setAdmin(userUid);