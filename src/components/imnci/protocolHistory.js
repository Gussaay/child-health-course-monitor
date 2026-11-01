// ============================================================================
// PROTOCOL CHANGE HISTORY
//
// What a save changed, in words a programme manager can read: "Fever ›
// MALARIA › Treatments" before and after, not a JSON patch. Kept apart from
// the page so the comparison can be tested without a browser.
// ============================================================================

const MAX_TEXT = 300;

const clip = (value) => {
    const text = Array.isArray(value)
        ? value.map((v) => String(v ?? '')).filter((v) => v.trim()).join(' | ')
        : (value === undefined || value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value));
    return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text;
};

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// For lists of lines, only the lines that went and the lines that came, so a
// long treatment list does not hide the one line that changed.
const push = (out, where, before, after) => {
    if (same(before, after)) return;
    if (Array.isArray(before) && Array.isArray(after)) {
        const removed = before.filter((l) => !after.includes(l));
        const added = after.filter((l) => !before.includes(l));
        if (removed.length || added.length) {
            out.push({ where, before: clip(removed), after: clip(added) });
            return;
        }
    }
    out.push({ where, before: clip(before), after: clip(after) });
};

const RULE_FIELDS = ['type', 'threshold', 'conditions', 'requires', 'signs', 'signsAr', 'treatments', 'treatmentsAr'];
const CLASS_FIELDS = ['label', 'labelAr', 'color'];

const diffRules = (out, catName, before = [], after = []) => {
    const len = Math.max(before.length, after.length);
    for (let i = 0; i < len; i += 1) {
        const b = before[i];
        const a = after[i];
        const name = a?.classification?.label || b?.classification?.label || `#${i + 1}`;
        if (!b) { push(out, `${catName} › ${name}`, '', 'Classification added'); continue; }
        if (!a) { push(out, `${catName} › ${name}`, 'Classification removed', ''); continue; }
        CLASS_FIELDS.forEach((f) => push(out, `${catName} › ${name} › ${f}`, b.classification?.[f], a.classification?.[f]));
        RULE_FIELDS.forEach((f) => push(out, `${catName} › ${name} › ${f}`, b[f], a[f]));
    }
};

const diffCategories = (out, before = {}, after = {}) => {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    keys.forEach((key) => {
        const b = before[key];
        const a = after[key];
        const name = a?.title || b?.title || key;
        if (!b) { push(out, name, '', 'Section added'); return; }
        if (!a) { push(out, name, 'Section removed', ''); return; }
        push(out, `${name} › title`, b.title, a.title);
        push(out, `${name} › titleAr`, b.titleAr, a.titleAr);
        diffRules(out, name, b.rules, a.rules);
    });
};

const DRUG_FIELDS = ['label', 'labelAr', 'fallback', 'fallbackAr', 'ageAndWeight'];
const BAND_FIELDS = ['minAge', 'maxAge', 'minWeight', 'maxWeight', 'doseQty', 'doseQtyAr', 'doseFreq', 'doseFreqAr', 'doseDuration', 'doseDurationAr'];

const diffDrugs = (out, before = [], after = []) => {
    const byId = (list) => new Map(list.map((d, i) => [d.id || `#${i + 1}`, d]));
    const b = byId(before);
    const a = byId(after);
    [...new Set([...b.keys(), ...a.keys()])].forEach((id) => {
        const db = b.get(id);
        const da = a.get(id);
        const name = da?.label || db?.label || id;
        if (!db) { push(out, name, '', 'Drug added'); return; }
        if (!da) { push(out, name, 'Drug removed', ''); return; }
        DRUG_FIELDS.forEach((f) => push(out, `${name} › ${f}`, db[f], da[f]));
        const rb = db.rules || [];
        const ra = da.rules || [];
        for (let i = 0; i < Math.max(rb.length, ra.length); i += 1) {
            const where = `${name} › band ${i + 1}`;
            if (!rb[i]) { push(out, where, '', 'Band added'); continue; }
            if (!ra[i]) { push(out, where, 'Band removed', ''); continue; }
            BAND_FIELDS.forEach((f) => push(out, `${where} › ${f}`, rb[i][f], ra[i][f]));
        }
    });
};

const FORM_TEXT = ['title', 'header', 'footer'];
const FORM_COLUMNS = ['ask', 'look', 'classify', 'treat'];

