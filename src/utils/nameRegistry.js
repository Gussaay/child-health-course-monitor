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
 * page), without duplicates. Entries: { name, aliases: string[] }.
 */
export const mergeRegistryEntries = (entries = [], extraNames = []) => {
    const byKey = new Map();
    const out = [];
    const add = (name, aliases = []) => {
        const clean = tidyName(name);
        if (!clean) return;
        const key = normalizeKey(clean);
        let entry = byKey.get(key);
        if (!entry) {
            entry = { name: clean, aliases: [] };
            out.push(entry);
            byKey.set(key, entry);
        }
        aliases.forEach((a) => {
            const alias = tidyName(a);
            const aliasKey = normalizeKey(alias);
            if (!alias || aliasKey === normalizeKey(entry.name)) return;
            if (!entry.aliases.some((x) => normalizeKey(x) === aliasKey)) entry.aliases.push(alias);
            if (!byKey.has(aliasKey)) byKey.set(aliasKey, entry);
        });
    };
    (entries || []).forEach((e) => add(e?.name, e?.aliases || []));
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
        if (!e?.name) return;
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
        variants.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
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
