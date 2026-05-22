// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Ensure you don't call initializeApp twice if it's already there
if (admin.apps.length === 0) {
  admin.initializeApp();
}

exports.sendFCMNotification = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const { targetUserId, targetVersion, title, body } = data;
    const db = admin.firestore();

    try {
        if (targetUserId === 'outdated_users' && targetVersion) {
            const usersSnap = await db.collection('users').get();
            const tokens = [];

            for (const doc of usersSnap.docs) {
                const userData = doc.data();
                
                if (!userData.fcmToken) continue;

                const statsSnap = await db.collection('userUsageStats').doc(doc.id).get();
                const statsData = statsSnap.exists ? statsSnap.data() : {};
                const userAppVersion = userData.appVersion || statsData.appVersion || "0.0.0";
                
                if (userAppVersion !== targetVersion) {
                    tokens.push(userData.fcmToken);
                }
            }

            if (tokens.length > 0) {
                await admin.messaging().sendEachForMulticast({
                    tokens: tokens,
                    notification: { title, body }
                });
            }
            
            return { success: true, notifiedCount: tokens.length };
        }
        
        // --- ADD YOUR ORIGINAL targetUserId === 'all' LOGIC BELOW IF NEEDED ---
        
    } catch (error) {
        console.error("Error sending FCM:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});