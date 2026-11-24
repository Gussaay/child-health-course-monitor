// GENERATED from src/dashboards/ by scripts/build-dashboards-bundle.mjs. Do not edit.
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/dashboards/index.js
var index_exports = {};
__export(index_exports, {
  facilityHistory: () => facilityHistory_exports,
  facilityUpdate: () => facilityUpdate_exports
});
module.exports = __toCommonJS(index_exports);

// src/dashboards/facilityHistory.js
var facilityHistory_exports = {};
__export(facilityHistory_exports, {
  HISTORY_FIELDS: () => HISTORY_FIELDS,
  HISTORY_SERVICES: () => HISTORY_SERVICES,
  facilitiesAt: () => facilitiesAt,
  historyCounts: () => historyCounts,
  historyMetrics: () => historyMetrics,
  timeOf: () => timeOf
});
var normalizeStr = (str) => typeof str === "string" ? str.trim() : str;
var HISTORY_SERVICES = {
  imnci: {
    inScope: (f) => ["\u0648\u062D\u062F\u0629 \u0635\u062D\u0629 \u0627\u0644\u0627\u0633\u0631\u0629", "\u0645\u0631\u0643\u0632 \u0635\u062D\u0629 \u0627\u0644\u0627\u0633\u0631\u0629"].includes(normalizeStr(f["\u0646\u0648\u0639_\u0627\u0644\u0645\u0624\u0633\u0633\u0629\u0627\u0644\u0635\u062D\u064A\u0629"])) && f["\u0647\u0644_\u0627\u0644\u0645\u0624\u0633\u0633\u0629_\u062A\u0639\u0645\u0644"] === "Yes",
    provides: (f) => f["\u0648\u062C\u0648\u062F_\u0627\u0644\u0639\u0644\u0627\u062C_\u0627\u0644\u0645\u062A\u0643\u0627\u0645\u0644_\u0644\u0627\u0645\u0631\u0627\u0636_\u0627\u0644\u0637\u0641\u0648\u0644\u0629"] === "Yes",
    tools: [
      { key: "\u0648\u062C\u0648\u062F_\u0633\u062C\u0644_\u0639\u0644\u0627\u062C_\u0645\u062A\u0643\u0627\u0645\u0644", label: "IMNCI Register" },
      { key: "\u0648\u062C\u0648\u062F_\u0643\u062A\u064A\u0628_\u0644\u0648\u062D\u0627\u062A", label: "Chart Booklet" },
      { key: "\u0645\u064A\u0632\u0627\u0646_\u0648\u0632\u0646", label: "Weight Scale" },
      { key: "\u0633\u0627\u0639\u0629_\u0645\u0624\u0642\u062A", label: "Timer" }
    ]
  },
  eenc: {
    inScope: (f) => ["BEmONC", "CEmONC"].includes(normalizeStr(f.eenc_service_type)) && f["\u0647\u0644_\u0627\u0644\u0645\u0624\u0633\u0633\u0629_\u062A\u0639\u0645\u0644"] === "Yes",
    provides: (f) => f.eenc_provides_essential_care === "Yes",
    tools: [
      { key: "eenc_steam_sterilizer", label: "Steam Sterilizer" },
      { key: "eenc_wall_clock", label: "Wall Clock" }
    ]
  },
  neonatal: {
    inScope: (f) => ["CEmONC", "pediatric"].includes(normalizeStr(f.eenc_service_type)) || f.neonatal_level_secondary === "Yes" || f.neonatal_level_tertiary === "Yes" || f.neonatal_level_of_care?.secondary || f.neonatal_level_of_care?.tertiary,
    provides: (f) => f.neonatal_level_secondary === "Yes" || f.neonatal_level_of_care?.secondary === true || f.neonatal_level_tertiary === "Yes" || f.neonatal_level_of_care?.tertiary === true,
    tools: [
      { key: "neonatal_kmc_unit", label: "KMC Unit" },
      { key: "neonatal_breastfeeding_unit", label: "Breastfeeding Unit" }
    ]
  },
  critical: {
    inScope: (f) => ["\u0645\u0633\u062A\u0634\u0641\u0649", "\u0645\u0633\u062A\u0634\u0641\u0649 \u0631\u064A\u0641\u064A"].includes(normalizeStr(f["\u0646\u0648\u0639_\u0627\u0644\u0645\u0624\u0633\u0633\u0629\u0627\u0644\u0635\u062D\u064A\u0629"])) || normalizeStr(f.eenc_service_type) === "pediatric",
    provides: (f) => f.etat_has_service === "Yes",
    tools: [
      { key: "hdu_has_service", label: "HDU Service" },
      { key: "picu_has_service", label: "PICU Service" }
    ]
  }
};
var HISTORY_FIELDS = Array.from(/* @__PURE__ */ new Set([
  "facilityId",
  "effectiveDate",
  "\u0627\u0644\u0648\u0644\u0627\u064A\u0629",
  "\u0627\u0644\u0645\u062D\u0644\u064A\u0629",
  "\u0646\u0648\u0639_\u0627\u0644\u0645\u0624\u0633\u0633\u0629\u0627\u0644\u0635\u062D\u064A\u0629",
  "\u0647\u0644_\u0627\u0644\u0645\u0624\u0633\u0633\u0629_\u062A\u0639\u0645\u0644",
  "\u0648\u062C\u0648\u062F_\u0627\u0644\u0639\u0644\u0627\u062C_\u0627\u0644\u0645\u062A\u0643\u0627\u0645\u0644_\u0644\u0627\u0645\u0631\u0627\u0636_\u0627\u0644\u0637\u0641\u0648\u0644\u0629",
  "eenc_service_type",
  "eenc_provides_essential_care",
  "neonatal_level_primary",
  "neonatal_level_secondary",
  "neonatal_level_tertiary",
  "neonatal_level_of_care",
  "etat_has_service",
  "hdu_has_service",
  "picu_has_service",
  ...Object.values(HISTORY_SERVICES).flatMap((s) => s.tools.map((t) => t.key))
]));
var NO_SERVICES = {
  "\u0648\u062C\u0648\u062F_\u0627\u0644\u0639\u0644\u0627\u062C_\u0627\u0644\u0645\u062A\u0643\u0627\u0645\u0644_\u0644\u0627\u0645\u0631\u0627\u0636_\u0627\u0644\u0637\u0641\u0648\u0644\u0629": "No",
  "eenc_provides_essential_care": "No",
  "etat_has_service": "No",
  "hdu_has_service": "No",
  "picu_has_service": "No",
  "neonatal_level_primary": "No",
  "neonatal_level_secondary": "No",
  "neonatal_level_tertiary": "No"
};
function timeOf(v) {
  if (!v) return 0;
  if (typeof v.toDate === "function") return v.toDate().getTime();
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v === "number") return v;
  if (typeof v === "object" && typeof v.seconds === "number") return v.seconds * 1e3;
  if (typeof v === "object" && typeof v._seconds === "number") return v._seconds * 1e3;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}
