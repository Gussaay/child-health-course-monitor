// ============================================================================
// TREATMENT AND COUNSELLING VIEW
//
// The booklet's treat, counsel and follow-up boxes for one part (sick child or
// young infant): a row of headings (vaccination, inhalers, local treatment,
// fluids, counselling, follow-up), then each box with its steps and table.
// Tables wrap their text instead of scrolling sideways, and with more than
// three columns become one card per row on a phone. Editing keeps the layout.
// ============================================================================
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const inputCls = 'w-full p-1.5 border border-sky-300 rounded bg-sky-50/60 text-[13px] focus:ring-1 focus:ring-sky-500 focus:outline-none';
const clone = (v) => JSON.parse(JSON.stringify(v));
const toLines = (text) => String(text ?? '').split('\n');
const tidy = (lines) => (lines || []).map((l) => String(l ?? '').trim()).filter(Boolean);

const GROUP_COLORS = {
    vaccination: 'bg-emerald-100 border-emerald-700',
    inhaler: 'bg-sky-100 border-sky-700',
    local: 'bg-amber-100 border-amber-700',
    fluids: 'bg-cyan-100 border-cyan-700',
    counsel: 'bg-violet-100 border-violet-700',
    followup: 'bg-rose-100 border-rose-700',
};

const LinesBox = ({ value, onChange, label }) => (
    <textarea
        value={(value || []).join('\n')}
        onChange={(e) => onChange(toLines(e.target.value))}
        onBlur={(e) => onChange(tidy(toLines(e.target.value)))}
        aria-label={label}
        rows={Math.max(2, (value || []).length + 1)}
        className={inputCls}
        dir="auto"
    />
);

