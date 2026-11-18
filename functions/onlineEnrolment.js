// functions/onlineEnrolment.js
//
// Who may take which online course, and in which group.
//
// A course is "approval" (the default): a learner asks to join and a manager
// approves, or a manager enrols them directly. A course marked "open" needs
// no enrolment at all. Each enrolled learner sits in a group: one of the
// default groups below, or a group a manager adds (for example "Registrar
// batch 53"). A group may have a facilitator from the app's facilitator list.
//
//   onlineEnrolments/{courseId}__{uid}
//     { courseId, uid, name, email, state, locality,
//       status: "requested" | "approved" | "declined", groupId,
//       requestedAt, decidedAt, decidedBy, decidedByName }
//   onlineGroups/{groupId}
//     { name, description, facilitatorId, facilitator: { name, phone, email, state },
//       isDeleted, createdAt, updatedAt }
//
// Everything goes through this callable, with the admin SDK, so no Firestore
// rule has to change for it: a learner only ever reaches their own records,
// and a manager only the people in their scope (the same scope as the
// progress dashboard, onlineProgressReport.js scopeOf).
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { scopeOf, rolesOf } = require("./onlineProgressReport");

// The groups every course has without anyone adding them. A manager can give
// one a facilitator; that is saved as an onlineGroups doc with the same id.
const DEFAULT_GROUPS = [
  { id: "general", name: "General learners", nameAr: "المتعلمون عامة", isDefault: true },
  { id: "doctors", name: "Medical doctors", nameAr: "الأطباء", isDefault: true },
  { id: "medical-assistants", name: "Medical assistants", nameAr: "المساعدون الطبيون", isDefault: true },
  { id: "nurses-midwives", name: "Nurses and midwives", nameAr: "الممرضون والقابلات", isDefault: true },
];
const DEFAULT_GROUP_ID = "general";

const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
const notDeleted = (x) => x && x.isDeleted !== true && x.isDeleted !== "true";
const enrolmentId = (courseId, uid) => `${courseId}__${uid}`;
const millis = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : v && v._seconds ? v._seconds * 1000 : typeof v === "number" ? v : null);

