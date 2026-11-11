// src/components/imnci/onlineCourses/ImportModal.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadCloud, AlertTriangle, BookOpen } from 'lucide-react';
import { Button, Spinner, Modal, Select } from '../../CommonComponents';
import { notify, confirmDialog } from '../../dialogs';
import { bulkUpsertOnlineCourseContent } from '../../../data';
import { LEGACY_DB, buildMigration } from './migration';
import { DIMCI_M1_PLAN } from '../dimci/module1';

// =============================================================================
// Import
// =============================================================================

export function ImportModal({ isOpen, onClose, onImported, existingCourses = [] }) {
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

    // WHO distance learning Module 1, shipped with the app. Added as a new,
    // unpublished course; from then on it is edited like any other course.
    const dimciThere = existingCourses.find((c) => c?.source === 'dimci' && !c.isDeleted);
    const addDimci = async () => {
        const ok = await confirmDialog(
            dimciThere
                ? t('imnci_ui.courses.import.dimci_again', '"{{title}}" is already here. Add another copy of Module 1 as a new course? The existing one is not changed.', { title: dimciThere.title })
                : t('imnci_ui.courses.import.dimci_confirm', 'Add "{{title}}" with Module 1 (5 sections)? It is added unpublished, so only managers see it until you publish it.', { title: DIMCI_M1_PLAN.course.title }),
            { title: t('imnci_ui.courses.import.dimci_title', 'Add WHO distance learning Module 1'), confirmLabel: t('imnci_ui.courses.import.add', 'Add') });
        if (!ok) return;
        setBusy(true); setError('');
        try {
            const r = await bulkUpsertOnlineCourseContent(DIMCI_M1_PLAN);
            notify(t('imnci_ui.courses.import.dimci_done', 'Added Module 1 with {{sections}} sections. Its exercises are drafts in Manage Exercises until you publish them.', { sections: r.sections }), 'success');
            onImported();
            onClose();
        } catch (e) {
            console.error('Adding Module 1 failed:', e);
            setError(t('imnci_ui.courses.import.failed', 'The import failed and nothing was saved. {{msg}}', { msg: String(e?.message || e) }));
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

                <div className="p-3 rounded border border-sky-200 bg-sky-50 space-y-2">
                    <div className="font-semibold text-sm text-sky-900">{t('imnci_ui.courses.import.dimci_heading', 'WHO IMCI distance learning modules')}</div>
                    <p className="text-xs text-sky-900">
                        {t('imnci_ui.courses.import.dimci_intro', 'Module 1, General danger signs: the WHO text in the Sudan national wording, chart booklet tables and the recording form from the protocol, and its exercises as quizzes and recording-form cases. Everything can be edited after it is added.')}
                    </p>
                    <Button onClick={addDimci} disabled={busy}>
                        <BookOpen size={16} /> {t('imnci_ui.courses.import.dimci_add', 'Add Module 1')}
                    </Button>
                </div>

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
                    </>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={busy}>{t('imnci_ui.courses.common.cancel', 'Cancel')}</Button>
                    <Button onClick={commit} disabled={busy || !plan?.course}>{t('imnci_ui.courses.import.import', 'Import')}</Button>
                </div>
            </div>
        </Modal>
    );
}
