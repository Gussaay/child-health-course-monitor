// functions/onlineProgressReport.js
//
// Who is working through the online courses, for managers: one row per
// person with how many sections of each course they have finished. Each
// learner's progress (onlineProgress/{uid}) is private to them in the rules,
// so managers get it only through here, and only for the people they manage:
// a state manager their state, a locality manager their locality.
// Kept apart from the Cloud Function so the arithmetic is tested on its own.

const MANAGER_ROLES = ["super_user", "federal_manager", "states_manager", "locality_manager"];

const rolesOf = (u) => (Array.isArray(u?.roles) && u.roles.length ? u.roles : u?.role ? [u.role] : [])
  .map((r) => String(r).toLowerCase());

const notDeleted = (x) => x && x.isDeleted !== true && x.isDeleted !== "true";
const millis = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : v && v._seconds ? v._seconds * 1000 : typeof v === "number" ? v : 0);
const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/** Which people this caller may see: everyone, one state, one locality, or nobody. */
function scopeOf(caller) {
  const roles = rolesOf(caller);
  if (roles.includes("super_user") || roles.includes("federal_manager")) return { level: "all" };
  if (roles.includes("states_manager") && caller.assignedState) return { level: "state", state: caller.assignedState };
  if (roles.includes("locality_manager") && caller.assignedLocality) {
    return { level: "locality", state: caller.assignedState || "", locality: caller.assignedLocality };
  }
  return null;
}

const inScope = (scope, u) => scope.level === "all"
  || (scope.level === "state" && same(u.assignedState, scope.state))
  || (scope.level === "locality" && same(u.assignedLocality, scope.locality));

/**
 * The report from plain records: courses ({id, title, isPublished}), items
 * (modules {id, kind: "module", courseId, title, order} and sections {id,
 * kind: "section", courseId, moduleId, title, order}), progress ({id: uid,
 * completed: {sectionId: time}, activities: {sectionId: [keys]}}) and users
 * ({id, displayName, email, assignedState, assignedLocality, role(s)}).
 * Everyone in scope is listed, those who have not started too.
 *
 * Each course carries its modules and lessons in reading order, with how many
 * of the people in scope finished and started each lesson, so the dashboard
 * can show where learners stop. Each learner carries how many lessons they
 * finished per course and per module, how many they have started but not
 * finished, and the lesson they are on.
 */
function buildReport({ caller, courses, items, progress, users }) {
  const scope = scopeOf(caller);
  if (!scope) return null;
  const live = courses.filter((c) => notDeleted(c) && c.isPublished !== false);
  const kept = items.filter(notDeleted);
  const byOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0);
  const modulesOf = {};
  kept.filter((i) => i.kind === "module").sort(byOrder).forEach((m) => {
    (modulesOf[m.courseId] = modulesOf[m.courseId] || []).push(m);
  });
  const sectionsOf = {};
  kept.filter((i) => i.kind === "section").forEach((s) => {
    (sectionsOf[s.courseId] = sectionsOf[s.courseId] || []).push(s);
  });
  const courseList = live.map((c) => {
    const secs = sectionsOf[c.id] || [];
    const mods = modulesOf[c.id] || [];
    const modIndex = Object.fromEntries(mods.map((m, i) => [m.id, i]));
    // Reading order: module by module, then lesson order; lessons outside a known module last.
    const ordered = [...secs].sort((a, b) => (modIndex[a.moduleId] ?? 1e6) - (modIndex[b.moduleId] ?? 1e6) || byOrder(a, b));
    const lessons = ordered.map((s) => ({ id: s.id, title: s.title || "", moduleId: s.moduleId || "", done: 0, started: 0 }));
    // ratingSum / ratings: the 1 to 5 stars learners gave the module at its end.
    const modules = mods.map((m) => ({ id: m.id, title: m.title || "", sections: lessons.filter((l) => l.moduleId === m.id).length, ratingSum: 0, ratings: 0 }))
      .filter((m) => m.sections > 0);
    return { id: c.id, title: c.title || c.id, sections: lessons.length, modules, lessons };
  }).filter((c) => c.sections > 0);
  const recordOf = Object.fromEntries(progress.map((p) => [p.id, p]));

  const learners = users.filter((u) => notDeleted(u) && inScope(scope, u)).map((u) => {
    const rec = recordOf[u.id] || {};
    const done = rec.completed || {};
    const acts = rec.activities || {};
    let last = millis(rec.lastUpdatedAt);
    const perCourse = {};
    const perModule = {};
    const startedPerCourse = {};
    const at = {};
    // First tries at practice questions: "<activity>@1" right, "<activity>@0" not.
    const firstTry = {};
    courseList.forEach((c) => {
      let n = 0;
      let started = 0;
      const ft = [0, 0];
      c.lessons.forEach((l) => {
        (Array.isArray(acts[l.id]) ? acts[l.id] : []).forEach((k) => {
          const tag = String(k).split("@")[1];
          if (tag === "1") { ft[0] += 1; ft[1] += 1; }
          else if (tag === "0") ft[1] += 1;
          else if (/^r[1-5]$/.test(tag || "")) {
            const m = c.modules.find((x) => x.id === l.moduleId);
            if (m) { m.ratingSum += Number(tag.slice(1)); m.ratings += 1; }
          }
        });
        if (done[l.id]) {
          n += 1;
          l.done += 1;
          last = Math.max(last, millis(done[l.id]));
          if (l.moduleId) perModule[l.moduleId] = (perModule[l.moduleId] || 0) + 1;
        } else {
          if (Array.isArray(acts[l.id]) && acts[l.id].length) { started += 1; l.started += 1; }
        }
      });
      // The lesson they are on: the first one not finished, once they have begun.
      const current = (n || started) ? c.lessons.find((l) => !done[l.id]) : null;
      if (current) at[c.id] = current.id;
      if (n) perCourse[c.id] = n;
      if (started) startedPerCourse[c.id] = started;
      if (ft[1]) firstTry[c.id] = ft;
    });
    return {
      uid: u.id,
      name: u.displayName || u.name || u.email || "",
      email: u.email || "",
      state: u.assignedState || "",
      locality: u.assignedLocality || "",
      role: rolesOf(u)[0] || "user",
      perCourse,
      perModule,
      startedPerCourse,
      firstTry,
      at,
      lastActive: last || null,
    };
  });
  return { scope, courses: courseList, learners };
}