function facilitiesAt(snapshots, facilities, states, targetMs) {
  const stateSet = new Set(states);
  const latest = /* @__PURE__ */ new Map();
  (snapshots || []).forEach((snap) => {
    if (!stateSet.has(snap["\u0627\u0644\u0648\u0644\u0627\u064A\u0629"])) return;
    const t = timeOf(snap.effectiveDate);
    if (t > targetMs) return;
    const prev = latest.get(snap.facilityId);
    if (!prev || t > prev._time) latest.set(snap.facilityId, { ...snap, _time: t });
  });
  const out = [];
  const entries = facilities instanceof Map ? facilities.entries() : facilities;
  for (const [facilityId, current] of entries) {
    out.push(latest.has(facilityId) ? latest.get(facilityId) : { ...current, facilityId, ...NO_SERVICES });
  }
  return out;
}
var emptyServiceCount = (service) => ({ base: 0, providers: 0, tools: Object.fromEntries(service.tools.map((t) => [t.key, 0])) });
function historyCounts(facilities) {
  const out = {};
  (facilities || []).forEach((f) => {
    const st = f["\u0627\u0644\u0648\u0644\u0627\u064A\u0629"] || "";
    const loc = f["\u0627\u0644\u0645\u062D\u0644\u064A\u0629"] || "";
    Object.entries(HISTORY_SERVICES).forEach(([key, service]) => {
      if (!service.inScope(f)) return;
      if (!out[st]) out[st] = {};
      if (!out[st][loc]) out[st][loc] = {};
      if (!out[st][loc][key]) out[st][loc][key] = emptyServiceCount(service);
      const c = out[st][loc][key];
      c.base += 1;
      if (service.provides(f)) {
        c.providers += 1;
        service.tools.forEach((tool) => {
          if (f[tool.key] === "Yes") c.tools[tool.key] += 1;
        });
      }
    });
  });
  return out;
}
function historyMetrics(counts, { states = null, locality = "" } = {}) {
  const out = {};
  Object.entries(HISTORY_SERVICES).forEach(([key, service]) => {
    const sum = emptyServiceCount(service);
    Object.entries(counts || {}).forEach(([st, byLoc]) => {
      if (states && !states.includes(st)) return;
      Object.entries(byLoc).forEach(([loc, byService]) => {
        if (locality && loc !== locality) return;
        const c = byService[key];
        if (!c) return;
        sum.base += c.base;
        sum.providers += c.providers;
        service.tools.forEach((tool) => {
          sum.tools[tool.key] += c.tools[tool.key] || 0;
        });
      });
    });
    if (sum.base === 0) {
      out[key] = { total: { num: 0, perc: 0, base: 0 }, tools: Object.fromEntries(service.tools.map((t) => [t.key, { num: 0, perc: 0 }])) };
      return;
    }
    out[key] = {
      total: { num: sum.providers, perc: Math.round(sum.providers / sum.base * 100), base: sum.base },
      tools: Object.fromEntries(service.tools.map((t) => [t.key, { num: sum.tools[t.key], perc: Math.round(sum.tools[t.key] / Math.max(sum.providers, 1) * 100) }]))
    };
  });
  return out;
}

