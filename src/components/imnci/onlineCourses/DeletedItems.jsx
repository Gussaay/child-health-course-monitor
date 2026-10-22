// src/components/imnci/onlineCourses/DeletedItems.jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, RotateCcw } from 'lucide-react';
import { Card, CardBody, Button } from '../../CommonComponents';
import { notify, confirmDialog } from '../../dialogs';
import {
    restoreOnlineCourse, hardDeleteOnlineCourse, restoreOnlineCourseItem, hardDeleteOnlineCourseItem,
} from '../../../data';
import { ASSET_ROOT } from './assets';

// What has been deleted, and the one place it can be got rid of for good.
//
// Deleting a course or a section hides it and records who and when. Nothing
// leaves the database until somebody empties the bin here, which is also the
// only place that removes the pictures from Storage. Two steps, because a
// converted module is a day's work and "delete" is one click away from "edit"
// in a list.
export function DeletedItems({ courses, items, onChanged }) {
    const { t } = useTranslation();
    const kindLabel = (k) => (k === 'course' ? t('imnci_ui.courses.bin.kind_course', 'course')
        : k === 'module' ? t('imnci_ui.courses.bin.kind_module', 'module')
            : k === 'section' ? t('imnci_ui.courses.bin.kind_section', 'section') : k);
    const [busy, setBusy] = useState(null);

    const deletedCourses = courses.filter((c) => c.isDeleted === true);
    const deletedItems = items.filter((i) => i.isDeleted === true);

    const when = (row) => {
        const at = row.deletedAt?.toDate?.() || (row.deletedAt ? new Date(row.deletedAt) : null);
        const who = row.deletedBy ? ' ' + t('imnci_ui.courses.bin.by', 'by {{who}}', { who: row.deletedBy }) : '';
        return at ? `${at.toLocaleDateString()} ${at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${who}`
            : (row.deletedBy ? t('imnci_ui.courses.bin.by', 'by {{who}}', { who: row.deletedBy }) : t('imnci_ui.courses.bin.before_recorded', 'before this was recorded'));
    };

    const restore = async (row) => {
        setBusy(row.id);
        try {
            if (row.kind) await restoreOnlineCourseItem(row.id);
            else await restoreOnlineCourse(row.id);
            notify(t('imnci_ui.courses.bin.restored', 'Restored.'), 'success');
            onChanged();
        } catch (e) {
            console.error('Could not restore:', e);
            notify(t('imnci_ui.courses.bin.restore_failed', 'Could not restore. {{msg}}', { msg: e?.message || '' }).trim(), 'error');
        } finally { setBusy(null); }
    };

    const purgeItem = async (row) => {
        const pictures = [...(row.read || []), ...(row.see || []), ...(row.practise || []), ...(row.blocks || [])]
            .filter((b) => (b.type === 'image' || b.type === 'page') && b.path).length;

        const ok = await confirmDialog(
            t('imnci_ui.courses.bin.purge_item', 'Permanently delete "{{title}}"?', { title: row.title })
            + (pictures ? ' ' + t('imnci_ui.courses.bin.purge_pictures', 'Its {{n}} picture(s) will be removed from storage too.', { n: pictures }) : '')
            + ' ' + t('imnci_ui.courses.bin.cannot_undo', 'This cannot be undone.'),
            { title: t('imnci_ui.courses.bin.delete_for_good', 'Delete for good'), confirmLabel: t('imnci_ui.courses.bin.delete_permanently', 'Delete permanently'), danger: true });
        if (!ok) return;

        setBusy(row.id);
        try {
            // Pictures a surviving section still points at are left alone: two
            // sections that meet on one page of the book share its picture.
            const keep = items
                .filter((i) => i.id !== row.id && i.isDeleted !== true)
                .flatMap((i) => [...(i.read || []), ...(i.see || []), ...(i.practise || []), ...(i.blocks || [])])
                .filter((b) => (b.type === 'image' || b.type === 'page') && b.path)
                .map((b) => `${ASSET_ROOT}/${String(b.path).replace(/^\/+/, '')}`);

            await hardDeleteOnlineCourseItem(row, keep);
            notify(t('imnci_ui.courses.bin.deleted_permanently', 'Deleted permanently.'), 'success');
            onChanged({ onlineCourseItems: [row.id] });
        } catch (e) {
            console.error('Could not delete:', e);
            notify(t('imnci_ui.courses.bin.delete_failed', 'Could not delete. {{msg}}', { msg: e?.message || '' }).trim(), 'error');
        } finally { setBusy(null); }
    };

    const purgeCourse = async (course) => {
        const mine = items.filter((i) => i.courseId === course.id);
        const ok = await confirmDialog(
            t('imnci_ui.courses.bin.purge_course', 'Permanently delete "{{title}}" and everything in it? That is {{modules}} modules and {{sections}} sections, with their pictures.', {
                title: course.title,
                modules: mine.filter((i) => i.kind === 'module').length,
                sections: mine.filter((i) => i.kind === 'section').length,
            })
            + ' ' + t('imnci_ui.courses.bin.cannot_undo', 'This cannot be undone.'),
            { title: t('imnci_ui.courses.bin.delete_whole_course', 'Delete the whole course'), confirmLabel: t('imnci_ui.courses.bin.delete_permanently', 'Delete permanently'), danger: true });
        if (!ok) return;

        setBusy(course.id);
        try {
            await hardDeleteOnlineCourse(course, mine);
            notify(t('imnci_ui.courses.bin.course_deleted', 'The course and everything in it was deleted.'), 'success');
            onChanged({ onlineCourses: [course.id], onlineCourseItems: mine.map((i) => i.id) });
        } catch (e) {
            console.error('Could not delete the course:', e);
            notify(t('imnci_ui.courses.bin.delete_failed', 'Could not delete. {{msg}}', { msg: e?.message || '' }).trim(), 'error');
        } finally { setBusy(null); }
    };

    if (!deletedCourses.length && !deletedItems.length) {
        return (
            <Card><CardBody className="text-center text-slate-500 py-10 text-sm">
                <Trash2 size={24} className="mx-auto mb-2 text-slate-300" />
                {t('imnci_ui.courses.bin.nothing', 'Nothing has been deleted.')}
            </CardBody></Card>
        );
    }

    const row = (thing, label, onPurge) => (
        <li key={thing.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
            <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                <div className="font-medium text-slate-700 truncate">{thing.title || t('imnci_ui.courses.bin.no_title', '(no title)')}</div>
                <div className="text-xs text-slate-500">{t('imnci_ui.courses.bin.deleted_when', '{{kind}} · deleted {{when}}', { kind: kindLabel(label), when: when(thing) })}</div>
            </div>
            <Button variant="secondary" disabled={busy === thing.id} onClick={() => restore(thing)}>
                <RotateCcw size={14} /> {t('imnci_ui.courses.bin.restore', 'Restore')}
            </Button>
            <Button variant="danger" disabled={busy === thing.id} onClick={() => onPurge(thing)}>
                <Trash2 size={14} /> {t('imnci_ui.courses.bin.delete_for_good', 'Delete for good')}
            </Button>
        </li>
    );

    return (
        <div className="space-y-3">
            <div className="px-3 py-2 bg-slate-100 border border-slate-300 rounded text-sm text-slate-700">
                {t('imnci_ui.courses.bin.intro', 'Deleted content is kept here so it can be put back. Emptying it removes the documents and their pictures from storage, and cannot be undone.')}
            </div>

            {deletedCourses.length > 0 && (
                <Card>
                    <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-sm font-bold text-rose-900">
                        {t('imnci_ui.courses.bin.courses_n', 'Courses ({{n}})', { n: deletedCourses.length })}
                    </div>
                    <ul className="divide-y">
                        {deletedCourses.map((c) => row(c, 'course', purgeCourse))}
                    </ul>
                </Card>
            )}

            {deletedItems.length > 0 && (
                <Card>
                    <div className="px-4 py-2 bg-slate-50 border-b text-sm font-bold text-slate-700">
                        {t('imnci_ui.courses.bin.items_n', 'Modules and sections ({{n}})', { n: deletedItems.length })}
                    </div>
                    <ul className="divide-y max-h-[28rem] overflow-y-auto">
                        {deletedItems.map((i) => row(i, i.kind, purgeItem))}
                    </ul>
                </Card>
            )}
        </div>
    );
}
