// ============================================================================
// PROTOCOL AS THE BOOKLET PRINTS IT
//
// The protocol in Protocol management, laid out like the national chart
// booklet: page title, the question box with IF YES, the ASK /
// LOOK column, and the pink / yellow / green SIGNS | CLASSIFY | IDENTIFY
// TREATMENT table. Pass `edit` and the same layout becomes the editor: signs
// and classifications are chosen from the standard lists (standardLists.js),
// each treatment line's dose from the part's drugs, and the page title,
// question, ASK / LOOK column, note and side labels are typed in.
// ============================================================================
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BOOKLET_PAGES, ruleSigns } from './bookletLayout';
import { toArabic } from './nationalProtocolAr';
import { promptDialog } from '../dialogs';
import { signOptions, classificationOptions, treatmentSuggestions, splitLine, joinLine } from './standardLists';

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
// A page's printed words: the booklet's, with any wording saved in
// protocol.pages[pageId] (title, question, ask, look, note, sideLabels, and the
// same names ending in Ar for Arabic) laid over them.
const PAGE_FIELDS = ['title', 'question', 'ask', 'look', 'note'];
const pageText = (page, ar, o = {}) => {
    const en = { ...page, sideLabels: { ...(page.sideLabels || {}), ...(o.sideLabels || {}) } };
    PAGE_FIELDS.forEach((f) => { if (o[f] !== undefined) en[f] = o[f]; });
    if (!ar) return en;
    const pick = (f, conv) => (o[`${f}Ar`] !== undefined ? o[`${f}Ar`] : conv(en[f]));
    const one = (v) => v && arOf(v);
    const many = (v) => v?.map(arOf);
    return {
        ...en,
        title: o.titleAr !== undefined ? o.titleAr : (page.titleAr || one(en.title)),
        question: pick('question', one),
        ask: pick('ask', many),
        look: pick('look', many),
        note: pick('note', one),
        sideLabels: { ...Object.fromEntries(Object.entries(en.sideLabels).map(([k, v]) => [k, arOf(v)])), ...(o.sideLabelsAr || {}) },
    };
};
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

const inputCls = 'w-full bg-white/90 border border-slate-500 rounded px-1.5 py-1 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500';
const selectCls = 'w-full min-w-0 bg-white/90 border border-slate-500 rounded px-1 py-1 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500';
const iconBtn = 'shrink-0 w-7 h-7 inline-flex items-center justify-center rounded border border-slate-500 bg-white/80 text-red-700 font-bold hover:bg-red-50';
const NEW = '__new__';

// Free text (titles, questions, the ASK / LOOK column) is edited one line per row.
const linesValue = (arr) => (arr || []).join('\n');
const toLines = (v) => String(v).split('\n');
const tidyLines = (arr) => (arr || []).map((l) => String(l).trimEnd()).filter((l) => l.trim());

const LinesEdit = ({ value, onChange, label, className = '' }) => (
    <textarea
        rows={Math.max(2, (value || []).length + 1)}
        value={linesValue(value)}
        onChange={(e) => onChange(toLines(e.target.value))}
        onBlur={(e) => onChange(tidyLines(toLines(e.target.value)))}
        aria-label={label}
        className={`${inputCls} ${className}`}
        dir="auto"
    />
);

// Asks for the English and the Arabic of a new list entry.
const askNew = async (t, kind) => {
    const title = kind === 'sign' ? t('clinical_ui.protocol.std.new_sign', 'New sign') : t('clinical_ui.protocol.std.new_class', 'New classification');
    const en = String(await promptDialog(t('clinical_ui.protocol.std.ask_en', 'English wording:'), { title }) || '').trim();
    if (!en) return null;
    const ar = String(await promptDialog(t('clinical_ui.protocol.std.ask_ar', 'Arabic wording (leave empty to use the English):'), { title }) || '').trim();
    return { en, ar: ar || toArabic(en) || en };
};