/** Each course: how many people started it, finished it, and their average share done. */
function courseTotals(report, { state = "" } = {}) {
  const people = report.learners.filter((l) => !state || same(l.state, state));
  return report.courses.map((c) => {
    const started = people.filter((l) => l.perCourse[c.id]);
    const completed = started.filter((l) => l.perCourse[c.id] >= c.sections);
    const avg = started.length ? started.reduce((n, l) => n + l.perCourse[c.id] / c.sections, 0) / started.length : 0;
    return {
      course: c.title, sections: c.sections, people: people.length,
      started: started.length, completed: completed.length,
      averagePercentDone: Math.round(avg * 100),
    };
  });
}

/** Per state (or per locality inside one state): started and finished, for one course or any. */
function placeTotals(report, { courseId = "", by = "state" } = {}) {
  const ids = courseId ? [courseId] : report.courses.map((c) => c.id);
  const size = Object.fromEntries(report.courses.map((c) => [c.id, c.sections]));
  const groups = new Map();
  report.learners.forEach((l) => {
    const key = l[by] || "(not set)";
    const g = groups.get(key) || { [by]: key, people: 0, started: 0, completed: 0 };
    g.people += 1;
    if (ids.some((id) => l.perCourse[id])) g.started += 1;
    if (ids.some((id) => l.perCourse[id] >= size[id])) g.completed += 1;
    groups.set(key, g);
  });
  return [...groups.values()].sort((a, b) => b.people - a.people);
}

/**
 * What the data assistant's online_progress tool returns: totals per course
 * and per state, and, when asked, the people (filtered by course, state and
 * status: not_started, started, completed), cut to `budget` characters.
 */
function progressForModel(report, args = {}, budget = 4000) {
  const course = args.course
    ? report.courses.find((c) => same(c.id, args.course) || String(c.title).toLowerCase().includes(String(args.course).toLowerCase()))
    : null;
  const state = String(args.state || "").trim();
  const out = {
    whoYouCanSee: report.scope.level === "all" ? "everyone" : `${report.scope.level} ${report.scope.locality || report.scope.state}`,
    courses: courseTotals(report, { state }),
    byState: placeTotals(report, { courseId: course?.id }).slice(0, 25),
  };
  if (state) out.byLocality = placeTotals({ ...report, learners: report.learners.filter((l) => same(l.state, state)) }, { courseId: course?.id, by: "locality" }).slice(0, 40);
  if (args.people) {
    const ids = course ? [course.id] : report.courses.map((c) => c.id);
    const size = Object.fromEntries(report.courses.map((c) => [c.id, c.sections]));
    const status = (l) => (ids.some((id) => l.perCourse[id] >= size[id]) ? "completed" : ids.some((id) => l.perCourse[id]) ? "started" : "not_started");
    const people = report.learners
      .filter((l) => (!state || same(l.state, state)) && (!args.status || status(l) === args.status))
      .map((l) => ({
        name: l.name, state: l.state, locality: l.locality, role: l.role, status: status(l),
        sectionsDone: Object.fromEntries(ids.filter((id) => l.perCourse[id]).map((id) => [report.courses.find((c) => c.id === id).title, `${l.perCourse[id]}/${size[id]}`])),
        lastActive: l.lastActive ? new Date(l.lastActive).toISOString().slice(0, 10) : null,
      }));
    const kept = [];
    let used = JSON.stringify(out).length;
    for (const p of people) {
      used += JSON.stringify(p).length + 1;
      if (used > budget) break;
      kept.push(p);
    }
    out.people = kept;
    if (kept.length < people.length) out.peopleNotShown = people.length - kept.length;
  }
  return out;
}

module.exports = { MANAGER_ROLES, rolesOf, scopeOf, buildReport, courseTotals, placeTotals, progressForModel };
