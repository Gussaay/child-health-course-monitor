// functions/dashboardKpisCore.js
//
// Server-calculated dashboard numbers (docs/server-dashboard-kpis.md). The
// server keeps slim copies of the collections a dashboard summarises (only
// changed records are read: the delta pattern of facilityDashboardCopyCore.js)
// and answers with the dashboard's numbers, worked out by the SAME code the
// pages use (functions/generated/dashboards.cjs, built from src/dashboards/).
//
// Logic only; the callable is dashboardKpis.js.

const { makeCore, slimFacility, toMillis } = require("./facilityDashboardCopyCore");
const dashboards = require("./generated/dashboards.cjs");

// The saved facility copy of facilityDashboardCopy.js (shared, same format).
const FACILITY_STORE_ID = "facilities";
const MAX_DATES = 24;
const MAX_STATES = 40;

/** A facility snapshot reduced to what the history dashboard reads. */
function slimHistorySnapshot(id, data) {
  const d = data || {};
  const out = { id };
  dashboards.facilityHistory.HISTORY_FIELDS.forEach((k) => {
    if (d[k] === undefined) return;
    const v = d[k];
    out[k] = v && typeof v === "object" && (typeof v.toMillis === "function" || typeof v._seconds === "number") ? toMillis(v) : v;
  });
  out.snapshotCreatedAt = toMillis(d.snapshotCreatedAt) || 0;
  return out;
}

/** A facility reduced to what the update dashboard reads (updateRecord). */
function slimUpdateFacility(id, data) {
  const d = data || {};
  return {
    id,
    isDeleted: d.isDeleted,
    lastSnapshotAt: toMillis(d.lastSnapshotAt) || 0,
    ...dashboards.facilityUpdate.updateRecord(d),
  };
}

function makeDashboardKpis({ db, Timestamp, now = () => Date.now(), log = () => {}, tally = () => {} }) {
  const shared = { db, Timestamp, now, log, tally, minRefreshMs: 5 * 60 * 1000, countEveryMs: 30 * 60 * 1000, persistEveryMs: 30 * 60 * 1000 };
  const facilities = makeCore({ ...shared, collection: "healthFacilities", slim: slimFacility, markField: "lastSnapshotAt", storeId: FACILITY_STORE_ID });
  const snapshots = makeCore({ ...shared, collection: "facilitySnapshots", slim: slimHistorySnapshot, markField: "snapshotCreatedAt", storeId: "kpi_facility_snapshots" });

  const updateFacilities = makeCore({ ...shared, collection: "healthFacilities", slim: slimUpdateFacility, markField: "lastSnapshotAt", storeId: "kpi_update_facilities" });

  // Results are kept per (question, data versions): past dates are worked out
  // once and reused until a change reaches them.
  const memo = new Map();
  const remember = (key, fn) => {
    if (memo.has(key)) return memo.get(key);
    const value = fn();
    if (memo.size > 500) memo.clear();
    memo.set(key, value);
    return value;
  };

  /** Facility history: counts per state and locality at each date asked. */
  async function facilityHistory({ states = [], dates = [] } = {}) {
    const stateList = (Array.isArray(states) ? states : []).filter((s) => typeof s === "string").slice(0, MAX_STATES);
    const dateList = (Array.isArray(dates) ? dates : []).map((d) => new Date(d)).filter((d) => !Number.isNaN(d.getTime())).slice(0, MAX_DATES);
    await Promise.all([facilities.refresh(), snapshots.refresh()]);
    const fst = facilities._state();
    const sst = snapshots._state();
    const versions = { facilities: fst.version, snapshots: sst.version };
    const stateSet = new Set(stateList);
    const current = remember(`hist-fac|${fst.version}|${stateList.join(",")}`, () =>
      Array.from(fst.items.values()).filter((f) => stateSet.has(f["الولاية"])).map((f) => [f.id, f]));
    const snaps = Array.from(sst.items.values());
    const results = dateList.map((d) => {
      const ms = d.getTime();
      const counts = remember(`hist|${versions.facilities}|${versions.snapshots}|${stateList.join(",")}|${ms}`, () =>
        dashboards.facilityHistory.historyCounts(dashboards.facilityHistory.facilitiesAt(snaps, current, stateList, ms)));
      return { date: d.toISOString(), counts };
    });
    return { dashboard: "facilityHistory", versions, asOf: now(), results };
  }

  /**
   * Facility update: counts per (month, state, locality, person) for the
   * viewer's scope ({ level: 'state'|'locality'|other, states, localities },
   * as ChildHealthServicesView narrows its list), months in `timeZone`.
   */
  async function facilityUpdate({ scope = {}, timeZone = "Africa/Khartoum" } = {}) {
    await updateFacilities.refresh();
    const st = updateFacilities._state();
    const level = scope && scope.level;
    const states = new Set(Array.isArray(scope && scope.states) ? scope.states : []);
    const localities = new Set(Array.isArray(scope && scope.localities) ? scope.localities : []);
    const tz = typeof timeZone === "string" && timeZone.length < 64 ? timeZone : "Africa/Khartoum";
    const cells = remember(`upd|${st.version}|${level}|${[...states].join(",")}|${[...localities].join(",")}|${tz}`, () => {
      const records = Array.from(st.items.values()).filter((r) => {
        if (r.isDeleted === true || r.isDeleted === "true") return false;
        if (level === "locality") return localities.size > 0 && localities.has(r.locality);
        if (level === "state") return states.size > 0 && states.has(r.state);
        return true;
      });
      return dashboards.facilityUpdate.updateCounts(records, { timeZone: tz });
    });
    return { dashboard: "facilityUpdate", versions: { facilities: st.version }, asOf: now(), timeZone: tz, cells };
  }

  const handlers = { facilityHistory, facilityUpdate };

  async function answer(request = {}) {
    const fn = handlers[request.dashboard];
    if (!fn) return { error: "unknown dashboard" };
    return fn(request);
  }

  return { answer, handlers };
}

module.exports = { makeDashboardKpis, slimHistorySnapshot, slimUpdateFacility };
