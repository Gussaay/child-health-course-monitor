// ============================================================================
// PROTOCOL AS THE BOOKLET PRINTS IT
//
// The protocol in Protocol management, laid out like the national chart
// booklet: page title, the question box with IF YES, the ASK /
// LOOK column, and the pink / yellow / green SIGNS | CLASSIFY | IDENTIFY
// TREATMENT table. Pass `edit` and the same layout becomes the editor: each
// cell is a box to type in, and Save Database saves it as before.
// ============================================================================
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BOOKLET_PAGES, ruleSigns } from './bookletLayout';
import { toArabic } from './nationalProtocolAr';

// --- Language -------------------------------------------------------------
// Arabic screens show the Arabic side of each line: the saved Arabic when it
// was written, otherwise the national Arabic wording of the English line, and
// the English only when neither exists (a line typed in English alone).
const arOf = (en) => toArabic(en) || en;
const nonEmpty = (arr) => Array.isArray(arr) && arr.some((l) => String(l ?? '').trim());
export const ruleText = (rule, ar) => {
    const signsEn = ruleSigns(rule);
    if (!ar) return { label: rule.classification?.label, signs: signsEn, treatments: rule.treatments || [], fields: { label: 'label', signs: 'signs', treatments: 'treatments' } };
    return {
        label: rule.classification?.labelAr || arOf(rule.classification?.label || ''),
        signs: nonEmpty(rule.signsAr) ? rule.signsAr : signsEn.map(arOf),
        treatments: nonEmpty(rule.treatmentsAr) ? rule.treatmentsAr : (rule.treatments || []).map(arOf),
        fields: { label: 'labelAr', signs: 'signsAr', treatments: 'treatmentsAr' },
    };
};
const pageText = (page, ar) => (!ar ? page : {
    ...page,
    title: arOf(page.title),
    question: page.question && arOf(page.question),
    ask: page.ask?.map(arOf),
    look: page.look?.map(arOf),
    note: page.note && arOf(page.note),
    sideLabels: page.sideLabels && Object.fromEntries(Object.entries(page.sideLabels).map(([k, v]) => [k, arOf(v)])),
});
const drugText = (obj, field, ar) => (ar ? (obj[`${field}Ar`] ?? (obj[field] ? arOf(obj[field]) : obj[field])) : obj[field]);

// The booklet's own colours: magenta-pink, bright yellow, green, black text.
const ROW_COLORS = {
    'bg-red-500': { background: '#f79cc8', border: '#d9468f' },
    'bg-pink-500': { background: '#f79cc8', border: '#d9468f' },
    'bg-yellow-400': { background: '#fff35c', border: '#d6c400' },
    'bg-green-500': { background: '#5cc46a', border: '#2e8b3e' },
};
const rowColor = (cls) => ROW_COLORS[cls] || { background: '#e2e8f0', border: '#94a3b8' };

const DOSE_TAG = /{{dose:(.*?)}}/;

/** One treatment line: the words, then the dose it points to as a small tag. */
const TreatmentLine = ({ line, drugLabels }) => {
    const text = String(line);
    const m = text.match(DOSE_TAG);
    const words = m ? text.replace(DOSE_TAG, '').replace(/[\s:—-]+$/, '') : text;
    const drugId = m ? m[1].trim() : null;
    return (
        <li className="flex gap-1.5 leading-snug">
            <span aria-hidden="true" className="shrink-0">►</span>
            <span>
                {words}
                {drugId && (
                    <span className="ms-1 inline-block align-middle text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/80 border border-slate-500 text-slate-800 whitespace-nowrap">
                        {drugLabels[drugId] || drugId}
                    </span>
                )}
            </span>
        </li>
    );
};

