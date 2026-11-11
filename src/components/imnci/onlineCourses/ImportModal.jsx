// src/components/imnci/onlineCourses/ImportModal.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadCloud, AlertTriangle, FileUp } from 'lucide-react';
import { Button, Spinner, Modal, Select } from '../../CommonComponents';
import { notify, confirmDialog } from '../../dialogs';
import { bulkUpsertOnlineCourseContent, upsertExerciseDefinition } from '../../../data';
import { LEGACY_DB, buildMigration } from './migration';
import { useImnci } from '../shared';
import { checkPackage, packagePlan, exercisesToSave } from './coursePackage';

// =============================================================================
// Import
// =============================================================================

// A course file (see coursePackage.js): read, checked and shown before
// anything is written, then added as a new course or into an existing one.
function FileImport({ busy, setBusy, setError, onDone, existingCourses, existingItems }) {
    const { t } = useTranslation();
    const { exercises, refreshExercises } = useImnci();
    const [pkg, setPkg] = useState(null);
    const [fileName, setFileName] = useState('');
    const [target, setTarget] = useState('new');
    const [replace, setReplace] = useState(false);
    const known = useMemo(() => (exercises || []).map((e) => e.id), [exercises]);
    const check = useMemo(() => (pkg ? checkPackage(pkg, known) : null), [pkg, known]);
    const courses = existingCourses.filter((c) => c && !c.isDeleted);

    const readFile = async (file) => {
        setError(''); setPkg(null); setFileName(file?.name || '');
        if (!file) return;
        try {
            setPkg(JSON.parse(await file.text()));
        } catch (e) {
            setError(t('imnci_ui.courses.import.file_unreadable', 'That file could not be read as a course file. {{msg}}', { msg: e.message }));
        }
    };

    const run = async () => {
        if (!pkg || check?.errors.length) return;
        const into = target === 'new' || target === 'exercises' ? null : courses.find((c) => c.id === target);
        const onlyExercises = target === 'exercises';
        const ok = await confirmDialog(
            onlyExercises
                ? t('imnci_ui.courses.import.file_confirm_exercises', 'Save the {{n}} exercise(s) in the file to Manage Exercises? No course or section is added.', { n: check.summary.exercises })
                : into
                ? t('imnci_ui.courses.import.file_confirm_into', 'Add {{modules}} module(s) with {{sections}} sections to "{{course}}"? Nothing already in the course is changed.', { modules: check.summary.modules, sections: check.summary.sections, course: into.title })
                : t('imnci_ui.courses.import.file_confirm_new', 'Create the course "{{course}}" with {{modules}} module(s) and {{sections}} sections? It is added unpublished.', { modules: check.summary.modules, sections: check.summary.sections, course: pkg.course?.title || '' }),
            { title: t('imnci_ui.courses.import.file_title', 'Import a course file'), confirmLabel: t('imnci_ui.courses.import.import', 'Import') });
        if (!ok) return;
        setBusy(true); setError('');
        try {
            // Exercises first, so a section never links to one that is not saved yet.
            const toSave = exercisesToSave(pkg, known, { replace });
            for (const ex of toSave) await upsertExerciseDefinition(ex);
            if (onlyExercises) {
                if (toSave.length) refreshExercises?.();
                notify(t('imnci_ui.courses.import.file_done_exercises', 'Saved {{n}} exercise(s).', { n: toSave.length }), 'success');
                onDone();
                return;
            }
            const lastOrder = into
                ? Math.max(0, ...existingItems.filter((i) => i.kind === 'module' && i.courseId === into.id && !i.isDeleted).map((i) => Number(i.order) || 0))
                : 0;
            const plan = packagePlan(pkg, { existingCourseId: into?.id || null, firstModuleOrder: lastOrder + 1 });
            const r = await bulkUpsertOnlineCourseContent(plan);
            if (toSave.length) refreshExercises?.();
            notify(t('imnci_ui.courses.import.file_done', 'Imported {{modules}} module(s), {{sections}} sections and {{exercises}} exercise(s).', { modules: r.modules, sections: r.sections, exercises: toSave.length }), 'success');
            onDone();
        } catch (e) {
            console.error('File import failed:', e);
            setError(t('imnci_ui.courses.import.file_failed', 'The import stopped part way. {{msg}} Check the course before importing again.', { msg: String(e?.message || e) }));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="p-3 rounded border border-sky-200 bg-sky-50 space-y-3">
            <div className="font-semibold text-sm text-sky-900 flex items-center gap-2"><FileUp size={16} /> {t('imnci_ui.courses.import.file_heading', 'Import a course file')}</div>
            <p className="text-xs text-sky-900">
                {t('imnci_ui.courses.import.file_intro', 'A course file (.imnci.json) holds modules, their sections in order with every block of Read, See and Practise, and the exercises they link to. Make one with Download file on any module.')}
            </p>
            <input type="file" accept=".json,application/json" disabled={busy}
                onChange={(e) => readFile(e.target.files?.[0])}
                className="block w-full text-sm file:me-3 file:rounded file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-white" />

            {check && (
                <>
                    {check.errors.length > 0 ? (
                        <div className="p-3 bg-red-50 border border-red-300 rounded text-sm text-red-900">
                            <div className="font-semibold mb-1">{t('imnci_ui.courses.import.file_errors', '{{file}} cannot be imported:', { file: fileName })}</div>
                            <ul className="list-disc ms-5 space-y-0.5 max-h-40 overflow-y-auto">{check.errors.map((x, i) => <li key={i}>{x}</li>)}</ul>
                        </div>
                    ) : (
                        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                            <strong>{pkg.course?.title || fileName}</strong>: {t('imnci_ui.courses.import.file_summary', '{{modules}} module(s), {{sections}} sections, {{exercises}} exercise(s).', check.summary)}
                            <ul className="list-disc ms-5 mt-1 text-xs">{(pkg.modules || []).map((m, i) => <li key={i}>{m.title} ({(m.sections || []).length})</li>)}</ul>
                        </div>
                    )}
                    {check.warnings.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                            <ul className="list-disc ms-5 space-y-0.5 max-h-32 overflow-y-auto">{check.warnings.map((x, i) => <li key={i}>{x}</li>)}</ul>
                        </div>
                    )}
                    {!check.errors.length && (
                        <>
                            <Select label={t('imnci_ui.courses.import.file_target', 'Add to')} value={target} onChange={(e) => setTarget(e.target.value)}>
                                <option value="new">{t('imnci_ui.courses.import.file_new_course', 'A new course: {{title}}', { title: pkg.course?.title || '' })}</option>
                                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                                {check.summary.exercises > 0 && <option value="exercises">{t('imnci_ui.courses.import.file_only_exercises', 'Only the exercises (no sections)')}</option>}
                            </Select>
                            {check.summary.clashes.length > 0 && (
                                <label className="flex items-start gap-2 text-sm text-slate-700">
                                    <input type="checkbox" className="mt-1" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                                    <span>{t('imnci_ui.courses.import.file_replace', '{{n}} exercise(s) in the file are already in the app. Replace them with the file\'s version (otherwise the app\'s version is kept).', { n: check.summary.clashes.length })}</span>
                                </label>
                            )}
                            <Button onClick={run} disabled={busy}>
                                <FileUp size={16} /> {busy ? t('imnci_ui.courses.common.saving', 'Saving…') : t('imnci_ui.courses.import.import', 'Import')}
                            </Button>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

export function ImportModal({ isOpen, onClose, onImported, existingCourses = [], existingItems = [] }) {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const [legacy, setLegacy] = useState(null);
    const [error, setError] = useState('');
    const [courseKey, setCourseKey] = useState('');

    useEffect(() => { if (isOpen) { setLegacy(null); setError(''); setCourseKey(''); } }, [isOpen]);

    const fetchLegacy = async () => {
        setBusy(true); setError('');
        try {
            const nodes = ['course', 'module', 'section'];
            const parts = await Promise.all(nodes.map((n) =>
                fetch(`${LEGACY_DB}/${n}.json`).then((r) => {
                    if (!r.ok) throw new Error(`${n}: HTTP ${r.status}`);
                    return r.json();
                })));
            const data = { course: parts[0], module: parts[1], section: parts[2] };
            setLegacy(data);
            const first = Object.values(data.course || {})[0];
            setCourseKey(first?.course_key || '');
        } catch (e) {
            console.error('Legacy fetch failed:', e);
            setError(t('imnci_ui.courses.import.read_failed', 'Could not read the original database. {{msg}}', { msg: e.message }));
        } finally {
            setBusy(false);
        }
    };

    const plan = useMemo(
        () => (legacy && courseKey ? buildMigration(legacy, courseKey) : null),
        [legacy, courseKey]);

    const commit = async () => {
        if (!plan?.course) return;
        const ok = await confirmDialog(
            t('imnci_ui.courses.import.confirm', 'Import "{{title}}" with {{modules}} modules and {{sections}} sections? This creates a new course.', {
                title: plan.course.title,
                modules: plan.items.filter(i => i.kind === 'module').length,
                sections: plan.items.filter(i => i.kind === 'section').length,
            }),
            { title: t('imnci_ui.courses.import.confirm_title', 'Import course'), confirmLabel: t('imnci_ui.courses.import.import', 'Import') });
        if (!ok) return;
        setBusy(true);
        try {
            const r = await bulkUpsertOnlineCourseContent(plan);
            notify(t('imnci_ui.courses.import.done', 'Imported {{modules}} modules and {{sections}} sections.', { modules: r.modules, sections: r.sections })
                + (r.orphaned ? ' ' + t('imnci_ui.courses.import.orphaned', '{{n}} section(s) had no module.', { n: r.orphaned }) : ''), 'success');
            onImported();
            onClose();
        } catch (e) {
            console.error('Import failed:', e);
            const raw = String(e?.message || e);
            setError(/insufficient permissions|permission-denied/i.test(raw)
                ? t('imnci_ui.courses.import.refused', 'Firestore refused the write. The onlineCourses rules may not be deployed yet. Nothing was saved.')
                : t('imnci_ui.courses.import.failed', 'The import failed and nothing was saved. {{msg}}', { msg: raw }));
        } finally {
            setBusy(false);
        }
    };

    const courses = Object.values(legacy?.course || {});

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('imnci_ui.courses.import.title_any', 'Add or import a course')}>
            <div className="space-y-4">
                {error && (
                    <div className="flex gap-2 bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded text-sm">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" /><div>{error}</div>
                    </div>
                )}

                <FileImport busy={busy} setBusy={setBusy} setError={setError}
                    existingCourses={existingCourses} existingItems={existingItems}
                    onDone={() => { onImported(); onClose(); }} />

                <details className="rounded border border-slate-200 p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-600">{t('imnci_ui.courses.import.legacy_heading', 'Older: read the Android app database')}</summary>
                    <div className="space-y-4 mt-3">
                <p className="text-sm text-slate-600">
                    {t('imnci_ui.courses.import.intro', 'Reads the course structure from the original Sudan Child Health database. Nothing in that database is changed.')}
                </p>

                {!legacy && (
                    <Button onClick={fetchLegacy} disabled={busy}>
                        <DownloadCloud size={16} /> {busy ? t('imnci_ui.courses.import.reading', 'Reading…') : t('imnci_ui.courses.import.read_db', 'Read the original database')}
                    </Button>
                )}

                {busy && legacy && <Spinner />}

                {legacy && (
                    <>
                        <Select label={t('imnci_ui.courses.import.course_to_import', 'Course to import')} value={courseKey}
                            onChange={(e) => setCourseKey(e.target.value)}>
                            {courses.map((c) => (
                                <option key={c.course_key} value={c.course_key}>{c.course_title}</option>
                            ))}
                        </Select>

                        {plan?.course && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-900">
                                <strong>{plan.course.title}</strong> — {t('imnci_ui.courses.import.summary', '{{modules}} modules, {{sections}} sections.', { modules: plan.items.filter(i => i.kind === 'module').length, sections: plan.items.filter(i => i.kind === 'section').length })}
                            </div>
                        )}

                        {plan?.warnings?.length > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                                <div className="font-semibold mb-1">{t('imnci_ui.courses.import.things_to_know', '{{n}} thing(s) to know', { n: plan.warnings.length })}</div>
                                <ul className="list-disc ms-5 space-y-0.5 max-h-32 overflow-y-auto">
                                    {plan.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            </div>
                        )}

                        <div className="p-3 bg-sky-50 border border-sky-200 rounded text-xs text-sky-900">
                            {t('imnci_ui.courses.import.after_note', 'The course text is only page references. After importing, use Upload course files to add the PDFs, or every section will show “not uploaded yet”.')}
                        </div>
                        <Button onClick={commit} disabled={busy || !plan?.course}>{t('imnci_ui.courses.import.import_db', 'Import from the database')}</Button>
                    </>
                )}
                    </div>
                </details>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={busy}>{t('imnci_ui.courses.common.close', 'Close')}</Button>
                </div>
            </div>
        </Modal>
    );
}