const diffForm = (out, before = {}, after = {}) => {
    ['en', 'ar'].forEach((lang) => {
        FORM_TEXT.forEach((f) => push(out, `${lang.toUpperCase()} › ${f}`, before[lang]?.[f], after[lang]?.[f]));
        FORM_COLUMNS.forEach((f) => push(out, `${lang.toUpperCase()} › column ${f}`, before[lang]?.columns?.[f], after[lang]?.columns?.[f]));
    });
    const sb = before.sections || [];
    const sa = after.sections || [];
    const byId = (list) => new Map(list.map((s, i) => [s.id || `#${i + 1}`, s]));
    const mb = byId(sb);
    const ma = byId(sa);
    [...new Set([...mb.keys(), ...ma.keys()])].forEach((id) => {
        const b = mb.get(id);
        const a = ma.get(id);
        const name = a?.en?.title || b?.en?.title || id;
        if (!b) { push(out, name, '', 'Section added'); return; }
        if (!a) { push(out, name, 'Section removed', ''); return; }
        push(out, `${name} › Yes/No`, b.yesNo, a.yesNo);
        ['en', 'ar'].forEach((lang) => ['title', ...FORM_COLUMNS].forEach((f) => (
            push(out, `${name} › ${lang.toUpperCase()} › ${f}`, b[lang]?.[f], a[lang]?.[f])
        )));
    });
    const order = (list) => list.map((s) => s.id).join(',');
    if (order(sb) !== order(sa) && sb.length === sa.length) push(out, 'Section order', order(sb), order(sa));
};

const diffGuide = (out, before = {}, after = {}) => {
    const byId = (list) => new Map((list || []).map((x, i) => [x.id || `#${i + 1}`, x]));
    const gb = byId(before.groups);
    const ga = byId(after.groups);
    [...new Set([...gb.keys(), ...ga.keys()])].forEach((gid) => {
        const b = gb.get(gid);
        const a = ga.get(gid);
        const gname = a?.en?.title || b?.en?.title || gid;
        if (!b) { push(out, gname, '', 'Heading added'); return; }
        if (!a) { push(out, gname, 'Heading removed', ''); return; }
        ['en', 'ar'].forEach((l) => push(out, `${gname} › ${l.toUpperCase()} › title`, b[l]?.title, a[l]?.title));
        const bb = byId(b.blocks);
        const ba = byId(a.blocks);
        [...new Set([...bb.keys(), ...ba.keys()])].forEach((bid) => {
            const x = bb.get(bid);
            const y = ba.get(bid);
            const name = `${gname} › ${y?.en?.title || x?.en?.title || bid}`;
            if (!x) { push(out, name, '', 'Box added'); return; }
            if (!y) { push(out, name, 'Box removed', ''); return; }
            ['en', 'ar'].forEach((l) => {
                ['title', 'lines', 'columns'].forEach((f) => push(out, `${name} › ${l.toUpperCase()} › ${f}`, x[l]?.[f], y[l]?.[f]));
                const rx = x[l]?.rows || [];
                const ry = y[l]?.rows || [];
                for (let i = 0; i < Math.max(rx.length, ry.length); i += 1) push(out, `${name} › ${l.toUpperCase()} › row ${i + 1}`, rx[i], ry[i]);
            });
        });
    });
};

/** Every change between two versions of one protocol document. */
export const diffProtocol = (formType, before, after) => {
    const out = [];
    const b = before || {};
    const a = after || {};
    if (String(formType).startsWith('dosages')) diffDrugs(out, b.drugs, a.drugs);
    else if (String(formType).startsWith('form_')) diffForm(out, b, a);
    else if (String(formType).startsWith('guide_')) diffGuide(out, b, a);
    else diffCategories(out, b.categories, a.categories);
    push(out, 'version', b.version, a.version);
    return out;
};

/** Who is saving, from the signed-in account; the role the app last stored. */
export const currentEditor = (authUser, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) => {
    const uid = authUser?.uid || '';
    let role = '';
    try { role = (uid && storage?.getItem(`backup_role_${uid}`)) || ''; } catch { role = ''; }
    return {
        userId: uid,
        name: authUser?.displayName || authUser?.email || 'Unknown',
        email: authUser?.email || '',
        role,
    };
};