/** Default groups with any saved changes, then the groups managers added. */
function mergeGroups(saved) {
  const byId = Object.fromEntries((saved || []).map((g) => [g.id, g]));
  const defaults = DEFAULT_GROUPS.map((d) => ({ ...d, ...(byId[d.id] || {}), id: d.id, isDefault: true, name: byId[d.id]?.name || d.name, isDeleted: false }));
  const added = (saved || []).filter((g) => !DEFAULT_GROUPS.some((d) => d.id === g.id) && notDeleted(g))
    .map((g) => ({ ...g, isDefault: false }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return [...defaults, ...added].map(publicGroup);
}

function publicGroup(g) {
  return {
    id: g.id,
    name: g.name || "",
    nameAr: g.nameAr || "",
    description: g.description || "",
    isDefault: !!g.isDefault,
    facilitatorId: g.facilitatorId || "",
    facilitator: g.facilitatorId && g.facilitator ? {
      name: g.facilitator.name || "", arabicName: g.facilitator.arabicName || "",
      phone: g.facilitator.phone || "", email: g.facilitator.email || "",
      state: g.facilitator.state || "", locality: g.facilitator.locality || "",
      courses: Array.isArray(g.facilitator.courses) ? g.facilitator.courses : [],
    } : null,
  };
}

function publicEnrolment(e) {
  return {
    id: e.id, courseId: e.courseId, uid: e.uid, name: e.name || "", email: e.email || "",
    state: e.state || "", locality: e.locality || "", status: e.status || "requested",
    groupId: e.groupId || DEFAULT_GROUP_ID,
    requestedAt: millis(e.requestedAt), decidedAt: millis(e.decidedAt), decidedByName: e.decidedByName || "",
  };
}

/** Whether a manager with `scope` may act on the person `u` (a users doc or an enrolment). */
const inScope = (scope, u) => !!scope && (scope.level === "all"
  || (scope.level === "state" && same(u.state ?? u.assignedState, scope.state))
  || (scope.level === "locality" && same(u.locality ?? u.assignedLocality, scope.locality)));

const personOf = (uid, u) => ({
  uid, name: u.displayName || u.name || u.email || "", email: u.email || "",
  state: u.assignedState || "", locality: u.assignedLocality || "",
});

const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

async function loadGroups(db) {
  return mergeGroups(docs(await db.collection("onlineGroups").get()));
}

function needString(v, what) {
  if (typeof v !== "string" || !v.trim() || v.length > 200) throw new HttpsError("invalid-argument", `${what} is missing.`);
  return v.trim();
}

async function handle(db, uid, data) {
  const action = data?.action;
  const meSnap = await db.collection("users").doc(uid).get();
  const me = meSnap.exists ? meSnap.data() : {};
  const scope = scopeOf(me);
  const groupsCol = db.collection("onlineGroups");
  const enrolCol = db.collection("onlineEnrolments");

  // --- the learner's own -------------------------------------------------
  if (action === "mine") {
    const [mine, groups] = await Promise.all([enrolCol.where("uid", "==", uid).get(), loadGroups(db)]);
    return { enrolments: docs(mine).map(publicEnrolment), groups };
  }

  if (action === "request") {
    const courseId = needString(data.courseId, "The course");
    const course = await db.collection("onlineCourses").doc(courseId).get();
    if (!course.exists || !notDeleted(course.data())) throw new HttpsError("not-found", "That course is not available.");
    if (course.data().enrolment === "open") return { status: "open" };
    const ref = enrolCol.doc(enrolmentId(courseId, uid));
    const now = await ref.get();
    if (now.exists && now.data().status === "approved") return publicEnrolment({ id: ref.id, ...now.data() });
    const rec = {
      courseId, ...personOf(uid, me), status: "requested",
      groupId: now.exists ? (now.data().groupId || DEFAULT_GROUP_ID) : DEFAULT_GROUP_ID,
      requestedAt: FieldValue.serverTimestamp(), decidedAt: null, decidedBy: null, decidedByName: "",
    };
    await ref.set(rec, { merge: true });
    return publicEnrolment({ id: ref.id, ...rec, requestedAt: Date.now() });
  }

  if (action === "cancel") {
    const courseId = needString(data.courseId, "The course");
    const ref = enrolCol.doc(enrolmentId(courseId, uid));
    const now = await ref.get();
    if (now.exists && now.data().status === "requested") await ref.delete();
    return { ok: true };
  }

  // --- managers ------------------------------------------------------------
  if (!scope) throw new HttpsError("permission-denied", "Managing enrolment is for managers.");
  const myName = me.displayName || me.name || me.email || "";

  if (action === "list") {
    const [enrols, groups, users] = await Promise.all([
      enrolCol.get(),
      loadGroups(db),
      db.collection("users").select("displayName", "name", "email", "assignedState", "assignedLocality", "role", "roles", "isDeleted").get(),
    ]);
    const people = docs(users).filter((u) => notDeleted(u) && inScope(scope, u))
      .map((u) => ({ ...personOf(u.id, u), role: rolesOf(u)[0] || "user" }));
    return {
      scope,
      enrolments: docs(enrols).filter((e) => inScope(scope, e)).map(publicEnrolment),
      groups,
      people,
    };
  }

  const groupIdOf = async (g) => {
    const id = String(g || DEFAULT_GROUP_ID);
    if (DEFAULT_GROUPS.some((d) => d.id === id)) return id;
    const snap = await groupsCol.doc(id).get();
    if (!snap.exists || !notDeleted(snap.data())) throw new HttpsError("invalid-argument", "That group does not exist.");
    return id;
  };

  if (action === "decide" || action === "setGroup") {
    const ids = Array.isArray(data.ids) ? data.ids.slice(0, 500).map(String) : [];
    if (!ids.length) throw new HttpsError("invalid-argument", "Choose at least one learner.");
    const groupId = data.groupId ? await groupIdOf(data.groupId) : null;
    const status = action === "decide" ? data.status : null;
    if (action === "decide" && !["approved", "declined", "removed"].includes(status)) throw new HttpsError("invalid-argument", "Unknown decision.");
    const snaps = await db.getAll(...ids.map((id) => enrolCol.doc(id)));
    const batch = db.batch();
    let n = 0;
    snaps.forEach((s) => {
      if (!s.exists || !inScope(scope, s.data())) return;
      n += 1;
      if (status === "removed") { batch.delete(s.ref); return; }
      const patch = {};
      if (groupId) patch.groupId = groupId;
      if (status) Object.assign(patch, { status, decidedAt: FieldValue.serverTimestamp(), decidedBy: uid, decidedByName: myName });
      batch.update(s.ref, patch);
    });
    await batch.commit();
    return { changed: n };
  }

  if (action === "enrol") {
    const courseId = needString(data.courseId, "The course");
    const uids = Array.isArray(data.uids) ? data.uids.slice(0, 500).map(String) : [];
    if (!uids.length) throw new HttpsError("invalid-argument", "Choose at least one learner.");
    const course = await db.collection("onlineCourses").doc(courseId).get();
    if (!course.exists) throw new HttpsError("not-found", "That course does not exist.");
    const groupId = await groupIdOf(data.groupId);
    const userSnaps = await db.getAll(...uids.map((id) => db.collection("users").doc(id)));
    const batch = db.batch();
    let n = 0;
    userSnaps.forEach((s) => {
      if (!s.exists || !inScope(scope, s.data())) return;
      n += 1;
      batch.set(enrolCol.doc(enrolmentId(courseId, s.id)), {
        courseId, ...personOf(s.id, s.data()), status: "approved", groupId,
        requestedAt: FieldValue.serverTimestamp(), decidedAt: FieldValue.serverTimestamp(), decidedBy: uid, decidedByName: myName,
      }, { merge: true });
    });
    await batch.commit();
    return { enrolled: n };
  }

  if (action === "saveGroup") {
    const g = data.group || {};
    const name = needString(g.name, "The group's name");
    const isDefault = DEFAULT_GROUPS.some((d) => d.id === g.id);
    const ref = g.id ? groupsCol.doc(String(g.id)) : groupsCol.doc();
    let facilitator = null;
    const facilitatorId = g.facilitatorId ? String(g.facilitatorId) : "";
    if (facilitatorId) {
      const f = await db.collection("facilitators").doc(facilitatorId).get();
      if (!f.exists) throw new HttpsError("invalid-argument", "That facilitator is not in the facilitator list.");
      const fd = f.data();
      facilitator = {
        name: fd.name || "", arabicName: fd.arabicName || "", phone: fd.phone || "", email: fd.email || "",
        state: fd.currentState || "", locality: fd.currentLocality || "", courses: Array.isArray(fd.courses) ? fd.courses : [],
      };
    }
    const rec = {
      name, description: String(g.description || "").slice(0, 500), facilitatorId, facilitator,
      isDeleted: false, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid,
    };
    if (isDefault) rec.isDefault = true;
    const before = await ref.get();
    if (!before.exists) { rec.createdAt = FieldValue.serverTimestamp(); rec.createdBy = uid; }
    await ref.set(rec, { merge: true });
    return publicGroup({ id: ref.id, ...rec });
  }

  if (action === "deleteGroup") {
    const id = needString(data.id, "The group");
    if (DEFAULT_GROUPS.some((d) => d.id === id)) throw new HttpsError("failed-precondition", "A default group cannot be deleted.");
    // Its learners move to the default group, so nobody is left in a group that is gone.
    const inGroup = await enrolCol.where("groupId", "==", id).get();
    const batch = db.batch();
    inGroup.docs.forEach((d) => batch.update(d.ref, { groupId: DEFAULT_GROUP_ID }));
    batch.set(groupsCol.doc(id), { isDeleted: true, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid }, { merge: true });
    await batch.commit();
    return { moved: inGroup.size };
  }

  throw new HttpsError("invalid-argument", "Unknown action.");
}

exports.onlineEnrolment = onCall({ timeoutSeconds: 60, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  return handle(getFirestore(), request.auth.uid, request.data || {});
});

module.exports.DEFAULT_GROUPS = DEFAULT_GROUPS;
module.exports.DEFAULT_GROUP_ID = DEFAULT_GROUP_ID;
module.exports.mergeGroups = mergeGroups;
module.exports.inScope = inScope;
module.exports.handle = handle;
