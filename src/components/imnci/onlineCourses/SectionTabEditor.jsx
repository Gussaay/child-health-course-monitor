// src/components/imnci/onlineCourses/SectionTabEditor.jsx
//
// The lesson editor.
//
// A lesson is shown the way the learner sees it, one element after another:
// text, videos, questions, flip cards and the rest. Tap an element to choose
// it; text is then written in place, and anything else opens its own form,
// with a named box for every field and one box per item of a list (a card, a
// step, an answer), and a "Learner sees" preview under it. "+" between two
// elements adds a new one there. Lines between elements show where the lesson
// is split into parts: what follows an activity opens when it is done.
//
// It replaces an editor where the whole lesson was one block of rich text with
// "[[card c3]]" markers in it, and every list was typed as lines split by
// " | ". The saved lesson is the same list of blocks either way (see
// editor/model.js), so lessons, learners' progress and the exercise manager
// are not affected.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ArrowUp, ArrowDown, Copy, Trash2, Pencil, Eye, EyeOff, Lock, X } from 'lucide-react';
import { ref as storageRef, getDownloadURL, uploadBytes } from 'firebase/storage';
import { Button, Modal } from '../../CommonComponents';
import { notify, confirmDialog } from '../../dialogs';
import { storage } from '../../../firebase';
import { upsertOnlineCourseItem } from '../../../data';
import { IMNCI_SEVERITIES } from '../../constants';
import { signOptions, classificationOptions, treatmentSuggestions } from '../standardLists';
import { liveProtocol, SEVERITY_OF_COLOR } from '../vocabulary';
import { SECTION_TABS, tabContent, sectionContent, isActivity } from '../book';
import { RichTextEditor } from '../shared';
import { ASSET_ROOT } from './assets';
import { ContentBlocks } from './blocks';
import { ELEMENTS, GROUPS, elementInfo, newElement } from './editor/elements';
import { toElements, fromElements, findProblem, partBreaks, withKey, isEmptyElement } from './editor/model';
import { ElementForm } from './editor/forms';

const PROBLEMS = {
    two_answers: ['imnci_ui.courses.editor.two_answers', 'Each question needs at least two answers to choose from.'],
    question_text: ['imnci_ui.courses.editor2.need_question', 'Write the question.'],
    choose_case: ['imnci_ui.courses.editor.choose_case', 'Choose which case the card points at.'],
    choose_tables: ['imnci_ui.courses.editor.choose_tables', 'Tick at least one chart booklet table.'],
    empty_cards: ['imnci_ui.courses.editor2.need_card', 'Write the front of at least one card.'],
};

// What the learner sees of one element. Clicks are kept for the editor, so
// tapping a question chooses it rather than answering it.
function LearnerLook({ block }) {
    const blocks = useMemo(() => fromElements([block]), [block]);
    if (!blocks.length) return null;
    return (
        <div className="pointer-events-none select-none [&_iframe]:pointer-events-none" aria-hidden="true">
            <ContentBlocks blocks={blocks} />
        </div>
    );
}

function AddPoint({ onAdd, label }) {
    return (
        <div className="relative h-7 flex items-center justify-center group">
            <span className="absolute inset-x-6 top-1/2 h-px bg-transparent group-hover:bg-sky-200" aria-hidden="true" />
            <button type="button" onClick={onAdd} aria-label={label} title={label}
                className="relative w-7 h-7 rounded-full grid place-items-center border border-dashed border-slate-300 bg-white text-slate-400 hover:border-sky-500 hover:text-sky-700 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-500">
                <Plus size={15} />
            </button>
        </div>
    );
}

function PartLine({ n, after, t }) {
    return (
        <div className="flex items-center gap-2 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400" data-testid="part-line">
            <Lock size={12} />
            <span>{t('imnci_ui.courses.editor2.part_n', 'Part {{n}}', { n })}</span>
            {after && <span className="normal-case tracking-normal font-medium">· {t('imnci_ui.courses.editor2.opens_after', 'opens when the {{what}} above is done', { what: after.toLowerCase() })}</span>}
            <span className="flex-1 h-px bg-slate-200" aria-hidden="true" />
        </div>
    );
}

