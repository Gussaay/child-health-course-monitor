const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin only once to avoid errors
if (admin.apps.length === 0) {
  admin.initializeApp();
}

exports.sendFCMNotification = functions.https.onCall(async (data, context) => {
    // 1. Verify Authentication (Security Rule)
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in to send notifications.');
    }

    const { targetUserId, targetVersion, title, body } = data;
    const db = admin.firestore();

    try {
        // =======================================================
        // SCENARIO 1: Smart update for outdated users only
        // =======================================================
        if (targetUserId === 'outdated_users' && targetVersion) {
            const usersSnap = await db.collection('users').get();
            const tokens = [];

            for (const doc of usersSnap.docs) {
                const userData = doc.data();
                
                // Skip if they don't have push notifications enabled
                if (!userData.fcmToken) continue;

                // Check their active version in usage stats
                const statsSnap = await db.collection('userUsageStats').doc(doc.id).get();
                const statsData = statsSnap.exists ? statsSnap.data() : {};
                
                const userAppVersion = userData.appVersion || statsData.appVersion || "0.0.0";
                
                // ONLY add their token if their version does not match the new target
                if (userAppVersion !== targetVersion) {
                    tokens.push(userData.fcmToken);
                }
            }

            // Send multicast message to the filtered list
            if (tokens.length > 0) {
                // Note: Firebase sendEachForMulticast accepts max 500 tokens per batch.
                // If you have > 500 users, you can safely chunk this array into groups of 500.
                await admin.messaging().sendEachForMulticast({
                    tokens: tokens,
                    notification: { title, body }
                });
            }
            
            return { success: true, notifiedCount: tokens.length, target: 'outdated_users' };
        }
        
        // =======================================================
        // SCENARIO 2: Send to everyone (e.g., standard announcements)
        // =======================================================
        else if (targetUserId === 'all') {
            const usersSnap = await db.collection('users').get();
            const tokens = [];

            usersSnap.forEach(doc => {
                const userData = doc.data();
                if (userData.fcmToken) {
                    tokens.push(userData.fcmToken);
                }
            });

            if (tokens.length > 0) {
                await admin.messaging().sendEachForMulticast({
                    tokens: tokens,
                    notification: { title, body }
                });
            }
            
            return { success: true, notifiedCount: tokens.length, target: 'all' };
        }

        // =======================================================
        // SCENARIO 3: Send to a specific single user
        // =======================================================
        else {
            const userSnap = await db.collection('users').doc(targetUserId).get();
            
            if (!userSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Target user does not exist.');
            }

            const userData = userSnap.data();
            if (!userData.fcmToken) {
                throw new functions.https.HttpsError('failed-precondition', 'Target user does not have a registered FCM token.');
            }

            await admin.messaging().send({
                token: userData.fcmToken,
                notification: { title, body }
            });

            return { success: true, notifiedCount: 1, target: targetUserId };
        }

    } catch (error) {
        console.error("Error sending FCM:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});