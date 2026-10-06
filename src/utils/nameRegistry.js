// nameRegistry.js
//
// One standard spelling for each project and organization.
//
// These names used to be typed freely, so the same project was stored as
// "share", "Share", "SHARE " and the same organization as "unicef", "UNICEF",
// "Unisef" and "يونيسيف". Every dashboard filter and count then split one
// project into several.
//
// The registry is a list of official names, each with the variants known to
// mean it. Everything here is pure (no Firebase) so it can be tested and used
// anywhere a project or organization name is shown or filtered.

export const NAME_KINDS = {
    projects: { label: 'Project', labelAr: 'المشروع' },
    organizations: { label: 'Organization', labelAr: 'المنظمة' },
};

/**
 * The key two spellings share when they are the same name: case, spacing,
 * punctuation and the usual Arabic letter variants are ignored.
 */
export const normalizeKey = (value) => String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')        // harakat, tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// Words that say what kind of thing a name is rather than which one it is,
// so "Share Project" and "SHARE" compare as the same.
const FILLER_WORDS = new Set([
    'project', 'projects', 'programme', 'program', 'the', 'of', 'org', 'organization', 'organisation',
    'مشروع', 'مشاريع', 'برنامج', 'منظمه',
]);

const compactKey = (value) => normalizeKey(value)
    .split(' ')
    .filter((w) => w && !FILLER_WORDS.has(w))
    .join('');

const tokens = (value) => new Set(normalizeKey(value).split(' ').filter((w) => w && !FILLER_WORDS.has(w)));

const levenshtein = (a, b) => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[b.length];
};

/** 0 (unrelated) to 1 (the same name written differently). */
export const nameSimilarity = (a, b) => {
    const ka = compactKey(a);
    const kb = compactKey(b);
    if (!ka || !kb) return 0;
    if (ka === kb) return 1;
    const shorter = ka.length <= kb.length ? ka : kb;
    const longer = ka.length <= kb.length ? kb : ka;
    // "Save the Children" and "Save the Children Sudan"
    if (shorter.length >= 4 && longer.includes(shorter)) return 0.9;
    const edit = 1 - levenshtein(ka, kb) / Math.max(ka.length, kb.length);
    const ta = tokens(a);
    const tb = tokens(b);
    const shared = [...ta].filter((t) => tb.has(t)).length;
    const jaccard = ta.size && tb.size ? shared / (ta.size + tb.size - shared) : 0;
    return Math.max(edit, jaccard);
};

/** At or above this, a new name is checked with the user before it is added. */
export const SIMILAR_THRESHOLD = 0.72;

/**
 * Existing names that look like `input`, best first.
 * @returns {{name: string, score: number}[]}
 */
export const findSimilarNames = (input, names, threshold = SIMILAR_THRESHOLD) => {
    const seen = new Set();
    return (names || [])
        .filter((n) => n && !seen.has(n) && seen.add(n))
        .map((name) => ({ name, score: nameSimilarity(input, name) }))
        .filter((m) => m.score >= threshold)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
};

/** "  SHARE   project " -> "SHARE project": spacing tidied, spelling kept. */
export const tidyName = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

/**
 * Registry entries, merged with extra official names (e.g. the Partners
 * page), without duplicates. Entries: { name, aliases: string[], deleted? }.
 *
 * A deleted name stays in the list, marked, so the same name coming back
 * from the Partners page (or one of its old spellings) is not offered again.
 */
