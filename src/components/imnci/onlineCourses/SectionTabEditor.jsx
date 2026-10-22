// src/components/imnci/onlineCourses/SectionTabEditor.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Stethoscope, Film } from 'lucide-react';
import { ref as storageRef, getDownloadURL, uploadBytes } from 'firebase/storage';
import { Button, Modal, Input, Select, Textarea } from '../../CommonComponents';
import { notify } from '../../dialogs';
import { storage } from '../../../firebase';
import { upsertOnlineCourseItem } from '../../../data';
import { IMNCI_SEVERITIES } from '../../constants';
import { SECTION_TABS, tabContent, newQuestion, newExerciseLink, blockHtml } from '../book';
import { RichTextEditor, useImnci } from '../shared';
import { ASSET_ROOT } from './assets';
import { BookImage, VideoBlock } from './blocks';

// =============================================================================
// Book manager
//
// This is what makes automatic conversion safe to use. The parser gets the
// prose right and the headings right, but the classification tables in these
// books are drawn as vector graphics — roughly 7,800 path operations in module
// 2 — so their grid and their colour do not survive extraction even though the
// cell text does. In IMCI that colour is clinical meaning, not decoration.
//
// So rather than pretending the converter is perfect, a federal manager can
// open any converted section and fix it: correct the text, drop what came
// through as noise, and build the classification tables properly with their
// pink, yellow and green rows.
// =============================================================================

// One tab of one section. Each tab is edited on its own: correcting the prose
// against the book and building the practice cases are different jobs, often
// done by different people, and neither should be able to lose the other's work
// by saving a whole section at once.
// A section tab, written as one document.
//
// It used to be one editor per paragraph. With a converted book that is thirty
// contentEditable elements on a page, each re-writing its own innerHTML on every
// change, and typing in it crawled. It also made no sense as a writing surface:
// a paragraph break is something you make by pressing Enter, not by pressing a
// button called "add block".
//
// So the flowing content — text, lists, pictures, charts — is one document, and
// only the things that are not prose keep a card of their own: a video, a
// question, a link to a case, a captured book page.
const STRUCTURED = ['video', 'question', 'exercise', 'page'];

