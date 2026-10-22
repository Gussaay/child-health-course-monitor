// src/components/imnci/onlineCourses/ItemModals.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Input, Select, Textarea } from '../../CommonComponents';
import { notify } from '../../dialogs';
import { upsertOnlineCourse, upsertOnlineCourseItem } from '../../../data';

// =============================================================================
// Authoring
// =============================================================================

export function CourseModal({ isOpen, onClose, course, onSaved }) {
    const { t } = useTranslation();
    const [form, setForm] = useState(course || { title: '', description: '', isPublished: false });
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (isOpen) setForm(course || { title: '', description: '', isPublished: false }); }, [isOpen, course]);

    const save = async () => {
        if (!form.title?.trim()) { notify(t('imnci_ui.courses.course_modal.enter_title', 'Enter a course title.'), 'error'); return; }
        setSaving(true);
        try {
            await upsertOnlineCourse({ ...form, title: form.title.trim() });
            notify(t('imnci_ui.courses.course_modal.saved', 'Course saved.'), 'success');
            onSaved(); onClose();
        } catch (e) {
            console.error(e); notify(t('imnci_ui.courses.course_modal.save_failed', 'Could not save the course.'), 'error');
        } finally { setSaving(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={course?.id ? t('imnci_ui.courses.course_modal.edit', 'Edit course') : t('imnci_ui.courses.course_modal.add', 'Add course')}>
            <div className="space-y-4">
                <Input label={t('imnci_ui.courses.common.title', 'Title')} value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Textarea label={t('imnci_ui.courses.common.description', 'Description')} rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
                    {t('imnci_ui.courses.course_modal.published', 'Published (visible to learners)')}
                </label>
                {/* Strict order suits a first pass through IMNCI, which is
                    taught in order; a refresher course or one used in a
                    classroom is better left open. */}
                <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-1" checked={form.lockOrder !== false} onChange={(e) => setForm({ ...form, lockOrder: e.target.checked })} />
                    <span>
                        {t('imnci_ui.courses.course_modal.lock_order', 'Learners open sections in order')}
                        <span className="block text-xs text-slate-500">
                            {t('imnci_ui.courses.course_modal.lock_order_help', 'Each section opens once the one before it is marked complete. Turn off to let learners open any section.')}
                        </span>
                    </span>
                </label>
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>{t('imnci_ui.courses.common.cancel', 'Cancel')}</Button>
                    <Button onClick={save} disabled={saving}>{saving ? t('imnci_ui.courses.common.saving', 'Saving…') : t('imnci_ui.courses.common.save', 'Save')}</Button>
                </div>
            </div>
        </Modal>
    );
}

export function ItemModal({ isOpen, onClose, item, courseId, kind, modules, onSaved }) {
    const { t } = useTranslation();
    const blank = { kind, courseId, title: '', order: 0, isPublished: true };
    const [form, setForm] = useState(item || blank);
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (isOpen) setForm(item || blank); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isOpen, item]);

    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const save = async () => {
        if (!form.title?.trim()) { notify(t('imnci_ui.courses.item_modal.enter_title', 'Enter a title.'), 'error'); return; }
        setSaving(true);
        try {
            await upsertOnlineCourseItem({ ...form, courseId, kind, title: form.title.trim(), order: Number(form.order) || 0 });
            notify(t('imnci_ui.courses.common.saved', 'Saved.'), 'success');
            onSaved(); onClose();
        } catch (e) {
            console.error(e); notify(t('imnci_ui.courses.common.save_failed', 'Could not save.'), 'error');
        } finally { setSaving(false); }
    };

    const isSection = kind === 'section';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={item?.id
            ? (kind === 'section' ? t('imnci_ui.courses.item_modal.edit_section', 'Edit section') : t('imnci_ui.courses.item_modal.edit_module', 'Edit module'))
            : (kind === 'section' ? t('imnci_ui.courses.item_modal.add_section', 'Add section') : t('imnci_ui.courses.item_modal.add_module', 'Add module'))}>
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input label={t('imnci_ui.courses.common.title', 'Title')} value={form.title || ''} onChange={(e) => set('title', e.target.value)} />
                    <Input label={t('imnci_ui.courses.item_modal.order', 'Order')} type="number" inputMode="decimal" value={form.order ?? 0} onChange={(e) => set('order', e.target.value)} />
                </div>

                {isSection && (
                    <>
                        <Select label={t('imnci_ui.courses.item_modal.module', 'Module')} value={form.moduleId || ''} onChange={(e) => set('moduleId', e.target.value)}>
                            <option value="">{t('imnci_ui.courses.item_modal.none', '— none —')}</option>
                            {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                        </Select>
                    </>
                )}

                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.isPublished !== false} onChange={(e) => set('isPublished', e.target.checked)} />
                    {t('imnci_ui.courses.item_modal.published', 'Published')}
                </label>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>{t('imnci_ui.courses.common.cancel', 'Cancel')}</Button>
                    <Button onClick={save} disabled={saving}>{saving ? t('imnci_ui.courses.common.saving', 'Saving…') : t('imnci_ui.courses.common.save', 'Save')}</Button>
                </div>
            </div>
        </Modal>
    );
}