export const mergeRegistryEntries = (entries = [], extraNames = []) => {
    const byKey = new Map();
    const out = [];
    const add = (name, aliases = [], deleted = false) => {
        const clean = tidyName(name);
        if (!clean) return;
        const key = normalizeKey(clean);
        let entry = byKey.get(key);
        if (!entry) {
            entry = { name: clean, aliases: [] };
            out.push(entry);
            byKey.set(key, entry);
        }
        if (deleted) entry.deleted = true;
        aliases.forEach((a) => {
            const alias = tidyName(a);
            const aliasKey = normalizeKey(alias);
            if (!alias || aliasKey === normalizeKey(entry.name)) return;
            if (!entry.aliases.some((x) => normalizeKey(x) === aliasKey)) entry.aliases.push(alias);
            if (!byKey.has(aliasKey)) byKey.set(aliasKey, entry);
        });
    };
    (entries || []).forEach((e) => add(e?.name, e?.aliases || [], e?.deleted === true));
    (extraNames || []).forEach((n) => {
        if (!byKey.has(normalizeKey(n))) add(n);
    });
    return out.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * A function from any recorded spelling to the standard one.
 *
 * Known names and their variants go to the registry name. A spelling the
 * registry does not know yet is still grouped with others that differ only in
 * case, spacing or punctuation, so "share" and "Share " count as one even
 * before anyone has standardized them; the most used spelling represents them.
 *
 * @param {{name: string, aliases?: string[]}[]} entries
 * @param {string[]} observedValues  spellings found in the data (with repeats)
 */
export const buildCanonicalizer = (entries = [], observedValues = []) => {
    const map = new Map();
    (entries || []).forEach((e) => {
        if (!e?.name || e.deleted) return;
        map.set(normalizeKey(e.name), tidyName(e.name));
        (e.aliases || []).forEach((a) => { if (!map.has(normalizeKey(a))) map.set(normalizeKey(a), tidyName(e.name)); });
    });
    const counts = new Map();
    (observedValues || []).forEach((v) => {
        const clean = tidyName(v);
        const key = normalizeKey(clean);
        if (!key || map.has(key)) return;
        if (!counts.has(key)) counts.set(key, new Map());
        const variants = counts.get(key);
        variants.set(clean, (variants.get(clean) || 0) + 1);
    });
    counts.forEach((variants, key) => {
        const best = [...variants.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
        map.set(key, best);
    });
    return (value) => {
        const clean = tidyName(value);
        if (!clean) return '';
        return map.get(normalizeKey(clean)) || clean;
    };
};

/** The distinct standard names among `values`, sorted. */
export const canonicalOptions = (canonicalize, values = [], extra = []) =>
    [...new Set([...extra, ...values].map((v) => canonicalize(v)).filter((v) => v && v !== 'N/A'))]
        .sort((a, b) => a.localeCompare(b));

/**
 * Groups recorded spellings for the standardization tool.
 *
 * Spellings that are the same name (same key, a registry alias, or close
 * enough to be a typo) land in one group, with a suggested standard name:
 * the registry's when there is one, otherwise the most used spelling.
 *
 * @param {{value: string, count: number}[]} values
 * @returns {{suggested: string, fromRegistry: boolean, variants: {value: string, count: number}[]}[]}
 */
export const groupVariants = (values, entries = [], threshold = 0.8) => {
    const canonical = buildCanonicalizer(entries);
    const registryKeys = new Set((entries || []).flatMap((e) => [e.name, ...(e.aliases || [])]).map(normalizeKey));
    const items = (values || []).filter((v) => tidyName(v.value));
    const parent = items.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (a, b) => { parent[find(a)] = find(b); };
    for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
            const a = items[i].value;
            const b = items[j].value;
            const sameRegistry = registryKeys.has(normalizeKey(a)) && registryKeys.has(normalizeKey(b)) && canonical(a) === canonical(b);
            if (sameRegistry || normalizeKey(a) === normalizeKey(b) || nameSimilarity(a, b) >= threshold) union(i, j);
        }
    }
    const groups = new Map();
    items.forEach((item, i) => {
        const root = find(i);
        if (!groups.has(root)) groups.set(root, []);
        groups.get(root).push(item);
    });
    return [...groups.values()].map((variants) => {
        // Most used first; on a tie, the spelling that is capitalised ("Model of
        // Care" over "model of care") makes the better suggestion.
        const capitalised = (v) => (/^\p{Lu}/u.test(tidyName(v.value)) ? 1 : 0);
        variants.sort((a, b) => b.count - a.count || capitalised(b) - capitalised(a) || a.value.localeCompare(b.value));
        const known = variants.find((v) => registryKeys.has(normalizeKey(v.value)));
        return {
            suggested: known ? canonical(known.value) : tidyName(variants[0].value),
            fromRegistry: !!known,
            variants,
        };
    }).sort((a, b) => b.variants.reduce((s, v) => s + v.count, 0) - a.variants.reduce((s, v) => s + v.count, 0));
};

/**
 * The registry after mapping recorded spellings to standard names: each
 * standard name becomes (or stays) an entry, and each spelling that differs
 * from it is kept as an alias so it is recognised wherever it still appears.
 *
 * @param {{from: string, to: string}[]} mappings
 */
export const applyMappingsToRegistry = (entries = [], mappings = []) => {
    const grouped = new Map();
    mappings.forEach(({ from, to }) => {
        const name = tidyName(to);
        if (!name) return;
        if (!grouped.has(name)) grouped.set(name, []);
        if (normalizeKey(from) !== normalizeKey(name)) grouped.get(name).push(from);
    });
    // A name that has been renamed is folded into its new entry.
    const renamed = new Map();
    (entries || []).forEach((e) => {
        // A change of capitals only ("Unicef" -> "UNICEF") is a rename too.
        const target = mappings.find((m) => normalizeKey(m.from) === normalizeKey(e.name) && tidyName(m.to) && tidyName(m.to) !== e.name);
        if (target) renamed.set(e, tidyName(target.to));
    });
    const kept = (entries || []).filter((e) => !renamed.has(e));
    const moved = [...renamed.entries()].map(([e, to]) => ({ name: to, aliases: [e.name, ...(e.aliases || [])] }));
    const added = [...grouped.entries()].map(([name, aliases]) => ({ name, aliases }));
    return mergeRegistryEntries([...kept, ...moved, ...added]);
};