const GuideTable = ({ side, edit, setColumn, setCell, addRow, removeRow, t }) => {
    const columns = side.columns || [];
    const rows = side.rows || [];
    const cell = (r, c) => (edit
        ? <textarea value={rows[r]?.[c] ?? ''} onChange={(e) => setCell(r, c, e.target.value)} aria-label={`row ${r + 1} column ${c + 1}`} rows={2} className={inputCls} dir="auto" />
        : rows[r]?.[c]);
    const wide = columns.length > 3;
    const table = (
        <table className="w-full border-collapse table-fixed text-[13px]">
            <thead>
                <tr className="bg-slate-100 text-xs">
                    {columns.map((col, c) => (
                        <th key={c} className="border border-slate-400 p-1.5 text-start align-bottom break-words">
                            {edit ? <input type="text" value={col} onChange={(e) => setColumn(c, e.target.value)} aria-label={`column ${c + 1}`} className={`${inputCls} font-bold`} dir="auto" /> : col}
                        </th>
                    ))}
                    {edit && <th className="border border-slate-400 p-1 w-12" />}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, r) => (
                    <tr key={r} className={r % 2 ? 'bg-slate-50' : ''}>
                        {columns.map((_, c) => <td key={c} className={`border border-slate-300 p-1.5 align-top break-words ${c === 0 ? 'font-bold' : ''}`}>{cell(r, c)}</td>)}
                        {edit && (
                            <td className="border border-slate-300 p-1 text-center align-top">
                                <button type="button" onClick={() => removeRow(r)} className="text-xs font-bold text-red-700 hover:underline">{t('clinical_ui.protocol.booklet.remove_band', 'Remove')}</button>
                            </td>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
    );
    return (
        <div>
            {wide ? (
                <>
                    <div className="md:hidden divide-y divide-slate-300 border border-slate-300">
                        {rows.map((row, r) => (
                            <div key={r} className="p-2 space-y-1 text-[13px]">
                                {columns.map((col, c) => (
                                    <div key={c}><span className="text-[11px] font-bold text-slate-500">{col}: </span>{cell(r, c)}</div>
                                ))}
                                {edit && <button type="button" onClick={() => removeRow(r)} className="text-xs font-bold text-red-700 hover:underline">{t('clinical_ui.protocol.booklet.remove_band', 'Remove')}</button>}
                            </div>
                        ))}
                    </div>
                    <div className="hidden md:block">{table}</div>
                </>
            ) : table}
            {edit && (
                <button type="button" onClick={addRow} className="mt-1 text-xs font-bold text-sky-800 hover:underline">
                    + {t('clinical_ui.protocol.guide.add_row', 'Add row')}
                </button>
            )}
        </div>
    );
};

export const TreatmentGuideView = ({ guide, edit = null, onChange }) => {
    const { t, i18n } = useTranslation();
    const [lang, setLang] = useState(i18n.language === 'ar' ? 'ar' : 'en');
    const groups = guide?.groups || [];
    const [active, setActive] = useState(groups[0]?.id || '');
    if (!guide) return null;
    const rtl = lang === 'ar';
    const gi = Math.max(0, groups.findIndex((g) => g.id === active));
    const current = groups[gi];

    const update = (fn) => { const next = clone(guide); fn(next); onChange(next); };
    const onBlock = (bi, fn) => update((g) => {
        const b = g.groups[gi].blocks[bi];
        b[lang] = b[lang] || {};
        fn(b, b[lang]);
    });
    // Rows and columns are added on both language sides together, so the
    // English and Arabic tables never fall out of step.
    const bothSides = (b, fn) => ['en', 'ar'].forEach((l) => { b[l] = b[l] || {}; fn(b[l]); });

    const addBlock = () => update((g) => {
        g.groups[gi].blocks.push({ id: `box_${Date.now().toString(36)}`, en: { title: 'New box', lines: [] }, ar: { title: 'مربع جديد', lines: [] } });
    });
    const removeBlock = (bi) => update((g) => { g.groups[gi].blocks.splice(bi, 1); });
    const addTable = (bi) => onBlock(bi, (b) => bothSides(b, (s) => {
        s.columns = s.columns?.length ? s.columns : ['', ''];
        s.rows = [...(s.rows || []), s.columns.map(() => '')];
    }));

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('clinical_ui.protocol.guide.headings', 'Headings')} dir={rtl ? 'rtl' : 'ltr'}>
                    {groups.map((g) => (
                        <button key={g.id} type="button" role="tab" aria-selected={g.id === current?.id} onClick={() => setActive(g.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${g.id === current?.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
                            {g[lang]?.title || g.en?.title}
                        </button>
                    ))}
                </div>
                <div className="inline-flex rounded border border-slate-300 overflow-hidden text-xs font-bold" role="group" aria-label={t('clinical_ui.protocol.form.language', 'Form language')}>
                    <button type="button" onClick={() => setLang('en')} className={`px-3 py-1.5 ${lang === 'en' ? 'bg-sky-700 text-white' : 'bg-white text-slate-700'}`}>English</button>
                    <button type="button" onClick={() => setLang('ar')} className={`px-3 py-1.5 ${lang === 'ar' ? 'bg-sky-700 text-white' : 'bg-white text-slate-700'}`}>العربية</button>
                </div>
            </div>

            {current && (
                <div className="space-y-4" dir={rtl ? 'rtl' : 'ltr'} lang={lang}>
                    {edit ? (
                        <input type="text" value={current[lang]?.title || ''} aria-label="heading"
                            onChange={(e) => update((g) => { g.groups[gi][lang] = { ...(g.groups[gi][lang] || {}), title: e.target.value }; })}
                            className={`${inputCls} font-extrabold text-base`} dir="auto" />
                    ) : (
                        <h3 className="text-center font-extrabold uppercase text-slate-900 border-2 border-slate-800 bg-white py-2 px-3 text-sm md:text-base">{current[lang]?.title}</h3>
                    )}
                    <div className="grid gap-4 xl:grid-cols-2 items-start">
                        {(current.blocks || []).map((b, bi) => {
                            const s = b[lang] || {};
                            const hasTable = (s.columns || []).length > 0;
                            return (
                                <section key={b.id || bi} className="border-2 border-slate-800 bg-white rounded-sm overflow-hidden text-slate-900">
                                    <div className={`border-b-2 px-3 py-1.5 ${GROUP_COLORS[current.id] || 'bg-slate-100 border-slate-800'}`}>
                                        {edit ? (
                                            <div className="flex items-center gap-2">
                                                <input type="text" value={s.title || ''} onChange={(e) => onBlock(bi, (_b, side) => { side.title = e.target.value; })} aria-label={`${b.id} title`} className={`${inputCls} font-extrabold`} dir="auto" />
                                                <button type="button" onClick={() => removeBlock(bi)} className="text-xs font-bold text-red-700 hover:underline shrink-0">{t('clinical_ui.protocol.guide.remove_box', 'Remove box')}</button>
                                            </div>
                                        ) : <h4 className="font-extrabold text-sm">{s.title}</h4>}
                                    </div>
                                    <div className="p-2.5 space-y-2.5 text-[13px]">
                                        {edit
                                            ? <LinesBox value={s.lines} onChange={(v) => onBlock(bi, (_b, side) => { side.lines = v; })} label={`${b.id} lines`} />
                                            : (s.lines || []).length > 0 && (
                                                <ul className="space-y-1">
                                                    {s.lines.map((l, k) => <li key={k} className="flex gap-1.5 leading-snug"><span className="text-slate-500 shrink-0">►</span><span>{l}</span></li>)}
                                                </ul>
                                            )}
                                        {hasTable && (
                                            <GuideTable
                                                side={s}
                                                edit={edit}
                                                t={t}
                                                setColumn={(c, v) => onBlock(bi, (_b, side) => { side.columns[c] = v; })}
                                                setCell={(r, c, v) => onBlock(bi, (_b, side) => { side.rows[r][c] = v; })}
                                                addRow={() => onBlock(bi, (blk) => bothSides(blk, (sd) => { sd.rows = [...(sd.rows || []), (sd.columns || []).map(() => '')]; }))}
                                                removeRow={(r) => onBlock(bi, (blk) => bothSides(blk, (sd) => { (sd.rows || []).splice(r, 1); }))}
                                            />
                                        )}
                                        {edit && !hasTable && (
                                            <button type="button" onClick={() => addTable(bi)} className="text-xs font-bold text-sky-800 hover:underline">
                                                + {t('clinical_ui.protocol.guide.add_table', 'Add a table')}
                                            </button>
                                        )}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                    {edit && (
                        <button type="button" onClick={addBlock} className="w-full border-2 border-dashed border-slate-300 rounded py-2 text-xs font-bold text-sky-800 hover:bg-sky-50">
                            + {t('clinical_ui.protocol.guide.add_box', 'Add box')}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default TreatmentGuideView;
