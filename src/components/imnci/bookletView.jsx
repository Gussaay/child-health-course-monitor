// ============================================================================
// PROTOCOL AS THE BOOKLET PRINTS IT
//
// A read-only view of the protocol in Protocol management, laid out like the
// national chart booklet: page title, the question box with IF YES, the ASK /
// LOOK column, and the pink / yellow / green SIGNS | CLASSIFY | IDENTIFY
// TREATMENT table. It shows what is in the editor, so an unsaved change is
// visible here before it is saved.
// ============================================================================
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BOOKLET_PAGES, ruleSigns } from './bookletLayout';

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

const ClassifyTable = ({ page, categories, drugLabels, t }) => {
    const withSide = page.categories.length > 1;
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
                            <div className="text-xs font-bold uppercase text-slate-700 border-b-2 border-slate-800 pb-0.5">
                                {page.sideLabels?.[catKey] || categories[catKey]?.title || catKey}
                            </div>
                        )}
                        {rules.map((rule, i) => {
                            const c = rowColor(rule.classification?.color);
                            const signs = ruleSigns(rule);
                            return (
                                <div key={rule.id || i} className="border-2 text-[13px] text-slate-900" style={{ background: c.background, borderColor: c.border }}>
                                    <div className="px-2.5 py-1.5 font-bold italic uppercase text-center border-b" style={{ borderColor: c.border }}>{rule.classification?.label}</div>
                                    {signs.length > 0 && (
                                        <ul className="px-2.5 py-1.5 font-bold space-y-0.5 border-b" style={{ borderColor: c.border }}>
                                            {signs.map((sg, k) => <li key={k}>{sg}</li>)}
                                        </ul>
                                    )}
                                    <ul className="px-2.5 py-1.5 space-y-1">
                                        {(rule.treatments || []).map((line, k) => <TreatmentLine key={k} line={line} drugLabels={drugLabels} />)}
                                    </ul>
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
                            const signs = ruleSigns(rule);
                            return (
                                <tr key={`${catKey}-${rule.id || i}`}>
                                    {withSide && i === 0 && (
                                        <td rowSpan={rules.length} className="border-2 border-slate-800 bg-white p-1.5 text-center text-xs font-bold align-middle">
                                            {page.sideLabels?.[catKey] || categories[catKey]?.title || catKey}
                                        </td>
                                    )}
                                    <td className="border-2 p-2 align-top font-bold" style={cell}>
                                        {signs.length
                                            ? <ul className="space-y-0.5">{signs.map((s, k) => <li key={k}>{s}</li>)}</ul>
                                            : <span className="italic font-normal">—</span>}
                                    </td>
                                    <td className="border-2 p-2 align-middle text-center font-bold italic uppercase" style={cell}>
                                        {rule.classification?.label}
                                    </td>
                                    <td className="border-2 p-2 align-top" style={cell}>
                                        <ul className="space-y-1">
                                            {(rule.treatments || []).map((line, k) => <TreatmentLine key={k} line={line} drugLabels={drugLabels} />)}
                                        </ul>
                                    </td>
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

export const BookletProtocolView = ({ formType, protocol, doses = [] }) => {
    const { t } = useTranslation();
    const categories = protocol?.categories || {};
    const drugLabels = Object.fromEntries((doses || []).map((d) => [d.id, d.label || d.id]));
    const pages = bookletPagesFor(formType, categories);

    if (!pages.length) {
        return <div className="p-6 text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded">{t('clinical_ui.protocol.booklet.empty', 'This protocol has no classification tables yet.')}</div>;
    }

    return (
        <div className="space-y-6" dir="ltr">
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
                        <ClassifyTable page={page} categories={categories} drugLabels={drugLabels} t={t} />
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

const rangeText = (min, max, unit, t) => {
    const lo = parseFloat(min) || 0;
    const hiNum = parseFloat(max);
    const open = !Number.isFinite(hiNum) || hiNum >= 99;
    if (lo === 0 && open) return '—';
    if (open) return t('clinical_ui.protocol.booklet.range_from', '{{lo}} {{unit}} or more', { lo, unit });
    if (lo === 0) return `${fmtUpper(hiNum)} ${unit}`;
    return `${lo} – ${fmtUpper(hiNum)} ${unit}`;
};

export const BookletDoseView = ({ protocol }) => {
    const { t } = useTranslation();
    const drugs = protocol?.drugs || [];
    if (!drugs.length) {
        return <div className="p-6 text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded">{t('clinical_ui.protocol.booklet.no_drugs', 'No doses saved yet.')}</div>;
    }
    const months = t('clinical_ui.protocol.booklet.months', 'months');
    return (
        <div className="grid gap-4 xl:grid-cols-2 items-start" dir="ltr">
            {drugs.map((drug, i) => (
                <section key={drug.id || i} className="border-2 border-slate-800 bg-white rounded-sm overflow-hidden">
                    <h3 className="bg-sky-100 border-b-2 border-slate-800 px-3 py-1.5 font-extrabold text-slate-900 text-sm">
                        {drug.label || drug.id}
                        {drug.ageAndWeight && <span className="ms-2 text-[10px] font-bold uppercase text-sky-800">{t('clinical_ui.protocol.booklet.age_weight_badge', 'Age and weight')}</span>}
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[420px] border-collapse text-[13px] text-slate-900">
                            <thead>
                                <tr className="bg-slate-100 text-xs">
                                    <th className="border border-slate-400 p-1.5">{t('clinical_ui.protocol.booklet.age', 'Age')}</th>
                                    <th className="border border-slate-400 p-1.5">{t('clinical_ui.protocol.booklet.weight', 'Weight')}</th>
                                    <th className="border border-slate-400 p-1.5 text-start">{t('clinical_ui.protocol.booklet.dose', 'Dose')}</th>
                                    <th className="border border-slate-400 p-1.5">{t('clinical_ui.protocol.booklet.freq', 'How often')}</th>
                                    <th className="border border-slate-400 p-1.5">{t('clinical_ui.protocol.booklet.duration', 'For how long')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(drug.rules || []).map((r, k) => (
                                    <tr key={k} className={k % 2 ? 'bg-slate-50' : ''}>
                                        <td className="border border-slate-300 p-1.5 text-center whitespace-nowrap">{rangeText(r.minAge, r.maxAge, months, t)}</td>
                                        <td className="border border-slate-300 p-1.5 text-center whitespace-nowrap">{rangeText(r.minWeight, r.maxWeight, 'kg', t)}</td>
                                        <td className="border border-slate-300 p-1.5 font-bold">{r.doseQty}</td>
                                        <td className="border border-slate-300 p-1.5 text-center">{r.doseFreq}</td>
                                        <td className="border border-slate-300 p-1.5 text-center">{r.doseDuration}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ))}
        </div>
    );
};
