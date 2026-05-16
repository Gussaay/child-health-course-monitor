const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendFCMNotification = functions.https.onCall(async (data, context) => {
    // 1. Ensure the user making the request is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to send notifications.');
    }

    // Optional: Check if the requesting user has the 'admin' or 'super_user' role in Firestore
    const senderDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const senderRoles = senderDoc.data()?.roles || [];
    if (!senderRoles.includes('super_user') && !senderRoles.includes('manager')) {
        throw new functions.https.HttpsError('permission-denied', 'You do not have permission to send push notifications.');
    }

    const { targetUserId, title, body } = data;

    try {
        let tokens = [];

        // 2. Determine target audience (Specific user vs. All users)
        if (targetUserId === 'all') {
            const usersSnapshot = await admin.firestore().collection('users').get();
            usersSnapshot.forEach(doc => {
                const userToken = doc.data().fcmToken;
                if (userToken) tokens.push(userToken);
            });
        } else {
            const userDoc = await admin.firestore().collection('users').doc(targetUserId).get();
            if (userDoc.exists && userDoc.data().fcmToken) {
                tokens.push(userDoc.data().fcmToken);
            }
        }

        if (tokens.length === 0) {
            return { success: false, message: 'No FCM tokens found for the selected target(s).' };
        }

        // 3. Construct the FCM payload
        const message = {
            notification: {
                title: title,
                body: body
            },
            tokens: tokens // Multicast message
        };

        // 4. Send using FCM
        const response = await admin.messaging().sendEachForMulticast(message);
        
        return { 
            success: true, 
            successCount: response.successCount, 
            failureCount: response.failureCount 
        };

    } catch (error) {
        console.error('Error sending FCM notification:', error);
        throw new functions.https.HttpsError('internal', 'Failed to send FCM message.');
    }
});