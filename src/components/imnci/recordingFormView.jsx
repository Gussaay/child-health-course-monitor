// ============================================================================
// RECORDING FORM VIEW
//
// The national register form (sick child or young infant) laid out as it is
// printed: the header lines, then one grey bar per section with its Ask,
// Look, Classify and Treatment cells. English or Arabic, either way round.
// Editing keeps the same layout and turns every cell into a text box.
// ============================================================================
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FORM_PARTS } from './recordingForms';

const inputCls = 'w-full p-1.5 border border-sky-300 rounded bg-sky-50/60 text-[13px] focus:ring-1 focus:ring-sky-500 focus:outline-none';
const toLines = (text) => String(text ?? '').split('\n');
const tidy = (lines) => (lines || []).map((l) => String(l ?? '').trim()).filter(Boolean);

const clone = (v) => JSON.parse(JSON.stringify(v));

const Lines = ({ lines }) => (
    <ul className="space-y-0.5">
        {(lines || []).map((l, i) => <li key={i} className="leading-snug">{l}</li>)}
    </ul>
);

const LinesBox = ({ value, onChange, label, rows }) => (
    <textarea
        value={(value || []).join('\n')}
        onChange={(e) => onChange(toLines(e.target.value))}
        onBlur={(e) => onChange(tidy(toLines(e.target.value)))}
        aria-label={label}
        rows={rows || Math.max(2, (value || []).length + 1)}
        className={inputCls}
        dir="auto"
    />
);

