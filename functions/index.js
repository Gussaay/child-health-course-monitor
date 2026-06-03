const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getAuth } = require("firebase-admin/auth");

// Initialize Firebase Admin
initializeApp();

// ============================================================================
// 1. UPDATED: PUSH NOTIFICATION FUNCTION (EXCLUDES SENDER)
// ============================================================================
exports.sendFCMNotification = onCall(async (request) => {
  const { auth, data } = request;

  // 1. Any authenticated user can trigger system notifications (e.g., submitting reports)
  if (!auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { targetUserId, title, body } = data;
  const db = getFirestore();
  const senderUid = auth.uid; // <-- Capture the ID of the person triggering the function

  try {
    const tokens = [];

    // Scenario A: Notify all Federal Managers and Super Users
    if (targetUserId === "managers_and_super_users") {
      const usersSnapshot = await db.collection("users").get();
      usersSnapshot.forEach((doc) => {
        // EXCLUDE THE SENDER FROM THE NOTIFICATION LIST
        if (doc.id === senderUid) return; 

        const userData = doc.data();
        const roles = userData.roles || [userData.role || 'user'];
        
        // Match against existing roles setup
        if (roles.includes("federal_manager") || roles.includes("super_user") || roles.includes("manager")) {
          const userToken = userData.fcmToken;
          if (userToken) tokens.push(userToken);
        }
      });
    } 
    // Scenario B: Broadcast to every single system user
    else if (targetUserId === "all") {
      const usersSnapshot = await db.collection("users").get();
      usersSnapshot.forEach((doc) => {
        // EXCLUDE THE SENDER
        if (doc.id === senderUid) return;

        const userToken = doc.data().fcmToken;
        if (userToken) tokens.push(userToken);
      });
    } 
    // Scenario C: Target a single specific user ID
    else {
      // EXCLUDE THE SENDER IF THEY ACCIDENTALLY TARGET THEMSELVES
      if (targetUserId === senderUid) {
          return { success: true, message: "Sender excluded from targeted notification." };
      }
      
      const userDoc = await db.collection("users").doc(targetUserId).get();
      if (userDoc.exists && userDoc.data().fcmToken) {
        tokens.push(userDoc.data().fcmToken);
      }
    }

    // Clean array duplicates
    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) {
      return { success: false, message: "No FCM tokens found for targets (or sender was the only target)." };
    }

    // Multicast message packet
    const message = {
      notification: { title, body },
      tokens: uniqueTokens,
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

// ============================================================================
// 2. RESTORED: LIST USERS FUNCTION
// ============================================================================
exports.listUsers = onCall(async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to fetch users."
    );
  }

  const db = getFirestore();

  // Role validation (Only Admins/Managers can query all users)
  const senderDoc = await db.collection("users").doc(auth.uid).get();
  const senderRoles = senderDoc.data()?.roles || [];
  if (!senderRoles.includes("super_user") && !senderRoles.includes("manager") && !senderRoles.includes("federal_manager")) {
    throw new HttpsError(
      "permission-denied",
      "You do not have permission to list authentication users."
    );
  }

  try {
    const authService = getAuth();
    const maxResults = data?.maxResults || 1000; 
    
    const listUsersResult = await authService.listUsers(maxResults, data?.pageToken);

    return {
      success: true,
      users: listUsersResult.users.map(userRecord => userRecord.toJSON()),
      pageToken: listUsersResult.pageToken 
    };
  } catch (error) {
    console.error("Error listing auth users:", error);
    throw new HttpsError("internal", "Failed to list users.");
  }
});