// The "Add" menu: every kind of element, grouped by what it is for.
function AddMenu({ isOpen, onClose, onPick, t }) {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('imnci_ui.courses.editor2.add_title', 'Add to the lesson')}>
            <div className="space-y-4">
                {GROUPS.map(([group, label]) => (
                    <div key={group}>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">{t(`imnci_ui.courses.editor2.group_${group}`, label)}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {ELEMENTS.filter((e) => e[3] === group).map(([kind, name, Icon, , desc]) => (
                                <button key={kind} type="button" onClick={() => onPick(kind)} data-testid={`add-${kind}`}
                                    className="flex items-start gap-2.5 text-start rounded-xl border border-slate-200 bg-white p-2.5 hover:border-sky-400 hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-500">
                                    <span className={`w-8 h-8 shrink-0 rounded-lg grid place-items-center ${group === 'check' || group === 'practise' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}><Icon size={16} /></span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-slate-800">{t(`imnci_ui.courses.editor2.el_${kind}`, name)}</span>
                                        <span className="block text-xs text-slate-500 leading-snug">{t(`imnci_ui.courses.editor2.el_${kind}_desc`, desc)}</span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
}

// The form for one element, with what the learner will see under it.
function EditSheet({ draft, setDraft, onDone, onCancel, uploadPicture, t }) {
    if (!draft) return null;
    const info = elementInfo(draft);
    return (
        <Modal isOpen onClose={onCancel} title={t('imnci_ui.courses.editor2.edit_title', 'Edit: {{name}}', { name: t(`imnci_ui.courses.editor2.el_${info.kind}`, info.name) })}>
            <div className="space-y-4" data-testid="edit-sheet">
                <ElementForm block={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} uploadPicture={uploadPicture} />
                {!isEmptyElement(draft) && (
                    <div className="border-t pt-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{t('imnci_ui.courses.editor2.learner_sees', 'Learner sees')}</div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <LearnerLook block={draft} />
                        </div>
                    </div>
                )}
                <div className="sticky bottom-0 -mx-4 -mb-4 px-4 py-3 bg-white border-t flex justify-end gap-2">
                    <Button variant="secondary" onClick={onCancel}>{t('imnci_ui.courses.common.cancel', 'Cancel')}</Button>
                    <Button onClick={onDone}>{t('imnci_ui.courses.editor2.done', 'Done')}</Button>
                </div>
            </div>
        </Modal>
    );
}

export function SectionTabEditor({ section, tab = 'all', onSaved, onCancel }) {
    const { t, i18n } = useTranslation();
    const [elements, setElements] = useState([]);
    const [title, setTitle] = useState('');
    const [selected, setSelected] = useState(null);
    const [adding, setAdding] = useState(null);
    const [editing, setEditing] = useState(null);
    const [draft, setDraft] = useState(null);
    const [preview, setPreview] = useState(false);
    const [saving, setSaving] = useState(false);
    const [charting, setCharting] = useState(false);
    const [changed, setChanged] = useState(false);
    const insertRef = useRef(null);
    // 'all' is the whole lesson on one page; a tab id edits that tab only
    // (kept for sections still written with tabs).
    const whole = tab === 'all';
    const meta = SECTION_TABS.find((x) => x.id === tab) || SECTION_TABS[0];
    const tabLabel = whole ? t('imnci_ui.courses.editor2.the_lesson', 'lesson')
        : i18n.language === 'ar' && meta.labelAr ? meta.labelAr : meta.label;

    useEffect(() => {
        if (!section) return;
        setElements(toElements(whole ? sectionContent(section) : tabContent(section, tab)));
        setTitle(section.title || '');
        setSelected(null);
        setChanged(false);
    }, [section, tab, whole]);

    const update = (fn) => { setElements(fn); setChanged(true); };
    const indexOf = (k) => elements.findIndex((b) => b._k === k);
    const nameOf = (b) => { const info = elementInfo(b); return t(`imnci_ui.courses.editor2.el_${info.kind}`, info.name); };

    const move = (k, by) => update((list) => {
        const i = list.findIndex((b) => b._k === k);
        const j = i + by;
        if (i < 0 || j < 0 || j >= list.length) return list;
        const next = [...list];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
    });
    const duplicate = (k) => {
        const i = indexOf(k);
        if (i < 0) return;
        const copy = withKey(elements[i]);
        update((list) => [...list.slice(0, i + 1), copy, ...list.slice(i + 1)]);
        setSelected(copy._k);
    };
    // Deleting always asks first, and says what will go.
    const remove = async (k) => {
        const b = elements[indexOf(k)];
        if (!b) return;
        const ok = await confirmDialog(
            t('imnci_ui.courses.editor2.delete_q', 'Delete the {{name}} element from the lesson? It is removed when you save the lesson.', { name: nameOf(b).toLowerCase() }),
            { title: t('imnci_ui.courses.editor2.delete_title', 'Delete {{name}}?', { name: nameOf(b) }), confirmLabel: t('imnci_ui.courses.editor2.delete', 'Delete'), danger: true },
        );
        if (!ok) return;
        update((list) => list.filter((x) => x._k !== k));
        setSelected(null);
    };

    const openEdit = (k, isNew = false) => {
        const b = elements.find((x) => x._k === k);
        if (!b) return;
        setDraft(JSON.parse(JSON.stringify(b)));
        setEditing({ k, isNew });
    };
    const closeEdit = () => {
        // A new element that was never finished is not left behind, empty.
        if (editing?.isNew) setElements((list) => list.filter((x) => x._k !== editing.k));
        setEditing(null);
        setDraft(null);
    };
    const finishEdit = () => {
        const problem = findProblem([draft]);
        if (problem) { notify(t(...PROBLEMS[problem.reason]), 'error'); return; }
        update((list) => list.map((x) => (x._k === editing.k ? draft : x)));
        setEditing(null);
        setDraft(null);
    };

    const add = (kind) => {
        const at = adding;
        setAdding(null);
        const b = withKey(newElement(kind));
        update((list) => [...list.slice(0, at), b, ...list.slice(at)]);
        setSelected(b._k);
        if (kind !== 'text') {
            setDraft(JSON.parse(JSON.stringify(b)));
            setEditing({ k: b._k, isNew: true });
        }
    };

    // A picture in the text goes straight into an <img>, so it is a link.
    const uploadTo = async (file) => {
        const clean = file.name.replace(/[^\w.-]+/g, '-');
        const rel = `figures/${section.courseId}/${section.id}/${Date.now()}-${clean}`;
        const dest = storageRef(storage, `${ASSET_ROOT}/${rel}`);
        await uploadBytes(dest, file, { contentType: file.type });
        return { rel, dest };
    };
    const uploadFailed = (e) => {
        console.error('Could not upload the image:', e);
        notify(t('imnci_ui.courses.editor.upload_failed', 'Could not upload that image. {{msg}}', { msg: e?.message || '' }).trim(), 'error');
        return null;
    };
    const uploadInline = async (file) => {
        if (!file || !section?.id) return null;
        try { const { dest } = await uploadTo(file); return await getDownloadURL(dest); } catch (e) { return uploadFailed(e); }
    };
    // A picture on a step is a course file, found the way book figures are.
    const uploadPicture = async (file) => {
        if (!file || !section?.id) return null;
        try { const { rel } = await uploadTo(file); return rel; } catch (e) { return uploadFailed(e); }
    };

    const cancel = async () => {
        if (changed) {
            const ok = await confirmDialog(t('imnci_ui.courses.editor2.leave_q', 'Leave without saving? Your changes to this lesson will be lost.'),
                { confirmLabel: t('imnci_ui.courses.editor2.leave', 'Leave without saving'), danger: true });
            if (!ok) return;
        }
        onCancel();
    };

    const save = async () => {
        const problem = findProblem(elements);
        if (problem) {
            setSelected(elements[problem.index]._k);
            notify(t(...PROBLEMS[problem.reason]), 'error');
            return;
        }
        setSaving(true);
        try {
            // Sections written before the tabs existed keep their text in
            // `blocks`; they move across the first time they are saved.
            const patch = { ...section, title: title.trim(), [whole ? 'read' : tab]: fromElements(elements) };
            if (whole) Object.assign(patch, { see: [], practise: [], test: [], blocks: [] });
            if (tab === 'read' && section.blocks?.length) patch.blocks = [];
            await upsertOnlineCourseItem(patch);
            notify(t('imnci_ui.courses.editor2.saved', 'Lesson saved.'), 'success');
            onSaved();
        } catch (e) {
            console.error('Could not save the section:', e);
            notify(t('imnci_ui.courses.editor.save_failed', 'Could not save. {{msg}}', { msg: e?.message || '' }).trim(), 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!section) return null;

    const breaks = partBreaks(elements, isActivity);
    let part = 1;

    return (
        <div className="space-y-3" data-testid="lesson-editor">
            {/* Kept in view while scrolling a long lesson. */}
            <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 py-2.5 bg-white/95 backdrop-blur border-b border-slate-200 rounded-t-2xl flex flex-wrap items-center gap-2">
                <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    {t('imnci_ui.courses.editor2.editing', 'Editing')}
                </span>
                <span className="flex-1" />
                <button type="button" onClick={() => { setPreview((p) => !p); setSelected(null); }} aria-pressed={preview}
                    className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-semibold ${preview ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-slate-300 bg-white text-slate-700'}`}>
                    {preview ? <EyeOff size={15} /> : <Eye size={15} />}
                    {preview ? t('imnci_ui.courses.editor2.back_to_edit', 'Back to editing') : t('imnci_ui.courses.editor2.preview', 'Preview')}
                </button>
                <Button variant="secondary" onClick={cancel} disabled={saving}>{t('imnci_ui.courses.common.cancel', 'Cancel')}</Button>
                <Button onClick={save} disabled={saving}>{saving ? t('imnci_ui.courses.common.saving', 'Saving…') : t('imnci_ui.courses.common.save', 'Save')}</Button>
            </div>

            <label className="block">
                <span className="block text-xs font-semibold text-slate-500 mb-1">{t('imnci_ui.courses.editor2.lesson_title', 'Lesson title')}</span>
                <input value={title} dir="auto" onChange={(e) => { setTitle(e.target.value); setChanged(true); }}
                    className="w-full text-xl font-bold text-slate-900 border-0 border-b-2 border-slate-200 focus:border-sky-500 focus:outline-none px-0 py-1 bg-transparent" />
            </label>

            {preview ? (
                <div className="rounded-xl border border-slate-200 p-3 sm:p-4" data-testid="lesson-preview">
                    <ContentBlocks blocks={fromElements(elements)} />
                </div>
            ) : (
                <div>
                    {elements.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-6">{t('imnci_ui.courses.editor2.empty', 'This {{what}} is empty. Use “Add” to start it.', { what: tabLabel })}</p>
                    )}
                    {elements.length > 0 && <PartLine n={1} t={t} />}
                    {elements.map((b, i) => {
                        const info = elementInfo(b);
                        const on = selected === b._k;
                        const isText = info.kind === 'text';
                        const canEdit = !isText && !['image', 'table'].includes(b.type);
                        const breakAfter = breaks.has(i);
                        if (breakAfter) part += 1;
                        return (
                            <React.Fragment key={b._k}>
                                <AddPoint onAdd={() => setAdding(i)} label={t('imnci_ui.courses.editor2.add_here', 'Add here')} />
                                <div
                                    data-testid="element"
                                    onClick={() => { if (!on) setSelected(b._k); }}
                                    onDoubleClick={() => { if (canEdit) openEdit(b._k); }}
                                    className={`relative rounded-xl border-2 transition-colors ${on ? 'border-sky-500 bg-white shadow-sm' : 'border-transparent hover:border-slate-200 cursor-pointer'} ${isText ? 'px-2 py-1' : 'p-3 bg-white shadow-sm border-slate-100'}`}
                                >
                                    {!isText && (
                                        <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                            <span className={`w-5 h-5 rounded grid place-items-center ${info.activity ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}><info.Icon size={12} /></span>
                                            {nameOf(b)}
                                            {info.kind === 'facilitator' && (
                                                <span className="normal-case tracking-normal font-semibold text-violet-700 bg-violet-50 rounded-full px-2">{t('imnci_ui.courses.editor2.not_learners', 'Not shown to learners')}</span>
                                            )}
                                        </div>
                                    )}

                                    {isText && on ? (
                                        <RichTextEditor
                                            key={b._k}
                                            value={b.text}
                                            autoFocus
                                            onChange={(html) => update((list) => list.map((x) => (x._k === b._k ? { ...x, text: html } : x)))}
                                            onInsertImage={uploadInline}
                                            onInsertChart={() => setCharting(true)}
                                            registerInsert={(fn) => { insertRef.current = fn; }}
                                            placeholder={t('imnci_ui.courses.editor2.write_here', 'Write here. Press Enter for a new paragraph.')}
                                            className="min-h-[8rem]"
                                        />
                                    ) : isEmptyElement(b) ? (
                                        <p className="text-sm italic text-slate-400 py-1">
                                            {isText ? t('imnci_ui.courses.editor2.tap_to_write', 'Empty text. Tap to write.') : t('imnci_ui.courses.editor2.tap_edit', 'Not filled in yet. Tap Edit.')}
                                        </p>
                                    ) : (
                                        <LearnerLook block={b} />
                                    )}

                                    {on && (
                                        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-dashed border-slate-200" data-testid="element-tools">
                                            {canEdit && (
                                                <button type="button" onClick={(e) => { e.stopPropagation(); openEdit(b._k); }}
                                                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700">
                                                    <Pencil size={14} /> {t('imnci_ui.courses.editor2.edit', 'Edit')}
                                                </button>
                                            )}
                                            <button type="button" disabled={i === 0} onClick={(e) => { e.stopPropagation(); move(b._k, -1); }} aria-label={t('imnci_ui.courses.editor2.move_up', 'Move up')}
                                                className="h-9 w-9 grid place-items-center rounded-lg border border-slate-300 bg-white disabled:opacity-30"><ArrowUp size={15} /></button>
                                            <button type="button" disabled={i === elements.length - 1} onClick={(e) => { e.stopPropagation(); move(b._k, 1); }} aria-label={t('imnci_ui.courses.editor2.move_down', 'Move down')}
                                                className="h-9 w-9 grid place-items-center rounded-lg border border-slate-300 bg-white disabled:opacity-30"><ArrowDown size={15} /></button>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); duplicate(b._k); }}
                                                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700">
                                                <Copy size={14} /> {t('imnci_ui.courses.editor2.duplicate', 'Duplicate')}
                                            </button>
                                            <span className="flex-1" />
                                            <button type="button" onClick={(e) => { e.stopPropagation(); remove(b._k); }} data-testid="delete-element"
                                                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-red-200 bg-white text-sm font-semibold text-red-600 hover:bg-red-50">
                                                <Trash2 size={14} /> {t('imnci_ui.courses.editor2.delete', 'Delete')}
                                            </button>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); setSelected(null); }} aria-label={t('imnci_ui.courses.editor2.deselect', 'Done with this element')}
                                                className="h-9 w-9 grid place-items-center rounded-lg border border-slate-300 bg-white text-slate-500"><X size={15} /></button>
                                        </div>
                                    )}
                                </div>
                                {breakAfter && <PartLine n={part} after={nameOf(b)} t={t} />}
                            </React.Fragment>
                        );
                    })}
                    <button type="button" onClick={() => setAdding(elements.length)} data-testid="add-end"
                        className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-sky-700 hover:border-sky-400 hover:bg-sky-50">
                        <Plus size={16} /> {t('imnci_ui.courses.editor2.add_end', 'Add to the end of the lesson')}
                    </button>
                </div>
            )}

            <AddMenu isOpen={adding !== null} onClose={() => setAdding(null)} onPick={add} t={t} />
            <EditSheet draft={draft} setDraft={setDraft} onDone={finishEdit} onCancel={closeEdit} uploadPicture={uploadPicture} t={t} />
            <ChartBuilderModal
                isOpen={charting}
                onClose={() => setCharting(false)}
                onInsert={(tableHtml) => { insertRef.current?.(tableHtml); setCharting(false); }}
            />
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
    // Signs, classifications and treatments come from the protocol's standard
    // lists (the same ones Protocol management and the exercises use); a pick
    // of a classification also sets the row to that classification's colour.
    const [part, setPart] = useState('child');
    const ar = i18n.language === 'ar';
    const doc = liveProtocol(part);
    const signs = signOptions(part, doc, ar);
    const classes = classificationOptions(part, doc, ar);
    const flat = (opts) => opts.groups.flatMap((g) => g.items.map((it) => (ar ? it.ar || it.en : it.en)));
    const lists = { 0: flat(signs), 1: flat(classes), 2: treatmentSuggestions(part, doc, ar) };
    const colourFor = (text) => {
        const hit = classes.groups.flatMap((g) => g.items).find((it) => it.en === text || it.ar === text);
        return hit ? SEVERITY_OF_COLOR[hit.color] : null;
    };

    useEffect(() => {
        if (isOpen) {
            setRows([{ colour: 'note', cells: ['', '', ''] }]);
            setHeaders(['Signs', 'Classify as', 'Treatment']);
        }
    }, [isOpen]);

    const setCell = (ri, ci, v) => setRows((p) => p.map((r, i) => {
        if (i !== ri) return r;
        const colour = ci === 1 ? colourFor(v) : null;
        return { ...r, ...(colour ? { colour } : {}), cells: r.cells.map((c, k) => (k === ci ? v : c)) };
    }));
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

                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-500">{t('imnci_ui.courses.chart.part', 'Standard lists for')}</span>
                    <select value={part} onChange={(e) => setPart(e.target.value)} className="border rounded p-1 text-xs">
                        <option value="child">{t('clinical_ui.protocol.parts.child', 'Sick child (2 months – 5 years)')}</option>
                        <option value="infant">{t('clinical_ui.protocol.parts.infant', 'Young infant (up to 2 months)')}</option>
                    </select>
                    <span className="text-slate-500">{t('imnci_ui.courses.chart.pick_hint', 'Type or pick signs, classifications and treatments from the protocol; a classification sets its row colour.')}</span>
                </div>
                {[0, 1, 2].map((ci) => (
                    <datalist key={ci} id={`chart-list-${ci}`}>{lists[ci].map((x) => <option key={x} value={x} />)}</datalist>
                ))}

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
                                list={ci <= 2 ? `chart-list-${ci}` : undefined} dir="auto"
                                className="flex-1 min-w-0 border rounded px-2 py-1 text-sm" />
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