export const RecordingFormView = ({ form, edit = null, onChange }) => {
    const { t, i18n } = useTranslation();
    const [lang, setLang] = useState(i18n.language === 'ar' ? 'ar' : 'en');
    if (!form) return null;
    const side = form[lang] || {};
    const columns = side.columns || {};
    const rtl = lang === 'ar';
    const yes = rtl ? 'نعم' : 'Yes';
    const no = rtl ? 'لا' : 'No';

    const update = (fn) => { const next = clone(form); fn(next); onChange(next); };
    const setTop = (field, value) => update((f) => { f[lang] = { ...(f[lang] || {}), [field]: value }; });
    const setColumn = (part, value) => update((f) => { f[lang] = { ...(f[lang] || {}), columns: { ...(f[lang]?.columns || {}), [part]: value } }; });
    const setCell = (i, field, value) => update((f) => { f.sections[i][lang] = { ...(f.sections[i][lang] || {}), [field]: value }; });
    const setYesNo = (i, value) => update((f) => { f.sections[i].yesNo = value; });
    const removeSection = (i) => update((f) => { f.sections.splice(i, 1); });
    const moveSection = (i, step) => update((f) => {
        const j = i + step;
        if (j < 0 || j >= f.sections.length) return;
        [f.sections[i], f.sections[j]] = [f.sections[j], f.sections[i]];
    });
    const addSection = () => update((f) => {
        const blank = { title: '', ask: [], look: [], classify: [], treat: [] };
        f.sections = [...(f.sections || []), { id: `section_${Date.now().toString(36)}`, yesNo: true, en: { ...blank, title: 'New section' }, ar: { ...blank, title: 'قسم جديد' } }];
    });

    const partLabel = (part) => columns[part] || t(`clinical_ui.protocol.form.col_${part}`, part);
    const cell = (section, i, part) => (edit
        ? <LinesBox value={section[lang]?.[part]} onChange={(v) => setCell(i, part, v)} label={`${section.id} ${part}`} />
        : <Lines lines={section[lang]?.[part]} />);

    const sectionBar = (section, i) => (
        <div className="flex flex-wrap items-center justify-between gap-2">
            {edit
                ? <input type="text" value={section[lang]?.title || ''} onChange={(e) => setCell(i, 'title', e.target.value)} aria-label={`${section.id} title`} className={`${inputCls} font-bold flex-1 min-w-[12rem]`} dir="auto" />
                : <span className="font-bold">{section[lang]?.title}</span>}
            <span className="flex items-center gap-3 text-xs font-bold">
                {edit ? (
                    <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={!!section.yesNo} onChange={(e) => setYesNo(i, e.target.checked)} />
                        {t('clinical_ui.protocol.form.yes_no', 'Asks Yes / No')}
                    </label>
                ) : section.yesNo && <span>{yes} ☐ &nbsp; {no} ☐</span>}
                {edit && (
                    <span className="flex items-center gap-2">
                        <button type="button" onClick={() => moveSection(i, -1)} className="text-slate-700 hover:underline" aria-label={t('clinical_ui.protocol.form.move_up', 'Move up')}>▲</button>
                        <button type="button" onClick={() => moveSection(i, 1)} className="text-slate-700 hover:underline" aria-label={t('clinical_ui.protocol.form.move_down', 'Move down')}>▼</button>
                        <button type="button" onClick={() => removeSection(i)} className="text-red-700 hover:underline">{t('clinical_ui.protocol.form.remove_section', 'Remove section')}</button>
                    </span>
                )}
            </span>
        </div>
    );

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 justify-between">
                <span className="text-xs text-slate-600">{form.version}</span>
                <div className="inline-flex rounded border border-slate-300 overflow-hidden text-xs font-bold" role="group" aria-label={t('clinical_ui.protocol.form.language', 'Form language')}>
                    <button type="button" onClick={() => setLang('en')} className={`px-3 py-1.5 ${lang === 'en' ? 'bg-sky-700 text-white' : 'bg-white text-slate-700'}`}>English</button>
                    <button type="button" onClick={() => setLang('ar')} className={`px-3 py-1.5 ${lang === 'ar' ? 'bg-sky-700 text-white' : 'bg-white text-slate-700'}`}>العربية</button>
                </div>
            </div>

            <div className="border-2 border-slate-800 bg-white rounded-sm text-slate-900 text-[13px]" dir={rtl ? 'rtl' : 'ltr'} lang={lang}>
                <div className="border-b-2 border-slate-800 px-3 py-2 text-center">
                    {edit
                        ? <input type="text" value={side.title || ''} onChange={(e) => setTop('title', e.target.value)} aria-label="title" className={`${inputCls} font-extrabold text-center`} dir="auto" />
                        : <h3 className="font-extrabold text-base">{side.title}</h3>}
                </div>
                <div className="border-b border-slate-400 px-3 py-2 text-xs text-slate-800">
                    {edit ? <LinesBox value={side.header} onChange={(v) => setTop('header', v)} label="header" /> : <Lines lines={side.header} />}
                </div>

                {/* Phone: each section as a card, columns one under another. */}
                <div className="md:hidden">
                    {(form.sections || []).map((section, i) => (
                        <section key={section.id || i} className="border-b border-slate-400">
                            <div className="bg-slate-200 px-3 py-1.5">{sectionBar(section, i)}</div>
                            <div className="divide-y divide-slate-200">
                                {FORM_PARTS.map((part) => ((edit || (section[lang]?.[part] || []).length > 0) && (
                                    <div key={part} className="px-3 py-2">
                                        <div className="text-[11px] font-bold uppercase text-slate-500 mb-0.5">{partLabel(part)}</div>
                                        {cell(section, i, part)}
                                    </div>
                                )))}
                            </div>
                        </section>
                    ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full border-collapse table-fixed">
                        <thead>
                            <tr className="bg-slate-100 text-xs">
                                {FORM_PARTS.map((part) => (
                                    <th key={part} className="border border-slate-400 p-1.5 text-start">
                                        {edit
                                            ? <input type="text" value={columns[part] || ''} onChange={(e) => setColumn(part, e.target.value)} aria-label={`column ${part}`} className={`${inputCls} font-bold`} dir="auto" />
                                            : partLabel(part)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(form.sections || []).map((section, i) => (
                                <React.Fragment key={section.id || i}>
                                    <tr className="bg-slate-200">
                                        <td colSpan={FORM_PARTS.length} className="border border-slate-400 px-2 py-1.5">{sectionBar(section, i)}</td>
                                    </tr>
                                    <tr className="align-top">
                                        {FORM_PARTS.map((part) => (
                                            <td key={part} className="border border-slate-400 p-2">{cell(section, i, part)}</td>
                                        ))}
                                    </tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {edit && (
                    <button type="button" onClick={addSection} className="w-full border-t border-slate-400 py-2 text-xs font-bold text-sky-800 hover:bg-sky-50">
                        + {t('clinical_ui.protocol.form.add_section', 'Add section')}
                    </button>
                )}
                <div className="border-t-2 border-slate-800 px-3 py-2 text-xs text-slate-800">
                    {edit ? <LinesBox value={side.footer} onChange={(v) => setTop('footer', v)} label="footer" /> : <Lines lines={side.footer} />}
                </div>
            </div>
        </div>
    );
};

export default RecordingFormView;
