// functions/claudeAccess.js
//
// Read-only access to programme data for Claude — one layer, used by both the
// chat panel inside the app and the MCP server the team connects from
// claude.ai.
//
// The rule this is built around: Claude acts AS THE PERSON ASKING, never as the
// system. Every query resolves the caller's own roles and applies the same
// permission each screen applies, so a facilitator reaches through Claude
// exactly what a facilitator reaches in the app, and nothing more. There is no
// service-account path and no "trusted" caller; a request with no verified user
// is refused rather than answered.
//
// It is read-only by construction: nothing here writes to a data collection.
// The only thing it writes is its own audit trail.

const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// The decisions live apart from the plumbing, so they can be tested without
// the Cloud Functions runtime installed. See claudePolicy.js.
const {
  COLLECTIONS, NEVER, MAX_ROWS, catalogueFor, assertReadable,
} = require("./claudePolicy");

// ============================================================================
// Who is asking
// ============================================================================

/** The caller's roles, from their own profile. Client input is never trusted. */
async function rolesOf(db, uid) {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return [];
  const data = snap.data() || {};
  if (Array.isArray(data.roles) && data.roles.length > 0) return data.roles;
  return data.role ? [String(data.role).toLowerCase()] : [];
}

/**
 * The caller's permissions, merged across their roles.
 *
 * Read from the same meta/roles blueprint the app reads, rather than a second
 * copy of the role table kept here. Two copies of an authorisation table drift,
 * and the copy that drifts is the one nobody is looking at.
 *
 * A role the blueprint does not describe grants nothing. Failing closed is the
 * only safe direction: the alternative is a role that has been renamed silently
 * becoming an administrator.
 */
async function permissionsOf(db, roles) {
  const snap = await db.collection("meta").doc("roles").get();
  const blueprint = snap.exists ? snap.data() || {} : {};

  const merged = {};
  let scope = "none";
  let location = "";

  roles.forEach((role) => {
    const entry = blueprint[String(role).toLowerCase()];
    if (!entry || typeof entry !== "object") return;
    Object.entries(entry).forEach(([key, value]) => {
      if (value === true) merged[key] = true;
    });
    // The widest scope any of the caller's roles grants.
    if (entry.manageScope === "all") { scope = "all"; location = ""; }
    else if (entry.manageScope && scope !== "all") {
      scope = entry.manageScope;
      location = entry.manageLocation || location;
    }
  });

  return { permissions: merged, manageScope: scope, manageLocation: location };
}

/** Everything needed to answer "may this person read this, and how much of it?" */
async function accessFor(auth) {
  if (!auth || !auth.uid) {
    const err = new Error("You must be signed in.");
    err.code = "unauthenticated";
    throw err;
  }
  const db = getFirestore();
  const roles = await rolesOf(db, auth.uid);
  const { permissions, manageScope, manageLocation } = await permissionsOf(db, roles);
  return { db, uid: auth.uid, email: auth.token?.email || null, roles, permissions, manageScope, manageLocation };
}

// ============================================================================
// Reading
// ============================================================================

/**
 * Runs one read.
 *
 * Filters are applied by Firestore where they can be, and the caller's own
 * state or locality is applied on top and cannot be widened by the request —
 * asking for another state returns that state's name filtered back to nothing
 * rather than that state's data.
 */
async function runQuery(access, { collection, filters = [], limit = 100, orderBy = null }) {
  const spec = assertReadable(collection, access);
  const capped = Math.max(1, Math.min(Number(limit) || 100, MAX_ROWS));

  let q = access.db.collection(collection);

  const allowedOps = new Set(["==", "!=", "<", "<=", ">", ">=", "array-contains", "in"]);
  (Array.isArray(filters) ? filters : []).slice(0, 8).forEach((f) => {
    if (!f || typeof f.field !== "string") return;
    const op = allowedOps.has(f.op) ? f.op : "==";
    q = q.where(f.field, op, f.value);
  });

  // The caller's own scope, applied last so a filter in the request cannot
  // replace it.
  if (spec.scope && access.manageScope !== "all" && access.manageLocation) {
    if (access.manageScope === "state" && spec.scope.state) {
      q = q.where(spec.scope.state, "==", access.manageLocation);
    } else if (access.manageScope === "locality" && spec.scope.locality) {
      q = q.where(spec.scope.locality, "==", access.manageLocation);
    }
  }

  if (orderBy && typeof orderBy === "string") q = q.orderBy(orderBy, "desc");

  const snap = await q.limit(capped).get();
  const rows = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => r.isDeleted !== true && r.isDeleted !== "true");

  await audit(access, "query", { collection, filters, limit: capped, returned: rows.length });

  return {
    collection,
    returned: rows.length,
    truncated: rows.length >= capped,
    containsPersonalData: !!spec.personal,
    containsClinicalRecords: !!spec.clinical,
    rows,
  };
}

/**
 * Counts, grouped by a field — the shape most programme questions actually
 * want, and the one that answers them without moving names anywhere.
 */
async function runSummary(access, { collection, groupBy, filters = [], limit = 2000 }) {
  assertReadable(collection, access);
  const page = await runQuery(access, { collection, filters, limit: Math.min(limit, MAX_ROWS) });

  const counts = {};
  page.rows.forEach((row) => {
    const key = String(row?.[groupBy] ?? "(not set)");
    counts[key] = (counts[key] || 0) + 1;
  });

  return {
    collection,
    groupBy,
    total: page.rows.length,
    truncated: page.truncated,
    groups: Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// ============================================================================
// Audit
// ============================================================================
//
// Every read is recorded, because this is the one path where programme data
// leaves the system into a model's context, and "what did Claude see, for whom,
// and when" has to be answerable afterwards. Written best-effort: a failure to
// log must not fail the read, but it is reported.

async function audit(access, action, detail) {
  try {
    await access.db.collection("claudeAccessLog").add({
      uid: access.uid,
      email: access.email,
      roles: access.roles,
      action,
      detail,
      at: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error("[claudeAccess] could not write the audit record:", e.message);
  }
}

module.exports = {
  COLLECTIONS,
  NEVER,
  accessFor,
  catalogueFor,
  assertReadable,
  runQuery,
  runSummary,
  MAX_ROWS,
};
