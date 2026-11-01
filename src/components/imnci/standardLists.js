// ============================================================================
// STANDARD SIGNS, CLASSIFICATIONS AND TREATMENT LINES
//
// So the same sign or classification is written the same way everywhere,
// Protocol management picks them from a list instead of typing them. The list
// is the national booklet's wording, then anything already saved in the
// protocol, then entries added with "New sign…" / "New classification…",
// which are kept in the classification document itself:
//
//   doc.standardSigns            [{ en, ar }]
//   doc.standardClassifications  [{ en, ar, color }]
//
// Each entry carries its English and Arabic, so choosing it fills both sides.
// ============================================================================
import { BOOKLET_SIGNS, ruleSigns } from './bookletLayout';
import { NATIONAL_PROTOCOLS } from './nationalProtocol';
import { toArabic } from './nationalProtocolAr';

const arOf = (en) => toArabic(en) || en;
const clean = (s) => String(s ?? '').trim();
const DOSE_TAG = /{{dose:(.*?)}}/;

/** Splits a treatment line into its words and the dose it points to. */
export const splitLine = (line) => {
    const text = String(line ?? '');
    const m = text.match(DOSE_TAG);
    return {
        words: m ? text.replace(DOSE_TAG, '').replace(/[\s:—-]+$/, '') : text,
        drugId: m ? m[1].trim() : '',
    };
};

/** A treatment line from its words and dose, written the way the engine reads it. */
export const joinLine = (words, drugId) => {
    const w = String(words ?? '').replace(/[\s:—-]+$/, '');
    if (!drugId) return w;
    return w ? `${w}: {{dose:${drugId}}}` : `{{dose:${drugId}}}`;
};

// Adds an entry under its group unless that English text is already listed.
const collector = () => {
    const groups = [];
    const seen = new Map();
    const add = (group, entry) => {
        const en = clean(entry.en);
        if (!en) return;
        if (seen.has(en)) {
            const known = seen.get(en);
            if (!known.ar && entry.ar) known.ar = entry.ar;
            if (!known.color && entry.color) known.color = entry.color;
            return;
        }
        let g = groups.find((x) => x.label === group);
        if (!g) { g = { label: group, items: [] }; groups.push(g); }
        const item = { ...entry, en };
        g.items.push(item);
        seen.set(en, item);
    };
    return { groups, add, get: (en) => seen.get(clean(en)) };
};

const tables = (part, doc) => [
    ...Object.entries(NATIONAL_PROTOCOLS[part]?.categories || {}),
    ...Object.entries(doc?.categories || {}),
];
const groupName = (cat, key, ar) => (ar ? (cat.titleAr || arOf(cat.title || key)) : (cat.title || key));

/**
 * The sign choices for a part, grouped by the table they belong to.
 * Returns { groups: [{ label, items: [{ en, ar }] }], get(en) }.
 */
export const signOptions = (part, doc, ar = false) => {
    const c = collector();
    tables(part, doc).forEach(([key, cat]) => (cat.rules || []).forEach((rule) => {
        const en = ruleSigns(rule);
        const arLines = Array.isArray(rule.signsAr) && rule.signsAr.length === en.length ? rule.signsAr : [];
        en.forEach((line, i) => c.add(groupName(cat, key, ar), { en: line, ar: clean(arLines[i]) || arOf(line) }));
        (BOOKLET_SIGNS[rule.id] || []).forEach((line) => c.add(groupName(cat, key, ar), { en: line, ar: arOf(line) }));
    }));
    (doc?.standardSigns || []).forEach((e) => c.add(ar ? 'مضافة' : 'Added', e));
    return c;
};

/** The classification choices for a part, grouped by table, each with its colour. */
export const classificationOptions = (part, doc, ar = false) => {
    const c = collector();
    tables(part, doc).forEach(([key, cat]) => (cat.rules || []).forEach((rule) => {
        const cls = rule.classification || {};
        c.add(groupName(cat, key, ar), { en: cls.label, ar: clean(cls.labelAr) || arOf(clean(cls.label)), color: cls.color });
    }));
    (doc?.standardClassifications || []).forEach((e) => c.add(ar ? 'مضافة' : 'Added', e));
    return c;
};

/** Treatment wording already used in the part, without doses, for suggestions. */
export const treatmentSuggestions = (part, doc, ar = false) => {
    const out = new Set();
    tables(part, doc).forEach(([, cat]) => (cat.rules || []).forEach((rule) => {
        const lines = ar
            ? (Array.isArray(rule.treatmentsAr) && rule.treatmentsAr.length ? rule.treatmentsAr : (rule.treatments || []).map(arOf))
            : (rule.treatments || []);
        lines.forEach((l) => { const w = clean(splitLine(l).words); if (w) out.add(w); });
    }));
    return [...out];
};