const AssessPanel = ({ page, t }) => (
    <div className="space-y-3">
        {page.question && (
            <div className="flex flex-col items-center">
                <div className="w-full border-2 border-slate-800 bg-white px-3 py-2 text-center font-bold uppercase text-[13px] text-slate-900">
                    {page.question}
                </div>
                <div className="border-x-2 border-b-2 border-slate-800 bg-white px-3 py-0.5 text-xs font-bold">
                    {t('clinical_ui.protocol.booklet.if_yes', 'IF YES')}
                </div>
            </div>
        )}
        {(page.ask?.length > 0 || page.look?.length > 0) && (
            <div className="border-2 border-slate-800 bg-white p-3 grid gap-3 sm:grid-cols-2 text-[13px] text-slate-900">
                {page.ask?.length > 0 && (
                    <div>
                        <div className="font-bold italic mb-1">{t('clinical_ui.protocol.booklet.ask', 'ASK:')}</div>
                        <ul className="space-y-1">{page.ask.map((a, i) => <li key={i} className="flex gap-1.5"><span aria-hidden="true">•</span><span>{a}</span></li>)}</ul>
                    </div>
                )}
                {page.look?.length > 0 && (
                    <div>
                        <div className="font-bold italic mb-1">{t('clinical_ui.protocol.booklet.look', 'LOOK, LISTEN, FEEL:')}</div>
                        <ul className="space-y-1">{page.look.map((a, i) => <li key={i} className="flex gap-1.5"><span aria-hidden="true">•</span><span>{a}</span></li>)}</ul>
                    </div>
                )}
            </div>
        )}
        {page.note && (
            <div className="border border-slate-500 bg-white/70 p-2 text-xs italic text-slate-700">{page.note}</div>
        )}
    </div>
);

const inputCls = 'w-full bg-white/90 border border-slate-500 rounded px-1.5 py-1 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500';

// Treatments are edited as one line each. A dose stays written as {{dose:id}}
// at the end of its line, as the editor's checks require.
const linesValue = (arr) => (arr || []).join('\n');
const toLines = (v) => String(v).split('\n');
const tidyLines = (arr) => (arr || []).map((l) => String(l).trimEnd()).filter((l) => l.trim());

const RuleCells = ({ rule, edit, catKey, index, drugLabels, t, ar }) => {
    const text = ruleText(rule, ar);
    const { signs, label } = text;
    if (!edit) {
        return {
            signs: signs.length
                ? <ul className="space-y-0.5">{signs.map((sg, k) => <li key={k}>{sg}</li>)}</ul>
                : <span className="italic font-normal">—</span>,
            label,
            treat: <ul className="space-y-1">{text.treatments.map((line, k) => <TreatmentLine key={k} line={line} drugLabels={drugLabels} />)}</ul>,
        };
    }
    return {
        signs: (
            <textarea
                rows={Math.max(3, signs.length + 1)}
                value={linesValue(rule[text.fields.signs] ?? signs)}
                onChange={(e) => edit.onRule(catKey, index, text.fields.signs, toLines(e.target.value))}
                onBlur={() => edit.onRule(catKey, index, text.fields.signs, tidyLines(rule[text.fields.signs] ?? signs))}
                aria-label={t('clinical_ui.protocol.booklet.signs', 'Signs')}
                className={`${inputCls} font-bold`}
                dir="auto"
            />
        ),
        label: (
            <div className="space-y-1">
                <textarea
                    rows={3}
                    value={label || ''}
                    onChange={(e) => edit.onClass(catKey, index, text.fields.label, e.target.value)}
                    aria-label={t('clinical_ui.protocol.booklet.classify', 'Classify as')}
                    className={`${inputCls} font-bold italic uppercase text-center`}
                    dir="auto"
                />
                <select
                    value={rule.classification?.color || ''}
                    onChange={(e) => edit.onClass(catKey, index, 'color', e.target.value)}
                    aria-label={t('clinical_ui.protocol.rule.color', 'Color')}
                    className={`${inputCls} text-xs not-italic normal-case`}
                >
                    <option value="bg-red-500">{t('clinical_ui.protocol.booklet.pink', 'Pink')}</option>
                    <option value="bg-yellow-400">{t('clinical_ui.protocol.booklet.yellow', 'Yellow')}</option>
                    <option value="bg-green-500">{t('clinical_ui.protocol.booklet.green', 'Green')}</option>
                    <option value="bg-slate-500">{t('clinical_ui.protocol.booklet.grey', 'Grey')}</option>
                </select>
            </div>
        ),
        treat: (
            <div className="space-y-1">
                <textarea
                    rows={Math.min(16, Math.max(4, text.treatments.length * 2 + 1))}
                    value={linesValue(rule[text.fields.treatments] ?? text.treatments)}
                    onChange={(e) => edit.onRule(catKey, index, text.fields.treatments, toLines(e.target.value))}
                    onBlur={() => edit.onRule(catKey, index, text.fields.treatments, tidyLines(rule[text.fields.treatments] ?? text.treatments))}
                    aria-label={t('clinical_ui.protocol.booklet.treat', 'Identify treatment')}
                    className={inputCls}
                    dir="auto"
                />
                <p className="text-[11px] text-slate-700">{t('clinical_ui.protocol.booklet.treat_hint', 'One treatment per line. A dose is written {{dose:drug_id}} at the end of its line.')}</p>
            </div>
        ),
    };
};

