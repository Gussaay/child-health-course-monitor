// functions/claudeOAuth.js
//
// OAuth 2.1 for the MCP connector, so a team member can add this server in
// claude.ai and sign in with the account they already have.
//
// The shape of it:
//
//   claude.ai  --GET /authorize-->  here  --redirect-->  the app's sign-in
//   the app    --approve-->         here  --redirect-->  claude.ai with a code
//   claude.ai  --POST /token-->     here  --returns-->   an access token
//   claude.ai  --MCP + bearer-->    here  --resolves-->  that person's uid
//
// The access token this issues stands for ONE PERSON and carries no permissions
// of its own. Every read still resolves their roles at the time of the read, so
// a token issued to a facilitator who is later promoted gains the new access,
// and one issued to somebody who is later removed grants nothing.
//
// Deliberately narrow: authorisation code with PKCE, and nothing else. No
// implicit grant, no client credentials — both would let something other than a
// person hold a token, which is the one thing this must not allow.

const crypto = require("node:crypto");
const { onRequest, HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

// Where the team signs in. The consent screen lives in the app itself, so the
// person sees their own familiar login rather than a page asking for their
// password on a domain they do not recognise.
const APP_ORIGIN = "https://imnci-courses-monitor.web.app";
const ISSUER = "https://us-central1-imnci-courses-monitor.cloudfunctions.net/claudeOAuth";
const RESOURCE = "https://us-central1-imnci-courses-monitor.cloudfunctions.net/claudeMcp";

const AUTH_REQUEST_TTL_MS = 10 * 60 * 1000;   // long enough to sign in
const CODE_TTL_MS = 60 * 1000;                // exchanged immediately
const ACCESS_TTL_MS = 60 * 60 * 1000;         // an hour
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Only these may be redirected to. An open redirect here hands somebody else's
// authorisation code to whoever asked for it.
const ALLOWED_REDIRECT_HOSTS = new Set(["claude.ai", "claude.com"]);

const isAllowedRedirect = (uri) => {
  try {
    const url = new URL(uri);
    if (url.protocol !== "https:") return false;
    return ALLOWED_REDIRECT_HOSTS.has(url.hostname)
      || url.hostname.endsWith(".claude.ai")
      || url.hostname.endsWith(".claude.com");
  } catch { return false; }
};

const randomId = () => crypto.randomBytes(32).toString("base64url");

// Stored hashed. A leaked database read must not hand somebody a working token,
// and nothing here ever needs the original back.
const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

const verifyPkce = (verifier, challenge) => {
  const computed = crypto.createHash("sha256").update(String(verifier)).digest("base64url");
  // Fixed-time compare: the lengths are equal by construction, and a plain ===
  // on a secret is a timing oracle.
  const a = Buffer.from(computed);
  const b = Buffer.from(String(challenge));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const json = (res, status, body) => res.status(status).json(body);

// ============================================================================
// Discovery
// ============================================================================

exports.claudeOAuthMetadata = onRequest({ cors: true }, (req, res) => {
  const path = req.path || "/";
  if (path.includes("oauth-protected-resource")) {
    json(res, 200, {
      resource: RESOURCE,
      authorization_servers: [ISSUER],
      bearer_methods_supported: ["header"],
    });
    return;
  }
  json(res, 200, {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/token`,
    registration_endpoint: `${ISSUER}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["programme.read"],
  });
});

// ============================================================================
// The OAuth server
// ============================================================================

exports.claudeOAuth = onRequest({ cors: true }, async (req, res) => {
  const db = getFirestore();
  const path = (req.path || "/").replace(/\/+$/, "");

  try {
    // --- dynamic client registration ------------------------------------
    // Open, as the specification intends: a client id identifies a piece of
    // software, it does not authorise anything. Every grant still needs a
    // person to sign in and approve, and the redirect allowlist above is what
    // actually constrains where a code can go.
    if (path.endsWith("/register") && req.method === "POST") {
      const body = req.body || {};
      const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
      if (redirectUris.length === 0 || !redirectUris.every(isAllowedRedirect)) {
        json(res, 400, {
          error: "invalid_redirect_uri",
          error_description: "Redirect URIs must be https and belong to claude.ai.",
        });
        return;
      }
      const clientId = randomId();
      await db.collection("claudeOAuthClients").doc(clientId).set({
        clientName: String(body.client_name || "MCP client").slice(0, 120),
        redirectUris,
        createdAt: FieldValue.serverTimestamp(),
      });
      json(res, 201, {
        client_id: clientId,
        client_name: body.client_name || "MCP client",
        redirect_uris: redirectUris,
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      });
      return;
    }

    // --- authorize --------------------------------------------------------
    if (path.endsWith("/authorize") && req.method === "GET") {
      const {
        client_id: clientId, redirect_uri: redirectUri, state,
        code_challenge: challenge, code_challenge_method: method,
        response_type: responseType,
      } = req.query || {};

      if (responseType !== "code") {
        json(res, 400, { error: "unsupported_response_type" }); return;
      }
      // PKCE is required, not optional. Without it a stolen code is enough.
      if (!challenge || method !== "S256") {
        json(res, 400, {
          error: "invalid_request",
          error_description: "PKCE with S256 is required.",
        });
        return;
      }
      if (!isAllowedRedirect(redirectUri)) {
        json(res, 400, { error: "invalid_request", error_description: "Unrecognised redirect_uri." });
        return;
      }

      const client = await db.collection("claudeOAuthClients").doc(String(clientId || "")).get();
      if (!client.exists || !(client.data().redirectUris || []).includes(redirectUri)) {
        json(res, 400, { error: "invalid_client" }); return;
      }

      // Parked here, and handed to the app as an opaque id. The challenge and
      // the redirect never travel through the browser where they could be
      // edited on the way.
      const requestId = randomId();
      await db.collection("claudeOAuthRequests").doc(requestId).set({
        clientId, clientName: client.data().clientName || "Claude",
        redirectUri, state: state || null, codeChallenge: challenge,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + AUTH_REQUEST_TTL_MS),
      });

      res.redirect(302, `${APP_ORIGIN}/?connect_claude=${encodeURIComponent(requestId)}`);
      return;
    }

    // --- token ------------------------------------------------------------
    if (path.endsWith("/token") && req.method === "POST") {
      const body = req.body || {};
      const grant = body.grant_type;

      if (grant === "authorization_code") {
        const { code, code_verifier: verifier, redirect_uri: redirectUri } = body;
        const ref = db.collection("claudeOAuthCodes").doc(hash(code || ""));
        const snap = await ref.get();
        if (!snap.exists) { json(res, 400, { error: "invalid_grant" }); return; }
        const rec = snap.data();

        // Single use, whatever happens next.
        await ref.delete();

        if (rec.expiresAt.toMillis() < Date.now()) { json(res, 400, { error: "invalid_grant", error_description: "The code has expired." }); return; }
        if (rec.redirectUri !== redirectUri) { json(res, 400, { error: "invalid_grant", error_description: "redirect_uri does not match." }); return; }
        if (!verifier || !verifyPkce(verifier, rec.codeChallenge)) { json(res, 400, { error: "invalid_grant", error_description: "PKCE verification failed." }); return; }

        const issued = await issueTokens(db, rec.uid, rec.clientId);
        json(res, 200, issued);
        return;
      }

      if (grant === "refresh_token") {
        const ref = db.collection("claudeOAuthTokens").doc(hash(body.refresh_token || ""));
        const snap = await ref.get();
        if (!snap.exists) { json(res, 400, { error: "invalid_grant" }); return; }
        const rec = snap.data();
        await ref.delete();   // rotated on every use
        if (rec.kind !== "refresh" || rec.expiresAt.toMillis() < Date.now()) {
          json(res, 400, { error: "invalid_grant" }); return;
        }
        json(res, 200, await issueTokens(db, rec.uid, rec.clientId));
        return;
      }

      json(res, 400, { error: "unsupported_grant_type" });
      return;
    }

    json(res, 404, { error: "not_found" });
  } catch (e) {
    console.error("[claudeOAuth]", e);
    json(res, 500, { error: "server_error" });
  }
});

async function issueTokens(db, uid, clientId) {
  const accessToken = randomId();
  const refreshToken = randomId();
  const now = Date.now();

  await db.collection("claudeOAuthTokens").doc(hash(accessToken)).set({
    kind: "access", uid, clientId,
    expiresAt: Timestamp.fromMillis(now + ACCESS_TTL_MS),
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.collection("claudeOAuthTokens").doc(hash(refreshToken)).set({
    kind: "refresh", uid, clientId,
    expiresAt: Timestamp.fromMillis(now + REFRESH_TTL_MS),
    createdAt: FieldValue.serverTimestamp(),
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    scope: "programme.read",
  };
}

/**
 * Resolves an access token to the person it was issued to.
 * @returns {Promise<{uid: string}|null>}
 */
async function uidForAccessToken(token) {
  if (!token) return null;
  const snap = await getFirestore().collection("claudeOAuthTokens").doc(hash(token)).get();
  if (!snap.exists) return null;
  const rec = snap.data();
  if (rec.kind !== "access" || rec.expiresAt.toMillis() < Date.now()) return null;
  return { uid: rec.uid };
}

// ============================================================================
// The consent step, called by the app
// ============================================================================

/**
 * The signed-in person approves the connection, and gets back where to send
 * the browser. Callable, so Firebase has already verified who they are — this
 * function never sees a password and never issues anything to an unverified
 * caller.
 */
exports.approveClaudeConnection = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const db = getFirestore();

  const requestId = String(request.data?.requestId || "");
  const ref = db.collection("claudeOAuthRequests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "That connection request has expired. Start again from Claude.");

  const req = snap.data();
  if (req.expiresAt.toMillis() < Date.now()) {
    await ref.delete();
    throw new HttpsError("deadline-exceeded", "That connection request has expired. Start again from Claude.");
  }

  await ref.delete();   // one approval per request

  const code = randomId();
  await db.collection("claudeOAuthCodes").doc(hash(code)).set({
    uid: request.auth.uid,
    clientId: req.clientId,
    redirectUri: req.redirectUri,
    codeChallenge: req.codeChallenge,
    expiresAt: Timestamp.fromMillis(Date.now() + CODE_TTL_MS),
    createdAt: FieldValue.serverTimestamp(),
  });

  const url = new URL(req.redirectUri);
  url.searchParams.set("code", code);
  if (req.state) url.searchParams.set("state", req.state);
  return { redirectTo: url.toString(), clientName: req.clientName };
});

/** What the consent screen shows, before anything is granted. */
exports.describeClaudeConnection = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const snap = await getFirestore()
    .collection("claudeOAuthRequests").doc(String(request.data?.requestId || "")).get();
  if (!snap.exists) throw new HttpsError("not-found", "That connection request has expired.");
  const req = snap.data();
  if (req.expiresAt.toMillis() < Date.now()) throw new HttpsError("deadline-exceeded", "That connection request has expired.");
  return { clientName: req.clientName || "Claude", redirectHost: new URL(req.redirectUri).hostname };
});

module.exports.uidForAccessToken = uidForAccessToken;
module.exports.isAllowedRedirect = isAllowedRedirect;
module.exports.verifyPkce = verifyPkce;
module.exports.hash = hash;
