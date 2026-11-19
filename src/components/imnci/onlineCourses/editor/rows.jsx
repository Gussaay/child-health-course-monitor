// src/components/imnci/onlineCourses/editor/rows.jsx
//
// The pieces the lesson editor's forms are built from. A list inside an
// element (flip cards, steps, answers, chapters...) is a row of named boxes
// per item, with buttons to move or remove it and "+ Add" below, rather than
// lines of text split by " | " that the author had to learn the rules of.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp, ArrowDown, X, Plus } from 'lucide-react';
import { confirmDialog } from '../../../dialogs';

const BOX = 'w-full border border-slate-300 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500';

/** A labelled text box. `area` makes it a few lines tall. */
export function Field({ label, hint, value, onChange, placeholder, area = false, rows = 3, type = 'text', className = '' }) {
    return (
        <label className={`block ${className}`}>
            {label && <span className="block text-sm font-semibold text-slate-700 mb-1">{label}</span>}
            {hint && <span className="block text-xs text-slate-500 -mt-0.5 mb-1">{hint}</span>}
            {area ? (
                <textarea rows={rows} value={value ?? ''} dir="auto" placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)} className={`${BOX} resize-y`} />
            ) : (
                <input type={type} value={value ?? ''} dir="auto" placeholder={placeholder}
                    onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value)}
                    className={BOX} />
            )}
        </label>
    );
}