// src/dashboards/facilityUpdate.js
var facilityUpdate_exports = {};
__export(facilityUpdate_exports, {
  UPDATE_SERVICES: () => UPDATE_SERVICES,
  updateCounts: () => updateCounts,
  updateDashboardData: () => updateDashboardData,
  updateRecord: () => updateRecord,
  yearMonthOf: () => yearMonthOf
});
var getValidDate = (val) => {
  if (!val) return null;
  if (val.toDate && typeof val.toDate === "function") return val.toDate();
  if (typeof val === "object" && val !== null) {
    if ("seconds" in val) return new Date(val.seconds * 1e3);
    if ("_seconds" in val) return new Date(val._seconds * 1e3);
  }
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
};
var getUpdateDate = (f) => getValidDate(f.lastSnapshotAt) || getValidDate(f["\u0627\u062E\u0631 \u062A\u062D\u062F\u064A\u062B"]) || getValidDate(f.updatedAt);
var getCreationDate = (f) => getValidDate(f.createdAt) || getValidDate(f.created_at);
var isUpdatedAfterCreation = (f) => {
  if (f.revision && f.revision > 1) return true;
  if (Array.isArray(f.history) && f.history.length > 0) return true;
  if (typeof f.updated_by === "string" && f.updated_by.toLowerCase().includes("cleaned by")) return true;
  const uDate = getUpdateDate(f);
  const cDate = getCreationDate(f);
  const updatedMs = uDate ? uDate.getTime() : 0;
  const createdMs = cDate ? cDate.getTime() : 0;
  if (createdMs > 0 && updatedMs > 0) return updatedMs - createdMs > 1e4;
  if (createdMs === 0 && updatedMs > 0) return true;
  return false;
};
var UPDATE_SERVICES = ["IMNCI", "EENC", "Neonatal", "ETAT"];
var hasServiceData = (f, service) => {
  switch (service) {
    case "IMNCI":
      return f["\u0648\u062C\u0648\u062F_\u0627\u0644\u0639\u0644\u0627\u062C_\u0627\u0644\u0645\u062A\u0643\u0627\u0645\u0644_\u0644\u0627\u0645\u0631\u0627\u0636_\u0627\u0644\u0637\u0641\u0648\u0644\u0629"] != null && f["\u0648\u062C\u0648\u062F_\u0627\u0644\u0639\u0644\u0627\u062C_\u0627\u0644\u0645\u062A\u0643\u0627\u0645\u0644_\u0644\u0627\u0645\u0631\u0627\u0636_\u0627\u0644\u0637\u0641\u0648\u0644\u0629"] !== "";
    case "EENC":
      return f.eenc_provides_essential_care != null && f.eenc_provides_essential_care !== "";
    case "Neonatal":
      return f.neonatal_level_of_care && Object.keys(f.neonatal_level_of_care).length > 0 || f.neonatal_level_primary != null || f.neonatal_level_secondary != null || f.neonatal_level_tertiary != null;
    case "ETAT":
      return f.etat_has_service != null && f.etat_has_service !== "";
    default:
      return false;
  }
};
function updateRecord(f) {
  const updated = getUpdateDate(f);
  return {
    state: f["\u0627\u0644\u0648\u0644\u0627\u064A\u0629"],
    locality: f["\u0627\u0644\u0645\u062D\u0644\u064A\u0629"],
    updatedMs: updated ? updated.getTime() : null,
    isUpdate: isUpdatedAfterCreation(f),
    updatedBy: typeof f.updated_by === "string" ? f.updated_by : f.updated_by || null,
    services: UPDATE_SERVICES.filter((s) => hasServiceData(f, s))
  };
}
var buildEmailToNameMap = (records) => {
  const map = {};
  records.forEach((r) => {
    const raw = r.updatedBy;
    if (!raw || typeof raw !== "string") return;
    const cleaned = raw.replace(/^Cleaned by\s+/i, "").trim();
    const match = cleaned.match(/^(.*?)\s*\((.*?@.*?)\)$/);
    if (match) {
      const name = match[1].trim();
      const email = match[2].trim().toLowerCase();
      if (name && email) map[email] = name;
    }
  });
  return map;
};
var normalizeUpdater = (raw, emailMap) => {
  if (!raw) return "System / Unknown";
  const s = String(raw).replace(/^Cleaned by\s+/i, "").trim();
  const lower = s.toLowerCase();
  if (lower === "system" || lower === "unknown uploader" || lower === "unknown / system" || lower === "unknown") return "System / Unknown";
  const match = s.match(/^(.*?)\s*\((.*?@.*?)\)$/);
  if (match) return match[1].trim();
  if (s.includes("@")) {
    const email = s.trim().toLowerCase();
    if (emailMap[email]) return emailMap[email];
    return email.split("@")[0];
  }
  return s;
};
function yearMonthOf(ms, timeZone) {
  if (!timeZone) {
    const d = new Date(ms);
    return { year: d.getFullYear(), month: d.getMonth() };
  }
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric" }).formatToParts(new Date(ms));
  const get = (t) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month") - 1 };
}
function updateCounts(records, { timeZone } = {}) {
  const emailMap = buildEmailToNameMap(records);
  const cells = [];
  const index = /* @__PURE__ */ new Map();
  records.forEach((r) => {
    if (!r.isUpdate || r.updatedMs == null) return;
    const { year, month } = yearMonthOf(r.updatedMs, timeZone);
    const updater = normalizeUpdater(r.updatedBy, emailMap);
    const key = `${year}|${month}|${r.state}|${r.locality}|${updater}`;
    let c = index.get(key);
    if (!c) {
      c = { year, month, state: r.state, locality: r.locality, updater, total: 0, IMNCI: 0, EENC: 0, Neonatal: 0, ETAT: 0 };
      index.set(key, c);
      cells.push(c);
    }
    c.total += 1;
    r.services.forEach((s) => {
      c[s] += 1;
    });
  });
  return cells;
}
function updateDashboardData(cells, { stateFilter = "", localityFilter = "", timeFilter = "THIS_MONTH", now }) {
  if (!cells) return null;
  const { year: currentYear, month: currentMonth } = now;
  const inPeriod = (c) => {
    if (timeFilter === "THIS_MONTH") return c.month === currentMonth && c.year === currentYear;
    if (timeFilter === "LAST_MONTH") {
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return c.month === lastMonth && c.year === lastMonthYear;
    }
    if (timeFilter === "THIS_YEAR") return c.year === currentYear;
    if (timeFilter === "LAST_YEAR") return c.year === currentYear - 1;
    return true;
  };
  let updatedThisMonth = 0;
  const stateStats = {};
  const localityStats = {};
  const updaterStats = {};
  cells.forEach((c) => {
    if (stateFilter && c.state !== stateFilter) return;
    if (localityFilter && c.locality !== localityFilter) return;
    if (!inPeriod(c)) return;
    if (c.month === currentMonth && c.year === currentYear) updatedThisMonth += c.total;
    const stateKey = c.state || "Unknown";
    if (!stateStats[stateKey]) stateStats[stateKey] = { total: 0, IMNCI: 0, EENC: 0, Neonatal: 0, ETAT: 0 };
    const locKey = c.locality || "Unknown";
    if (!localityStats[locKey]) localityStats[locKey] = { total: 0 };
    if (!updaterStats[c.updater]) updaterStats[c.updater] = { total: 0, IMNCI: 0, EENC: 0, Neonatal: 0, ETAT: 0 };
    stateStats[stateKey].total += c.total;
    localityStats[locKey].total += c.total;
    updaterStats[c.updater].total += c.total;
    UPDATE_SERVICES.forEach((s) => {
      stateStats[stateKey][s] += c[s];
      updaterStats[c.updater][s] += c[s];
    });
  });
  const top = (o) => Object.entries(o).sort((a, b) => b[1].total - a[1].total)[0];
  return { updatedThisMonth, stateStats, updaterStats, topState: top(stateStats), topLocality: top(localityStats), topUpdater: top(updaterStats) };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  facilityHistory,
  facilityUpdate
});