/** A select of list entries, grouped by table; shows each in the screen's language. */
// The chosen text is shown wrapped in full, with the native select laid over
// it, invisible, so a long sign is never cut off and a tap still opens the list.
const OptionSelect = ({ options, value, onChange, ar, label, placeholder, newLabel, extra }) => {
    const entry = value && options.get(value);
    const known = !value || entry;
    const shown = value ? ((ar ? entry?.ar : entry?.en) || value) : placeholder;
    return (
        <div className={`relative min-w-0 flex-1 ${selectCls} pe-6 leading-snug ${value ? '' : 'text-slate-600'}`}>
            <span className="block break-words" aria-hidden="true">{shown}</span>
            <span className="absolute end-1.5 top-1/2 -translate-y-1/2 text-slate-600 text-[10px]" aria-hidden="true">▼</span>
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} aria-label={label} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" dir={ar ? 'rtl' : 'ltr'}>
            {placeholder && <option value="">{placeholder}</option>}
            {!known && <option value={value}>{value}</option>}
            {options.groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                    {g.items.map((it) => <option key={it.en} value={it.en}>{ar ? it.ar || it.en : it.en}</option>)}
                </optgroup>
            ))}
            {extra}
            {newLabel && <option value={NEW}>{newLabel}</option>}
        </select>
        </div>
    );
};

/** The SIGNS cell when editing: one chosen sign per row. */
const SignsPicker = ({ rule, catKey, index, edit, options, ar, t }) => {
    const en = ruleSigns(rule);
    const shown = ruleText(rule, ar).signs;
    // Arabic already saved for a line stays with it while other lines change.
    const arFor = (line) => {
        const i = en.indexOf(line);
        return (ar && i !== -1 && shown.length === en.length && shown[i]) || (Array.isArray(rule.signsAr) && i !== -1 && rule.signsAr[i]) || options.get(line)?.ar || toArabic(line) || line;
    };
    const save = (lines) => {
        const arLines = lines.map(arFor);
        edit.onRule(catKey, index, 'signs', lines);
        edit.onRule(catKey, index, 'signsAr', arLines);
    };
    const pick = async (k, value) => {
        let v = value;
        if (v === NEW) {
            const entry = await askNew(t, 'sign');
            if (!entry) return;
            edit.addStandard('standardSigns', entry);
            v = entry.en;
        }
        if (!v) return;
        const next = [...en];
        if (k === en.length) next.push(v); else next[k] = v;
        save(next);
    };
    return (
        <div className="space-y-1">
            {en.map((line, k) => (
                <div key={k} className="flex items-center gap-1">
                    <OptionSelect options={options} value={line} onChange={(v) => pick(k, v)} ar={ar} label={`${t('clinical_ui.protocol.booklet.signs', 'Signs')} ${k + 1}`} newLabel={t('clinical_ui.protocol.std.new_sign_opt', '+ New sign…')} />
                    <button type="button" onClick={() => save(en.filter((_, j) => j !== k))} className={iconBtn} aria-label={t('clinical_ui.protocol.booklet.remove_band', 'Remove')}>×</button>
                </div>
            ))}
            <OptionSelect options={options} value="" onChange={(v) => pick(en.length, v)} ar={ar} label={t('clinical_ui.protocol.std.add_sign', '+ Add sign')} placeholder={t('clinical_ui.protocol.std.add_sign', '+ Add sign')} newLabel={t('clinical_ui.protocol.std.new_sign_opt', '+ New sign…')} />
        </div>
    );
};

