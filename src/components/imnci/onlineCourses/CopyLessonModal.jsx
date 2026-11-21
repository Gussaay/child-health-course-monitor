// src/components/imnci/onlineCourses/CopyLessonModal.jsx
//
// Copies one lesson into another module, of this course or another one, so
// material written once (a procedure, a piece of equipment) can be used again
// where it is taught. The copy is a new lesson with the same blocks, added
// at the end of the chosen module; the original is not changed. Learner
// progress is kept per lesson, so finishing one copy does not finish the
// other. To point at the original instead, use a "courselink" block.
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Select } from '../../CommonComponents';
import { notify } from '../../dialogs';
import { upsertOnlineCourseItem } from '../../../data';

const live = (x) => x && x.isDeleted !== true;
// What a copy must not carry over: the original's identity and upload tags.
const NOT_COPIED = ['id', 'createdAt', 'lastUpdatedAt', 'importBatch', 'updateTag', 'legacyKey', 'legacyModuleKey', 'courseId', 'moduleId', 'order'];

/** The new lesson's fields: the section's content, placed at the end of `moduleId`. */
export function lessonCopy(section, { courseId, moduleId, items = [] }) {
    const copy = { ...section };
    NOT_COPIED.forEach((k) => delete copy[k]);
    const last = items.filter((i) => live(i) && i.kind === 'section' && i.moduleId === moduleId)
        .reduce((n, i) => Math.max(n, Number(i.order) || 0), 0);
    return { ...copy, kind: 'section', courseId, moduleId, order: last + 1, copiedFrom: section.id };
}

export default function CopyLessonModal({ isOpen, onClose, section, courses = [], items = [], defaultCourseId, onCopied }) {
    const { t } = useTranslation();
    const [courseId, setCourseId] = useState(defaultCourseId || '');
    const [moduleId, setModuleId] = useState('');
    const [saving, setSaving] = useState(false);
    const modules = useMemo(() => items.filter((i) => live(i) && i.kind === 'module' && i.courseId === courseId)
        .sort((a, b) => (a.order || 0) - (b.order || 0)), [items, courseId]);

    const save = async () => {
        if (!courseId || !moduleId) { notify(t('imnci_ui.courses.copy.choose', 'Choose the course and the module.'), 'error'); return; }
        setSaving(true);
        try {
            await upsertOnlineCourseItem(lessonCopy(section, { courseId, moduleId, items }));
            notify(t('imnci_ui.courses.copy.done', 'Lesson copied.'), 'success');
            onCopied?.(); onClose();
        } catch (e) {
            console.error(e); notify(t('imnci_ui.courses.copy.failed', 'Could not copy the lesson.'), 'error');
        } finally { setSaving(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('imnci_ui.courses.copy.title', 'Copy this lesson to another module')}>
            <div className="space-y-4">
                <p className="text-sm text-slate-600">
                    {t('imnci_ui.courses.copy.help', 'The copy is added at the end of the module you choose. The original lesson stays where it is.')}
                </p>
                <Select label={t('imnci_ui.courses.copy.course', 'Course')} value={courseId}
                    onChange={(e) => { setCourseId(e.target.value); setModuleId(''); }}>
                    <option value="">{t('imnci_ui.courses.course_modal.choose', 'Choose…')}</option>
                    {courses.filter(live).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </Select>
                <Select label={t('imnci_ui.courses.item_modal.module', 'Module')} value={moduleId} onChange={(e) => setModuleId(e.target.value)} disabled={!courseId}>
                    <option value="">{t('imnci_ui.courses.course_modal.choose', 'Choose…')}</option>
                    {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </Select>
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>{t('imnci_ui.courses.common.cancel', 'Cancel')}</Button>
                    <Button onClick={save} disabled={saving || !moduleId} data-testid="copy-lesson-save">
                        {saving ? t('imnci_ui.courses.common.saving', 'Saving…') : t('imnci_ui.courses.copy.button', 'Copy')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
