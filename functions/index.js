const { onCall, HttpsError } = require("firebase-functions/v2/https");
const functionsV1 = require("firebase-functions/v1");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getAuth } = require("firebase-admin/auth");

// Initialize Firebase Admin
initializeApp();

// ============================================================================
// SHARED AUTHORISATION HELPERS
// ============================================================================

// Roles allowed to act on every user in the system. Kept in one place so a new
// privileged operation cannot accidentally ship without the check — which is
// exactly how sendFCMNotification below came to accept "broadcast to everyone"
// from any signed-in account.
const ADMIN_ROLES = ["super_user", "manager", "federal_manager"];

/** Reads the caller's roles from their profile. Never trusts client input. */
async function getCallerRoles(db, uid) {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return [];
  const data = snap.data() || {};
  if (Array.isArray(data.roles) && data.roles.length > 0) return data.roles;
  return data.role ? [String(data.role).toLowerCase()] : [];
}

/** Throws unless the caller holds one of ADMIN_ROLES. */
async function requireAdmin(db, auth, action) {
  if (!auth) throw new HttpsError("unauthenticated", "You must be logged in.");
  const roles = await getCallerRoles(db, auth.uid);
  if (!roles.some((role) => ADMIN_ROLES.includes(role))) {
    throw new HttpsError("permission-denied", `You do not have permission to ${action}.`);
  }
  return roles;
}

// A signed-in account may trigger at most this many broadcasts per hour.
// Without it, one compromised manager account can notify every device in a loop.
const BROADCAST_LIMIT_PER_HOUR = 20;

async function enforceBroadcastRateLimit(db, uid) {
  const ref = db.collection("notificationRateLimits").doc(uid);
  const windowStart = Date.now() - 60 * 60 * 1000;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const recent = (snap.exists ? snap.data().sentAt || [] : []).filter((ms) => ms > windowStart);
    if (recent.length >= BROADCAST_LIMIT_PER_HOUR) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many broadcasts in the last hour. Try again later."
      );
    }
    recent.push(Date.now());
    tx.set(ref, { sentAt: recent }, { merge: true });
  });
}

// ============================================================================
// 1. PUSH NOTIFICATION FUNCTION (EXCLUDES SENDER)
// ============================================================================
exports.sendFCMNotification = onCall(async (request) => {
  const { auth, data } = request;

  if (!auth) {
    throw new HttpsError("unauthenticated", "You must be logged in.");
  }

  const { targetUserId, title, body } = data || {};

  if (typeof title !== "string" || typeof body !== "string" || !title.trim() || !body.trim()) {
    throw new HttpsError("invalid-argument", "A notification needs a title and a body.");
  }
  if (title.length > 120 || body.length > 500) {
    throw new HttpsError("invalid-argument", "Notification text is too long.");
  }

  const db = getFirestore();
  const senderUid = auth.uid; // <-- Capture the ID of the person triggering the function

  // Broadcasts reach every device in the country. Only the privileged roles may
  // send them; a plain user can still trigger a targeted notification (e.g. the
  // report they just submitted notifying its reviewer).
  const isBroadcast = targetUserId === "all" || targetUserId === "managers_and_super_users";
  if (isBroadcast) {
    await requireAdmin(db, auth, "send notifications to all users");
    await enforceBroadcastRateLimit(db, senderUid);
  }

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
      if (typeof targetUserId !== "string" || !targetUserId) {
        throw new HttpsError("invalid-argument", "targetUserId is required.");
      }

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
    if (error instanceof HttpsError) throw error;
    console.error("Error sending FCM notification:", error);
    throw new HttpsError("internal", "Failed to send FCM message.");
  }
});

// ============================================================================
// 2. LIST USERS FUNCTION
// ============================================================================
exports.listUsers = onCall(async (request) => {
  const { auth, data } = request;

  const db = getFirestore();

  // Role validation (Only Admins/Managers can query all users)
  await requireAdmin(db, auth, "list authentication users");

  try {
    const authService = getAuth();
    const maxResults = Math.min(Number(data?.maxResults) || 1000, 1000);

    const listUsersResult = await authService.listUsers(maxResults, data?.pageToken);

    // Only the fields the admin screens actually render. userRecord.toJSON()
    // carries provider credentials, hashed password info and every linked
    // identity, none of which the browser needs.
    return {
      success: true,
      users: listUsersResult.users.map((userRecord) => ({
        uid: userRecord.uid,
        email: userRecord.email || null,
        displayName: userRecord.displayName || null,
        photoURL: userRecord.photoURL || null,
        disabled: userRecord.disabled,
        emailVerified: userRecord.emailVerified,
        creationTime: userRecord.metadata?.creationTime || null,
        lastSignInTime: userRecord.metadata?.lastSignInTime || null,
        providers: (userRecord.providerData || []).map((p) => p.providerId),
      })),
      pageToken: listUsersResult.pageToken
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("Error listing auth users:", error);
    throw new HttpsError("internal", "Failed to list users.");
  }
});

// ============================================================================
// 3. PROFILE CREATION — SERVER SIDE ONLY
//
// The browser used to create its own users/{uid} document, including the
// `permissions` object the whole UI then gates on. That only worked because the
// rules let a user write their own profile, which also let any signed-in user
// grant themselves super_user from the console. Creating the profile here means
// the rules can refuse every client write to role/roles/permissions.
//
// This is the v1 Auth onCreate trigger rather than a v2 blocking function, so
// it works without upgrading the project to Identity Platform. It fires just
// after the account is created, so the client can briefly read a missing
// profile — App.jsx retries for it instead of writing one itself.
// ============================================================================
const DEFAULT_PROFILE = {
  role: "user",
  roles: ["user"],
  permissions: {},   // the client applies DEFAULT_ROLE_PERMISSIONS for the role
  assignedState: "",
  assignedLocality: "",
};

exports.createUserProfile = functionsV1.auth.user().onCreate(async (user) => {
  if (!user) return;

  const db = getFirestore();
  const ref = db.collection("users").doc(user.uid);

  // A profile may already exist when an administrator pre-registered the person
  // by email. Never overwrite one — that would demote them on first sign-in.
  const existing = await ref.get();
  if (existing.exists) {
    await ref.set(
      { email: user.email || existing.data().email || "", lastLogin: FieldValue.serverTimestamp() },
      { merge: true }
    );
    return;
  }

  await ref.set({
    ...DEFAULT_PROFILE,
    email: user.email || "",
    displayName: user.displayName || "",
    createdAt: FieldValue.serverTimestamp(),
    lastLogin: FieldValue.serverTimestamp(),
  });
});

// ============================================================================
// 4. ROLE ASSIGNMENT — the only way role/permissions ever change
// ============================================================================
exports.setUserRoles = onCall(async (request) => {
  const { auth, data } = request;
  const db = getFirestore();

  await requireAdmin(db, auth, "change another user's roles");

  const { userId, roles, permissions, assignedState, assignedLocality } = data || {};
  if (!userId || !Array.isArray(roles) || roles.length === 0) {
    throw new HttpsError("invalid-argument", "userId and a non-empty roles array are required.");
  }
  if (userId === auth.uid) {
    throw new HttpsError("permission-denied", "You cannot change your own roles.");
  }

  const update = {
    roles,
    role: String(roles[0]).toLowerCase(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: auth.token?.email || auth.uid,
  };
  if (permissions && typeof permissions === "object") update.permissions = permissions;
  if (typeof assignedState === "string") update.assignedState = assignedState;
  if (typeof assignedLocality === "string") update.assignedLocality = assignedLocality;

  await db.collection("users").doc(userId).set(update, { merge: true });
  return { success: true };
});