/** The CLASSIFY AS cell when editing: a classification from the list, and its colour. */
const ClassificationPicker = ({ rule, catKey, index, edit, options, ar, t }) => {
    const cls = rule.classification || {};
    const pick = async (value) => {
        let entry = options.get(value);
        if (value === NEW) {
            entry = await askNew(t, 'class');
            if (!entry) return;
            entry = { ...entry, color: cls.color };
            edit.addStandard('standardClassifications', entry);
        }
        if (!entry) return;
        edit.onClass(catKey, index, 'label', entry.en);
        edit.onClass(catKey, index, 'labelAr', entry.ar || toArabic(entry.en) || entry.en);
        if (entry.color) edit.onClass(catKey, index, 'color', entry.color);
    };
    return (
        <div className="space-y-1 font-bold">
            <OptionSelect options={options} value={cls.label} onChange={pick} ar={ar} label={t('clinical_ui.protocol.booklet.classify', 'Classify as')} newLabel={t('clinical_ui.protocol.std.new_class_opt', '+ New classification…')} />
            <select
                value={cls.color || ''}
                onChange={(e) => edit.onClass(catKey, index, 'color', e.target.value)}
                aria-label={t('clinical_ui.protocol.rule.color', 'Color')}
                className={`${selectCls} text-xs`}
            >
                <option value="bg-red-500">{t('clinical_ui.protocol.booklet.pink', 'Pink')}</option>
                <option value="bg-yellow-400">{t('clinical_ui.protocol.booklet.yellow', 'Yellow')}</option>
                <option value="bg-green-500">{t('clinical_ui.protocol.booklet.green', 'Green')}</option>
                <option value="bg-slate-500">{t('clinical_ui.protocol.booklet.grey', 'Grey')}</option>
            </select>
        </div>
    );
};

/**
 * The IDENTIFY TREATMENT cell when editing: each line's words, and its dose
 * chosen from the part's drugs. The dose is written into the line for the
 * engine; nobody types {{dose:…}} any more.
 */
