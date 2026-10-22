// src/components/imnci/onlineCourses/ImportModal.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadCloud, AlertTriangle } from 'lucide-react';
import { Button, Spinner, Modal, Select } from '../../CommonComponents';
import { notify, confirmDialog } from '../../dialogs';
import { bulkUpsertOnlineCourseContent } from '../../../data';
import { LEGACY_DB, buildMigration } from './migration';

// =============================================================================
// Import
// =============================================================================

export function ImportModal({ isOpen, onClose, onImported }) {
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
        <Modal isOpen={isOpen} onClose={onClose} title={t('imnci_ui.courses.import.title', 'Import from the Android app')}>
            <div className="space-y-4">
                {error && (
                    <div className="flex gap-2 bg-red-50 border border-red-300 text-red-800 px-3 py-2 rounded text-sm">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" /><div>{error}</div>
                    </div>
                )}

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