const ClassifyTable = ({ page, categories, drugLabels, edit, t, ar }) => {
    const withSide = page.categories.length > 1;
    const sideLabel = (catKey) => page.sideLabels?.[catKey] || (ar ? categories[catKey]?.titleAr || arOf(categories[catKey]?.title || '') : categories[catKey]?.title) || catKey;
    return (
        <>
        {/* Phone: one coloured box per classification, signs then treatment. */}
        <div className="md:hidden space-y-2">
            {page.categories.map((catKey) => {
                const rules = categories[catKey]?.rules || [];
                if (!rules.length) return null;
                return (
                    <div key={catKey} className="space-y-2">
                        {withSide && (
                            <div className="text-xs font-bold uppercase text-slate-700 border-b-2 border-slate-800 pb-0.5">{sideLabel(catKey)}</div>
                        )}
                        {rules.map((rule, i) => {
                            const c = rowColor(rule.classification?.color);
                            const cells = RuleCells({ rule, edit, catKey, index: i, drugLabels, t, ar });
                            return (
                                <div key={rule.id || i} className="border-2 text-[13px] text-slate-900" style={{ background: c.background, borderColor: c.border }}>
                                    <div className="px-2.5 py-1.5 font-bold italic uppercase text-center border-b" style={{ borderColor: c.border }}>{cells.label}</div>
                                    <div className="px-2.5 py-1.5 font-bold border-b" style={{ borderColor: c.border }}>{cells.signs}</div>
                                    <div className="px-2.5 py-1.5">{cells.treat}</div>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
        <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[13px] text-slate-900">
                <thead>
                    <tr className="bg-slate-800 text-white text-xs uppercase tracking-wide">
                        {withSide && <th className="p-1.5 w-20" />}
                        <th className="p-1.5 text-start w-[32%]">{t('clinical_ui.protocol.booklet.signs', 'Signs')}</th>
                        <th className="p-1.5 w-[20%]">{t('clinical_ui.protocol.booklet.classify', 'Classify as')}</th>
                        <th className="p-1.5 text-start">{t('clinical_ui.protocol.booklet.treat', 'Identify treatment')}</th>
                    </tr>
                </thead>
                <tbody>
                    {page.categories.map((catKey) => {
                        const rules = categories[catKey]?.rules || [];
                        if (!rules.length) return null;
                        return rules.map((rule, i) => {
                            const c = rowColor(rule.classification?.color);
                            const cell = { background: c.background, borderColor: c.border };
                            const cells = RuleCells({ rule, edit, catKey, index: i, drugLabels, t, ar });
                            return (
                                <tr key={`${catKey}-${rule.id || i}`}>
                                    {withSide && i === 0 && (
                                        <td rowSpan={rules.length} className="border-2 border-slate-800 bg-white p-1.5 text-center text-xs font-bold align-middle">{sideLabel(catKey)}</td>
                                    )}
                                    <td className="border-2 p-2 align-top font-bold" style={cell}>{cells.signs}</td>
                                    <td className="border-2 p-2 align-middle text-center font-bold italic uppercase" style={cell}>{cells.label}</td>
                                    <td className="border-2 p-2 align-top" style={cell}>{cells.treat}</td>
                                </tr>
                            );
                        });
                    })}
                </tbody>
            </table>
        </div>
        </>
    );
};

/** The pages to show: the booklet's, then any saved table it does not cover. */
export const bookletPagesFor = (formType, categories = {}) => {
    const known = (BOOKLET_PAGES[formType] || [])
        .map((p) => ({ ...p, categories: p.categories.filter((k) => categories[k]?.rules?.length) }))
        .filter((p) => p.categories.length);
    const covered = new Set(known.flatMap((p) => p.categories));
    const extra = Object.entries(categories)
        .filter(([k, c]) => !covered.has(k) && c?.rules?.length)
        .map(([k, c]) => ({ id: k, title: c.title || k, categories: [k] }));
    return [...known, ...extra];
};

export const BookletProtocolView = ({ formType, protocol, doses = [], edit = null }) => {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const categories = protocol?.categories || {};
    const drugLabels = Object.fromEntries((doses || []).map((d) => [d.id, drugText(d, 'label', ar) || d.id]));
    const pages = bookletPagesFor(formType, categories).map((p) => pageText(p, ar));

    if (!pages.length) {
        return <div className="p-6 text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded">{t('clinical_ui.protocol.booklet.empty', 'This protocol has no classification tables yet.')}</div>;
    }

    return (
        <div className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
            <div className="text-center border-2 border-slate-800 bg-white py-2 px-3">
                <div className="font-extrabold uppercase text-slate-900 text-sm md:text-base">
                    {formType === 'infant'
                        ? t('clinical_ui.protocol.booklet.infant_heading', 'Assess, classify and treat the sick young infant, age up to 2 months')
                        : t('clinical_ui.protocol.booklet.child_heading', 'Assess and classify the sick child, age 2 months up to 5 years')}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">{t('clinical_ui.protocol.booklet.use_all', 'Use all boxes that match the symptoms and problems to classify the illness.')}</div>
            </div>
            {pages.map((page) => (
                <section key={page.id} className="rounded-sm p-3 md:p-4 shadow-sm border border-amber-200" style={{ background: '#fffbd6' }}>
                    <h3 className="mx-auto mb-3 w-fit max-w-full border-2 border-slate-800 bg-white px-4 py-1.5 text-center font-extrabold uppercase tracking-wide text-slate-900 text-sm md:text-base">
                        {page.title}
                    </h3>
                    <div className={`grid gap-4 ${page.ask || page.look || page.question ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]' : ''}`}>
                        {(page.ask || page.look || page.question) && <AssessPanel page={page} t={t} />}
                        <ClassifyTable page={page} categories={categories} drugLabels={drugLabels} edit={edit} t={t} ar={ar} />
                    </div>
                </section>
            ))}
        </div>
    );
};

// ----------------------------------------------------------------------------
// Dose tables, as the TREAT pages print them
// ----------------------------------------------------------------------------
const fmtUpper = (v) => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return null;
    // Bands end at .99 so no weight falls between rows; the booklet prints "up to 10".
    const frac = Math.round((n - Math.floor(n)) * 100);
    return frac === 99 ? `< ${Math.ceil(n)}` : `${n}`;
};

// Young-infant ages are stored in months but printed in days ("under 7 days"):
// a value with more than two decimals is a day count turned into months.
const DAYS_PER_MONTH = 30.44;
const isDayValue = (n) => Math.abs(n * 100 - Math.round(n * 100)) > 1e-6;

const rangeText = (min, max, unit, t) => {
    const lo = parseFloat(min) || 0;
    const hiNum = parseFloat(max);
    const open = !Number.isFinite(hiNum) || hiNum >= 99;
    if (lo === 0 && open) return '—';
    const isAge = unit !== 'kg';
    const days = t('clinical_ui.protocol.booklet.days', 'days');
    const show = (n, upperBound) => {
        if (isAge && isDayValue(n)) {
            const d = n * DAYS_PER_MONTH;
            return upperBound ? `< ${Math.ceil(d)} ${days}` : `${Math.round(d)} ${days}`;
        }
        return `${upperBound ? fmtUpper(n) : n} ${unit}`;
    };
    if (open) return t('clinical_ui.protocol.booklet.range_from', '{{lo}} {{unit}} or more', { lo: show(lo), unit: '' }).replace(/\s+/g, ' ');
    if (lo === 0) { const hi = show(hiNum, true); return hi.startsWith('<') ? hi : `≤ ${hi}`; }
    return `${show(lo)} – ${show(hiNum, true)}`;
};

/** One dose band: read as the booklet prints it, or as inputs when editing. */
const DoseBand = ({ r, edit, drugIndex, k, months, t, layout, ar }) => {
    const set = (field) => (e) => edit.onRange(drugIndex, k, field, e.target.value);
    const show = (field) => drugText(r, field, ar);
    const num = (field, ph) => (
        <input type="number" inputMode="decimal" step="0.01" value={r[field] ?? ''} onChange={set(field)} placeholder={ph} aria-label={field} className={`${inputCls} text-center w-16`} />
    );
    const txt = (field, extra = '') => (
        <input type="text" value={show(field) ?? ''} onChange={set(ar ? `${field}Ar` : field)} aria-label={field} className={`${inputCls} ${extra}`} dir="auto" />
    );
    const age = edit ? <span className="inline-flex items-center gap-1">{num('minAge', '0')}–{num('maxAge', '∞')}</span> : rangeText(r.minAge, r.maxAge, months, t);
    const weight = edit ? <span className="inline-flex items-center gap-1">{num('minWeight', '0')}–{num('maxWeight', '∞')}</span> : rangeText(r.minWeight, r.maxWeight, ar ? 'كجم' : 'kg', t);
    const remove = edit && (
        <button type="button" onClick={() => edit.removeRange(drugIndex, k)} className="text-xs font-bold text-red-700 hover:underline">
            {t('clinical_ui.protocol.booklet.remove_band', 'Remove')}
        </button>
    );

    // Phone: the same table in two columns, so nothing scrolls sideways.
    if (layout === 'compact') {
        return (
            <tr className={k % 2 ? 'bg-slate-50' : ''}>
                <td className="border border-slate-300 p-1.5 align-top text-xs">
                    <div className={edit ? '' : 'whitespace-nowrap'}>{age}</div>
                    <div className={`text-slate-600 ${edit ? 'mt-1' : 'whitespace-nowrap'}`}>{weight}</div>
                </td>
                <td className="border border-slate-300 p-1.5 align-top break-words">
                    <div className="font-bold">{edit ? txt('doseQty', 'font-bold') : show('doseQty')}</div>
                    <div className="text-xs text-slate-700 mt-0.5 space-y-0.5">
                        {edit ? <>{txt('doseFreq')}{txt('doseDuration')}</> : [show('doseFreq'), show('doseDuration')].filter(Boolean).join(' · ')}
                    </div>
                    {remove}
                </td>
            </tr>
        );
    }
    return (
        <tr className={k % 2 ? 'bg-slate-50' : ''}>
            <td className="border border-slate-300 p-1.5 text-center whitespace-nowrap">{age}</td>
            <td className="border border-slate-300 p-1.5 text-center whitespace-nowrap">{weight}</td>
            <td className="border border-slate-300 p-1.5 font-bold">{edit ? txt('doseQty', 'font-bold') : show('doseQty')}</td>
            <td className="border border-slate-300 p-1.5 text-center">{edit ? txt('doseFreq') : show('doseFreq')}</td>
            <td className="border border-slate-300 p-1.5 text-center">{edit ? txt('doseDuration') : show('doseDuration')}</td>
            {edit && <td className="border border-slate-300 p-1.5 text-center">{remove}</td>}
        </tr>
    );
};

export const BookletDoseView = ({ protocol, edit = null }) => {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const drugs = protocol?.drugs || [];
    if (!drugs.length) {
        return <div className="p-6 text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded">{t('clinical_ui.protocol.booklet.no_drugs', 'No doses saved yet.')}</div>;
    }
    const months = t('clinical_ui.protocol.booklet.months', 'months');
    return (
        <div className="grid gap-4 xl:grid-cols-2 items-start" dir={ar ? 'rtl' : 'ltr'}>
            {drugs.map((drug, i) => (
                <section key={drug.id || i} className="border-2 border-slate-800 bg-white rounded-sm overflow-hidden">
                    <div className="bg-sky-100 border-b-2 border-slate-800 px-3 py-1.5 text-slate-900">
                        {edit ? (
                            <div className="space-y-1.5">
                                <input type="text" value={drugText(drug, 'label', ar) || ''} onChange={(e) => edit.onDrug(i, ar ? 'labelAr' : 'label', e.target.value)} aria-label={t('clinical_ui.protocol.drug.label', 'Display label')} className={`${inputCls} font-extrabold`} dir="auto" />
                                <input type="text" value={drugText(drug, 'fallback', ar) || ''} onChange={(e) => edit.onDrug(i, ar ? 'fallbackAr' : 'fallback', e.target.value)} placeholder={t('clinical_ui.protocol.booklet.fallback', 'Text when no band matches')} className={`${inputCls} text-xs`} dir="auto" />
                                <label className="flex items-center gap-2 text-xs font-bold">
                                    <input type="checkbox" checked={!!drug.ageAndWeight} onChange={(e) => edit.onDrug(i, 'ageAndWeight', e.target.checked)} />
                                    {t('clinical_ui.protocol.booklet.age_weight_badge', 'Age and weight')}
                                </label>
                                <div className="text-[10px] font-mono text-slate-600">{`{{dose:${drug.id}}}`}</div>
                            </div>
                        ) : (
                            <h3 className="font-extrabold text-sm">
                                {drugText(drug, 'label', ar) || drug.id}
                                {drug.ageAndWeight && <span className="ms-2 text-[10px] font-bold uppercase text-sky-800">{t('clinical_ui.protocol.booklet.age_weight_badge', 'Age and weight')}</span>}
                            </h3>
                        )}
                    </div>
                    {/* Phone: two columns, so nothing is cut off or scrolls sideways. */}
                    <table className="md:hidden w-full border-collapse table-fixed text-[13px] text-slate-900">
                        <thead>
                            <tr className="bg-slate-100 text-xs">
                                <th className="border border-slate-400 p-1.5 text-start w-[42%]">{t('clinical_ui.protocol.booklet.age', 'Age')} / {t('clinical_ui.protocol.booklet.weight', 'Weight')}</th>
                                <th className="border border-slate-400 p-1.5 text-start">{t('clinical_ui.protocol.booklet.dose', 'Dose')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(drug.rules || []).map((r, k) => <DoseBand key={k} r={r} edit={edit} drugIndex={i} k={k} months={months} t={t} ar={ar} layout="compact" />)}
                        </tbody>
                    </table>
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full border-collapse text-[13px] text-slate-900">
                            <thead>
                                <tr className="bg-slate-100 text-xs">
                                    <th className="border border-slate-400 p-1.5">{t('clinical_ui.protocol.booklet.age', 'Age')}</th>
                                    <th className="border border-slate-400 p-1.5">{t('clinical_ui.protocol.booklet.weight', 'Weight')}</th>
                                    <th className="border border-slate-400 p-1.5 text-start">{t('clinical_ui.protocol.booklet.dose', 'Dose')}</th>
                                    <th className="border border-slate-400 p-1.5">{t('clinical_ui.protocol.booklet.freq', 'How often')}</th>
                                    <th className="border border-slate-400 p-1.5">{t('clinical_ui.protocol.booklet.duration', 'For how long')}</th>
                                    {edit && <th className="border border-slate-400 p-1.5" />}
                                </tr>
                            </thead>
                            <tbody>
                                {(drug.rules || []).map((r, k) => <DoseBand key={k} r={r} edit={edit} drugIndex={i} k={k} months={months} t={t} ar={ar} layout="row" />)}
                            </tbody>
                        </table>
                    </div>
                    {edit && (
                        <button type="button" onClick={() => edit.addRange(i)} className="w-full border-t border-slate-300 py-2 text-xs font-bold text-sky-800 hover:bg-sky-50">
                            + {t('clinical_ui.protocol.btn.add_range', 'Add Dose Range')}
                        </button>
                    )}
                </section>
            ))}
        </div>
    );
};