const TreatmentEditor = ({ rule, catKey, index, edit, drugs, listId, suggestions = [], ar, t }) => {
    const [draft, setDraft] = useState('');
    const field = ar ? 'treatmentsAr' : 'treatments';
    const other = ar ? 'treatments' : 'treatmentsAr';
    const lines = ruleText(rule, ar).treatments;
    const otherLines = Array.isArray(rule[other]) && rule[other].length === lines.length ? rule[other] : null;
    const drugIds = new Set(drugs.map((d) => d.id));
    const setLines = (next, nextOther) => {
        edit.onRule(catKey, index, field, next);
        if (nextOther) edit.onRule(catKey, index, other, nextOther);
    };
    const setWords = (k, words) => {
        const next = [...lines];
        next[k] = joinLine(words, splitLine(lines[k]).drugId);
        setLines(next);
    };
    // The dose is the same in both languages, so it is changed on both sides.
    const setDrug = (k, drugId) => {
        const next = [...lines];
        next[k] = joinLine(splitLine(lines[k]).words, drugId);
        const nextOther = otherLines && otherLines.map((l, j) => (j === k ? joinLine(splitLine(l).words, drugId) : l));
        setLines(next, nextOther);
    };
    const remove = (k) => setLines(lines.filter((_, j) => j !== k), otherLines && otherLines.filter((_, j) => j !== k));
    const commit = () => { const v = draft.trim(); if (!v) return; setLines([...lines, v]); setDraft(''); };
    return (
        <div className="space-y-1.5">
            {lines.map((line, k) => {
                const { words, drugId } = splitLine(line);
                return (
                    <div key={k} className="flex flex-wrap items-start gap-1 border-b border-black/10 pb-1.5 last:border-0">
                        <textarea
                            rows={Math.max(1, Math.ceil(String(words).length / 30))}
                            value={words}
                            onChange={(e) => setWords(k, e.target.value.replace(/\n/g, ' '))}
                            onBlur={() => { if (!String(words).trim() && !drugId) remove(k); }}
                            aria-label={`${t('clinical_ui.protocol.booklet.treat', 'Identify treatment')} ${k + 1}`}
                            className={`${inputCls} basis-full`}
                            dir="auto"
                        />
                        <select value={drugId} onChange={(e) => setDrug(k, e.target.value)} aria-label={t('clinical_ui.protocol.std.dose', 'Dose')} className={`${selectCls} flex-1 text-xs`}>
                            <option value="">{t('clinical_ui.protocol.std.no_dose', 'No dose')}</option>
                            {drugId && !drugIds.has(drugId) && <option value={drugId}>{t('clinical_ui.protocol.std.missing_dose', '{{id}} (not in the doses)', { id: drugId })}</option>}
                            {drugs.map((d) => <option key={d.id} value={d.id}>{t('clinical_ui.protocol.std.dose_of', 'Dose: {{name}}', { name: drugText(d, 'label', ar) || d.id })}</option>)}
                        </select>
                        <button type="button" onClick={() => remove(k)} className={iconBtn} aria-label={t('clinical_ui.protocol.booklet.remove_band', 'Remove')}>×</button>
                    </div>
                );
            })}
            <div className="flex items-center gap-1">
                <input
                    type="text"
                    list={listId}
                    value={draft}
                    placeholder={t('clinical_ui.protocol.std.add_line', '+ Add a treatment line (type or pick)')}
                    // Picking a suggestion adds it at once; typed text is added with Enter or Add.
                    onChange={(e) => { const v = e.target.value; if (suggestions.includes(v)) { setLines([...lines, v]); setDraft(''); } else setDraft(v); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
                    aria-label={t('clinical_ui.protocol.std.add_line', '+ Add a treatment line (type or pick)')}
                    className={`${inputCls} border-dashed`}
                    dir="auto"
                />
                <button type="button" onClick={commit} disabled={!draft.trim()} className="shrink-0 px-2 h-7 rounded border border-slate-500 bg-white/80 text-xs font-bold text-sky-800 disabled:opacity-40">
                    {t('clinical_ui.protocol.custom.add', 'Add')}
                </button>
            </div>
        </div>
    );
};

const RuleCells = ({ rule, edit, catKey, index, drugLabels, t, ar, ctx }) => {
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
    const common = { rule, catKey, index, edit, ar, t };
    return {
        signs: <SignsPicker {...common} options={ctx.signOpts} />,
        label: <ClassificationPicker {...common} options={ctx.classOpts} />,
        treat: <TreatmentEditor {...common} drugs={ctx.drugs} listId={ctx.listId} suggestions={ctx.suggestions} />,
    };
};

const AssessPanel = ({ page, t, setPage }) => {
    if (setPage) {
        return (
            <div className="space-y-2 border-2 border-dashed border-slate-500 bg-white/60 p-2 text-[13px]">
                <label className="block text-xs font-bold">{t('clinical_ui.protocol.page.question', 'Question box (leave empty for none)')}
                    <input type="text" value={page.question || ''} onChange={(e) => setPage('question', e.target.value)} className={`${inputCls} font-bold uppercase mt-0.5`} dir="auto" />
                </label>
                <label className="block text-xs font-bold">{t('clinical_ui.protocol.booklet.ask', 'ASK:')}
                    <LinesEdit value={page.ask} onChange={(v) => setPage('ask', v)} label="ask" className="mt-0.5 font-normal" />
                </label>
                <label className="block text-xs font-bold">{t('clinical_ui.protocol.booklet.look', 'LOOK, LISTEN, FEEL:')}
                    <LinesEdit value={page.look} onChange={(v) => setPage('look', v)} label="look" className="mt-0.5 font-normal" />
                </label>
                <label className="block text-xs font-bold">{t('clinical_ui.protocol.page.note', 'Note')}
                    <textarea rows={4} value={page.note || ''} onChange={(e) => setPage('note', e.target.value)} className={`${inputCls} mt-0.5 italic font-normal`} dir="auto" />
                </label>
            </div>
        );
    }
    return (
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
};

const ClassifyTable = ({ page, categories, drugLabels, edit, t, ar, ctx, setSide }) => {
    const withSide = page.categories.length > 1;
    const sideLabel = (catKey) => page.sideLabels?.[catKey] || (ar ? categories[catKey]?.titleAr || arOf(categories[catKey]?.title || '') : categories[catKey]?.title) || catKey;
    const side = (catKey) => (edit
        ? <textarea rows={3} value={sideLabel(catKey)} onChange={(e) => setSide(catKey, e.target.value)} aria-label={t('clinical_ui.protocol.page.side', 'Side label')} className={`${inputCls} text-xs font-bold text-center`} dir="auto" />
        : sideLabel(catKey));
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
                            <div className="text-xs font-bold uppercase text-slate-700 border-b-2 border-slate-800 pb-0.5">{side(catKey)}</div>
                        )}
                        {rules.map((rule, i) => {
                            const c = rowColor(rule.classification?.color);
                            const cells = RuleCells({ rule, edit, catKey, index: i, drugLabels, t, ar, ctx });
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
                        {withSide && <th className="p-1.5 w-24" />}
                        <th className="p-1.5 text-start w-[30%]">{t('clinical_ui.protocol.booklet.signs', 'Signs')}</th>
                        <th className="p-1.5 w-[22%]">{t('clinical_ui.protocol.booklet.classify', 'Classify as')}</th>
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
                            const cells = RuleCells({ rule, edit, catKey, index: i, drugLabels, t, ar, ctx });
                            return (
                                <tr key={`${catKey}-${rule.id || i}`}>
                                    {withSide && i === 0 && (
                                        <td rowSpan={rules.length} className="border-2 border-slate-800 bg-white p-1.5 text-center text-xs font-bold align-middle">{side(catKey)}</td>
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
        .map(([k, c]) => ({ id: k, title: c.title || k, titleAr: c.titleAr, categories: [k], custom: true }));
    return [...known, ...extra];
};

// `pageIds` limits the view to those booklet pages (one disease tab);
// `heading` is the part's banner, left off when only one page is shown.
export const BookletProtocolView = ({ formType, protocol, doses = [], edit = null, pageIds = null, heading = true }) => {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const categories = protocol?.categories || {};
    const drugLabels = Object.fromEntries((doses || []).map((d) => [d.id, drugText(d, 'label', ar) || d.id]));
    const overrides = protocol?.pages || {};
    const pages = bookletPagesFor(formType, categories)
        .filter((p) => !pageIds || pageIds.includes(p.id))
        .map((p) => ({ ...pageText(p, ar, overrides[p.id]), raw: p }));
    const listId = `treat-lines-${formType}-${ar ? 'ar' : 'en'}`;
    const ctx = edit ? {
        signOpts: signOptions(formType, protocol, ar),
        classOpts: classificationOptions(formType, protocol, ar),
        drugs: doses || [],
        listId,
        suggestions: treatmentSuggestions(formType, protocol, ar),
    } : null;
    // Page wording is saved in protocol.pages[pageId]; Arabic in the …Ar fields.
    const setPage = (page) => (field, value) => {
        // A table added by hand has no booklet page: its title is the table's.
        if (field === 'title' && page.raw.custom) { edit.onCategory(page.raw.categories[0], ar ? 'titleAr' : 'title', value); return; }
        edit.onPage(page.id, ar ? `${field}Ar` : field, value);
    };
    const setSide = (page) => (catKey, value) => {
        const key = ar ? 'sideLabelsAr' : 'sideLabels';
        edit.onPage(page.id, key, { ...(overrides[page.id]?.[key] || {}), [catKey]: value });
    };

    if (!pages.length) {
        return <div className="p-6 text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded">{t('clinical_ui.protocol.booklet.empty', 'This protocol has no classification tables yet.')}</div>;
    }

    return (
        <div className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
            {edit && (
                <datalist id={listId}>
                    {ctx.suggestions.map((s) => <option key={s} value={s} />)}
                </datalist>
            )}
            {heading && <div className="text-center border-2 border-slate-800 bg-white py-2 px-3">
                <div className="font-extrabold uppercase text-slate-900 text-sm md:text-base">
                    {formType === 'infant'
                        ? t('clinical_ui.protocol.booklet.infant_heading', 'Assess, classify and treat the sick young infant, age up to 2 months')
                        : t('clinical_ui.protocol.booklet.child_heading', 'Assess and classify the sick child, age 2 months up to 5 years')}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">{t('clinical_ui.protocol.booklet.use_all', 'Use all boxes that match the symptoms and problems to classify the illness.')}</div>
            </div>}
            {pages.map((page) => {
                const hasPanel = !!(page.ask?.length || page.look?.length || page.question || page.note || edit);
                return (
                    <section key={page.id} className="rounded-sm p-3 md:p-4 shadow-sm border border-amber-200" style={{ background: '#fffbd6' }}>
                        {edit ? (
                            <input type="text" value={page.title || ''} onChange={(e) => setPage(page)('title', e.target.value)} aria-label={t('clinical_ui.protocol.page.title', 'Page title')}
                                className={`${inputCls} mx-auto mb-3 block max-w-2xl text-center font-extrabold uppercase text-sm md:text-base border-2 border-slate-800`} dir="auto" />
                        ) : (
                            <h3 className="mx-auto mb-3 w-fit max-w-full border-2 border-slate-800 bg-white px-4 py-1.5 text-center font-extrabold uppercase tracking-wide text-slate-900 text-sm md:text-base">
                                {page.title}
                            </h3>
                        )}
                        <div className={`grid gap-4 ${hasPanel ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]' : ''}`}>
                            {hasPanel && <AssessPanel page={page} t={t} setPage={edit ? setPage(page) : null} />}
                            <ClassifyTable page={page} categories={categories} drugLabels={drugLabels} edit={edit} t={t} ar={ar} ctx={ctx} setSide={edit ? setSide(page) : null} />
                        </div>
                    </section>
                );
            })}
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
    const pair = (lo, hi) => (layout === 'compact'
        ? <span className="flex flex-col gap-1">{num(lo, '0')}{num(hi, '∞')}</span>
        : <span className="inline-flex items-center gap-1">{num(lo, '0')}–{num(hi, '∞')}</span>);
    const age = edit ? pair('minAge', 'maxAge') : rangeText(r.minAge, r.maxAge, months, t);
    const weight = edit ? pair('minWeight', 'maxWeight') : rangeText(r.minWeight, r.maxWeight, ar ? 'كجم' : 'kg', t);
    const remove = edit && (
        <button type="button" onClick={() => edit.removeRange(drugIndex, k)} className="text-xs font-bold text-red-700 hover:underline">
            {t('clinical_ui.protocol.booklet.remove_band', 'Remove')}
        </button>
    );

    // Phone: Age, Weight and Dose columns (how often and how long under the
    // dose), so nothing scrolls sideways and age never shares a cell with weight.
    if (layout === 'compact') {
        return (
            <tr className={k % 2 ? 'bg-slate-50' : ''}>
                <td className="border border-slate-300 p-1.5 align-top text-xs break-words">{age}</td>
                <td className="border border-slate-300 p-1.5 align-top text-xs break-words">{weight}</td>
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

// `only` is the list of drug indexes to show (one disease tab). Indexes stay
// those of protocol.drugs, since every edit handler works by that index.
export const BookletDoseView = ({ protocol, edit = null, only = null }) => {
    const { t, i18n } = useTranslation();
    const ar = i18n.language === 'ar';
    const all = protocol?.drugs || [];
    const drugs = (only || all.map((_, i) => i)).map((i) => ({ drug: all[i], i })).filter(({ drug }) => drug);
    if (!drugs.length) {
        return <div className="p-6 text-center text-slate-500 bg-white border border-dashed border-slate-300 rounded">{t('clinical_ui.protocol.booklet.no_drugs', 'No doses saved yet.')}</div>;
    }
    const months = t('clinical_ui.protocol.booklet.months', 'months');
    return (
        <div className="grid gap-4 xl:grid-cols-2 items-start" dir={ar ? 'rtl' : 'ltr'}>
            {drugs.map(({ drug, i }) => (
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
                    {/* Phone: Age, Weight, Dose — nothing is cut off or scrolls sideways. */}
                    <table className="md:hidden w-full border-collapse table-fixed text-[13px] text-slate-900">
                        <thead>
                            <tr className="bg-slate-100 text-xs">
                                <th className="border border-slate-400 p-1.5 text-start w-[24%]">{t('clinical_ui.protocol.booklet.age', 'Age')}</th>
                                <th className="border border-slate-400 p-1.5 text-start w-[22%]">{t('clinical_ui.protocol.booklet.weight', 'Weight')}</th>
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


// The same pickers for the advanced rule builder, so signs, classifications
// and doses are chosen the same way on every editing screen.
export { SignsPicker, ClassificationPicker, TreatmentEditor };
/** The lists the pickers choose from, for one part of a protocol. */
export const editorLists = (formType, protocol, ar) => ({
    signOpts: signOptions(formType, protocol, ar),
    classOpts: classificationOptions(formType, protocol, ar),
    suggestions: treatmentSuggestions(formType, protocol, ar),
});
