// src/components/imnci/onlineCourses/ItemModals.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Input, Select, Textarea } from '../../CommonComponents';
import { notify } from '../../dialogs';
import { upsertOnlineCourse, upsertOnlineCourseItem } from '../../../data';
import { COURSE_CATEGORIES, categoryOf, subcategoriesFor } from './categories';
import { courseSavePayload } from './courseForm';

// =============================================================================
// Authoring
// =============================================================================

export function CourseModal({ isOpen, onClose, course, onSaved }) {
    const { t } = useTranslation();
    // New courses need a manager's approval to join unless the author opens them.
    const blank = { title: '', description: '', isPublished: false, enrolment: 'approval', category: '', subcategory: '' };
    const withCategory = (c) => (c ? { ...c, category: categoryOf(c), subcategory: c.subcategory || '', enrolment: c.enrolment || 'approval' } : blank);
    const [form, setForm] = useState(() => withCategory(course));
    const [saving, setSaving] = useState(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (isOpen) setForm(withCategory(course)); }, [isOpen, course]);
    const subOptions = subcategoriesFor(form.category);

    const persist = async (payload, doneMessage) => {
        setSaving(true);
        try {
            await upsertOnlineCourse(payload);
            notify(doneMessage, 'success');
            onSaved(); onClose();
        } catch (e) {
            console.error(e); notify(t('imnci_ui.courses.course_modal.save_failed', 'Could not save the course.'), 'error');
        } finally { setSaving(false); }
    };

    const save = async () => {
        if (!form.title?.trim()) { notify(t('imnci_ui.courses.course_modal.enter_title', 'Enter a course title.'), 'error'); return; }
        await persist(courseSavePayload(form), t('imnci_ui.courses.course_modal.saved', 'Course saved.'));
    };

    // A draft keeps whatever is filled in so far — no title, category or
    // description is demanded — and is never published, so learners do not
    // see it until the author finishes it and publishes it.
    const saveDraft = async () => {
        const untitled = t('imnci_ui.courses.course_modal.untitled_draft', 'Untitled course (draft)');
        await persist(courseSavePayload(form, { draft: true, untitled }), t('imnci_ui.courses.course_modal.saved_draft', 'Saved as draft.'));
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={course?.id ? t('imnci_ui.courses.course_modal.edit', 'Edit course') : t('imnci_ui.courses.course_modal.add', 'Add course')}>
            <div className="space-y-4">
                <Input label={t('imnci_ui.courses.common.title', 'Title')} value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <Textarea label={t('imnci_ui.courses.common.description', 'Description')} rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                {/* Grouped like the face-to-face courses: a package, then a kind of course inside it. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select label={t('imnci_ui.courses.course_modal.category', 'Category')} value={form.category || ''}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}>
                        <option value="">{t('imnci_ui.courses.course_modal.choose', 'Choose…')}</option>
                        {[...new Set([...COURSE_CATEGORIES, form.category].filter(Boolean))].map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                    <div className="flex flex-col">
                        <Input label={t('imnci_ui.courses.course_modal.subcategory', 'Subcategory')} list="oc-subcategories" value={form.subcategory || ''}
                            placeholder={t('imnci_ui.courses.course_modal.subcategory_hint', 'Pick or type, e.g. ETAT Plus')}
                            onChange={(e) => setForm({ ...form, subcategory: e.target.value })} />
                        <datalist id="oc-subcategories">{subOptions.map((s) => <option key={s} value={s} />)}</datalist>
                    </div>
                </div>
                <Select label={t('imnci_ui.courses.course_modal.enrolment', 'Who can join')} value={form.enrolment || 'approval'}
                    onChange={(e) => setForm({ ...form, enrolment: e.target.value })}>
                    <option value="approval">{t('imnci_ui.courses.course_modal.enrolment_approval', 'A manager approves or enrols each learner')}</option>
                    <option value="open">{t('imnci_ui.courses.course_modal.enrolment_open', 'Open: anyone can start, no enrolment needed')}</option>
                </Select>
                <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
                    {t('imnci_ui.courses.course_modal.published', 'Published (visible to learners)')}
                </label>
                {/* While the course is a draft, only managers and the testers
                    named here can see and open it. One email per line. */}
                {!form.isPublished && (
                    <div>
                        <Textarea label={t('imnci_ui.courses.course_modal.testers', 'Testers (invited by email)')} rows={3}
                            value={Array.isArray(form.testers) ? form.testers.join('\n') : (form.testers || '')}
                            placeholder={t('imnci_ui.courses.course_modal.testers_placeholder', 'One email address per line')}
                            onChange={(e) => setForm({ ...form, testers: e.target.value })} />
                        <p className="mt-1 text-xs text-slate-500">
                            {t('imnci_ui.courses.course_modal.testers_hint', 'While this course is a draft, only managers and these people can see and open it, so it can be tested before publishing. They sign in with this email address. Publishing the course opens it to everyone as usual.')}
                        </p>
                    </div>
                )}
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
                {/* A modular course (Small & Sick Newborn): each module is a
                    unit of its own that can be shared and finished alone. */}
                {form.lockOrder !== false && (
                    <label className="flex items-start gap-2 text-sm ms-6">
                        <input type="checkbox" className="mt-1" checked={form.modulesAnyOrder === true} data-testid="modules-any-order"
                            onChange={(e) => setForm({ ...form, modulesAnyOrder: e.target.checked })} />
                        <span>
                            {t('imnci_ui.courses.course_modal.modules_any_order', 'Each module can be taken on its own')}
                            <span className="block text-xs text-slate-500">
                                {t('imnci_ui.courses.course_modal.modules_any_order_help', 'Every module opens without finishing the one before it. The lessons inside a module are still read in order.')}
                            </span>
                        </span>
                    </label>
                )}
                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>{t('imnci_ui.courses.common.cancel', 'Cancel')}</Button>
                    <Button variant="secondary" onClick={saveDraft} disabled={saving}
                        title={t('imnci_ui.courses.course_modal.save_draft_title', 'Keep the course unpublished and save whatever is filled in so far')}>
                        {t('imnci_ui.courses.course_modal.save_draft', 'Save as draft')}
                    </Button>
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

                {!isSection && (
                    // A reference module (procedures, equipment): other
                    // modules link to the lesson they need, so all open.
                    <label className="flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-1" checked={form.anyOrder === true} data-testid="module-any-order"
                            onChange={(e) => set('anyOrder', e.target.checked)} />
                        <span>
                            {t('imnci_ui.courses.item_modal.any_order', 'Reference module: its lessons open in any order')}
                            <span className="block text-xs text-slate-500">
                                {t('imnci_ui.courses.item_modal.any_order_help', 'For procedures or equipment that other lessons link to.')}
                            </span>
                        </span>
                    </label>
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