/** A labelled drop-down. `options` is a list of [value, label]. */
export function Choice({ label, value, onChange, options, className = '' }) {
    return (
        <label className={`block ${className}`}>
            {label && <span className="block text-sm font-semibold text-slate-700 mb-1">{label}</span>}
            <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={BOX}>
                {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
        </label>
    );
}

export function Tick({ label, checked, onChange, className = '' }) {
    return (
        <label className={`flex items-start gap-2 text-sm text-slate-700 ${className}`}>
            <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-sky-600" />
            <span>{label}</span>
        </label>
    );
}

const hasWords = (x) => {
    if (x == null) return false;
    if (typeof x === 'string' || typeof x === 'number') return String(x).trim() !== '';
    if (Array.isArray(x)) return x.some(hasWords);
    if (typeof x === 'object') return Object.values(x).some(hasWords);
    return false;
};

const move = (list, from, to) => {
    const next = [...list];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    return next;
};

/**
 * A list edited as one box per item. `render(item, set, index)` draws the
 * item's fields; `set(patch)` merges into an object item, or replaces a plain
 * string item. Removing an item that has something written in it asks first.
 */
export function RowList({ label, hint, items, onChange, newItem, itemName, addLabel, render, min = 0, onRemove }) {
    const { t } = useTranslation();
    const list = Array.isArray(items) ? items : [];
    const setAt = (j, patch) => onChange(list.map((x, k) => {
        if (k !== j) return x;
        return (typeof patch === 'object' && patch !== null && !Array.isArray(patch) && typeof x === 'object' && x !== null) ? { ...x, ...patch } : patch;
    }));
    const remove = async (j) => {
        if (hasWords(list[j])) {
            const ok = await confirmDialog(t('imnci_ui.courses.editor2.remove_row_q', 'Remove {{item}} {{n}}? What is written in it will be lost.', { item: itemName.toLowerCase(), n: j + 1 }),
                { title: t('imnci_ui.courses.editor2.remove_title', 'Remove'), confirmLabel: t('imnci_ui.courses.editor2.remove', 'Remove'), danger: true });
            if (!ok) return;
        }
        if (onRemove) onRemove(j);
        else onChange(list.filter((_, k) => k !== j));
    };
    return (
        <div>
            {label && <div className="text-sm font-semibold text-slate-700 mb-1">{label}</div>}
            {hint && <div className="text-xs text-slate-500 -mt-0.5 mb-1.5">{hint}</div>}
            <div className="space-y-2">
                {list.map((item, j) => (
                    <div key={j} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2" data-testid="row">
                        <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
                            <span className="flex-1">{itemName} {j + 1}</span>
                            <button type="button" aria-label={t('imnci_ui.courses.editor2.move_up', 'Move up')} disabled={j === 0}
                                onClick={() => onChange(move(list, j, j - 1))} className="w-8 h-7 grid place-items-center rounded-md border border-slate-200 bg-white disabled:opacity-30"><ArrowUp size={14} /></button>
                            <button type="button" aria-label={t('imnci_ui.courses.editor2.move_down', 'Move down')} disabled={j === list.length - 1}
                                onClick={() => onChange(move(list, j, j + 1))} className="w-8 h-7 grid place-items-center rounded-md border border-slate-200 bg-white disabled:opacity-30"><ArrowDown size={14} /></button>
                            <button type="button" aria-label={t('imnci_ui.courses.editor2.remove', 'Remove')} disabled={list.length <= min}
                                onClick={() => remove(j)} className="w-8 h-7 grid place-items-center rounded-md border border-slate-200 bg-white text-red-600 disabled:opacity-30"><X size={14} /></button>
                        </div>
                        {render(item, (patch) => setAt(j, patch), j)}
                    </div>
                ))}
            </div>
            <button type="button" onClick={() => onChange([...list, typeof newItem === 'function' ? newItem() : newItem])}
                className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 py-2 text-sm font-semibold text-sky-700 hover:border-sky-400 hover:bg-sky-50">
                <Plus size={15} /> {addLabel}
            </button>
        </div>
    );
}

/** A list of plain sentences, one box each. */
export function TextList({ label, hint, items, onChange, itemName, addLabel, placeholder }) {
    return (
        <RowList label={label} hint={hint} items={items} onChange={onChange} newItem="" itemName={itemName} addLabel={addLabel}
            render={(v, set) => <Field value={v} onChange={set} placeholder={placeholder} />} />
    );
}

// ---------------------------------------------------------------------------
// Answers
//
// A question keeps its answers in three parallel lists (options, feedback, and
// answer or answers), which is how it is saved and how learners' answers are
// checked. The editor shows them together, one box per answer, and writes the
// three lists back.
// ---------------------------------------------------------------------------

/** The saved question fields as one row per answer. */
export function answerRows(q = {}) {
    const right = Array.isArray(q.answers) && q.answers.length ? q.answers.map(Number) : [Number(q.answer ?? 0)];
    return (q.options || []).map((text, i) => ({ text: String(text ?? ''), right: right.includes(i), feedback: String((q.feedback || [])[i] ?? '') }));
}

/** Rows back into options, feedback and answer (or answers when several are right). */
export function answersFromRows(rows = [], multi = false) {
    const options = rows.map((r) => r.text);
    const fb = rows.map((r) => r.feedback || '');
    while (fb.length && !fb[fb.length - 1].trim()) fb.pop();
    const right = rows.map((r, i) => (r.right ? i : -1)).filter((i) => i >= 0);
    const out = { options, feedback: fb.length ? fb : undefined };
    if (multi && right.length > 1) return { ...out, answers: right, answer: undefined };
    return { ...out, answer: right[0] ?? 0, answers: undefined };
}

/**
 * Answer boxes with a "This is right" tick and feedback for each. `multi`
 * allows several right answers ("select all that apply"); `allowMulti` shows
 * the switch for it; `withFeedback` false hides the feedback boxes.
 */
export function AnswersEditor({ q, onChange, allowMulti = true, withFeedback = true }) {
    const { t } = useTranslation();
    const rows = answerRows(q);
    const multi = Array.isArray(q.answers) && q.answers.length > 1 ? true : !!q._multi;
    const write = (next, m = multi) => onChange({ ...answersFromRows(next, m), _multi: m || undefined });
    const name = React.useId();
    return (
        <div className="space-y-2">
            {allowMulti && (
                <Tick label={t('imnci_ui.courses.editor2.multi', 'More than one answer is right (select all that apply)')} checked={multi}
                    onChange={(m) => {
                        // Back to one right answer: keep the first one ticked.
                        const next = m ? rows : rows.map((r, i) => ({ ...r, right: i === rows.findIndex((x) => x.right) }));
                        write(next, m);
                    }} />
            )}
            <RowList
                label={t('imnci_ui.courses.editor2.answers', 'Answers')}
                hint={t('imnci_ui.courses.editor2.answers_hint', 'Tick the right answer. Feedback shows when the learner picks that answer.')}
                items={rows} itemName={t('imnci_ui.courses.editor2.answer', 'Answer')} addLabel={t('imnci_ui.courses.editor2.add_answer', 'Add an answer')}
                newItem={{ text: '', right: false, feedback: '' }} min={2}
                onChange={(next) => write(next)}
                render={(r, set, j) => (
                    <>
                        <Field value={r.text} onChange={(v) => set({ text: v })} placeholder={t('imnci_ui.courses.editor2.answer_text', 'The answer')} />
                        <label className={`flex items-center gap-2 text-sm font-semibold ${r.right ? 'text-green-700' : 'text-slate-600'}`}>
                            <input type={multi ? 'checkbox' : 'radio'} name={name} checked={r.right} className="w-4 h-4 accent-green-600"
                                onChange={(e) => write(multi ? rows.map((x, k) => (k === j ? { ...x, right: e.target.checked } : x)) : rows.map((x, k) => ({ ...x, right: k === j })))} />
                            {t('imnci_ui.courses.editor2.is_right', 'This is right')}
                        </label>
                        {withFeedback && (
                            <Field value={r.feedback} onChange={(v) => set({ feedback: v })}
                                placeholder={t('imnci_ui.courses.editor2.feedback', 'Feedback when this answer is picked (optional)')} />
                        )}
                    </>
                )}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// A filled recording form (practice cases, find the error)
// ---------------------------------------------------------------------------

const asItem = (x) => (typeof x === 'string' ? { text: x } : { text: '', ...x });
// An entry with nothing but text is saved as a plain string, as before.
const fromItem = (x) => (x.error || (x.why && x.why.trim()) ? { text: x.text, ...(x.why ? { why: x.why } : {}), ...(x.error ? { error: true } : {}) } : x.text);

function EntryList({ label, items, onChange, withError, t }) {
    return (
        <RowList label={label} items={(items || []).map(asItem)} itemName={t('imnci_ui.courses.editor2.entry', 'Entry')}
            addLabel={t('imnci_ui.courses.editor2.add_entry', 'Add an entry')} newItem={{ text: '' }}
            onChange={(next) => onChange(next.map(fromItem))}
            render={(it, set) => (
                <>
                    <Field value={it.text} onChange={(v) => set({ text: v })} placeholder={t('imnci_ui.courses.editor2.entry_text', 'What is written')} />
                    {withError && <Tick label={t('imnci_ui.courses.editor2.is_error', 'This entry is the error')} checked={it.error} onChange={(v) => set({ error: v || undefined })} />}
                    <Field value={it.why} onChange={(v) => set({ why: v || undefined })} placeholder={t('imnci_ui.courses.editor2.entry_why', 'Feedback when it is tapped (optional)')} />
                </>
            )} />
    );
}

/** The child's recording form: a box per part of the form, with its findings and classification. */
export function RecordEditor({ record, onChange, withError = false }) {
    const { t } = useTranslation();
    return (
        <RowList
            label={t('imnci_ui.courses.editor2.record', 'The child’s recording form')}
            hint={withError ? t('imnci_ui.courses.editor2.record_hint_error', 'Fill each part of the form. Tick the one entry that is wrong.') : t('imnci_ui.courses.editor2.record_hint', 'Fill each part of the form as the health worker wrote it.')}
            items={record || []} itemName={t('imnci_ui.courses.editor2.form_part', 'Part of the form')}
            addLabel={t('imnci_ui.courses.editor2.add_form_part', 'Add a part of the form')}
            newItem={() => ({ title: '', lines: [] })}
            onChange={onChange}
            render={(sec, set) => (
                <>
                    <Field value={sec.title} onChange={(v) => set({ title: v })} placeholder={t('imnci_ui.courses.editor2.form_part_name', 'Part of the form, e.g. Cough or difficult breathing')} />
                    <EntryList label={t('imnci_ui.courses.editor2.findings', 'Findings')} items={sec.lines} withError={withError} t={t} onChange={(v) => set({ lines: v })} />
                    <EntryList label={t('imnci_ui.courses.editor2.classification', 'Classification')} items={sec.classify} withError={withError} t={t}
                        onChange={(v) => set({ classify: v.length ? v : undefined })} />
                </>
            )}
        />
    );
}
