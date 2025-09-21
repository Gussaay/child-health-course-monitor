// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize with explicit configuration if needed
try {
  admin.initializeApp();
} catch (e) {
  console.log('Firebase Admin already initialized');
}

// Set admin claims for a user
exports.setAdminClaims = functions.https.onCall(async (data, context) => {
  // Ensure the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated', 
      'You must be logged in to perform this action'
    );
  }

  // Ensure the caller is an admin
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied', 
      'Only admins can set other admins'
    );
  }

  const { uid, isAdmin } = data;
  
  // Validate input
  if (!uid || typeof isAdmin !== 'boolean') {
    throw new functions.https.HttpsError(
      'invalid-argument', 
      'The function must be called with a valid uid and isAdmin boolean'
    );
  }
  
  try {
    // Set custom claims
    await admin.auth().setCustomUserClaims(uid, { admin: isAdmin });
    
    // Also update the Firestore user document
    await admin.firestore().collection('users').doc(uid).set({
      isAdmin: isAdmin,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: context.auth.uid
    }, { merge: true });
    
    return { 
      success: true, 
      message: `User ${uid} admin status set to ${isAdmin}` 
    };
  } catch (error) {
    console.error('Error setting admin claims:', error);
    throw new functions.https.HttpsError('internal', 'Unable to set admin claims');
  }
});

// List all users (admin only)
exports.listUsers = functions.https.onCall(async (data, context) => {
  // Ensure the caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated', 
      'You must be logged in to perform this action'
    );
  }

  // Ensure the caller is an admin
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied', 
      'Only admins can list users'
    );
  }

  try {
    const listUsersResult = await admin.auth().listUsers();
    const users = listUsersResult.users.map(user => ({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      isAdmin: user.customClaims && user.customClaims.admin
    }));
    
    return { users };
  } catch (error) {
    console.error('Error listing users:', error);
    throw new functions.https.HttpsError('internal', 'Unable to list users');
  }
});