export function SectionTabEditor({ section, tab = 'read', onSaved, onCancel }) {
    const { t, i18n } = useTranslation();
    const [html, setHtml] = useState('');
    const [extras, setExtras] = useState([]);
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const [charting, setCharting] = useState(false);
    const meta = SECTION_TABS.find((x) => x.id === tab) || SECTION_TABS[0];
    const tabLabel = i18n.language === 'ar' && meta.labelAr ? meta.labelAr : meta.label;
    const { exercises } = useImnci();
    const insertRef = useRef(null);

    useEffect(() => {
        if (!section) return;
        const content = tabContent(section, tab);
        // Everything that can be expressed as text becomes one document; the
        // rest keeps its card. Joined in the order it was already in, so a
        // figure that sat between two paragraphs stays between them.
        const doc = content
            .filter((b) => !STRUCTURED.includes(b.type))
            .map((b) => blockHtml(b))
            .filter(Boolean)
            .join('\n');
        setHtml(doc);
        setExtras(JSON.parse(JSON.stringify(content.filter((b) => STRUCTURED.includes(b.type)))));
        setTitle(section.title || '');
    }, [section, tab]);

    const updateExtra = (i, patch) => setExtras((p) => p.map((b, j) => (j === i ? { ...b, ...patch } : b)));
    const removeExtra = (i) => setExtras((p) => p.filter((_, j) => j !== i));
    const addExtra = (type) => setExtras((p) => [...p, (
        type === 'question' ? newQuestion()
            : type === 'exercise' ? newExerciseLink()
                : { type: 'video', url: '', caption: '' }
    )]);

    // Uploads and hands back a URL, because a picture in the text goes straight
    // into an <img> rather than resolving a storage path when it renders.
    const uploadInline = async (file) => {
        if (!file || !section?.id) return null;
        try {
            const clean = file.name.replace(/[^\w.-]+/g, '-');
            const path = `${ASSET_ROOT}/figures/${section.courseId}/${section.id}/${Date.now()}-${clean}`;
            const dest = storageRef(storage, path);
            await uploadBytes(dest, file, { contentType: file.type });
            return await getDownloadURL(dest);
        } catch (e) {
            console.error('Could not upload the image:', e);
            notify(t('imnci_ui.courses.editor.upload_failed', 'Could not upload that image. {{msg}}', { msg: e?.message || '' }).trim(), 'error');
            return null;
        }
    };

    const save = async () => {
        setSaving(true);
        try {
            const words = String(html).replace(/<[^>]*>/g, '').trim();
            const body = words || /<img|<table/i.test(html)
                ? [{ type: 'rich', text: html }]
                : [];

            const kept = extras.filter((b) => (
                b.type === 'video' ? String(b.url || '').trim() : true
            ));

            // Caught here rather than saved and met by a learner: a question
            // with one answer to choose from is not a question, and a card that
            // points at no case is a dead end.
            const problem = kept.find((b) => (
                b.type === 'question'
                    ? (b.options || []).filter((o) => String(o).trim()).length < 2
                    : b.type === 'exercise' ? !b.exerciseId : false
            ));
            if (problem) {
                notify(problem.type === 'exercise'
                    ? t('imnci_ui.courses.editor.choose_case', 'Choose which case the card points at.')
                    : t('imnci_ui.courses.editor.two_answers', 'Each question needs at least two answers to choose from.'), 'error');
                setSaving(false);
                return;
            }

            // Sections written before the tabs existed keep their text in
            // `blocks`. Saving the Read tab moves it across and empties the old
            // field, so a section is migrated the first time someone edits it
            // and nothing has to be rewritten in bulk.
            const patch = { ...section, title: title.trim(), [tab]: [...body, ...kept] };
            if (tab === 'read' && section.blocks?.length) patch.blocks = [];
            await upsertOnlineCourseItem(patch);
            notify(t('imnci_ui.courses.editor.tab_saved', '{{tab}} saved.', { tab: tabLabel }), 'success');
            onSaved();
        } catch (e) {
            console.error('Could not save the section:', e);
            notify(t('imnci_ui.courses.editor.save_failed', 'Could not save. {{msg}}', { msg: e?.message || '' }).trim(), 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!section) return null;

    return (
        <div className="space-y-4">
            {/* Editing happens on the page the text is read on, at the width it
                will be read at. It used to be a dialog, which meant writing a
                paragraph in a box half the size of the page it appears on. */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 sticky top-2 z-20">
                <span className="text-sm text-amber-900 font-semibold">
                    {t('imnci_ui.courses.editor.editing', 'Editing {{tab}}', { tab: tabLabel })}
                </span>
                <span className="flex gap-2">
                    <Button variant="secondary" onClick={onCancel} disabled={saving}>{t('imnci_ui.courses.common.cancel', 'Cancel')}</Button>
                    <Button onClick={save} disabled={saving}>{saving ? t('imnci_ui.courses.common.saving', 'Saving…') : t('imnci_ui.courses.common.save', 'Save')}</Button>
                </span>
            </div>

            <Input label={t('imnci_ui.courses.editor.section_title', 'Section title')} value={title} onChange={(e) => setTitle(e.target.value)} />

            <RichTextEditor
                value={html}
                onChange={setHtml}
                onInsertImage={uploadInline}
                onInsertChart={() => setCharting(true)}
                registerInsert={(fn) => { insertRef.current = fn; }}
                placeholder={t('imnci_ui.courses.editor.placeholder', 'Write the {{tab}} text here. Press Enter for a new paragraph.', { tab: tabLabel.toLowerCase() })}
                className="min-h-[24rem]"
            />

            <ChartBuilderModal
                isOpen={charting}
                onClose={() => setCharting(false)}
                onInsert={(tableHtml) => { insertRef.current?.(tableHtml); setCharting(false); }}
            />

            {/* Everything that is not prose. A question is a set of fields, not
                a paragraph, so it keeps a card rather than being typed into the
                text as markup nobody can see. */}
            <div className="space-y-2">
                {extras.map((b, i) => (
                    <div key={i} className="border rounded-lg p-3 bg-white space-y-2">
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono text-slate-500 flex-1">{b.type}</span>
                            <button onClick={() => removeExtra(i)}
                                className="px-1.5 py-0.5 border rounded text-red-600 hover:bg-red-50">
                                <Trash2 size={12} />
                            </button>
                        </div>

                        {b.type === 'page' && (
                            <div className="text-xs text-slate-500">
                                {t('imnci_ui.courses.editor.page_captured', 'Page {{page}} of the book, captured when it was converted.', { page: b.page })}
                                <BookImage block={b} />
                            </div>
                        )}

                        {b.type === 'video' && (
                            <div className="space-y-2">
                                <Input label={t('imnci_ui.courses.editor.video_address', 'Video address')} value={b.url || ''}
                                    placeholder={t('imnci_ui.courses.editor.video_placeholder', 'https://www.youtube.com/watch?v=… or a link to an MP4')}
                                    onChange={(e) => updateExtra(i, { url: e.target.value })} />
                                <Input label={t('imnci_ui.courses.editor.caption', 'Caption')} value={b.caption || ''}
                                    onChange={(e) => updateExtra(i, { caption: e.target.value })} />
                                {b.url && <VideoBlock block={b} />}
                            </div>
                        )}

                        {b.type === 'exercise' && (
                            <div className="space-y-2">
                                <Select label={t('imnci_ui.courses.editor.which_case', 'Which case')} value={b.exerciseId || ''} disabled={!exercises}
                                    onChange={(e) => updateExtra(i, { exerciseId: e.target.value })}>
                                    <option value="">{exercises ? t('imnci_ui.courses.editor.choose_a_case', '— choose a case —') : t('imnci_ui.courses.editor.loading_cases', 'Loading the cases…')}</option>
                                    {(exercises || []).map((ex) => (
                                        <option key={ex.id} value={ex.id}>
                                            {ex.title}{ex.draft ? t('imnci_ui.courses.editor.draft_suffix', ' (draft)') : ''}
                                        </option>
                                    ))}
                                </Select>
                                <p className="text-xs text-slate-500">
                                    {t('imnci_ui.courses.editor.cases_written', 'Cases are written in the case builder, from Manage mode.')}
                                </p>
                                <Input label={t('imnci_ui.courses.editor.why_here', 'Why it is here (optional)')} value={b.note || ''}
                                    onChange={(e) => updateExtra(i, { note: e.target.value })} />
                            </div>
                        )}

                        {b.type === 'question' && (
                            <div className="space-y-2">
                                <Textarea rows={2} value={b.text || ''} placeholder={t('imnci_ui.courses.editor.the_question', 'The question')}
                                    onChange={(e) => updateExtra(i, { text: e.target.value })} />
                                {(b.options || []).map((opt, oi) => (
                                    <div key={oi} className="flex gap-2 items-center">
                                        <input type="radio" name={`ans-${i}`} checked={(b.answer ?? 0) === oi}
                                            onChange={() => updateExtra(i, { answer: oi })} title={t('imnci_ui.courses.editor.correct_answer', 'The correct answer')} />
                                        <input value={opt} placeholder={t('imnci_ui.courses.editor.answer_n', 'Answer {{letter}}', { letter: String.fromCharCode(97 + oi) })}
                                            onChange={(e) => updateExtra(i, {
                                                options: b.options.map((x, k) => (k === oi ? e.target.value : x)),
                                            })} className="flex-1 border rounded px-2 py-1 text-sm" />
                                        <button disabled={(b.options || []).length <= 2}
                                            onClick={() => updateExtra(i, {
                                                options: b.options.filter((_, k) => k !== oi),
                                                answer: (b.answer ?? 0) > oi ? (b.answer ?? 0) - 1
                                                    : Math.min(b.answer ?? 0, b.options.length - 2),
                                            })} className="px-2 border rounded text-red-600 disabled:opacity-30">−</button>
                                    </div>
                                ))}
                                <button onClick={() => updateExtra(i, { options: [...(b.options || []), ''] })}
                                    className="text-xs text-sky-700 font-semibold">{t('imnci_ui.courses.editor.add_answer', '+ add answer')}</button>
                                <Input label={t('imnci_ui.courses.editor.why_after', 'Why (shown after answering)')} value={b.explanation || ''}
                                    onChange={(e) => updateExtra(i, { explanation: e.target.value })} />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t">
                <span className="text-xs text-slate-500 self-center">{t('imnci_ui.courses.editor.add_below', 'Add below the text:')}</span>
                {tab === 'practise' && (
                    <>
                        <button onClick={() => addExtra('question')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded hover:bg-slate-50 hover:border-sky-300">
                            <Plus size={13} /> {t('imnci_ui.courses.editor.question', 'Question')}
                        </button>
                        <button onClick={() => addExtra('exercise')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded hover:bg-slate-50 hover:border-sky-300">
                            <Stethoscope size={13} /> {t('imnci_ui.courses.editor.link_case', 'Link a case')}
                        </button>
                    </>
                )}
                {tab !== 'practise' && (
                    <button onClick={() => addExtra('video')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border rounded hover:bg-slate-50 hover:border-sky-300">
                        <Film size={13} /> {t('imnci_ui.courses.video.video', 'Video')}
                    </button>
                )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="secondary" onClick={onCancel} disabled={saving}>{t('imnci_ui.courses.common.cancel', 'Cancel')}</Button>
                <Button onClick={save} disabled={saving}>{saving ? t('imnci_ui.courses.common.saving', 'Saving…') : t('imnci_ui.courses.editor.save_tab', 'Save {{tab}}', { tab: tabLabel })}</Button>
            </div>
        </div>
    );
}

// Builds a classification chart and hands back the HTML for it, so it can be
// dropped into the text where it belongs rather than living in a separate list
// underneath. The colours are IMNCI_SEVERITIES, written as inline style so the
// chart keeps its meaning wherever the HTML ends up.
export function ChartBuilderModal({ isOpen, onClose, onInsert }) {
    const { t, i18n } = useTranslation();
    const [rows, setRows] = useState([{ colour: 'note', cells: ['', '', ''] }]);
    const [headers, setHeaders] = useState(['Signs', 'Classify as', 'Treatment']);

    useEffect(() => {
        if (isOpen) {
            setRows([{ colour: 'note', cells: ['', '', ''] }]);
            setHeaders(['Signs', 'Classify as', 'Treatment']);
        }
    }, [isOpen]);

    const setCell = (ri, ci, v) => setRows((p) => p.map((r, i) => (
        i === ri ? { ...r, cells: r.cells.map((c, k) => (k === ci ? v : c)) } : r)));
    const addRow = () => setRows((p) => [...p, { colour: 'note', cells: headers.map(() => '') }]);
    const addColumn = () => {
        setHeaders((h) => [...h, '']);
        setRows((p) => p.map((r) => ({ ...r, cells: [...r.cells, ''] })));
    };

    const build = () => {
        const esc = (s) => String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const head = headers.some((h) => h.trim())
            ? `<tr>${headers.map((h) => `<th style="background-color: #e2e8f0; padding: 6px">${esc(h)}</th>`).join('')}</tr>`
            : '';
        const body = rows.map((r) => {
            const tone = CHART_TONES[r.colour] || CHART_TONES.note;
            return `<tr>${r.cells.map((c) => (
                `<td style="background-color: ${tone.bg}; color: ${tone.fg}; padding: 6px">${esc(c)}</td>`
            )).join('')}</tr>`;
        }).join('');
        onInsert(`<table style="width: 100%">${head}${body}</table><p><br></p>`);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('imnci_ui.courses.chart.title', 'Build a classification chart')}>
            <div className="space-y-3">
                <p className="text-sm text-slate-600">
                    {t('imnci_ui.courses.chart.intro', 'The row colour is the classification colour — the same one the protocol and the exercises use — so a pink row here means at the bedside what it means here.')}
                </p>

                <div className="flex gap-1">
                    <span className="w-32 shrink-0 text-xs text-slate-500 self-center">{t('imnci_ui.courses.chart.headings', 'Headings')}</span>
                    {headers.map((h, i) => (
                        <input key={i} value={h} onChange={(e) => setHeaders(
                            (p) => p.map((x, k) => (k === i ? e.target.value : x)))}
                            className="flex-1 border rounded px-2 py-1 text-sm font-semibold" />
                    ))}
                </div>

                {rows.map((r, ri) => (
                    <div key={ri} className="flex gap-1 items-start">
                        <select value={r.colour}
                            onChange={(e) => setRows((p) => p.map((x, i) => (
                                i === ri ? { ...x, colour: e.target.value } : x)))}
                            className="border rounded text-xs p-1 w-32 shrink-0">
                            {IMNCI_SEVERITIES.map((c) => <option key={c.id} value={c.id}>{i18n.language === 'ar' && c.labelAr ? c.labelAr : c.label}</option>)}
                        </select>
                        {r.cells.map((c, ci) => (
                            <input key={ci} value={c} onChange={(e) => setCell(ri, ci, e.target.value)}
                                className="flex-1 border rounded px-2 py-1 text-sm" />
                        ))}
                        <button onClick={() => setRows((p) => p.filter((_, i) => i !== ri))}
                            disabled={rows.length <= 1}
                            className="px-2 border rounded text-red-600 shrink-0 disabled:opacity-30">−</button>
                    </div>
                ))}

                <div className="flex gap-3">
                    <button onClick={addRow} className="text-xs text-sky-700 font-semibold">{t('imnci_ui.courses.chart.add_row', '+ row')}</button>
                    <button onClick={addColumn} className="text-xs text-sky-700 font-semibold">{t('imnci_ui.courses.chart.add_column', '+ column')}</button>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose}>{t('imnci_ui.courses.common.cancel', 'Cancel')}</Button>
                    <Button onClick={build}>{t('imnci_ui.courses.chart.insert', 'Insert the chart')}</Button>
                </div>
            </div>
        </Modal>
    );
}

// The severity colours as plain values. The renderer uses Tailwind classes for
// them, but a chart built here is stored as HTML that has to carry its own
// colour, because it may be read anywhere the stylesheet is not.
const CHART_TONES = {
    severe: { bg: '#ffe4e6', fg: '#881337' },
    moderate: { bg: '#fef3c7', fg: '#78350f' },
    mild: { bg: '#d1fae5', fg: '#064e3b' },
    note: { bg: '#ffffff', fg: '#0f172a' },
};
