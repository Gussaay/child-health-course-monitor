const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// Initialize Firebase Admin
initializeApp();

exports.sendFCMNotification = onCall(async (request) => {
  const { auth, data } = request;

  // 1. Check Authentication
  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to send notifications."
    );
  }

  const db = getFirestore();

  // 2. Role validation
  const senderDoc = await db.collection("users").doc(auth.uid).get();
  const senderRoles = senderDoc.data()?.roles || [];
  if (!senderRoles.includes("super_user") && !senderRoles.includes("manager")) {
    throw new HttpsError(
      "permission-denied",
      "You do not have permission to send push notifications."
    );
  }

  const { targetUserId, title, body } = data;

  try {
    const tokens = [];

    // 3. Gather tokens based on target
    if (targetUserId === "all") {
      const usersSnapshot = await db.collection("users").get();
      usersSnapshot.forEach((doc) => {
        const userToken = doc.data().fcmToken;
        if (userToken) tokens.push(userToken);
      });
    } else {
      const userDoc = await db.collection("users").doc(targetUserId).get();
      if (userDoc.exists && userDoc.data().fcmToken) {
        tokens.push(userDoc.data().fcmToken);
      }
    }

    if (tokens.length === 0) {
      return { success: false, message: "No FCM tokens found for target(s)." };
    }

    // 4. Construct payload and send
    const message = {
      notification: { title, body },
      tokens: tokens,
    };

    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast(message);

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error("Error sending FCM notification:", error);
    throw new HttpsError("internal", "Failed to send FCM message.");
  }
});