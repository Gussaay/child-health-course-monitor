// functions/aiReference.js
//
// The read_reference tool of the data assistant: the published figures behind
// the dashboard's Morbidity & Mortality tab (UN IGME estimates, Sudan MICS
// 2014, Sudan S3M II 2018). They are not in the database; referenceData.json
// is built from the app's own copy by scripts/build-reference-data.mjs.

const DATA = require("./referenceData.json");

const SURVEYS = ["igme", "mics", "s3m"];
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "");

// The same measure under each survey's name: MICS counts pneumonia as ARI
// symptoms, which S3M calls ARI.
const SAME = {
  pneumonia: "ari", ari: "pneumonia",
  pneumonia_care: "hf_ari", hf_ari: "pneumonia_care",
  diarrhoea_care: "hf_diarrhoea", hf_diarrhoea: "diarrhoea_care",
};

/** The indicators asked for, by id or by a word of their label; all when none match. */
function pick(indicators, asked) {
  const all = indicators.map((ind, i) => ({ ...ind, i }));
  const wanted = (Array.isArray(asked) ? asked : asked ? [asked] : []).map(norm).filter(Boolean);
  if (!wanted.length) return { inds: all, missing: [] };
  const missing = [];
  // An exact id wins, then the other survey's name for it, then every
  // indicator whose label holds the word.
  const found = new Set(wanted.flatMap((w) => {
    for (const id of [w, SAME[w]]) {
      const byId = all.filter((ind) => norm(ind.id) === id);
      if (byId.length) return byId;
    }
    const byLabel = all.filter((ind) => norm(ind.label).includes(w));
    if (!byLabel.length) missing.push(w);
    return byLabel;
  }));
  return found.size ? { inds: all.filter((ind) => found.has(ind)), missing } : { inds: all, missing };
}

/** A state key from any spelling the model gives ("gedaref", "Gedaref State"). */
function stateKey(states, asked) {
  const w = norm(asked).replace(/state$/, "");
  if (!w) return null;
  return Object.keys(states).find((k) => norm(k) === w)
    || Object.keys(states).find((k) => norm(k).includes(w) || w.includes(norm(k))) || null;
}

function readIgme(args) {
  const from = Number(args.fromYear) || 2000;
  const ids = pick(Object.entries(DATA.igme.series).map(([id, s]) => ({ id, label: s.label })), args.indicators).inds.map((s) => s.id);
  const series = Object.fromEntries(ids.map((id) => {
    const { rows, ...rest } = DATA.igme.series[id];
    return [id, { ...rest, rows: rows.filter((r) => r[0] >= from) }];
  }));
  return { source: DATA.igme.source, series };
}

function readSurvey(id, args) {
  const survey = DATA[id];
  const { inds, missing } = pick(survey.indicators, args.indicators);
  const cut = (values) => inds.map((ind) => values?.[ind.i] ?? null);
  const head = {
    source: survey.source,
    indicators: inds.map(({ id: key, label, unit, better }) => ({ id: key, label, unit, better })),
    columns: ["place", ...inds.map((ind) => ind.id)],
    national: cut(survey.national),
    ...(missing.length ? { notInThisSurvey: missing } : {}),
  };
  if (!args.state) {
    return { ...head, level: "states", rows: Object.entries(survey.states).map(([state, s]) => [state, ...cut(s.values)]) };
  }
  const key = stateKey(survey.states, args.state);
  if (!key) return { error: `No state "${args.state}" in ${survey.source}. States: ${Object.keys(survey.states).join(", ")}.` };
  const st = survey.states[key];
  if (!st.localities) return { ...head, level: "state", state: key, stateValues: cut(st.values), note: "This survey reports by state only, not by locality." };
  return { ...head, level: "localities", state: key, stateValues: cut(st.values), rows: st.localities.map(([name, values]) => [name, ...cut(values)]) };
}

/** One read_reference call; null values are not reported by the survey. */
function readReference(args = {}) {
  const survey = String(args.survey || "").toLowerCase();
  if (!SURVEYS.includes(survey)) return { error: `survey must be one of ${SURVEYS.join(", ")}.` };
  return survey === "igme" ? readIgme(args) : readSurvey(survey, args);
}

module.exports = { readReference, SURVEYS };
