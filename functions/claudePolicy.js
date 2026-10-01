// functions/claudePolicy.js
//
// The rules about what Claude may read and where an authorisation code may be
// sent — the decisions, with none of the plumbing that carries them out.
//
// Kept apart from claudeAccess.js and claudeOAuth.js because those pull in
// firebase-functions and firebase-admin, which are installed only inside
// functions/. A test that imports them passes on a developer's machine and
// fails in CI, where only the root dependencies exist — which is exactly what
// happened. Nothing here requires anything but node's own crypto, so the parts
// where a mistake is a vulnerability can be tested anywhere.

const crypto = require("node:crypto");

// ============================================================================
// What may be read, and by whom
// ============================================================================
//
// An allowlist, not a denylist. A collection added to Firestore later is
// unreachable until somebody puts it here and says which permission it needs —
// which is the failure we want, rather than a new collection of personal data
// becoming readable the day it is created.
//
// `permission` names a key from src/components/permissions.js. `scope` names
// the fields that carry a state and a locality, so a manager limited to one
// state sees only their own.
const COLLECTIONS = {
  courses: {
    permission: "canViewCourse",
    scope: { state: "state", locality: "locality" },
    description: "Training courses: type, sub-course, dates, state, locality, groups.",
  },
  participants: {
    permission: "canViewCourse",
    scope: { state: "state", locality: "locality" },
    personal: true,
    description: "People who attended a course: name, job title, phone, group, test scores.",
  },
  participantTests: {
    permission: "canViewCourse",
    description: "Pre and post test records, per participant and module.",
  },
  observations: {
    permission: "canViewCourse",
    description: "Clinical observation records made during a course.",
  },
  cases: {
    permission: "canViewCourse",
    description: "Practical cases seen by participants during a course.",
  },
  finalReports: {
    permission: "canViewCourse",
    description: "The final report submitted for a course.",
  },
  facilitators: {
    permission: "canViewHumanResource",
    personal: true,
    description: "Facilitators: name, qualification, contact, courses facilitated.",
  },
  coordinators: {
    permission: "canViewHumanResource",
    personal: true,
    description: "Locality, state and federal coordinators.",
  },
  healthFacilities: {
    permission: "canViewFacilities",
    scope: { state: "الولاية", locality: "المحلية" },
    description: "Health facilities: name, type, services, staffing, coordinates.",
  },
  facilitySnapshots: {
    permission: "canViewFacilities",
    description: "Point-in-time records of a facility's services and readiness.",
  },
  masterPlans: {
    permission: "canViewLocalityPlan",
    scope: { state: "state", locality: "locality" },
    description: "Strategic and locality plans: interventions, targets, budgets, funding.",
  },
  operationalPlans: {
    permission: "canViewLocalityPlan",
    scope: { state: "state", locality: "locality" },
    description: "Quarterly, monthly and weekly operational plans and their activities.",
  },
  populationTargets: {
    permission: "canViewLocalityPlan",
    scope: { state: "state", locality: "locality" },
    description: "Population denominators per state and locality per year.",
  },
  skillMentorshipSubmissions: {
    permission: "canViewSkillsMentorship",
    scope: { state: "state", locality: "locality" },
    description: "Mentorship visits: skills assessed, scores, health worker, facility.",
  },
  imnciVisitReports: {
    permission: "canViewSkillsMentorship",
    scope: { state: "state", locality: "locality" },
    description: "IMNCI supervisory visit reports.",
  },
  eencVisitReports: {
    permission: "canViewSkillsMentorship",
    scope: { state: "state", locality: "locality" },
    description: "EENC supervisory visit reports.",
  },
  supervisionAssessments: {
    permission: "canViewSupervision",
    scope: { state: "state", locality: "locality" },
    description: "Supervision checklists completed against a service.",
  },
  supplyItems: {
    permission: "canViewSupplyChain",
    description: "Essential supply list: drugs, equipment and information items.",
  },
  projects: {
    permission: "canViewCourse",
    description: "Projects and the funding behind them.",
  },
  // Clinical records of individual children. Reachable because the programme
  // asked for it, and gated on the same permission the recording screen uses.
  // Flagged `clinical` so a caller is told what they are handling and so the
  // audit trail can be read for these alone.
  imnciPatientRecords: {
    permission: "canViewCourse",
    scope: { state: "state", locality: "locality" },
    personal: true,
    clinical: true,
    description:
      "Individual sick-child records: age, weight, signs, classifications and treatments. "
      + "Clinical records of named children — summarise rather than list wherever the question allows it.",
  },
};

// Never reachable, whatever the caller's role. Credentials, delivery queues and
// the permission blueprint itself: reading these through an assistant has no
// analytical purpose and each one is a way to escalate.
const NEVER = new Set(["users", "meta", "mail", "onlineProgress", "exerciseAttempts"]);

const MAX_ROWS = 500;

/** The collections this caller may read, with what each one holds. */
function catalogueFor(access) {
  return Object.entries(COLLECTIONS)
    .filter(([, spec]) => access.permissions[spec.permission] === true)
    .map(([name, spec]) => ({
      collection: name,
      description: spec.description,
      containsPersonalData: !!spec.personal,
      containsClinicalRecords: !!spec.clinical,
      scopedTo: spec.scope ? Object.keys(spec.scope) : [],
    }));
}

/** Throws unless this caller may read this collection. Returns its spec. */
function assertReadable(name, access) {
  if (NEVER.has(name)) {
    const err = new Error(`"${name}" is not available through this interface.`);
    err.code = "permission-denied";
    throw err;
  }
  const spec = COLLECTIONS[name];
  if (!spec) {
    const err = new Error(`Unknown collection "${name}".`);
    err.code = "invalid-argument";
    throw err;
  }
  if (access.permissions[spec.permission] !== true) {
    const err = new Error(
      `Your account does not have access to ${name}. It needs ${spec.permission}.`);
    err.code = "permission-denied";
    throw err;
  }
  return spec;
}

// ============================================================================
// OAuth
// ============================================================================

// Only these may be redirected to. An open redirect here hands somebody else's
// authorisation code to whoever asked for it.
const ALLOWED_REDIRECT_HOSTS = new Set(["claude.ai", "claude.com"]);

// Loopback, for a desktop client. OAuth 2.1 allows this for native apps
// precisely because a loopback address cannot be reached from anywhere else,
// and PKCE is mandatory here, so a code that leaks is still unusable. The port
// is deliberately not pinned: a native client picks a free one at run time.
const isLoopback = (url) =>
  (url.protocol === "http:" || url.protocol === "https:")
  && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");

const isAllowedRedirect = (uri) => {
  try {
    const url = new URL(uri);
    if (isLoopback(url)) return true;
    if (url.protocol !== "https:") return false;
    return ALLOWED_REDIRECT_HOSTS.has(url.hostname)
      || url.hostname.endsWith(".claude.ai")
      || url.hostname.endsWith(".claude.com");
  } catch { return false; }
};

// Stored hashed. A leaked database read must not hand somebody a working token,
// and nothing here ever needs the original back.
const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

/** Does this verifier produce the challenge the flow started with? */
const verifyPkce = (verifier, challenge) => {
  const computed = crypto.createHash("sha256").update(String(verifier)).digest("base64url");
  // Fixed-time compare: a plain === on a secret is a timing oracle.
  const a = Buffer.from(computed);
  const b = Buffer.from(String(challenge));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = {
  COLLECTIONS, NEVER, MAX_ROWS, catalogueFor, assertReadable,
  isAllowedRedirect, hash, verifyPkce,
};
