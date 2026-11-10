// functions/facilityDashboardCopyCore.js
//
// The "Dashboard copy" of the health facilities: every facility, without the
// fields no dashboard reads (staff lists, signatures, photos, notes, history).
// The Dashboard downloads this one answer instead of ~7,000 full facility
// documents through the Firestore SDK, and then runs exactly the same
// calculations on it as before, so its numbers do not change.
//
// Kept current cheaply:
//   - On each request, only facilities whose lastSnapshotAt moved since the
//     copy's mark are read (every facility save sets lastSnapshotAt).
//   - A count() of the collection (1 read per 1,000 facilities) catches hard
//     deletes, which leave nothing for the delta query to find: if the count
//     differs from the copy, the copy is rebuilt in full.
//   - A full rebuild also happens once a day, whatever happens.
// The copy is kept in this instance's memory and saved to Firestore
// (_dashboardCopies, admin-only) so a cold start does not re-read everything.
//
// Logic only; the callable wrapper is facilityDashboardCopy.js.

const FULL_REBUILD_MS = 24 * 60 * 60 * 1000;
// A save's server timestamp can land a little before an earlier-started
// query sees it; re-asking for a 10 minute overlap costs nothing extra.
const DELTA_OVERLAP_MS = 10 * 60 * 1000;
// Firestore documents are limited to 1 MiB. Arabic text is 2 bytes a
// character in UTF-8, so 350k characters is at most ~700 KB.
const PART_CHARS = 350000;
// Above this the answer is not sent and the app reads the full list instead.
const MAX_ANSWER_CHARS = 9 * 1024 * 1024;

const STORE = "_dashboardCopies";
const DOC_ID = "facilities";

// Fields no dashboard reads, by name. tests/facilityDashboardCopy.test.js
// checks every field the dashboards and the main-menu coverage name, so a
// field that starts being used there cannot be dropped here unnoticed.
const DROP_KEY = /staff|signature|^photos?_|_photos?$|_images?$|^images?$|^history$|_history$|comment|_notes?$/i;

function toMillis(v) {
  if (!v) return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v._seconds === "number") return v._seconds * 1000 + Math.round((v._nanoseconds || 0) / 1e6);
  if (typeof v.seconds === "number" && typeof v.nanoseconds === "number") return v.seconds * 1000 + Math.round(v.nanoseconds / 1e6);
  return v;
}

/** The dashboard's copy of one facility document. */
function slimFacility(id, data) {
  const out = { id };
  Object.keys(data || {}).forEach((k) => {
    if (DROP_KEY.test(k)) return;
    const v = data[k];
    // Server timestamps become plain milliseconds: a Timestamp does not
    // survive the trip to the app, and no dashboard reads a date.
    out[k] = v && typeof v === "object" && (typeof v.toMillis === "function" || typeof v._seconds === "number") ? toMillis(v) : v;
  });
  return out;
}

const newestMark = (items) => items.reduce((m, f) => {
  const t = Number(f && f.lastSnapshotAt);
  return Number.isFinite(t) && t > m ? t : m;
}, 0);

function makeCore({ db, Timestamp, now = () => Date.now(), log = () => {} }) {
  let state = null; // { items: Map, mark, fullAt, version }
  let busy = null;

  const col = () => db.collection("healthFacilities");
  const store = () => db.collection(STORE).doc(DOC_ID);
  const versionOf = (s) => `${s.fullAt}-${s.mark}-${s.items.size}-${s.changes || 0}`;

  async function restore() {
    try {
      const meta = await store().get();
      if (!meta.exists) return null;
      const m = meta.data() || {};
      if (!(m.parts > 0)) return null;
      const parts = await Promise.all(Array.from({ length: m.parts }, (_, i) => store().collection("parts").doc(String(i)).get()));
      if (parts.some((p) => !p.exists)) return null;
      const items = JSON.parse(parts.map((p) => p.data().text || "").join(""));
      if (!Array.isArray(items)) return null;
      return { items: new Map(items.map((f) => [f.id, f])), mark: m.mark || 0, fullAt: m.fullAt || 0, changes: m.changes || 0 };
    } catch (e) {
      log("restore failed", e && e.message);
      return null;
    }
  }

  async function persist(s) {
    try {
      const text = JSON.stringify(Array.from(s.items.values()));
      const parts = [];
      for (let i = 0; i < text.length; i += PART_CHARS) parts.push(text.slice(i, i + PART_CHARS));
      const old = await store().get();
      const oldParts = old.exists ? (old.data().parts || 0) : 0;
      const batch = db.batch();
      parts.forEach((p, i) => batch.set(store().collection("parts").doc(String(i)), { text: p }));
      for (let i = parts.length; i < oldParts; i += 1) batch.delete(store().collection("parts").doc(String(i)));
      batch.set(store(), { parts: parts.length, mark: s.mark, fullAt: s.fullAt, changes: s.changes || 0, count: s.items.size, savedAt: now() });
      await batch.commit();
    } catch (e) {
      // Not fatal: the copy in memory is still right; the next cold start rebuilds.
      log("persist failed", e && e.message);
    }
  }

  async function rebuild() {
    const snap = await col().get();
    const items = new Map();
    snap.docs.forEach((d) => items.set(d.id, slimFacility(d.id, d.data())));
    const s = { items, mark: newestMark(Array.from(items.values())), fullAt: now(), changes: 0 };
    log("full rebuild", items.size);
    return s;
  }

  async function refresh() {
    let dirty = false;
    if (!state) {
      state = await restore();
      if (state) log("restored", state.items.size);
    }
    if (!state || now() - state.fullAt > FULL_REBUILD_MS) {
      state = await rebuild();
      dirty = true;
    } else {
      const since = Math.max(0, state.mark - DELTA_OVERLAP_MS);
      const delta = await col().where("lastSnapshotAt", ">", Timestamp.fromMillis(since)).get();
      let changed = 0;
      delta.docs.forEach((d) => {
        const next = slimFacility(d.id, d.data());
        const prev = state.items.get(d.id);
        if (!prev || JSON.stringify(prev) !== JSON.stringify(next)) changed += 1;
        state.items.set(d.id, next);
      });
      if (changed) {
        state.mark = Math.max(state.mark, newestMark(delta.docs.map((d) => state.items.get(d.id))));
        state.changes = (state.changes || 0) + changed;
        dirty = true;
      }
      // Hard deletes leave nothing for the delta to find.
      const counted = await col().count().get();
      if (counted.data().count !== state.items.size) {
        log("count differs, rebuilding", counted.data().count, state.items.size);
        state = await rebuild();
        dirty = true;
      }
    }
    state.version = versionOf(state);
    if (dirty) await persist(state);
    return state;
  }

  /**
   * The answer for one request. `knownVersion` is the version the app already
   * holds; when it is still current only { unchanged: true } is sent.
   */
  async function answer(knownVersion) {
    if (!busy) busy = refresh().finally(() => { busy = null; });
    const s = await busy;
    if (knownVersion && knownVersion === s.version) return { unchanged: true, version: s.version };
    const items = Array.from(s.items.values());
    const size = JSON.stringify(items).length;
    if (size > MAX_ANSWER_CHARS) {
      log("copy too large to send", size);
      return { tooLarge: true, version: s.version };
    }
    return { version: s.version, builtAt: now(), count: items.length, items };
  }

  return { answer, _state: () => state };
}

module.exports = { makeCore, slimFacility, DROP_KEY, FULL_REBUILD_MS };