/** The names in use (not deleted). */
export const activeEntries = (entries = []) => (entries || []).filter((e) => e && !e.deleted);

/** Every key (name and spellings) of a set of entries. */
const keysOf = (entries) => new Set((entries || []).flatMap((e) => [e.name, ...(e.aliases || [])]).map(normalizeKey));

/**
 * Turns the choices made in the standardization tool into the new name list
 * and the facility changes. Nothing is mapped unless a choice says so.
 *
 * @param {object} args
 * @param {{name: string, aliases?: string[], deleted?: boolean}[]} args.entries  the current list
 * @param {string[]} args.values  every spelling recorded on facilities
 * @param {Record<string, {type: 'keep'|'rename'|'merge'|'delete', to?: string}>} [args.officialActions]
 *        per official name: rename it, merge it into another official name, or delete it
 * @param {Record<string, string[]>} [args.removedAliases]  per official name, spellings to detach
 * @param {Record<string, {type: 'leave'|'map'|'official'|'clear', to?: string}>} [args.spellingActions]
 *        per recorded spelling not yet in the list: map it to an official name, make
 *        it (or a corrected form of it) official, or clear it from the facilities
 * @returns {{entries: object[], rewrites: {from: string, to: string}[]}}
 */
export const planStandardization = ({ entries = [], values = [], officialActions = {}, removedAliases = {}, spellingActions = {} }) => {
    let list = mergeRegistryEntries(entries).map((e) => ({ ...e, aliases: [...(e.aliases || [])] }));
    const findActive = (name) => list.find((e) => !e.deleted && (normalizeKey(e.name) === normalizeKey(name)
        || e.aliases.some((a) => normalizeKey(a) === normalizeKey(name))));
    // What an official name is called after the choices above it: renames and merges chain.
    const renamedTo = new Map();
    const finalName = (name) => {
        let current = tidyName(name);
        for (let i = 0; i < 10 && renamedTo.has(normalizeKey(current)); i++) current = renamedTo.get(normalizeKey(current));
        return current;
    };

    // 1. Spellings detached from an official name become unmapped again.
    Object.entries(removedAliases || {}).forEach(([name, aliases]) => {
        const entry = findActive(name);
        if (!entry) return;
        const drop = new Set((aliases || []).map(normalizeKey));
        entry.aliases = entry.aliases.filter((a) => !drop.has(normalizeKey(a)));
    });

    // 2. Rename, merge and delete official names.
    Object.entries(officialActions || {}).forEach(([name, action]) => {
        const entry = list.find((e) => !e.deleted && normalizeKey(e.name) === normalizeKey(name));
        if (!entry || !action || action.type === 'keep') return;
        if (action.type === 'delete') {
            entry.deleted = true;
            return;
        }
        const to = tidyName(action.to);
        if (!to || normalizeKey(to) === normalizeKey(entry.name) && to === entry.name) return;
        const target = list.find((e) => e !== entry && !e.deleted && normalizeKey(e.name) === normalizeKey(finalName(to)));
        if (action.type === 'merge' || target) {
            if (!target) return;
            target.aliases.push(entry.name, ...entry.aliases);
            list = list.filter((e) => e !== entry);
            renamedTo.set(normalizeKey(entry.name), target.name);
        } else {
            entry.aliases.push(entry.name);
            renamedTo.set(normalizeKey(entry.name), to);
            entry.name = to;
        }
    });

    // 3. Spellings not yet in the list.
    const cleared = new Set();
    // New official names first, so spellings can be mapped onto them in the same save.
    const ordered = Object.entries(spellingActions || {})
        .sort(([, a], [, b]) => (a?.type === 'official' ? 0 : 1) - (b?.type === 'official' ? 0 : 1));
    ordered.forEach(([raw, action]) => {
        if (!action || action.type === 'leave') return;
        if (action.type === 'clear') { cleared.add(raw); return; }
        const to = tidyName(action.type === 'official' ? (action.to || raw) : finalName(action.to));
        if (!to) return;
        const existing = findActive(to);
        if (existing) {
            existing.aliases.push(raw);
        } else if (action.type === 'official') {
            list.push({ name: to, aliases: [raw] });
        }
    });

    const finalEntries = mergeRegistryEntries(list);
    const canonical = buildCanonicalizer(finalEntries);
    const deletedKeys = keysOf(finalEntries.filter((e) => e.deleted));
    const activeKeys = keysOf(activeEntries(finalEntries));
    const rewrites = [];
    [...new Set(values || [])].forEach((raw) => {
        if (typeof raw !== 'string' || !tidyName(raw)) return;
        const key = normalizeKey(raw);
        let to;
        if (cleared.has(raw) || (deletedKeys.has(key) && !activeKeys.has(key))) to = '';
        else to = canonical(raw);
        if (to !== raw) rewrites.push({ from: raw, to });
    });
    return { entries: finalEntries, rewrites };
};
